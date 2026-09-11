import fs from 'node:fs';
import path from 'node:path';
import {clearServerCache, getLibreServers, getOoklaServers, LIBRE_CN_SERVERS, OOKLA_CN_SERVERS} from '../controller/servers.js';

/**
 * Ookla / LibreSpeed 节点的运行时健康检查与自动替换。
 *
 * 定时任务(server/tasks/nodeUpdate.js)每轮调用一次 updateProvider():
 *   1. 拉取备用池 —— Ookla 用官方目录 API, LibreSpeed 用 librespeed.org 清单, 逐个探活;
 *   2. 体检当前"在用节点", 连续 FAILS_BEFORE_REPLACE 轮探活失败才判定失效;
 *   3. 把失效节点移入 overlay 的 removed(墓碑), 并从备用池提拔等量节点补位;
 *   4. 写 overlay 文件并清掉 servers.js 的模块级缓存, 新列表立即生效(无需重启)。
 *
 * 为什么不直接改写 servers.js 里的常量: 内置节点是静态 import, 改写源码后当前进程
 * 也不会重新加载, 必须重启。overlay 文件让运行时替换无需重启, 且能"删除"内置节点。
 *
 * ⚠️ overlay 必须与 data/servers/ookla.json 分开: 那个文件由 util/loadServers.js 管理,
 *    其 isCurrent() 判定不通过时会整个覆盖重写, 写进去的墓碑会丢失。这里用独立文件。
 */

const SERVERS_DIR = path.join('data', 'servers');

const OVERLAY_FILES = {
    ookla: path.join(SERVERS_DIR, 'ookla-managed.json'),
    libre: path.join(SERVERS_DIR, 'librespeed-managed.json')
};

// ── 探测参数 ──
const SAMPLES = 3;              // 每个节点采样次数(全失败才判本轮失败)
const LATENCY_TIMEOUT = 8000;
const CONCURRENCY = 6;
const POOL_MAX = 20;            // 备用池上限(延迟达标的节点)
const RESERVE_MAX = 10;         // 后备池上限(活着但延迟超标, 仅在池耗尽时启用)
const FAILS_BEFORE_REPLACE = 2; // 连续失败多少轮才替换(防止网络抖动导致反复替换)
const PROBE_MAX_NODES = 40;     // 单轮体检的在用节点上限, 约束单轮耗时

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Ookla 官方目录 API 校验来源, 缺 Referer/Origin 会 403
const DIRECTORY_HEADERS = {
    'User-Agent': BROWSER_UA,
    'Referer': 'https://www.speedtest.net/',
    'Origin': 'https://www.speedtest.net',
    'Accept': 'application/json'
};

const log = (...a) => console.log('[node-update]', ...a);

// ═══════════════════════════════════════════════════
//  工具
// ═══════════════════════════════════════════════════

async function timedFetch(url, opts = {}, timeout = LATENCY_TIMEOUT) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeout);
    const t0 = Date.now();
    try {
        const res = await fetch(url, {...opts, signal: ac.signal});
        return {res, ms: Date.now() - t0};
    } finally {
        clearTimeout(t);
    }
}

async function pool(items, limit, worker) {
    const out = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({length: Math.min(limit, items.length)}, async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) return;
            out[i] = await worker(items[i], i);
        }
    }));
    return out;
}

// ═══════════════════════════════════════════════════
//  overlay 读写
// ═══════════════════════════════════════════════════

const emptyOverlay = () => ({pool: {}, reserve: {}, nodes: {}, removed: [], state: {}});

export const readOverlay = (provider) => {
    try {
        const parsed = JSON.parse(fs.readFileSync(OVERLAY_FILES[provider], 'utf8'));
        return {
            pool: parsed.pool ?? {},
            reserve: parsed.reserve ?? {},
            nodes: parsed.nodes ?? {},
            removed: Array.isArray(parsed.removed) ? parsed.removed : [],
            state: parsed.state ?? {}
        };
    } catch {
        return emptyOverlay();
    }
}

const writeOverlay = (provider, data) => {
    fs.mkdirSync(SERVERS_DIR, {recursive: true});
    fs.writeFileSync(OVERLAY_FILES[provider], JSON.stringify(data, null, 2));
}

// ═══════════════════════════════════════════════════
//  探活
// ═══════════════════════════════════════════════════

/**
 * Ookla 协议探活: GET /speedtest/latency.txt 期望 200 + "test=test"。
 * 返回采样中的最小 RTT(最接近真实往返时延, 消除排队抖动); 全部失败返回 null。
 */
export async function probeOokla(host) {
    let best = null;
    for (let i = 0; i < SAMPLES; i++) {
        try {
            const {res, ms} = await timedFetch(`http://${host}/speedtest/latency.txt?x=${i}`);
            const body = (await res.text()).trim();
            if (res.status !== 200 || !/test=test/.test(body)) return best;
            best = best === null ? ms : Math.min(best, ms);
        } catch {
            break;
        }
    }
    return best;
}

