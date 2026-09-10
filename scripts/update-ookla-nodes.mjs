/**
 * Ookla 测速节点自动更新
 *
 * 候选来源: bench.laset.com 清单 + Ookla 官方目录 API, 验证后写回
 * server/controller/servers.js 的 OOKLA_CN_SERVERS。
 *
 * ── 判定依据(两层, 缺一不可) ──
 * 1. 必须在 Ookla 官方目录里。
 *    CLI 只认自己目录(live directory)中的节点, 目录外的 ID 直接报
 *    NoServersException —— 与节点能否 ping 通无关。实测 5396/59386/36663/
 *    43752/59387/3633 等已从目录中移除, 即使 HTTP 可达也无法用于 --server-id。
 *    目录 API(www.speedtest.net/api/js/servers)比第三方清单更新更快,
 *    实测与 CLI 判定完全一致(CLI 认可的 3 个国内节点 = 目录里的 3 个;
 *    目录外的 37390 等 CLI 一律 NoServers)。
 * 2. 必须真实可测。用 Ookla 协议端点直接打流:
 *      延迟   GET  /speedtest/latency.txt        期望 200 + "test=test"
 *      下行   GET  /speedtest/download?size=N     期望 200 + 完整字节
 *      上行   POST /speedtest/upload.php         期望 200
 *    只有延迟没有带宽的节点(如 16204 实测 9.7KB/s)会被 --min-download 过滤掉。
 *
 * 走 HTTP 协议而非官方 CLI 的原因: CLI 对 server list 拉取有频率限制, 实测短时间
 * 打满后持续返回 "Limit reached" 且数分钟不恢复, 而该配额与生产测速共用。
 * 脚本默认全程不碰 CLI; 需要最终确认时用 --cli 抽样复核(会消耗配额)。
 *
 * 用法:
 *   node scripts/update-ookla-nodes.mjs                # 验证并写回 servers.js
 *   node scripts/update-ookla-nodes.mjs --dry-run      # 只报告, 不改文件
 *   node scripts/update-ookla-nodes.mjs --json         # 输出 JSON 报告
 *   node scripts/update-ookla-nodes.mjs --cli          # 额外用官方 CLI 复核(耗配额)
 *   node scripts/update-ookla-nodes.mjs --max-ping=0   # 不限制延迟(默认只收 ≤100ms)
 *   node scripts/update-ookla-nodes.mjs --min-download=500  # 下行门槛(kbps)
 *   node scripts/update-ookla-nodes.mjs --concurrency=4     # 并发探测数
 *
 * 注: 结果与运行环境网络出口强相关, 换网络需重跑。
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERVERS_JS = path.join(PROJECT_ROOT, 'server', 'controller', 'servers.js');
const REPORT_PATH = path.join(__dirname, '.last-ookla-report.json');

const SOURCE_XML = 'https://bench.laset.com/speedtest-servers-all.xml';
const DIRECTORY_API = 'https://www.speedtest.net/api/js/servers';
// laset 按 UA 分流: 默认 UA 会拿到 speedtest.sh 脚本, 必须伪装浏览器
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// 目录 API 会校验来源, 缺 Referer/Origin 直接 403
const DIRECTORY_HEADERS = {
    'User-Agent': BROWSER_UA,
    'Referer': 'https://www.speedtest.net/',
    'Origin': 'https://www.speedtest.net',
    'Accept': 'application/json',
};

// ── 参数 ──
const argv = process.argv.slice(2);
const flag = (name, def = null) => {
    const hit = argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!hit) return def;
    const eq = hit.indexOf('=');
    return eq === -1 ? true : hit.slice(eq + 1);
};
const DRY_RUN = !!flag('dry-run', false);
const JSON_OUT = !!flag('json', false);
const USE_CLI = !!flag('cli', false);
const BIND_IP = flag('ip', null);
const MAX_PING = parseFloat(flag('max-ping', '100'));          // ms, 0=不限
const MIN_DOWNLOAD = parseFloat(flag('min-download', '200'));  // kbps, 0=不限
const CONCURRENCY = parseInt(flag('concurrency', '6'), 10);
const LATENCY_TIMEOUT = parseInt(flag('latency-timeout', '8000'), 10);
const DOWNLOAD_TIMEOUT = parseInt(flag('download-timeout', '20000'), 10);
const DOWNLOAD_SIZE = parseInt(flag('download-size', '2000000'), 10);
const CLI_TIMEOUT = parseInt(flag('cli-timeout', '20000'), 10);

const log = (...a) => { if (!JSON_OUT) console.log(...a); };

/** XML 实体解码: &amp; &lt; &#x6D59; &#27993; 等 */
const decodeXml = s => s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

