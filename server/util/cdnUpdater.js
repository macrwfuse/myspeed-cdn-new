import fs from 'node:fs';
import path from 'node:path';
import {clearServerCache, getCdnServers} from '../controller/servers.js';
import {discoverAllCdnUrls, KNOWN_CDN_SOURCES, matchCdnGroup} from './cdnDiscovery.js';

/**
 * CDN 节点下载链接的运行时健康检查与自动替换。
 *
 * 逻辑移植自 scripts/update-cdn-nodes.mjs, 但**不再改写 servers.js 源码**:
 *   旧做法: 改写源码 → 重启进程 → 新列表生效
 *   新做法: 写覆盖层 data/servers/cdn-managed.json → 清缓存 → 立即生效
 *
 * 为什么不沿用旧做法: 编译后的二进制(Windows 的 MySpeed-CN.exe 等)里
 * server/controller/servers.js 并不以文件形式存在, 源码改写无从下手; 而且重启
 * 进程会中断正在进行的测速。覆盖层方案在二进制/源码/Docker 三种运行方式下一致。
 *
 * 覆盖层结构:
 *   urlMap  失效链接 → 替代链接(servers.js 的 getCdnServers 会据此改写节点的
 *           downloadUrl / downloadUrls / fallbackDownloadUrl)
 *   pool    按 CDN 组维护的候选链接池(已验证可用)
 *   state   每个链接的连续失败次数, 用于防抖动
 */

const OVERLAY_FILE = path.join('data', 'servers', 'cdn-managed.json');

// ── 探测参数 ──
const FETCH_TIMEOUT = 15_000;
const CONCURRENCY = 6;
const FAILS_BEFORE_REPLACE = 2;  // 连续失败多少轮才替换(与 Ookla/LibreSpeed 一致)

// 浏览器 UA + 防盗链 Referer(与 server/util/providers/cdnSpeedtest.js 的 dlHeaders 保持一致,
// 否则 download.cntv.cn / video19.ifeng.com 等防盗链源会被裸请求误判为死链)
const CHECK_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CHECK_REFERER_MAP = {
    'download.cntv.cn': 'https://www.cntv.cn/',
    'video19.ifeng.com': 'https://www.ifeng.com/',
    'dldir1.qq.com': 'https://v.qq.com/',
    'imtt.dd.qq.com': 'https://im.qq.com/',
    'softdlc.360tpcdn.com': 'https://www.360.cn/',
    'bigsoftdlc.360tpcdn.com': 'https://www.360.cn/',
    'cdn.qq.ime.sogou.com': 'https://pinyin.sogou.com/',
    'webcdn.m.qq.com': 'https://www.qq.com/',
    'cd.pddpic.com': 'https://www.pinduoduo.com/',
    'lf3-cdn-tos.bytegoofy.com': 'https://www.douyin.com/',
    'lf6-cdn-tos.bytegoofy.com': 'https://www.douyin.com/',
    'lf9-apk.ugapk.cn': 'https://www.douyin.com/',
    'lf3-package.vlabstatic.com': 'https://www.capcut.cn/',
    'lf6-package.vlabstatic.com': 'https://www.capcut.cn/',
    'lf9-package.vlabstatic.com': 'https://www.capcut.cn/',
    'open-image.ws.126.net': 'https://music.163.com/',
};

const log = (...a) => console.log('[cdn-update]', ...a);

// ═══════════════════════════════════════════════════
//  工具
// ═══════════════════════════════════════════════════

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

function checkHeaders(url) {
    let host = '';
    try {
        host = new URL(url).hostname;
    } catch { /* 保持空值 */ }

    return {
        'User-Agent': CHECK_UA,
        'Referer': CHECK_REFERER_MAP[host] || (host ? `https://${host}/` : '')
    };
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = FETCH_TIMEOUT) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
        return await fetch(url, {...opts, signal: ac.signal});
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 探测单个链接。先 HEAD, 不支持 HEAD 的源再用 GET + Range 兜底
 * (部分 CDN 对 HEAD 返回 405/403 但正常下载没问题)。
 */
