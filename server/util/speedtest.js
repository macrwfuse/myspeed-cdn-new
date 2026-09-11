import { spawn } from 'node:child_process';
import * as interfacesModule from '../util/loadInterfaces.js';
import * as config from '../controller/config.js';
import fs from 'node:fs';
import path from 'node:path';
import { runCdnSpeedtest } from './providers/cdnSpeedtest.js';

export default async (mode, serverId, serverUrl) => {
    // CDN 模式不使用外部二进制，直接通过 HTTP 测速
    if (mode === "cdn") {
        const { getCdnServers } = await import("../controller/servers.js");
        const allServers = getCdnServers();

        // 选中的节点可能已被下架(如实测不可达的 cdn-cachefly)。直接抛错会让配置里
        // 仍指向该节点的实例从此每次定时测速都失败, 因此回退到默认节点并留下告警。
        let serverEntry = allServers[serverId];
        if (!serverEntry) {
            console.warn(`CDN 节点 ${serverId} 已不存在, 本次回退到 cdn-cloudflare-25m`);
            serverEntry = allServers["cdn-cloudflare-25m"];
        }
        if (!serverEntry) throw new Error(`CDN 节点 ${serverId} 不存在`);

        return await runCdnSpeedtest(serverEntry);
    }

    const binaryPath = mode === "ookla" ? './bin/speedtest' + (process.platform === "win32" ? ".exe" : "")
        : mode === "libre" ? './bin/librespeed-cli' + (process.platform === "win32" ? ".exe" : "")
            : './bin/cfspeedtest' + (process.platform === "win32" ? ".exe" : "");

    // Check if binary exists before trying to spawn
    if (!fs.existsSync(binaryPath)) {
        throw new Error(`测速组件 ${binaryPath} 不存在，请确认 bin 目录中包含对应组件`);
    }

    if (!interfacesModule.interfaces) throw new Error("No interfaces found");

    const currentInterface = await config.getValue("interface");
    const interfaceIp = interfacesModule.interfaces[currentInterface];

    const startTime = new Date().getTime();
    let args;

    if (mode === "ookla") {
        args = ['--accept-license', '--accept-gdpr', '--format=json'];

        if (process.platform === "win32") {
            args.push('--ip=' + interfaceIp);
        } else {
            args.push('--interface=' + currentInterface);
        }

        if (serverId) args.push(`--server-id=${serverId}`);
    } else if (mode === "libre") {
        // 并发与下载块数调优: 教育网 LibreSpeed 节点单连接带宽受限, 默认并发 3 会
        // 严重低估下载(实测 ZJU: c=3 仅 22.7 Mbps, c=8 达 430+ Mbps);
        // 上传单流即可吃满不受影响。--chunks/--upload-size 同步调大避免部分
        // 节点默认块数不足/上传负载过小导致中断或数值失真。
        args = ['--json', '--duration=5', '--concurrent=8', '--chunks=256', '--upload-size=4096', '--source=' + interfaceIp];
        if (serverUrl) {
            const customServerConfig = [{
                id: 1,
                name: "Custom Server",
                server: serverUrl,
                dlURL: "garbage.php",
                ulURL: "empty.php",
                pingURL: "empty.php",
                getIpURL: "getIP.php"
            }];
            const tempJsonPath = path.join('data', 'servers', 'libre_custom.json');
            fs.writeFileSync(tempJsonPath, JSON.stringify(customServerConfig));
            args.push(`--local-json=${tempJsonPath}`);
            args.push('--server=1');
        } else if (serverId) {
            // 支持字符串 ID (如 "cn-edu-zju") 通过本地 JSON 传递节点配置
            if (/[^0-9]/.test(String(serverId))) {
                const { getLibreServers } = await import("../controller/servers.js");
                const allServers = getLibreServers();
                const serverEntry = allServers[serverId];
                if (serverEntry) {
                    const serverConfig = [{
                        id: 1,
                        name: serverEntry.name || "Selected Server",
                        server: serverEntry.server,
                        dlURL: serverEntry.dlURL || "garbage.php",
                        ulURL: serverEntry.ulURL || "empty.php",
                        pingURL: serverEntry.pingURL || "empty.php",
                        getIpURL: serverEntry.getIpURL || "getIP.php"
                    }];
                    const tempJsonPath = path.join('data', 'servers', 'libre_selected.json');
                    fs.writeFileSync(tempJsonPath, JSON.stringify(serverConfig));
                    args.push(`--local-json=${tempJsonPath}`);
                    args.push('--server=1');
                } else {
                    args.push(`--server=${serverId}`);
                }
            } else {
                args.push(`--server=${serverId}`);
            }
        }
    } else if (mode === "cloudflare") {
        args = ['--output-format=json'];

        if (interfaceIp.includes(':')) {
            args.push('--ipv6=' + interfaceIp);
        } else {
            args.push('--ipv4=' + interfaceIp);
        }
    }

    let result = {};
    let stdout = '';

    const testProcess = spawn(binaryPath, args, {windowsHide: true});

    testProcess.stderr.on('data', (buffer) => {
        result.error = buffer.toString();
        if (buffer.toString().includes("Too many requests")) {
            result.error = "Too many requests. Please try again later";
        }
    });

    testProcess.stdout.on('data', (buffer) => {
        stdout += buffer.toString();
    });

    await new Promise((resolve, reject) => {
        testProcess.on('error', e => reject({message: e}));
        testProcess.on('exit', () => {
            if (stdout.trim()) {
                const lines = stdout.trim().split('\n');
                for (const line of lines) {
                    if (!(line.startsWith("{") || line.startsWith("["))) continue;

                    let data = {};
                    try {
                        data = JSON.parse(line);
                        if (line.startsWith("[") && mode !== "cloudflare") data = data[0];
                    } catch (e) {
                        data.error = e.message;
                        console.error("JSON parse error:", e.message, "Line:", line);
                        continue;
                    }

                    if (data.error) result.error = data.error;

                    if ((mode === "ookla" && data.type === "result") || mode === "libre" || mode === "cloudflare") {
                        result = data;
                    }
                }
            }
            resolve();
        });
    });

    if (result.error) throw new Error(result.error);
    return {...result, elapsed: new Date().getTime() - startTime};
}