async function pool(items, limit, worker) {
    const out = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) return;
            out[i] = await worker(items[i], i);
        }
    }));
    return out;
}

// ═══════════════════════════════════════════════════
//  1. 候选来源
// ═══════════════════════════════════════════════════

/** Ookla 官方目录(权威): 只返回当前真实存在于目录中的节点 */
async function fetchDirectory(search) {
    const url = `${DIRECTORY_API}?engine=js&limit=500&search=${encodeURIComponent(search)}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 30_000);
    try {
        const res = await fetch(url, { headers: DIRECTORY_HEADERS, signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const list = await res.json();
        return list.map(s => ({
            id: String(s.id),
            name: s.name,
            country: s.country,
            cc: s.cc,
            sponsor: s.sponsor,
            // 目录里的 host 就是 CLI 实际使用的地址(*.prod.hosts.ooklaserver.net)
            host: s.host,
            distance: typeof s.distance === 'number' ? Math.round(s.distance) : 0,
        }));
    } finally { clearTimeout(t); }
}

/** bench.laset.com 清单(用户指定来源, 作为目录的补充候选) */
async function fetchLasetServers() {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 60_000);
    let xml;
    try {
        const res = await fetch(SOURCE_XML, { headers: { 'User-Agent': BROWSER_UA }, signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        xml = await res.text();
    } finally { clearTimeout(t); }

    const out = [];
    for (const m of xml.matchAll(/<server\s+([^>]+?)\/>/g)) {
        const a = {};
        for (const am of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) a[am[1]] = decodeXml(am[2]);
        if (a.cc !== 'HK' && a.cc !== 'CN') continue;
        out.push({
            id: a.id,
            name: a.name,
            country: a.cc === 'HK' ? 'Hong Kong' : a.country,
            cc: a.cc,
            sponsor: a.sponsor,
            host: a.host,
        });
    }
    return out;
}

function existingBlockRange(src) {
    const marker = 'export const OOKLA_CN_SERVERS';
    let start = src.indexOf(marker);
    if (start === -1) throw new Error('未找到 OOKLA_CN_SERVERS');

    // 连同紧邻上方的注释块一起替换(自动生成的头部说明需跟着刷新)
    const before = src.slice(0, start).split('\n');
    let cut = before.length - 1;
    while (cut > 0 && before[cut - 1].trimStart().startsWith('//')) cut--;
    start = before.slice(0, cut).join('\n').length + (cut > 0 ? 1 : 0);

    const eq = src.indexOf('{', src.indexOf('=', start));
    let depth = 0, end = eq;
    for (let i = eq; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) { end = i + 1; break; }
    }
    if (src[end] === ';') end++;
    return { start, end };
}

function parseExistingNodes(src) {
    const { start, end } = existingBlockRange(src);
    const block = src.slice(src.indexOf('{', start), end);
    const out = [];
    for (const m of block.matchAll(/"(\d+)":\s*\{([^}]+)\}/g)) {
        const body = m[2];
        const g = k => (body.match(new RegExp(`${k}:\\s*"([^"]*)"`)) || [])[1] || '';
        out.push({
            id: m[1],
            name: g('name'),
            sponsor: g('sponsor'),
            country: g('country'),
            cc: g('cc') || 'CN',
            host: g('host'),
        });
    }
    return out;
}

// ═══════════════════════════════════════════════════
//  2. Ookla 协议实测
// ═══════════════════════════════════════════════════

async function timedFetch(url, opts = {}, timeout) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeout);
    const t0 = Date.now();
    try {
        const res = await fetch(url, { ...opts, signal: ac.signal });
        return { res, ms: Date.now() - t0 };
    } finally { clearTimeout(t); }
}

