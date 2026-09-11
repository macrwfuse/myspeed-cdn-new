import schedule from 'node-schedule';
import {isValidCron} from "cron-validator";
import * as settings from '../util/nodeUpdateSettings.js';
import {updateProvider} from '../util/nodeUpdater.js';

/**
 * Ookla / LibreSpeed 节点的定时健康检查与自动替换。
 *
 * CDN 不在这里 —— 它由容器调度器(docker/cdn-scheduler.mjs)执行, 因为那套流程需要
 * 改写 servers.js 源码并重启 server 进程。这里的两个服务商只更新 overlay 文件并清缓存,
 * 无需重启即可生效。
 *
 * 定时器在启动时按配置 arm, 配置变更时由 server/routes/config.js 重启。
 */

const jobs = {};
let running = {};

const run = async (provider) => {
    // 上一轮还没跑完就跳过, 避免慢链路下任务堆叠
    if (running[provider]) {
        console.warn(`[node-update] ${provider} 上一轮尚未结束, 跳过本次触发`);
        return;
    }

    running[provider] = true;
    const startedAt = Date.now();

    try {
        const config = (await settings.read())[provider];
        console.log(`[node-update] ${provider} 开始 (cron=${config.cron})`);

        const summary = await updateProvider(provider, config);
        const cost = ((Date.now() - startedAt) / 1000).toFixed(1);

        if (summary.dead.length) {
            console.log(`[node-update] ${provider} 完成 耗时${cost}s — 失效: ${summary.dead.join(', ')}` +
                (summary.promoted.length ? ` | 补位: ${summary.promoted.join(', ')}` : ' | 备用池无可用补位节点'));
        } else {
            console.log(`[node-update] ${provider} 完成 耗时${cost}s — 全部 ${summary.checked} 个节点正常`);
        }
    } catch (e) {
        console.error(`[node-update] ${provider} 失败:`, e?.stack || e);
    } finally {
        running[provider] = false;
    }
}

export const startTimers = async () => {
    stopTimers();

    const config = await settings.read();

    for (const provider of ["ookla", "libre"]) {
        const {enabled, cron} = config[provider];
        if (!enabled) continue;

        if (!isValidCron(cron)) {
            console.warn(`[node-update] ${provider} 的 cron 表达式无效(${cron}), 已跳过`);
            continue;
        }

        jobs[provider] = schedule.scheduleJob(cron, () => run(provider));
        console.log(`[node-update] ${provider} 自动更新已启用: ${cron}`);
    }
}

export const stopTimers = () => {
    for (const provider of Object.keys(jobs)) {
        try {
            jobs[provider]?.cancel();
        } catch { /* 忽略 */ }
        delete jobs[provider];
    }
}

/**
 * 配置变更后重建定时器。
 * 串行化: 页面保存会并发发出多个 PATCH, 每个都会调用本函数; 若并发执行
 * stop/start 可能重复 arm 出多个 job, 导致同一轮更新被触发多次。
 */
let queue = Promise.resolve();

export const reload = () => {
    const next = queue.then(async () => {
        stopTimers();
        await startTimers();
    });

    queue = next.catch(() => { /* 单次失败不阻塞后续 */ });
    return next;
};

/** 供配置变更后立即跑一轮(便于用户验证设置是否生效) */
export const runOnce = (provider) => run(provider);
