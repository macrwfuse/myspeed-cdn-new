#!/usr/bin/env node

/**
 * CDN 节点链接自动更新脚本 (MySpeed-CN)
 *
 * 功能：
 *   1. 检测 server/controller/servers.js 中 CDN_SERVERS 所有下载链接的可用性
 *   2. 自动替换失效链接（从备用池选取同 CDN 的替代链接）
 *   3. 输出检测报告
 *
 * 用法：
 *   node scripts/update-cdn-nodes.mjs              # 检测并修复
 *   node scripts/update-cdn-nodes.mjs --check-only  # 仅检测，不修改
 *   node scripts/update-cdn-nodes.mjs --verbose      # 详细输出
 *
 * 定时任务（crontab -e）：
 *   0 3 * * * cd /path/to/myspeed-cn-cdn && node scripts/update-cdn-nodes.mjs >> /var/log/cdn-update.log 2>&1
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERVERS_JS = path.join(PROJECT_ROOT, 'server', 'controller', 'servers.js');
const BACKUP_POOL_PATH = path.join(PROJECT_ROOT, 'scripts', '.cdn-backup-pool.json');
const REPORT_PATH = path.join(PROJECT_ROOT, 'scripts', '.last-report.json');

// ── 参数解析 ──
const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check-only');
const VERBOSE = args.includes('--verbose');

function log(...a) { console.log(`[${new Date().toISOString()}]`, ...a); }
function vlog(...a) { if (VERBOSE) console.log(`[${new Date().toISOString()}] [V]`, ...a); }

// ── CDN 分组 / 备用池种子 / 自动发现 ──
// 全部来自 server/util/cdnDiscovery.js。那份实现是运行时更新(server/util/cdnUpdater.js)
// 与容器调度器共用的单一来源 —— 编译后的二进制访问不到 scripts/，所以逻辑必须放在
// server/ 下，这里只做引用。
let discoverAllCdnUrls, matchCdnGroupFn, KNOWN_CDN_SOURCES;
try {
  const mod = await import('../server/util/cdnDiscovery.js');
  discoverAllCdnUrls = mod.discoverAllCdnUrls;
  matchCdnGroupFn = mod.matchCdnGroup;
  KNOWN_CDN_SOURCES = mod.KNOWN_CDN_SOURCES;
} catch (e) {
  // 降级: 无法加载时不做发现, 且没有种子源(仅能依靠现有存活链接)
  console.warn(`[warn] 无法加载 server/util/cdnDiscovery.js: ${e.message}`);
  discoverAllCdnUrls = async () => [];
  matchCdnGroupFn = null;
  KNOWN_CDN_SOURCES = {};
}

// ── 网络工具 ──
const FETCH_TIMEOUT = 15_000;
const CONCURRENCY = 6;

// 浏览器 UA + 防盗链 Referer（与 server/util/providers/cdnSpeedtest.js 的 dlHeaders 保持一致，
// 否则 download.cntv.cn / video19.ifeng.com 等防盗链源会被裸请求误判为死链而被自动替换）
const CHECK_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
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

function checkHeaders(url) {
  let host = '';
  try { host = new URL(url).hostname; } catch { /* keep '' */ }
  return {
    'User-Agent': CHECK_UA,
    'Referer': CHECK_REFERER_MAP[host] || (host ? `https://${host}/` : ''),
  };
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url) {
  const start = Date.now();
  const headers = checkHeaders(url);
  try {
    const resp = await fetchWithTimeout(url, { method: 'HEAD', headers });
    const latencyMs = Date.now() - start;
    const ok = resp.status >= 200 && resp.status < 400;
    return { ok, status: resp.status, latencyMs };
  } catch {
    try {
      const resp = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { ...headers, Range: 'bytes=0-0' },
      });
      const latencyMs = Date.now() - start;
      const ok = resp.status >= 200 && resp.status < 400;
      return { ok, status: resp.status, latencyMs };
    } catch (err2) {
      return {
        ok: false,
        status: 0,
        latencyMs: Date.now() - start,
        error: err2.name === 'AbortError' ? 'timeout' : err2.message,
      };
    }
  }
}