/**
 * 延迟测 5 次取最小值。
 * 取最小而非平均: 链路上任何排队/整形都只会让单次 RTT 变大, 最小值最接近真实
 * 往返时延。实测同一节点在链路被自己跑满时中位数可从 47ms 虚高到 91ms,
 * 而最小值始终稳定在真实水平。
 */
async function measureLatency(host, samples = 5) {
    let best = null;
    for (let i = 0; i < samples; i++) {
        try {
            const { res, ms } = await timedFetch(
                `http://${host}/speedtest/latency.txt?x=${i}`, {}, LATENCY_TIMEOUT);
            const body = (await res.text()).trim();
            if (res.status !== 200 || !/test=test/.test(body)) return null;
            best = best === null ? ms : Math.min(best, ms);
        } catch { return best; }   // 后续样本失败不推翻已有结果
    }
    return best;
}

/** 下行吞吐: 读满 N 字节或超时为止, 返回 kbps */
async function measureDownload(host) {
    try {
        const { res, ms } = await timedFetch(
            `http://${host}/speedtest/download?size=${DOWNLOAD_SIZE}`, {}, DOWNLOAD_TIMEOUT);
        if (res.status !== 200) return null;
        let bytes = 0;
        for await (const chunk of res.body) bytes += chunk.length;
        if (!bytes) return null;
        return Math.round(bytes * 8 / 1000 / (Math.max(ms, 1) / 1000));
    } catch {
        return null;
    }
}

