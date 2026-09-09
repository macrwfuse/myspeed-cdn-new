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

// ── CDN 域名分组 ──
// 用于匹配失效链接属于哪个 CDN 组，从而从同组备用池中选取替代
const CDN_DOMAIN_GROUPS = {
  '和彩云CDN': ['mcloud.139.com'],
  '天翼云CDN': ['ctyun.cn'],
  'Speedo云CDN': [
    'bytegoofy.com', 'bytedance.com', 'byteimg.com', 'vlabstatic.com',
    'qiniu.com', 'qnssl.com', 'qbox.me',
    'alipay.com', 'alicdn.com', 'aliyun.com',
    'sina.cn', 'sinaimg.cn', 'weibo.com',
    'ws.126.net', '126.net', 'netease.com',
    'pddpic.com', 'aixifan.com', 'vivo.com.cn',
    'jd.com', '360buyimg.com', 'up366.cn',
    'ljcdn.com', 'ifeng.com', 'tapimg.com',
    'antpcdn.com', 'baidupcs.com',
    'sohu.com', 'itc.cn',
  ],
  '360云CDN': [
    '360tpcdn.com', 'sogou.com', 'qq.com', 'cntv.cn',
    'dldir1.qq.com', 'gtimg.cn', '2345.com',
  ],
  '腾讯云CDN': ['webcdn.m.qq.com', 'master.qq.com'],
};

// ── 导入自动发现模块 ──
let discoverAllCdnUrls, matchCdnGroupFn;
try {
  const mod = await import('./cdn-discovery.mjs');
  discoverAllCdnUrls = mod.discoverAllCdnUrls;
  matchCdnGroupFn = mod.matchCdnGroup;
} catch {
  // 降级: 无发现模块时使用内置静态列表
  discoverAllCdnUrls = async () => [];
  matchCdnGroupFn = null;
}