async function checkUrls(urls) {
  const results = new Map();
  const queue = [...urls];
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, urls.length || 1) },
    async () => {
      while (queue.length) {
        const url = queue.shift();
        if (results.has(url)) continue;
        const result = await checkUrl(url);
        results.set(url, result);
        vlog(`  ${result.ok ? '✅' : '❌'} [${result.status}] ${result.latencyMs}ms ${url}`);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

// ── 备用池 ──
function loadBackupPool() {
  try {
    if (fs.existsSync(BACKUP_POOL_PATH))
      return JSON.parse(fs.readFileSync(BACKUP_POOL_PATH, 'utf-8'));
  } catch { /* ignore */ }
  return {};
}

function saveBackupPool(pool) {
  fs.writeFileSync(BACKUP_POOL_PATH, JSON.stringify(pool, null, 2), 'utf-8');
}

function matchCdnGroup(url) {
  if (matchCdnGroupFn) return matchCdnGroupFn(url);
  for (const [group, domains] of Object.entries(CDN_DOMAIN_GROUPS)) {
    for (const d of domains) {
      if (url.includes(d)) return group;
    }
  }
  return null;
}

/**
 * 从 servers.js 源码中提取 CDN_SERVERS 对象的文本范围
 * 返回 { start, end, text } — start/end 是字符偏移量
 */
function extractCdnServersBlock(src) {
  // 找到 "export const CDN_SERVERS = {"
  const marker = 'export const CDN_SERVERS';
  const markerIdx = src.indexOf(marker);
  if (markerIdx === -1) throw new Error('CDN_SERVERS 未找到');

  // 找到等号后的第一个 {
  const eqIdx = src.indexOf('{', src.indexOf('=', markerIdx));
  if (eqIdx === -1) throw new Error('CDN_SERVERS 开始大括号未找到');

  // 配对大括号找到结束位置
  let depth = 0;
  let end = eqIdx;
  for (let i = eqIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }

  return { start: markerIdx, end, text: src.slice(markerIdx, end) };
}

/**
 * 从 CDN_SERVERS 块中解析所有节点信息
 * 返回 Map<nodeId, { downloadUrl?, downloadUrls?, uploadUrl?, uploadUrls?, name }>
 */
function parseCdnNodes(blockText) {
  const nodes = new Map();

  // 匹配每个节点块: "cdn-xxx": { ... }
  const nodeRegex = /"([^"]+)":\s*\{([^}]+)\}/g;
  let match;

  while ((match = nodeRegex.exec(blockText)) !== null) {
    const nodeId = match[1];
    const body = match[2];

    // 提取 name
    const nameMatch = body.match(/name:\s*"([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : nodeId;

    // 提取 downloadUrl (单个)
    const dlSingleMatch = body.match(/downloadUrl:\s*"([^"]+)"/);

    // 提取 downloadUrls (数组)
    const dlArrayMatch = body.match(/downloadUrls:\s*\[([^\]]+)\]/s);
    let downloadUrls = null;
    if (dlArrayMatch) {
      downloadUrls = [...dlArrayMatch[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
    }

    // 提取 uploadUrl
    const ulSingleMatch = body.match(/uploadUrl:\s*"([^"]+)"/);

    // 提取 uploadUrls (数组)
    const ulArrayMatch = body.match(/uploadUrls:\s*\[([^\]]+)\]/s);
    let uploadUrls = null;
    if (ulArrayMatch) {
      uploadUrls = [...ulArrayMatch[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
    }

    // 提取 fallbackDownloadUrl (保底无限流源, 需一并纳入健康检测)
    const fbMatch = body.match(/fallbackDownloadUrl:\s*"([^"]+)"/);

    nodes.set(nodeId, {
      name,
      downloadUrl: dlSingleMatch ? dlSingleMatch[1] : null,
      downloadUrls,
      uploadUrl: ulSingleMatch ? ulSingleMatch[1] : null,
      uploadUrls,
      fallbackDownloadUrl: fbMatch ? fbMatch[1] : null,
    });
  }

  return nodes;
}

/**
 * 在源码中替换 CDN_SERVERS 节点的某个 URL
 * 精确匹配字符串字面量进行替换
 */
function replaceUrlInSource(src, oldUrl, newUrl) {
  // 直接替换字符串（servers.js 中 URL 都是字符串字面量）
  const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`"${escaped}"`, 'g');
  return src.replace(regex, `"${newUrl}"`);
}

