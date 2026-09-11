import fs from 'node:fs';
import path from 'node:path';
import * as config from '../controller/config.js';

/**
 * 节点自动更新设置的共享副本。
 *
 * 页面上的开关/定时存在数据库(见 server/controller/config.js 的 configDefaults),
 * 但 CDN 的更新动作由容器调度器 docker/cdn-scheduler.mjs 执行 —— 它是独立进程,
 * 读不到数据库。因此服务端把配置镜像到这个 JSON 文件(位于持久化卷 data/ 下),
 * 调度器轮询它即可在无需重启容器的情况下生效。
 *
 * ⚠️ 不要改成直接读写数据库: 调度器可能运行在 MySQL 后端下, 无法访问数据库。
 */

export const SETTINGS_FILE = path.join('data', 'node-update.json');

/** 从数据库读当前配置, 组装成调度器与定时任务共用的结构 */
export const read = async () => {
    const int = async (key, fallback) => {
        const n = parseInt(await config.getValue(key), 10);
        return Number.isFinite(n) && n > 0 ? n : fallback;
    };

    return {
        ookla: {
            enabled: (await config.getValue("ooklaUpdateEnabled")) === "true",
            cron: await config.getValue("ooklaUpdateCron"),
            maxPing: await int("ooklaUpdateMaxPing", 100)
        },
        libre: {
            enabled: (await config.getValue("libreUpdateEnabled")) === "true",
            cron: await config.getValue("libreUpdateCron")
        },
        cdn: {
            enabled: (await config.getValue("cdnUpdateEnabled")) === "true",
            cron: await config.getValue("cdnUpdateCron"),
            // CDN 更新现已由服务端进程内完成(server/util/cdnUpdater.js), 不再需要
            // 容器调度器改写 servers.js 并重启。调度器看到此标记就只监督 server,
            // 不再执行自己的 CDN 周期, 避免两边重复更新、互相覆盖。
            handledByServer: true
        }
    };
}

/** 写共享文件。CDN 调度器靠它决定是否执行以及何时执行。 */
export const sync = async () => {
    const settings = await read();

    try {
        fs.mkdirSync(path.dirname(SETTINGS_FILE), {recursive: true});
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    } catch (e) {
        console.error("Could not write node update settings:", e.message);
    }

    return settings;
}