/** 上行吞吐: multipart POST, 返回 kbps */
async function measureUpload(host, bytes = 512 * 1024) {
    try {
        const payload = Buffer.alloc(bytes, 0x78);   // 'x' * N
        const { res, ms } = await timedFetch(`http://${host}/speedtest/upload.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: payload,
        }, DOWNLOAD_TIMEOUT);
        if (res.status !== 200) return null;
        await res.arrayBuffer();
        return Math.round(bytes * 8 / 1000 / (Math.max(ms, 1) / 1000));
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════
//  3. 可选的官方 CLI 复核(消耗 Ookla 配额)
// ═══════════════════════════════════════════════════

function probeWithCli(node) {
    return new Promise(resolve => {
        const bin = path.join(PROJECT_ROOT, 'bin',
            'speedtest' + (process.platform === 'win32' ? '.exe' : ''));
        const args = ['--accept-license', '--accept-gdpr', '--format=json', '--progress=yes',
            `--server-id=${node.id}`];
        if (BIND_IP) args.push(process.platform === 'win32' ? `--ip=${BIND_IP}` : `--interface=${BIND_IP}`);

        const r = { id: node.id, status: 'error', ping: null, error: null };
        let child;
        try { child = spawn(bin, args, { windowsHide: true }); } catch (e) {
            r.error = e.message;
            return resolve(r);
        }

        let done = false;
        const pings = [];
        const finish = (status, err = null) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            r.status = status;
            r.error = err;
            if (pings.length) r.ping = Math.round(Math.min(...pings) * 10) / 10;
            try { child.kill('SIGKILL'); } catch { }
            resolve(r);
        };
        const timer = setTimeout(() => finish('unreachable', '超时'), CLI_TIMEOUT);

        const onChunk = chunk => {
            for (const line of chunk.toString().split('\n')) {
                const s = line.trim();
                if (!s) continue;
                if (/Limit reached|Too many requests/i.test(s)) return finish('rateLimited', '频率限制');
                if (!s.startsWith('{')) continue;
                let ev;
                try { ev = JSON.parse(s); } catch { continue; }
                if (ev.type === 'ping' && typeof ev.ping?.latency === 'number') {
                    pings.push(ev.ping.latency);
                    if (pings.length >= 3) return finish('ok');
                } else if (ev.type === 'log' && ev.level === 'error') {
                    if (/NoServersException/.test(ev.message || '')) return finish('notInDirectory', '不在目录');
                    if (/Limit reached/i.test(ev.message || '')) return finish('rateLimited', '频率限制');
                }
            }
        };
        child.stdout.on('data', onChunk);
        child.stderr.on('data', onChunk);
        child.on('error', e => finish('error', e.message));
        child.on('exit', () => finish('unreachable', r.error || '无结果'));
    });
}

// ═══════════════════════════════════════════════════
//  4. 生成 OOKLA_CN_SERVERS 代码块
// ═══════════════════════════════════════════════════

const CITY_CN = {
    'Hong Kong': '香港',
    Suzhou: '苏州', Shanghai: '上海', Kunshan: '昆山', Zhenjiang: '镇江',
    Beijing: '北京', HangZhou: '杭州', NingBo: '宁波', Xuzhou: '徐州',
    Guangzhou: '广州', Shenzhen: '深圳', Chengdu: '成都', Wuhan: '武汉',
    Nanjing: '南京', Tianjin: '天津', Chongqing: '重庆', Xian: '西安',
};

function renderBlock(nodes, meta) {
    const cn = nodes.filter(n => n.cc === 'CN').length;
    const lines = [
        '// ── 🇨🇳🇭🇰 国内 + 香港 Ookla Speedtest 节点 ──',
        '// 由 scripts/update-ookla-nodes.mjs 自动生成: 候选来自 bench.laset.com 与',
        '// Ookla 官方目录, 并逐个用 Ookla 协议端点实测延迟与上下行吞吐。',
        '// 仅保留"在 Ookla 目录中 + 实测可跑"的节点(目录外的 ID 会被 CLI 拒绝)。',
        `// 上次验证: ${meta.date}${meta.isp ? ` · 出口 ${meta.isp} ${meta.externalIp || ''}` : ''}`.trimEnd(),
        `// 国内 ${cn} 个 / 香港 ${nodes.length - cn} 个; 明细见 scripts/.last-ookla-report.json`,
        'export const OOKLA_CN_SERVERS = {',
    ];
    nodes.forEach((n, i) => {
        lines.push(`    "${n.id}": {`);
        lines.push(`        name: ${JSON.stringify(n.name)},`);
        lines.push(`        sponsor: ${JSON.stringify(n.sponsor)},`);
        lines.push(`        country: ${JSON.stringify(n.country)},`);
        lines.push(`        cc: ${JSON.stringify(n.cc)},`);
        lines.push(`        distance: ${n.distance ?? 0},`);
        lines.push(`        host: ${JSON.stringify(n.host)}`);
        lines.push('    }' + (i === nodes.length - 1 ? '' : ','));
    });
    lines.push('};');
    return lines.join('\n');
}

// ═══════════════════════════════════════════════════
//  main
// ═══════════════════════════════════════════════════

async function main() {
    log('📡 拉取候选节点...');
    const [dirCn, dirHk, laset] = await Promise.all([
        fetchDirectory('China'),
        fetchDirectory('Hong Kong'),
        fetchLasetServers(),
    ]);
    const directory = [...dirCn, ...dirHk];
    log(`   Ookla 目录: 国内 ${dirCn.length} 个 / 香港 ${dirHk.length} 个`);
    log(`   laset 清单: HH/CN 共 ${laset.length} 个`);

    const src = fs.readFileSync(SERVERS_JS, 'utf-8');
    const existing = parseExistingNodes(src);

    // 合并候选: 目录信息优先(它才有 CLI 实际使用的 host 与 distance)
    const byId = new Map();
    for (const n of laset) byId.set(n.id, { ...n, inDirectory: false, source: 'laset' });
    for (const n of existing) byId.set(n.id, { ...byId.get(n.id), ...n, existed: true });
    for (const n of directory) byId.set(n.id, { ...byId.get(n.id), ...n, inDirectory: true });
    const candidates = [...byId.values()];
    log(`   去重后共 ${candidates.length} 个候选 (目录内 ${candidates.filter(c => c.inDirectory).length} 个)`);

    // ── 实测 ──
    // 分两阶段: 先测延迟再压吞吐。二者混跑会互相干扰 —— 并发下载会把链路吃满,
    // 令同时进行的延迟测量被排队延迟污染(实测同批节点从 47ms 虚高到 91ms)。
    const notInDir = candidates.filter(c => !c.inDirectory);
    for (const n of notInDir) {
        log(`   ❌ ${String(n.id).padStart(6)} ${(n.sponsor || n.name || '').slice(0, 26).padEnd(28)} 不在 Ookla 目录中`);
    }

    const inDir = candidates.filter(c => c.inDirectory);
    log(`\n🔬 阶段 A: 延迟实测 (并发 ${CONCURRENCY}, 每节点 5 次取最小)`);
    const latencies = await pool(inDir, CONCURRENCY, n => measureLatency(n.host));
    const latById = new Map(inDir.map((n, i) => [n.id, latencies[i]]));

    // 先按延迟筛, 只给通过延迟门槛的节点跑吞吐 —— 省流量, 也避免把链路压满
    // 反过来污染下一轮的延迟测量。
    const latencyOk = [], latencyFail = [];
    for (const n of inDir) {
        const ping = latById.get(n.id);
        const ok = ping !== null && (MAX_PING <= 0 || ping <= MAX_PING);
        (ok ? latencyOk : latencyFail).push(n);
        log(`   ${ok ? '✅' : '❌'} ${String(n.id).padStart(6)} ` +
            `${(n.sponsor || n.name || '').slice(0, 26).padEnd(28)} ` +
            (ping === null ? '延迟测试失败'
                : `${String(ping).padStart(6)}ms` + (ok ? '' : ` (> ${MAX_PING}ms)`)));
    }
    if (latencyFail.length) {
        log(`   ⏱  ${latencyFail.length} 个未过延迟门槛(${MAX_PING}ms), 不再测吞吐`);
    }

    log(`\n🔬 阶段 B: 上下行吞吐 (并发 ${CONCURRENCY}, 下行 ${DOWNLOAD_SIZE / 1e6}MB)`);
    const results = await pool(latencyOk, CONCURRENCY, async node => {
        const ping = latById.get(node.id);
        const download = await measureDownload(node.host);
        const upload = download === null ? null : await measureUpload(node.host);
        const v = {
            ping, download, upload,
            ok: download !== null,
            error: download === null ? '下行不可用' : null,
        };
        const dl = download === null ? '—' : `${(download / 1000).toFixed(1)}Mbps`;
        const ul = upload === null ? '—' : `${(upload / 1000).toFixed(1)}Mbps`;
        log(`   ${v.ok ? '✅' : '❌'} ${String(node.id).padStart(6)} ` +
            `${(node.sponsor || node.name || '').slice(0, 26).padEnd(28)} ` +
            `${String(ping).padStart(6)}ms ↓${dl.padEnd(10)}↑${ul.padEnd(10)}` + (v.error ? ` ${v.error}` : ''));
        return { node, v };
    });
    for (const n of latencyFail) {
        results.push({
            node: n,
            v: {
                ping: latById.get(n.id), download: null, upload: null, ok: false,
                error: latById.get(n.id) === null ? '延迟测试失败' : `延迟 ${latById.get(n.id)}ms 超阈值`,
            },
        });
    }

    // ── 过滤 ──
    let kept = results.filter(r => r.v.ok);
    if (MAX_PING > 0) {
        const dropped = kept.filter(r => r.v.ping > MAX_PING);
        kept = kept.filter(r => r.v.ping <= MAX_PING);
        if (dropped.length) log(`\n   ⏱  丢弃 ${dropped.length} 个延迟 > ${MAX_PING}ms: ` +
            dropped.map(d => `${d.node.id}(${d.v.ping}ms)`).join(', '));
    }
    if (MIN_DOWNLOAD > 0) {
        const dropped = kept.filter(r => r.v.download < MIN_DOWNLOAD);
        kept = kept.filter(r => r.v.download >= MIN_DOWNLOAD);
        if (dropped.length) log(`   🐌 丢弃 ${dropped.length} 个下行 < ${MIN_DOWNLOAD}kbps: ` +
            dropped.map(d => `${d.node.id}(${(d.v.download / 1000).toFixed(1)}Mbps)`).join(', '));
    }

    // ── 可选: 官方 CLI 复核 ──
    if (USE_CLI && kept.length) {
        log(`\n🔎 官方 CLI 复核 (${kept.length} 个, 会消耗 Ookla 配额)`);
        for (const r of kept) {
            const c = await probeWithCli(r.node);
            r.cli = c;
            // 只有"不在目录"是确定的否决信号; 限流/超时只作参考, 不动结论
            if (c.status === 'notInDirectory') r.cliVeto = true;
            log(`   ${c.status === 'ok' ? '✅' : c.status === 'rateLimited' ? '🚫' : '❌'} ` +
                `${String(r.node.id).padStart(6)} ` +
                (c.status === 'ok' ? `${c.ping}ms` : `${c.status}: ${c.error || ''}`));
            if (c.status === 'rateLimited') {
                log('   🚫 命中频率限制, 停止复核(其余节点未判定, 保留 HTTP 实测结论)');
                break;
            }
        }
        const vetoed = kept.filter(r => r.cliVeto);
        if (vetoed.length) {
            kept = kept.filter(r => !r.cliVeto);
            log(`   ✂️  CLI 判定不在目录, 剔除 ${vetoed.length} 个: ` +
                vetoed.map(v => v.node.id).join(', '));
        }
    }

    // ── 排序: 国内在前, 组内延迟升序 ──
    kept.sort((a, b) => (a.node.cc === 'CN' ? 0 : 1) - (b.node.cc === 'CN' ? 0 : 1)
        || a.v.ping - b.v.ping);

    const finalNodes = kept.map(({ node }) => ({
        id: node.id,
        name: CITY_CN[node.name] || node.name || node.host,
        sponsor: node.sponsor || node.name || '',
        country: node.cc === 'HK' ? 'Hong Kong' : (node.country || 'China'),
        cc: node.cc,
        distance: node.distance ?? 0,
        host: node.host,
    }));

    const report = {
        generatedAt: new Date().toISOString(),
        sources: { directory: DIRECTORY_API, laset: SOURCE_XML },
        candidates: candidates.length,
        usable: finalNodes.length,
        nodes: kept.map(({ node, v, cli }) => ({
            id: node.id, name: CITY_CN[node.name] || node.name, sponsor: node.sponsor,
            cc: node.cc, host: node.host, distance: node.distance ?? 0,
            pingMs: v.ping, downloadKbps: v.download, uploadKbps: v.upload,
            cliStatus: cli?.status ?? null,
        })),
        rejected: [
            ...notInDir.map(n => ({
                id: n.id, sponsor: n.sponsor, cc: n.cc, status: 'notInDirectory',
                reason: '不在 Ookla 目录中(CLI 会报 NoServersException)',
            })),
            ...results.filter(r => !r.v.ok || !kept.includes(r)).map(r => ({
                id: r.node.id, sponsor: r.node.sponsor, cc: r.node.cc,
                status: r.v.ok ? 'filtered' : 'unreachable',
                reason: r.v.error || '未达阈值',
                pingMs: r.v.ping, downloadKbps: r.v.download, uploadKbps: r.v.upload,
            })),
        ],
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    if (JSON_OUT) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        log(`\n📋 可用节点 ${finalNodes.length} 个 ` +
            `(国内 ${finalNodes.filter(n => n.cc === 'CN').length} / 香港 ${finalNodes.filter(n => n.cc === 'HK').length})`);
        for (const n of report.nodes) {
            log(`   ${n.cc} ${String(n.id).padStart(6)} ${(n.name || '').padEnd(6)} ` +
                `${(n.sponsor || '').slice(0, 24).padEnd(26)} ` +
                `${String(n.pingMs).padStart(6)}ms ↓${(n.downloadKbps / 1000).toFixed(1)}Mbps`);
        }
        log(`\n   报告: ${path.relative(PROJECT_ROOT, REPORT_PATH)}`);
    }

    if (DRY_RUN) {
        log('\n(--dry-run: servers.js 未修改)');
        return;
    }
    if (!finalNodes.length) {
        log('\n⚠️  无可用节点, 拒绝写回以免清空列表');
        process.exitCode = 1;
        return;
    }

    const block = renderBlock(finalNodes, {
        date: new Date().toISOString().slice(0, 10),
        isp: null,
        externalIp: null,
    });
    const { start, end } = existingBlockRange(src);
    fs.writeFileSync(SERVERS_JS, src.slice(0, start) + block + src.slice(end), 'utf-8');
    log(`\n💾 已更新 ${path.relative(PROJECT_ROOT, SERVERS_JS)} (${finalNodes.length} 个节点)`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