// ── 已知稳定 CDN 下载源（备用池种子）──
const KNOWN_CDN_SOURCES = {
  'Speedo云CDN': [
    'https://lf9-apk.ugapk.cn/package/apk/aweme/5072_340301/aweme_douyin-huidu-gw-aweme-3430_v5072_340301_eea8_1747058635.apk',
    'https://cdn.aixifan.com/downloads/AcfunLive-Setup-1.9.0.200-ReleaseX64_6d5c40.exe',
    'https://devtools.qiniu.com/linux/amd64/qrsctl',
    'https://devtools.qiniu.com/qdoractl-darwin-amd64-0.4.6',
    'https://gw.alipayobjects.com/os/volans-demo/93211a67-0eed-40ff-8a48-f6c137a88781/MiniProgramStudio-3.1.3.exe',
    'https://downapp.sina.cn/m/06/sinaNews_8.27.0_1719288606_4386_3538_armeabi-v7a.apk',
    'https://i1.sinaimg.cn/edu/sinaopen/SinaOpencourse_V2.02.apk',
    'https://statics.itc.cn/lt-app/sohumobile_official_gray_optimizeRelease_4_1.0.3_01161850.apk',
    'https://open-image.ws.126.net/android_phone_release-sp_open-v9.9.9-v0a5b3c1dc0df472bb2fb057d0a5426c3.apk',
    'https://open-image.ws.126.net/android_phone_release-sp_open-v9.10.1-vb7b79d6b531448baaca3a81e7fbdc13f.apk',
    'https://lf3-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe',
    'https://lf6-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe',
    'https://wwwstatic.vivo.com.cn/vivoportal/files/download/app/20231026/350bda07c8a0719919bcadbf5aea3538.apk',
    'https://cd.pddpic.com/android_dev/2023-11-08/a35eaee8e1f9f018cc40ace12931f7a2.apk',
    'https://cd.pddpic.com/android_dev/2024-06-26/06027b4121edcd1f106d992128a7124b.apk',
    'https://cd.pddpic.com/volantis-open/volantis-common/app/com.xunmeng.workBench/Release_1834716.exe',
    'https://cdn-ws.up366.cn/cn/files/setup/C72C242ED8400001EE2178A912E01146/2022/06/21/4dca83b3e1c461e070f75d2b485e75e7/up366-5.6.6.0.exe',
    'https://lf3-package.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe',
    'https://lf6-package.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe',
    'https://lf9-package.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe',
    'https://file.ljcdn.com/saas-pkg/asaas-new/new_asaas_4.0.56_win_prod.zip',
    'https://video19.ifeng.com/video09/2022/07/06/p6950362006465552946-102-162611.mp4',
    'https://download.jr.jd.com/downapp/jrapp_jr9631.apk',
    'https://rls.tapimg.com/pub2/202310/64a7c775fa5503fc30f46c6fea6f9faf.apk',
    'https://apk.360buyimg.com/build-cms/V5.2.0-4258-800000136-bazaar-64bit.apk',
    'https://upgrade.k.sohu.com/upgrade/SohuNews_V7.3.6_0421110326_online_1003.apk',
    'https://uu.gdl.netease.com/4112/UU-4.68.1.exe',
    'https://8c8947-1956185621.antpcdn.com:19001/b/pkg-ant.baidu.com/issue/netdisk/LinuxGuanjia/4.17.7/baidunetdisk_4.17.7_amd64.deb',
    'https://1270e8-3086970414.antpcdn.com:19001/b/pkg-ant.baidu.com/issue/netdisk/yunguanjia/BaiduNetdisk_7.55.1.101.exe',
  ],
  '360云CDN': [
    'https://cdn.qq.ime.sogou.com/QQPinyin_Setup_6.6.6304.400.exe',
    'http://softdlc.360tpcdn.com/auto/20201130/2000000064_f07aefc3d918ebdafa9418f3f5ef5f9c.exe',
    'https://dldir1.qq.com/qqtv/TencentVideo11.99.8523.0.exe',
    'http://softdlc.360tpcdn.com/auto/20201127/23_21ed487ededbbb428b2a7dcecc969c7c.exe',
    'https://download.cntv.cn/cbox/v6/ysyy_v6.0.3.3_1001_setup_x64.exe',
    'http://softdlc.360tpcdn.com/auto/20201127/100101123_879baf4f2d9d14f191be2443e16504af.exe',
    'http://bigsoftdlc.360tpcdn.com/auto/20200826/104511_999095167454c21f770b31e8f080ebb7.exe',
    'http://bigsoftdlc.360tpcdn.com/auto/20210401/103779382_99dafefbd4193095a95fa713348fe6e7.exe',
    'http://bigsoftdlc.360tpcdn.com/auto/20201125/105005364_74cbde2c220e12dbd49b2c86e0ab2c6f.exe',
    'https://dl.2345.com/pic/2345pic_x64_v11.3.0.10165.exe',
  ],
  '和彩云CDN': [
    'https://img.mcloud.139.com/material_prod/material_media/20221128/1669626861087.png',
  ],
  '天翼云CDN': [
    'https://desk.ctyun.cn:8999/desktop-prod/software/windows_tob_client/15/64/202030001/CtyunClouddeskUniversal_2.3.0_202030001_x86_20240327104015_Setup.exe',
  ],
  '腾讯云CDN': [
    'http://webcdn.m.qq.com/speed/SpeedTestData.dat',
  ],
};

// ── 网络工具 ──
const FETCH_TIMEOUT = 15_000;
const CONCURRENCY = 6;

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
  try {
    const resp = await fetchWithTimeout(url, { method: 'HEAD' });
    const latencyMs = Date.now() - start;
    const ok = resp.status >= 200 && resp.status < 400;
    return { ok, status: resp.status, latencyMs };
  } catch {
    try {
      const resp = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
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

    nodes.set(nodeId, {
      name,
      downloadUrl: dlSingleMatch ? dlSingleMatch[1] : null,
      downloadUrls,
      uploadUrl: ulSingleMatch ? ulSingleMatch[1] : null,
      uploadUrls,
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
