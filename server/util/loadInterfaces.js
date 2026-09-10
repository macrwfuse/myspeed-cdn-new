import os from 'node:os';
import https from 'node:https';
import * as config from '../controller/config.js';
import { fixMojibake } from './fixMojibake.js';

export let interfaces = {};

export const requestInterfaces = async () => {
    let interfacesNode = os.networkInterfaces();
    let interfacesResult = {};

    console.log("Looking for network interfaces...");
    for (let rawName in interfacesNode) {
        // Bun 在 Windows 下会把网卡名按 Latin-1 解码（"以太网" → "ä»¥å¤ªç½"），此处还原
        const i = fixMojibake(rawName);
        for (let j in interfacesNode[rawName]) {
            let address = interfacesNode[rawName][j];

            if (address.internal) continue;

            let options = {hostname: "speed.cloudflare.com", path: "/__down?bytes=1", method: "GET",
                family: address.family === "IPv4" ? 4 : 6, timeout: 5000};

            options.agent = new https.Agent(options);
            options.localAddress = address.address;

            await new Promise((resolve) => {

                const req = https.request(options, () => {
                    if (!interfacesResult[i]) interfacesResult[i] = [];
                    interfacesResult[i].push(address.address);
                    req.destroy();
                    resolve();
                });

                req.on('error', () => resolve());
                req.on('timeout', () => req.destroy());

                req.end();
            });
        }

        if (!interfacesResult[i]) delete interfacesResult[i];
    }

    for (let i in interfacesResult) {
        for (let j in interfacesResult[i]) {
            if (interfacesResult[i][j].includes(".")) {
                interfaces[i] = interfacesResult[i][j];
                break;
            }
        }

        if (!interfaces[i]) interfaces[i] = interfacesResult[i][0];
    }

    for (let i in interfaces) {
        console.log(`Found interface ${i} with IP ${interfaces[i]}`);
    }

    const storedInterface = await config.getValue("interface");
    const currentInterface = fixMojibake(storedInterface);

    // 历史配置中可能保存了乱码网卡名: 修复后能匹配到有效网卡则回写
    if (storedInterface && currentInterface !== storedInterface && interfaces[currentInterface]) {
        console.log(`Fixed mojibake interface name: ${storedInterface} -> ${currentInterface}`);
        await config.updateValue("interface", currentInterface);
    }

    if (!interfaces[currentInterface]) {
        if (!currentInterface) {
            console.warn("No interface set. Falling back to default.");
        } else {
            console.warn(`Interface ${currentInterface} not found. Falling back to default.`);
        }
        await config.updateValue("interface", Object.keys(interfaces)[0]);
    }
};