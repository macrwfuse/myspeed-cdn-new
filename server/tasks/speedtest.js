import speedTest from '../util/speedtest.js';
import * as tests from '../controller/speedtests.js';
import * as config from '../controller/config.js';
import * as controller from "../controller/recommendations.js";
import * as parseData from '../util/providers/parseData.js';
import { setState, sendRunning, sendError, sendFinished } from "./integrations.js";
import * as serverController from "../controller/servers.js";

let _isRunning = false;

const setRunning = (running, sendRequest = true) => {
    _isRunning = running;

    if (running) {
        setState("running");
        if (sendRequest) sendRunning().then(undefined);
    } else {
        setState("ping");
    }
}

const createRecommendations = async () => {
    let list = (await tests.listTests()).filter((entry) => !entry.error);
    if (list.length >= 10) {
        let recommendations = {ping: 1000, down: 0, up: 0};
        for (let i = 0; i < 10; i++) {
            if (list[i].ping < recommendations["ping"]) recommendations["ping"] = list[i].ping;
            if (list[i].download > recommendations["down"]) recommendations["down"] = list[i].download;
            if (list[i].upload > recommendations["up"]) recommendations["up"] = list[i].upload;
        }

        await controller.update(recommendations["ping"], recommendations["down"], recommendations["up"]);
    }
}

export const run = async (retryAuto = false) => {
    setRunning(true);
    let mode = await config.getValue("provider");

    if (mode === "none") {
        setRunning(false);
        throw {message: "No provider selected"};
    }

    let serverId = mode === "cloudflare" ? 0 : await config.getValue(mode + "Id");
    let serverUrl = mode === "libre" ? await config.getValue("libreUrl") : undefined;

    if (serverId === "none")
        serverId = undefined;

    // 未指定节点时默认使用上海电信 (3633)
    if (serverId === undefined && mode === "ookla") serverId = "3633";
    // CDN 模式默认使用 Cloudflare 25MB 节点
    if (serverId === undefined && mode === "cdn") serverId = "cdn-cloudflare-25m";
    
    if (serverUrl === "none")
        serverUrl = undefined;

    if (mode === "libre" && serverUrl)
        serverId = undefined;

    let speedtest = await (retryAuto ? speedTest(mode) : speedTest(mode, serverId, serverUrl));

    if (mode === "ookla" && speedtest.server) {
        if (serverId === undefined) await config.updateValue("ooklaId", speedtest.server?.id);
        serverId = speedtest.server?.id;
    }

    if (mode === "libre" && speedtest.server && !serverUrl) {
        let serverEntry = Object.entries(serverController.getLibreServers())
            .filter(([, value]) => value === speedtest.server.name)[0];

        if (serverEntry) {
            if (serverId === undefined) await config.updateValue("libreId", serverEntry[0]);
            serverId = parseInt(serverEntry[0]);
        }
    }

    // CDN 模式直接返回 serverId
    if (mode === "cdn") {
        speedtest.serverId = serverId;
    }

    if (Object.keys(speedtest).length <= 1) throw {message: "No response, even after trying again, test timed out."};

    return {...speedtest, serverId}
}

export const create = async (type = "auto", retried = false) => {
    const mode = await config.getValue("provider");
    if (mode === "none") return 400;
    if (_isRunning && !retried) return 500;

    try {
        let test;
        if (process.env.PREVIEW_MODE === "true") {
            await new Promise(resolve => setTimeout(resolve, 5000));
            test = {
                ping: {latency: Math.floor(Math.random() * 25) + 5, jitter: Math.random() * 5 + 0.5},
                download: {bandwidth: 125 * 100000 * (Math.random() + 0.5), elapsed: 10000},
                upload: {bandwidth: 125 * 100000 * (Math.random() + 0.5), elapsed: 10000},
            }
        } else {
            test = await run(retried);
        }

        let {ping, jitter, download, upload, time, resultId, serverName, serverHost} = await parseData.parseData(process.env.PREVIEW_MODE === "true" ?
            "ookla" : mode, test);

        let testResult = await tests.create(ping, download, upload, time, test.serverId, type, resultId, null, jitter, serverName, serverHost);
        console.log(`Test #${testResult} was executed successfully in ${time}s. 🏓 ${ping} (±${jitter || 'N/A'}) ⬇ ${download}️ ⬆ ${upload}️`);
        createRecommendations().then(() => "");
        setRunning(false);
        sendFinished({ping, jitter, download, upload, time}).then(() => "");
    } catch (e) {
        console.log(e)
        // Ensure error message is always a string (not object/array)
        let errorMsg = e.message;
        if (typeof errorMsg === 'object') {
            try { errorMsg = JSON.stringify(errorMsg); } catch { errorMsg = String(errorMsg); }
        }
        if (typeof errorMsg !== 'string') errorMsg = String(errorMsg || "Unknown error");

        // Friendly message for missing binary
        if (errorMsg.includes('ENOENT') && errorMsg.includes('speedtest')) {
            errorMsg = "测速组件未找到，请确认 bin 目录中包含对应组件";
        }

        // Auto-fallback: if Ookla/Libre binary fails (NoServersException, ENOENT, etc.),
        // retry once
        if (!retried && (mode === "ookla" || mode === "libre")) {
            console.log(`⚠️ ${mode} 模式失败 (${errorMsg})，自动重试...`);
        }

        if (!retried) return create(type, true);
        let testResult = await tests.create(-1, -1, -1, null, 0, type, null, errorMsg);
        await sendError(errorMsg);
        setRunning(false, false);
        console.log(`Test #${testResult} was not executed successfully: ` + errorMsg);
    }
}

export const isRunning = () => _isRunning;

export const removeOld = async () => {
    await tests.removeOld();
};