/** LibreSpeed 探活: empty.php 取延迟, garbage.php 确认下载端可用 */
export async function probeLibre(entry) {
    const base = String(entry.server || '').replace(/\/+$/, '');
    if (!base) return null;

    try {
        const ping = await timedFetch(`${base}/${entry.pingURL || 'empty.php'}`, {}, LATENCY_TIMEOUT);
        if (ping.res.status !== 200) return null;

        // 下载端不可用(如 403/404)不算可用节点, 否则测速时会失败
        const dl = await timedFetch(`${base}/${entry.dlURL || 'garbage.php'}?ckSize=1`, {}, LATENCY_TIMEOUT);
        if (dl.res.status !== 200) return null;
        await dl.res.arrayBuffer();

        return ping.ms;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════
//  备用池
// ═══════════════════════════════════════════════════

/** 从 Ookla 官方目录拉候选(权威来源: CLI 只认目录内的节点) */
async function fetchOoklaDirectory(search) {
    const url = `https://www.speedtest.net/api/js/servers?engine=js&limit=500&search=${encodeURIComponent(search)}`;
    const {res} = await timedFetch(url, {headers: DIRECTORY_HEADERS}, 30000);
    if (!res.ok) throw new Error(`directory HTTP ${res.status}`);

    const list = await res.json();
    return list.map(s => ({
        id: String(s.id),
        name: s.name,
        sponsor: s.sponsor,
        country: s.cc === 'HK' ? 'Hong Kong' : s.country,
        cc: s.cc,
        distance: typeof s.distance === 'number' ? Math.round(s.distance) : 0,
        host: s.host
    }));
}

/**
 * Ookla 备用池: 目录候选 → 探活 → 分两档
 *   pool    延迟达标(<= maxPing)的最优节点 —— 首选补位来源
 *   reserve 活着但延迟超标 —— 仅在 pool 用尽时兜底
 *
 * 为什么需要 reserve: 在用列表本身就是按"延迟达标"筛出来的, 所以目录里达标的节点
 * 基本都已在用, pool 常常没有可补的余量。此时用"慢但活着"的节点替换"死的"节点
 * 仍然严格更好(死节点完全不可用)。实测 13 个在用节点全部达标, pool 无余量。
 */
export async function fetchOoklaPool(maxPing = 100) {
    const candidates = [];
    for (const search of ['China', 'Hong Kong']) {
        try {
            candidates.push(...await fetchOoklaDirectory(search));
        } catch (e) {
            log(`拉取 Ookla 目录(${search})失败: ${e.message}`);
        }
    }

    // 同 ID 去重(两份搜索可能重叠)
    const unique = [...new Map(candidates.map(c => [c.id, c])).values()];
    const probed = await pool(unique, CONCURRENCY, async node => ({
        node, ping: await probeOokla(node.host)
    }));

    const alive = probed
        .filter(({ping}) => ping !== null)
        .sort((a, b) => a.ping - b.ping)
        .map(({node, ping}) => ({...node, pingMs: ping, addedAt: new Date().toISOString()}));

    return {
        pool: alive.filter(n => n.pingMs <= maxPing).slice(0, POOL_MAX),
        reserve: alive.filter(n => n.pingMs > maxPing).slice(0, RESERVE_MAX)
    };
}

/** LibreSpeed 备用池: librespeed.org 清单 → 探活(无延迟门槛, 可用的都留) */
export async function fetchLibrePool() {
    const {res} = await timedFetch('https://librespeed.org/backend-servers/servers.php', {}, 30000);
    if (!res.ok) throw new Error(`librespeed HTTP ${res.status}`);

    const list = await res.json();
    const probed = await pool(list, CONCURRENCY, async row => ({
        row, ping: await probeLibre(row)
    }));

    const poolNodes = probed
        .filter(({ping}) => ping !== null)
        .sort((a, b) => a.ping - b.ping)
        .slice(0, POOL_MAX)
        .map(({row, ping}) => ({
            // 池节点用非数字 id: server/util/speedtest.js 对非数字 id 走 --local-json
            // 直接下发完整配置, 不依赖 librespeed-cli 内置节点表
            id: `libre-pool-${row.id}`,
            name: row.name,
            server: row.server,
            dlURL: row.dlURL || 'garbage.php',
            ulURL: row.ulURL || 'empty.php',
            pingURL: row.pingURL || 'empty.php',
            getIpURL: row.getIpURL || 'getIP.php',
            pingMs: ping,
            addedAt: new Date().toISOString()
        }));

    return {pool: poolNodes, reserve: []};
}

// ═══════════════════════════════════════════════════
//  更新主流程
// ═══════════════════════════════════════════════════

const probeFor = (provider, entry) =>
    provider === 'ookla' ? probeOokla(entry.host) : probeLibre(entry);

/** 受管节点: 内置节点 + 上一轮提拔进列表的节点 */
const managedIds = (provider, overlay) => {
    const builtIn = provider === 'ookla' ? OOKLA_CN_SERVERS : LIBRE_CN_SERVERS;
    return [...new Set([...Object.keys(builtIn), ...Object.keys(overlay.nodes)])];
}

/**
 * 跑一轮更新。返回一份摘要(供日志/报告使用)。
 * @param {'ookla'|'libre'} provider
 * @param {{maxPing?: number}} opts
 */
export async function updateProvider(provider, opts = {}) {
    const overlay = readOverlay(provider);
    const inUse = provider === 'ookla' ? getOoklaServers() : getLibreServers();

    // ── 1. 刷新备用池 ──
    let freshPool, freshReserve;
    try {
        const fetched = provider === 'ookla'
            ? await fetchOoklaPool(opts.maxPing ?? 100)
            : await fetchLibrePool();
        freshPool = fetched.pool;
        freshReserve = fetched.reserve;
    } catch (e) {
        log(`${provider}: 备用池拉取失败, 保留原有池 — ${e.message}`);
        freshPool = Object.values(overlay.pool);
        freshReserve = Object.values(overlay.reserve);
    }
    log(`${provider}: 备用池 ${freshPool.length} 个达标` +
        (freshReserve.length ? ` + ${freshReserve.length} 个后备(延迟超标)` : ''));

    // ── 2. 体检在用节点 ──
    // 已知节点 = 内置节点 + 上一轮提拔的节点。注意这里用的是"未套用墓碑"的全集,
    // 否则被移除的节点查不到配置就无从探活, 也就永远无法在恢复后自动回来。
    const builtIn = provider === 'ookla' ? OOKLA_CN_SERVERS : LIBRE_CN_SERVERS;
    const known = {...builtIn, ...overlay.nodes};

    const ids = managedIds(provider, overlay).slice(0, PROBE_MAX_NODES);
    const removed = new Set(overlay.removed);
    const state = {...overlay.state};
    const nodes = {...overlay.nodes};

    const checks = await pool(ids, CONCURRENCY, async id => ({
        id, ping: await probeFor(provider, known[id] ?? {})
    }));

    const deadNow = [];
    const revived = [];

    for (const {id, ping} of checks) {
        const wasRemoved = removed.has(id);

        if (ping !== null) {
            state[id] = {fails: 0, lastCheck: new Date().toISOString(), pingMs: ping};

            // 之前判定失效的节点又活了 → 撤销墓碑, 自动回到列表
            if (wasRemoved) {
                removed.delete(id);
                revived.push(id);
            }
            continue;
        }

        // 已移除的节点不再累计失败, 保持移除状态等它恢复
        if (wasRemoved) {
            state[id] = {fails: FAILS_BEFORE_REPLACE, lastCheck: new Date().toISOString(), pingMs: null};
            continue;
        }

        const fails = (state[id]?.fails ?? 0) + 1;
        state[id] = {fails, lastCheck: new Date().toISOString(), pingMs: null};

        if (fails >= FAILS_BEFORE_REPLACE) {
            removed.add(id);
            delete nodes[id];
            deadNow.push(id);
        } else {
            log(`${provider}: ${id} 本轮探活失败 (${fails}/${FAILS_BEFORE_REPLACE}), 暂不替换`);
        }
    }

    if (revived.length) log(`${provider}: ${revived.join(', ')} 已恢复, 撤销移除标记`);

    // ── 3. 从池中提拔补位 —— 失效几个补几个, 保持列表规模稳定 ──
    const promoteCount = deadNow.length;
    const activeIds = new Set([...Object.keys(inUse), ...Object.keys(nodes)]);

    const promoted = [];
    // 先用达标节点; 达标池耗尽(常见: 在用列表本身就是达标节点)再退而用后备
    for (const tier of [freshPool, freshReserve]) {
        for (const candidate of tier) {
            if (promoted.length >= promoteCount) break;
            if (activeIds.has(candidate.id)) continue;

            nodes[candidate.id] = candidate;
            activeIds.add(candidate.id);
            promoted.push(candidate.id);
        }
        if (promoted.length >= promoteCount) break;
    }
    if (promoted.length < promoteCount) {
        log(`${provider}: 备用池不足以全部补位(需 ${promoteCount}, 实补 ${promoted.length})`);
    }

    // ── 4. 清理: 非内置节点不需要墓碑(从 nodes 移除即已不在列表中), 只留内置节点的 ──
    const prunedRemoved = [...removed].filter(id => builtIn[id] !== undefined);

    writeOverlay(provider, {
        pool: Object.fromEntries(freshPool.map(n => [n.id, n])),
        reserve: Object.fromEntries(freshReserve.map(n => [n.id, n])),
        nodes,
        removed: prunedRemoved,
        state
    });
    clearServerCache();

    const summary = {
        provider,
        poolSize: freshPool.length,
        reserveSize: freshReserve.length,
        checked: checks.length,
        dead: deadNow,
        revived,
        promoted,
        removedTotal: prunedRemoved.length
    };
    log(`${provider}: 体检 ${checks.length} 个, 失效 ${deadNow.length}, 补位 ${promoted.length}, ` +
        `恢复 ${revived.length}, 墓碑共 ${prunedRemoved.length}`);

    return summary;
}