export async function checkUrl(url) {
    const headers = checkHeaders(url);

    try {
        const res = await fetchWithTimeout(url, {method: 'HEAD', headers});
        return {ok: res.status >= 200 && res.status < 400, status: res.status};
    } catch {
        try {
            const res = await fetchWithTimeout(url, {
                method: 'GET',
                headers: {...headers, Range: 'bytes=0-0'}
            });
            return {ok: res.status >= 200 && res.status < 400, status: res.status};
        } catch (e) {
            return {ok: false, status: 0, error: e.name === 'AbortError' ? 'timeout' : e.message};
        }
    }
}

async function checkUrls(urls) {
    const unique = [...new Set(urls)];
    const results = await pool(unique, CONCURRENCY, async url => ({url, ...await checkUrl(url)}));
    return new Map(results.map(r => [r.url, r]));
}

// ═══════════════════════════════════════════════════
//  覆盖层读写
// ═══════════════════════════════════════════════════

const emptyOverlay = () => ({urlMap: {}, pool: {}, state: {}});

export const readOverlay = () => {
    try {
        const parsed = JSON.parse(fs.readFileSync(OVERLAY_FILE, 'utf8'));
        return {
            urlMap: parsed.urlMap ?? {},
            pool: parsed.pool ?? {},
            state: parsed.state ?? {}
        };
    } catch {
        return emptyOverlay();
    }
}

const writeOverlay = (data) => {
    fs.mkdirSync(path.dirname(OVERLAY_FILE), {recursive: true});
    fs.writeFileSync(OVERLAY_FILE, JSON.stringify(data, null, 2));
}

// ═══════════════════════════════════════════════════
//  链接收集与替换选择
// ═══════════════════════════════════════════════════

/** 收集所有 CDN 节点当前在用的下载链接 */
function collectUrls(servers) {
    const entries = [];

    for (const [nodeId, node] of Object.entries(servers)) {
        if (!node || typeof node !== 'object') continue;

        if (node.downloadUrl) entries.push({nodeId, name: node.name, url: node.downloadUrl});
        if (Array.isArray(node.downloadUrls))
            for (const url of node.downloadUrls) entries.push({nodeId, name: node.name, url});
        if (node.fallbackDownloadUrl)
            entries.push({nodeId, name: node.name, url: node.fallbackDownloadUrl});
    }

    return entries;
}

/**
 * 为失效链接挑选替代: 优先不同域名的、未被占用的链接。
 * 同域名替换意义不大(同一条链路挂了另一个文件多半也挂), 所以放在最后。
 */
function findReplacement(deadUrl, group, candidates, usedUrls) {
    const deadHost = (() => {
        try { return new URL(deadUrl).hostname; } catch { return ''; }
    })();

    const usable = candidates.filter(u => u !== deadUrl && !usedUrls.has(u));
    if (!usable.length) return null;

    const diffDomain = usable.filter(u => {
        try { return new URL(u).hostname !== deadHost; } catch { return false; }
    });

    return (diffDomain[0] ?? usable[0]);
}

// ═══════════════════════════════════════════════════
//  主流程
// ═══════════════════════════════════════════════════

/**
 * 跑一轮 CDN 链接体检与替换。
 * @returns 摘要对象(供日志/报告使用)
 */