/**
 * 为失效链接寻找同 CDN 组的替代
 */
function findReplacement(deadUrl, cdnGroup, backupPool, existingUrls) {
  const deadDomain = (() => {
    try { return new URL(deadUrl).hostname; } catch { return ''; }
  })();

  const pool = backupPool[cdnGroup] || [];

  // 优先：不同域名且未被其他节点使用
  const diffDomain = pool.filter(u => {
    if (existingUrls.has(u)) return false;
    try { return new URL(u).hostname !== deadDomain; } catch { return false; }
  });
  if (diffDomain.length > 0)
    return diffDomain[Math.floor(Math.random() * diffDomain.length)];

  // 退而求其次：不同域名但已被其他节点使用（CDN 测速链接可复用）
  const diffDomainReuse = pool.filter(u => {
    try { return new URL(u).hostname !== deadDomain; } catch { return false; }
  });
  if (diffDomainReuse.length > 0)
    return diffDomainReuse[Math.floor(Math.random() * diffDomainReuse.length)];

  // 最后：同域名也行
  const any = pool.filter(u => !existingUrls.has(u));
  if (any.length > 0) return any[0];

  // 同域名复用
  return pool.length > 0 ? pool[0] : null;
}

// ── 主流程 ──
async function main() {
  log('=== MySpeed-CN CDN 节点自动更新脚本 ===');
  log(`模式: ${CHECK_ONLY ? '仅检测' : '检测并修复'}`);

  // 1. 读取 servers.js
  if (!fs.existsSync(SERVERS_JS)) {
    log(`❌ 未找到 ${SERVERS_JS}`);
    process.exit(1);
  }
  const src = fs.readFileSync(SERVERS_JS, 'utf-8');

  // 2. 提取并解析 CDN_SERVERS
  const block = extractCdnServersBlock(src);
  const cdnNodes = parseCdnNodes(block.text);
  log(`📦 解析到 ${cdnNodes.size} 个 CDN 节点`);

  // 3. 收集所有待检测 URL
  const allUrls = [];
  const urlMeta = []; // { nodeId, nodeName, url, type }

  for (const [nodeId, node] of cdnNodes) {
    // downloadUrls 数组
    if (node.downloadUrls) {
      for (const url of node.downloadUrls) {
        allUrls.push(url);
        urlMeta.push({ nodeId, nodeName: node.name, url, type: 'downloadUrls' });
      }
    }
    // downloadUrl 单个
    if (node.downloadUrl) {
      allUrls.push(node.downloadUrl);
      urlMeta.push({ nodeId, nodeName: node.name, url: node.downloadUrl, type: 'downloadUrl' });
    }
    // fallbackDownloadUrl 保底源(判死时替换策略同 downloadUrl)
    if (node.fallbackDownloadUrl) {
      allUrls.push(node.fallbackDownloadUrl);
      urlMeta.push({ nodeId, nodeName: node.name, url: node.fallbackDownloadUrl, type: 'downloadUrl' });
    }
  }

  log(`🔗 共 ${allUrls.length} 个下载链接待检测`);

  // 4. 批量检测
  const results = await checkUrls(allUrls);

  // 5. 汇总
  const dead = [];
  const alive = [];
  const report = { total: allUrls.length, alive: 0, dead: 0, replaced: 0 };

  for (const meta of urlMeta) {
    const result = results.get(meta.url);
    if (!result) continue;
    const entry = { ...meta, ...result };
    if (result.ok) { report.alive++; alive.push(entry); }
    else { report.dead++; dead.push(entry);
      log(`❌ 失效 [${meta.nodeName}]: ${meta.url} (${result.error || result.status})`);
    }
  }

  log(`\n📊 检测报告: 总计 ${report.total} | ✅ ${report.alive} | ❌ ${report.dead}`);

  // 6. 更新备用池
  log('\n🔄 更新备用池...');
  const backupPool = loadBackupPool();

  // 将可用链接加入备用池
  for (const entry of alive) {
    const g = matchCdnGroup(entry.url);
    if (!g) continue;
    if (!backupPool[g]) backupPool[g] = [];
    if (!backupPool[g].includes(entry.url)) backupPool[g].push(entry.url);
  }

  // 合并静态已知源
  for (const [group, urls] of Object.entries(KNOWN_CDN_SOURCES)) {
    if (!backupPool[group]) backupPool[group] = [];
    for (const url of urls) {
      if (!backupPool[group].includes(url)) backupPool[group].push(url);
    }
  }

  // 从互联网自动发现新 CDN 链接
  log('🌐 从互联网自动发现新 CDN 链接...');
  const discovered = await discoverAllCdnUrls(vlog);
  let discoveredCount = 0;
  for (const u of discovered) {
    if (!u.startsWith('http')) continue;
    const g = matchCdnGroup(u);
    if (!g) continue;
    if (!backupPool[g]) backupPool[g] = [];
    if (!backupPool[g].includes(u)) {
      backupPool[g].push(u);
      discoveredCount++;
    }
  }
  if (discoveredCount > 0) log(`   ✅ 新增 ${discoveredCount} 个候选链接到备用池`);

  // 验证备用池
  log('🔍 验证备用池链接...');
  for (const [group, urls] of Object.entries(backupPool)) {
    const poolResults = await checkUrls([...new Set(urls)]);
    const valid = urls.filter(u => {
      const r = poolResults.get(u);
      return r && r.ok;
    });
    const removed = urls.length - valid.length;
    backupPool[group] = valid;
    if (removed > 0) vlog(`  ${group}: 移除 ${removed} 个失效备用链接`);
  }

  saveBackupPool(backupPool);
  log('💾 备用池已更新');

  // 7. 替换失效链接
  if (dead.length > 0 && !CHECK_ONLY) {
    log('\n🔧 开始替换失效链接...');
    let updatedSrc = src;

    for (const entry of dead) {
      const cdnGroup = matchCdnGroup(entry.url);
      if (!cdnGroup) {
        log(`  ⚠ 无法匹配 CDN 组: ${entry.url}`);
        continue;
      }

      // 收集当前所有已有 URL
      const existingUrls = new Set();
      for (const n of cdnNodes.values()) {
        if (n.downloadUrl) existingUrls.add(n.downloadUrl);
        if (n.downloadUrls) n.downloadUrls.forEach(u => existingUrls.add(u));
      }

      const replacement = findReplacement(entry.url, cdnGroup, backupPool, existingUrls);
      if (replacement) {
        updatedSrc = replaceUrlInSource(updatedSrc, entry.url, replacement);
        report.replaced++;
        // 从备用池移除已使用的链接（避免重复使用）
        const pool = backupPool[cdnGroup];
        if (pool) {
          const idx = pool.indexOf(replacement);
          if (idx !== -1) pool.splice(idx, 1);
        }
        log(`  ✅ 替换 [${entry.nodeName}]: ${entry.url.substring(0, 70)}...`);
        log(`     → ${replacement.substring(0, 70)}...`);
      } else {
        log(`  ⚠ 无可用替代 [${entry.nodeName}]: ${entry.url}`);
      }
    }

    if (report.replaced > 0) {
      fs.writeFileSync(SERVERS_JS, updatedSrc, 'utf-8');
      log(`\n💾 servers.js 已更新，共替换 ${report.replaced} 个链接`);
    }
  } else if (dead.length > 0 && CHECK_ONLY) {
    log(`\n⚠ 检测到 ${dead.length} 个失效链接（--check-only 模式，不修改）`);
  }

  // 8. 报告
  log('\n========================================');
  log('📋 最终报告');
  log('========================================');
  log(`  总链接数: ${report.total}`);
  log(`  ✅ 可用:   ${report.alive}`);
  log(`  ❌ 失效:   ${report.dead}`);
  log(`  🔄 替换:   ${report.replaced}`);
  log(`  📦 备用池: ${Object.values(backupPool).reduce((s, a) => s + a.length, 0)} 个候选`);
  log('========================================\n');

  fs.writeFileSync(REPORT_PATH, JSON.stringify({
    timestamp: new Date().toISOString(),
    ...report,
    backupPoolSize: Object.fromEntries(
      Object.entries(backupPool).map(([k, v]) => [k, v.length])
    ),
  }, null, 2), 'utf-8');

  if (report.dead > 0 && report.replaced < report.dead) {
    log('⚠ 部分失效链接无法自动替换，请手动检查');
    process.exit(1);
  }

  log('✅ 完成');
}

main().catch(err => {
  log('❌ 致命错误:', err.message);
  process.exit(1);
});