export async function updateCdnNodes() {
    const overlay = readOverlay();
    const servers = getCdnServers();
    const entries = collectUrls(servers);
    const urlMap = {...overlay.urlMap};
    const state = {...overlay.state};

    log(`体检 ${entries.length} 个下载链接`);

    // ── 1. 批量探测 ──
    const results = await checkUrls(entries.map(e => e.url));

    const alive = [], deadNow = [];
    for (const entry of entries) {
        const result = results.get(entry.url);
        if (!result) continue;

        if (result.ok) {
            state[entry.url] = {fails: 0, lastCheck: new Date().toISOString()};
            alive.push(entry.url);
            continue;
        }

        const fails = (state[entry.url]?.fails ?? 0) + 1;
        state[entry.url] = {fails, lastCheck: new Date().toISOString(), status: result.status};

        if (fails >= FAILS_BEFORE_REPLACE) {
            deadNow.push({...entry, status: result.status, error: result.error});
        } else {
            log(`  ${entry.url.slice(0, 60)} 失败 (${fails}/${FAILS_BEFORE_REPLACE}), 暂不替换`);
        }
    }

    log(`可用 ${alive.length} / ${entries.length}` +
        (deadNow.length ? ` — 判定失效 ${deadNow.length} 个` : ''));

    // ── 2. 只有"能找到同组备用源"的失效链接才值得构建备用池 ──
    // 部分节点(Cloudflare / Steam / Microsoft 等国际 CDN)不在任何
    // CDN_DOMAIN_GROUPS 分组里, 没有可替换的同源链接。把它们排除掉, 否则这类永久
    // 失效的链接会让每轮都白白重建一次备用池(发现 + 逐个验证, 很费流量)。
    const replaceable = deadNow.filter(d => matchCdnGroup(d.url));
    for (const dead of deadNow.filter(d => !matchCdnGroup(d.url))) {
        log(`  ⚠ 无同组备用源, 无法自动替换(需人工处理): ${dead.url.slice(0, 60)}`);
    }

    if (!replaceable.length) {
        writeOverlay({urlMap, pool: overlay.pool, state});
        clearServerCache();
        return {total: entries.length, alive: alive.length, dead: deadNow.length, replaced: 0};
    }

    // ── 3. 构建备用池: 现存可用链接 + 静态种子 + 互联网发现 ──
    const pool = {...overlay.pool};

    const addToPool = (url) => {
        const group = matchCdnGroup(url);
        if (!group) return false;
        if (!pool[group]) pool[group] = [];
        if (!pool[group].includes(url)) {
            pool[group].push(url);
            return true;
        }
        return false;
    };

    for (const url of alive) addToPool(url);
    const seeded = Object.values(KNOWN_CDN_SOURCES).flat().filter(addToPool).length;

    let discovered = [];
    try {
        discovered = await discoverAllCdnUrls();
    } catch (e) {
        log(`互联网发现失败, 仅使用种子池 — ${e.message}`);
    }
    const discoveredAdded = discovered.filter(u => u.startsWith('http')).filter(addToPool).length;
    if (seeded || discoveredAdded) {
        log(`备用池新增: 种子 ${seeded} 个, 自动发现 ${discoveredAdded} 个`);
    }

    // 池内链接逐个验证, 剔除失效的(否则替换后又是个死链)
    const candidatesByGroup = {};
    for (const [group, urls] of Object.entries(pool)) {
        const checked = await checkUrls(urls);
        candidatesByGroup[group] = [...checked.values()].filter(r => r.ok).map(r => r.url);
        pool[group] = candidatesByGroup[group];
    }

    // ── 4. 逐个替换 ──
    const usedUrls = new Set(entries.map(e => e.url));
    let replaced = 0;

    for (const dead of replaceable) {
        const group = matchCdnGroup(dead.url);
        const replacement = findReplacement(dead.url, group, candidatesByGroup[group] ?? [], usedUrls);
        if (!replacement) {
            log(`  ⚠ 组「${group}」无可用替代: ${dead.url.slice(0, 60)}`);
            continue;
        }

        // 同时改写旧映射中指向 deadUrl 的条目, 避免形成 A→B→C 的链。
        // 应用覆盖层时只做一次查表(不递归), 否则 A 会解析到已失效的 B:
        // 内置常量里仍然是原始链接 A, 而 A 的映射指向后来也挂掉的 B。
        for (const [from, to] of Object.entries(urlMap)) {
            if (to === dead.url) urlMap[from] = replacement;
        }
        urlMap[dead.url] = replacement;

        usedUrls.add(replacement);
        // 用掉就移出池子, 避免多个失效链接替换成同一个
        pool[group] = pool[group].filter(u => u !== replacement);

        replaced++;
        log(`  ✅ [${dead.name}] ${dead.url.slice(0, 55)}… → ${replacement.slice(0, 55)}…`);
    }

    // 清理自映射(如 A→B 之后 B 又换回 A, 会留下 A→A)
    for (const [from, to] of Object.entries(urlMap)) {
        if (from === to) delete urlMap[from];
    }

    writeOverlay({urlMap, pool, state});
    clearServerCache();

    return {total: entries.length, alive: alive.length, dead: deadNow.length, replaced};
}
