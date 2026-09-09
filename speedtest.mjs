#!/usr/bin/env node
/**
 * SpeedTest CLI — 纯 Node.js 实现
 * 支持 LibreSpeed / Ookla / CDN 节点
 *
 * 用法:
 *   node speedtest.mjs              # 自动检测运营商，选择上海节点
 *   node speedtest.mjs --list       # 列出所有可用节点
 *   node speedtest.mjs -s <id>      # 指定节点
 *   node speedtest.mjs --mode libre # LibreSpeed 模式 (默认)
 *   node speedtest.mjs --mode ookla # Ookla 模式
 *   node speedtest.mjs --mode cdn   # CDN 下载测速模式
 *   node speedtest.mjs -h           # 帮助
 */

import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { execSync } from 'node:child_process';

// ═══════════════════════════════════════════════════
// 节点配置
// ═══════════════════════════════════════════════════

const LIBRE_NODES = {
  // ── 上海节点 ──
  'sh-telecom': {
    name: '上海电信 (中科大)',
    city: '上海', isp: 'telecom',
    server: 'https://test.ustc.edu.cn/backend/',
    dlURL: 'garbage.php', ulURL: 'empty.php',
    pingURL: 'empty.php', getIpURL: 'getIP.php',
    note: '可能有来源检查，失败自动 fallback',
  },
  'sh-unicom-5g': {
    name: '上海联通 5G',
    city: '上海', isp: 'unicom',
    server: 'https://mobile.shunicomtest.com/',
    dlURL: 'garbage.php', ulURL: 'empty.php',
    pingURL: 'empty.php', getIpURL: 'getIP.php',
  },
  'nju-fs': {
    name: '南京大学 文件服务',
    city: '南京', isp: 'edu',
    server: 'https://fs.nju.edu.cn/speed/',
    dlURL: 'garbage.php', ulURL: 'empty.php',
    pingURL: 'empty.php', getIpURL: 'getIP.php',
  },
  'nju-test': {
    name: '南京大学 测速站',
    city: '南京', isp: 'edu',
    server: 'https://test.nju.edu.cn/backend/',
    dlURL: 'garbage.php', ulURL: 'empty.php',
    pingURL: 'empty.php', getIpURL: 'getIP.php',
    note: 'Anubis 保护，可能失败',
  },
  'sjtu': {
    name: '上海交通大学',
    city: '上海', isp: 'edu',
    server: 'https://ftp.sjtu.edu.cn/speedtest/backend/',
    dlURL: 'garbage.php', ulURL: 'empty.php',
    pingURL: 'empty.php', getIpURL: 'getIP.php',
    note: '可能 502',
  },
  'tsinghua': {
    name: '清华大学',
    city: '北京', isp: 'edu',
    server: 'https://iptv.tsinghua.edu.cn/st/',
    dlURL: 'garbage.php', ulURL: 'empty.php',
    pingURL: 'empty.php', getIpURL: 'getIP.php',
    note: '可能 404',
  },
  'cloudflare': {
    name: 'CloudFlare 全球 CDN',
    city: '全球', isp: 'any',
    server: 'https://speed.cloudflare.com/',
    dlURL: '__down?bytes=25000000', ulURL: '__up',
    pingURL: '__down?bytes=0', getIpURL: null,
    isCloudflare: true,
  },
};

const OOKLA_NODES = {
  'sh-telecom-3633': {
    name: '上海电信', id: '3633',
    city: '上海', isp: 'telecom',
    host: '222.68.195.2:8080',
  },
  'sh-unicom-24447': {
    name: '上海联通 5G', id: '24447',
    city: '上海', isp: 'unicom',
    host: 'mobile.shunicomtest.com',
  },
  'sh-mobile-4665': {
    name: '上海移动', id: '4665',
    city: '上海', isp: 'mobile',
    host: 'sh.mobile.speedtest.net',
  },
  'sh-unicom-5083': {
    name: '上海联通', id: '5083',
    city: '上海', isp: 'unicom',
    host: 'sh.unicom.speedtest.net',
  },
  'nj-telecom-5396': {
    name: '南京电信 5G', id: '5396',
    city: '南京', isp: 'telecom',
    host: '115.169.22.130:8080',
  },
  'hz-telecom-59386': {
    name: '杭州电信', id: '59386',
    city: '杭州', isp: 'telecom',
    host: '61.130.56.1:8080',
  },
  'bj-unicom-43752': {
    name: '北京联通', id: '43752',
    city: '北京', isp: 'unicom',
    host: 'beijing.unicomtest.com:8080',
  },
  'nb-telecom-59387': {
    name: '宁波电信', id: '59387',
    city: '宁波', isp: 'telecom',
    host: 'cesu-nb.zjtelecom.com.cn:8080',
  },
};

// ── 🌐 CDN 下载测速节点 ──
// 每个节点按 CDN 列表名命名，测速时随机选取下载链接
const CDN_NODES = {
  'mcloud': {
    name: '和彩云 CDN',
    city: '全国', isp: 'any',
    downloadUrls: [
      'https://img.mcloud.139.com/material_prod/material_media/20221128/1669626861087.png'
    ],
    uploadUrl: 'https://speed.cloudflare.com/__up',
    pingUrl: 'http://webcdn.m.qq.com',
  },
  'ctyun': {
    name: '天翼云 CDN',
    city: '全国', isp: 'any',
    downloadUrls: [
      'https://desk.ctyun.cn:8999/desktop-prod/software/windows_tob_client/15/64/202030001/CtyunClouddeskUniversal_2.3.0_202030001_x86_20240327104015_Setup.exe'
    ],
    uploadUrl: 'https://speed.cloudflare.com/__up',
    pingUrl: 'http://webcdn.m.qq.com',
  },
  'speedo': {
    name: 'Speedo云 CDN',
    city: '全国', isp: 'any',
    downloadUrls: [
      'https://lf9-apk.ugapk.cn/package/apk/aweme/5072_340301/aweme_douyin-huidu-gw-aweme-3430_v5072_340301_eea8_1747058635.apk',
      'https://cdn.aixifan.com/downloads/AcfunLive-Setup-1.9.0.200-ReleaseX64_6d5c40.exe',
      'https://devtools.qiniu.com/linux/amd64/qrsctl',
      'https://devtools.qiniu.com/qdoractl-darwin-amd64-0.4.6',
      'https://gw.alipayobjects.com/os/volans-demo/93211a67-0eed-40ff-8a48-f6c137a88781/MiniProgramStudio-3.1.3.exe',
      'https://8c8947-1956185621.antpcdn.com:19001/b/pkg-ant.baidu.com/issue/netdisk/LinuxGuanjia/4.17.7/baidunetdisk_4.17.7_amd64.deb',
      'https://downapp.sina.cn/m/06/sinaNews_8.27.0_1719288606_4386_3538_armeabi-v7a.apk',
      'https://i1.sinaimg.cn/edu/sinaopen/SinaOpencourse_V2.02.apk',
      'https://upgrade.k.sohu.com/upgrade/SohuNews_V7.3.6_0421110326_online_1003.apk',
      'https://statics.itc.cn/lt-app/sohumobile_official_gray_optimizeRelease_4_1.0.3_01161850.apk',
      'https://pkg.sinaimg.cn/weibo_13.11.1_vcode_6489_wm_3333_1001_so_32_64_weibo_5395_205935.apk',
      'https://open-image.ws.126.net/android_phone_release-sp_open-v9.9.9-v0a5b3c1dc0df472bb2fb057d0a5426c3.apk',
      'https://lf3-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe',
      'https://lf6-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe',
      'https://wwwstatic.vivo.com.cn/vivoportal/files/download/app/20231026/350bda07c8a0719919bcadbf5aea3538.apk',
      'https://cd.pddpic.com/android_dev/2023-11-08/a35eaee8e1f9f018cc40ace12931f7a2.apk',
      'https://1270e8-3086970414.antpcdn.com:19001/b/pkg-ant.baidu.com/issue/netdisk/yunguanjia/BaiduNetdisk_7.55.1.101.exe',
      'https://rls.tapimg.com/pub2/202310/64a7c775fa5503fc30f46c6fea6f9faf.apk',
      'https://uu.gdl.netease.com/4112/UU-4.68.1.exe',
      'https://cd.pddpic.com/android_dev/2024-06-26/06027b4121edcd1f106d992128a7124b.apk',
      'https://cd.pddpic.com/volantis-open/volantis-common/app/com.xunmeng.workBench/Release_1834716.exe',
      'https://cdn-ws.up366.cn/cn/files/setup/C72C242ED8400001EE2178A912E01146/2022/06/21/4dca83b3e1c461e070f75d2b485e75e7/up366-5.6.6.0.exe',
      'https://open-image.ws.126.net/android_phone_release-sp_open-v9.10.1-vb7b79d6b531448baaca3a81e7fbdc13f.apk',
      'https://lf3-package.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe',
      'https://lf6-package.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe',
      'https://lf9-package.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe',
      'https://file.ljcdn.com/saas-pkg/asaas-new/new_asaas_4.0.56_win_prod.zip',
      'https://video19.ifeng.com/video09/2022/07/06/p6950362006465552946-102-162611.mp4',
      'https://apk.360buyimg.com/build-cms/V5.2.0-4258-800000136-bazaar-64bit.apk',
      'https://download.jr.jd.com/downapp/jrapp_jr9631.apk'
    ],
    uploadUrls: [
      'https://test.ustc.edu.cn/backend/empty.php?cors=1',
      'https://iptv.tsinghua.edu.cn/st/empty.php?cors=1',
      'https://ftp.sjtu.edu.cn/speedtest/backend/empty.php?cors=1',
      'https://test.nju.edu.cn/backend/empty.php?cors=1',
      'https://219.140.61.101/backend/empty.php?cors=1',
      'https://119.36.86.250:81/backend/empty.php?cors=1',
      'http://211.67.53.2/backend/empty.php?cors=1'
    ],
    pingUrl: 'http://webcdn.m.qq.com',
  },
  'cdn-360': {
    name: '360云 CDN',
    city: '全国', isp: 'any',
    downloadUrls: [
      'https://cdn.qq.ime.sogou.com/QQPinyin_Setup_6.6.6304.400.exe',
      'http://softdlc.360tpcdn.com/auto/20201130/2000000064_f07aefc3d918ebdafa9418f3f5ef5f9c.exe',
      'https://dldir1.qq.com/qqtv/TencentVideo11.99.8523.0.exe',
      'http://softdlc.360tpcdn.com/auto/20201127/23_21ed487ededbbb428b2a7dcecc969c7c.exe',
      'https://download.cntv.cn/cbox/v6/ysyy_v6.0.3.3_1001_setup_x64.exe?spm=0.PF8WgFTOZypm.ETms2K8Lsimc.6&file=ysyy_v6.0.3.3_1001_setup_x64.exe',
      'http://softdlc.360tpcdn.com/auto/20201127/100101123_879baf4f2d9d14f191be2443e16504af.exe',
      'https://dl.2345.com/pic/2345pic_x64_v11.3.0.10165.exe',
      'http://bigsoftdlc.360tpcdn.com/auto/20200826/104511_999095167454c21f770b31e8f080ebb7.exe',
      'http://bigsoftdlc.360tpcdn.com/auto/20210401/103779382_99dafefbd4193095a95fa713348fe6e7.exe',
      'http://bigsoftdlc.360tpcdn.com/auto/20201125/105005364_74cbde2c220e12dbd49b2c86e0ab2c6f.exe'
    ],
    uploadUrl: 'https://speed.cloudflare.com/__up',
    pingUrl: 'http://webcdn.m.qq.com',
  },
  'tencent': {
    name: '腾讯云 CDN',
    city: '全国', isp: 'any',
    downloadUrls: [
      'http://webcdn.m.qq.com/speed/SpeedTestData.dat'
    ],
    uploadUrl: 'http://netsp.master.qq.com/cgi-bin/netspeed',
    pingUrl: 'http://webcdn.m.qq.com',
  },
};

// ═══════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════

const CONFIG = {
  dlStreams: 6,
  ulStreams: 3,
  streamDelay: 100,
  dlGraceTime: 2,
  ulGraceTime: 2,
  dlMaxTime: 10,
  ulMaxTime: 10,
  pingCount: 10,
  overheadFactor: 1.06,
  pollInterval: 200,
  ulBlobSize: 1024 * 1024, // 1MB
  regionTimeout: 5000,
  chunkSize: 100, // MB for garbage.php
};

// ═══════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function c(color, text) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function progressBar(ratio, width = 30) {
  const filled = Math.round(ratio * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function formatMbps(bps) {
  return (bps).toFixed(2);
}

function httpGet(url, onProgress, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      headers: {
        'Cache-Control': 'no-cache',
        'User-Agent': 'SpeedTest-CLI/1.0',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        httpGet(redirectUrl, onProgress, timeout).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let bytes = 0;
      res.on('data', (chunk) => {
        bytes += chunk.length;
        if (onProgress) onProgress(bytes);
      });
      res.on('end', () => resolve(bytes));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function httpPost(url, sizeBytes, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': sizeBytes,
        'Cache-Control': 'no-cache',
        'User-Agent': 'SpeedTest-CLI/1.0',
      },
    }, (res) => {
      res.resume();
      resolve(sizeBytes);
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
    const chunkSize = 64 * 1024;
    let sent = 0;
    const buf = Buffer.alloc(chunkSize);
    for (let i = 0; i < chunkSize; i++) buf[i] = Math.floor(Math.random() * 256);
    function writeChunk() {
      const toWrite = Math.min(chunkSize, sizeBytes - sent);
      if (toWrite <= 0) { req.end(); return; }
      const ok = req.write(buf.slice(0, toWrite));
      sent += toWrite;
      if (!ok) {
        req.once('drain', writeChunk);
      } else {
        setImmediate(writeChunk);
      }
    }
    writeChunk();
  });
}

function httpGetJSON(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'SpeedTest-CLI/1.0' },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGetJSON(new URL(res.headers.location, url).toString(), timeout).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ═══════════════════════════════════════════════════
// ISP 检测
// ═══════════════════════════════════════════════════

async function detectISP() {
  try {
    // 优先用 ipinfo.io
    const info = await httpGetJSON('https://ipinfo.io/json', 8000);
    const org = (info.org || '').toLowerCase();
    const city = info.city || '';
    const ip = info.ip || '';

    let isp = 'unknown';
    if (org.includes('telecom') || org.includes('chinanet') || org.includes('ct')) {
      isp = 'telecom';
    } else if (org.includes('unicom') || org.includes('cnc') || org.includes('cu')) {
      isp = 'unicom';
    } else if (org.includes('mobile') || org.includes('cmcc')) {
      isp = 'mobile';
    } else if (org.includes('alibaba') || org.includes('tencent') || org.includes('huawei') || org.includes('cloud')) {
      isp = 'cloud';
    }

    return { ip, city, isp, org: info.org || '', raw: info };
  } catch {
    // fallback: 用 LibreSpeed getIP
    try {
      const info = await httpGetJSON('https://fs.nju.edu.cn/speed/getIP.php?isp=true&distance=km', 8000);
      const raw = info.rawIspInfo || {};
      const org = (raw.org || '').toLowerCase();
      let isp = 'unknown';
      if (org.includes('telecom') || org.includes('chinanet')) isp = 'telecom';
      else if (org.includes('unicom') || org.includes('cnc')) isp = 'unicom';
      else if (org.includes('mobile') || org.includes('cmcc')) isp = 'mobile';
      else if (org.includes('alibaba') || org.includes('tencent')) isp = 'cloud';
      return { ip: raw.ip || info.processedString, city: raw.city || '', isp, org: raw.org || '', raw };
    } catch {
      return { ip: 'unknown', city: '', isp: 'unknown', org: '', raw: {} };
    }
  }
}

// ═══════════════════════════════════════════════════
// LibreSpeed 测试
// ═══════════════════════════════════════════════════

function buildLibreUrl(node, endpoint, extra = '') {
  const base = node.server;
  const sep = base.includes('?') ? '&' : '?';
  const url = base + endpoint + (endpoint.includes('?') ? '&' : '?');
  return url + extra + (extra ? '&' : '') + 'r=' + Math.random();
}

async function librePing(node, count = CONFIG.pingCount) {
  const latencies = [];
  for (let i = 0; i < count; i++) {
    try {
      const start = performance.now();
      await httpGet(buildLibreUrl(node, node.pingURL), null, CONFIG.regionTimeout);
      latencies.push(performance.now() - start);
    } catch { }
    await new Promise(r => setTimeout(r, 100));
  }
  if (latencies.length === 0) return { latency: 0, jitter: 0 };
  const latency = Math.min(...latencies);
  let jitter = 0;
  if (latencies.length >= 2) {
    let totalDiff = 0;
    for (let i = 1; i < latencies.length; i++) totalDiff += Math.abs(latencies[i] - latencies[i - 1]);
    jitter = totalDiff / (latencies.length - 1);
  }
  return {
    latency: parseFloat(latency.toFixed(2)),
    jitter: parseFloat(jitter.toFixed(2)),
  };
}

async function libreDownload(node) {
  const controller = { aborted: false };
  let totalBytes = 0;
  const startTime = performance.now();
  let graceDone = false;
  let graceStartTime = startTime;
  const speeds = [];

  const getDownloadUrl = () => {
    if (node.isCloudflare) {
      return `https://speed.cloudflare.com/__down?bytes=25000000&r=${Math.random()}`;
    }
    return buildLibreUrl(node, node.dlURL, `ckSize=${CONFIG.chunkSize}`);
  };

  const streamBytes = new Array(CONFIG.dlStreams).fill(0);
  const streamPromises = [];
  for (let i = 0; i < CONFIG.dlStreams; i++) {
    streamPromises.push((async () => {
      await new Promise(r => setTimeout(r, i * CONFIG.streamDelay));
      while (!controller.aborted) {
        try {
          await httpGet(getDownloadUrl(), (bytes) => {
            const delta = bytes - streamBytes[i];
            streamBytes[i] = bytes;
            totalBytes += delta;
          });
        } catch (e) {
          if (e.message === 'timeout' || e.message === 'aborted') break;
        }
      }
    })());
  }

  const samplingDone = new Promise((resolve) => {
    const interval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (!graceDone) {
        if (elapsed > CONFIG.dlGraceTime && totalBytes > 0) {
          graceDone = true;
          graceStartTime = performance.now();
          totalBytes = 0;
        }
        return;
      }
      const measureTime = (performance.now() - graceStartTime) / 1000;
      if (measureTime < 0.2) return;
      const bps = totalBytes / measureTime;
      const mbps = (bps * 8 * CONFIG.overheadFactor) / 1_000_000;
      speeds.push(mbps);

      // 实时显示
      const progress = Math.min(measureTime / CONFIG.dlMaxTime, 1);
      process.stdout.write(`\r  ${c('cyan', progressBar(progress))} ${c('bold', formatMbps(mbps))} Mbps `);

      if (measureTime >= CONFIG.dlMaxTime) {
        clearInterval(interval);
        controller.aborted = true;
        resolve();
      }
    }, CONFIG.pollInterval);
    setTimeout(() => {
      clearInterval(interval);
      controller.aborted = true;
      resolve();
    }, (CONFIG.dlGraceTime + CONFIG.dlMaxTime + 5) * 1000);
  });

  await samplingDone;
  await Promise.allSettled(streamPromises);

  const validSpeeds = speeds.slice(Math.floor(speeds.length * 0.2));
  const download = validSpeeds.length > 0
    ? parseFloat(Math.max(...validSpeeds).toFixed(2))
    : 0;
  process.stdout.write('\n');
  return { download, elapsed: Math.round((performance.now() - startTime) / 1000) };
}

async function libreUpload(node) {
  const controller = { aborted: false };
  let totalBytes = 0;
  const startTime = performance.now();
  let graceDone = false;
  let graceStartTime = startTime;
  const speeds = [];

  const uploadUrl = node.isCloudflare
    ? 'https://speed.cloudflare.com/__up'
    : buildLibreUrl(node, node.ulURL);

  const streamBytes = new Array(CONFIG.ulStreams).fill(0);
  const streamPromises = [];
  for (let i = 0; i < CONFIG.ulStreams; i++) {
    streamPromises.push((async () => {
      await new Promise(r => setTimeout(r, i * CONFIG.streamDelay));
      while (!controller.aborted) {
        try {
          const size = CONFIG.ulBlobSize;
          await httpPost(uploadUrl, size);
          totalBytes += size;
        } catch (e) {
          if (e.message === 'timeout' || e.message === 'aborted') break;
        }
      }
    })());
  }

  const samplingDone = new Promise((resolve) => {
    const interval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (!graceDone) {
        if (elapsed > CONFIG.ulGraceTime && totalBytes > 0) {
          graceDone = true;
          graceStartTime = performance.now();
          totalBytes = 0;
        }
        return;
      }
      const measureTime = (performance.now() - graceStartTime) / 1000;
      if (measureTime < 0.2) return;
      const bps = totalBytes / measureTime;
      const mbps = (bps * 8 * CONFIG.overheadFactor) / 1_000_000;
      speeds.push(mbps);

      const progress = Math.min(measureTime / CONFIG.ulMaxTime, 1);
      process.stdout.write(`\r  ${c('green', progressBar(progress))} ${c('bold', formatMbps(mbps))} Mbps `);

      if (measureTime >= CONFIG.ulMaxTime) {
        clearInterval(interval);
        controller.aborted = true;
        resolve();
      }
    }, CONFIG.pollInterval);
    setTimeout(() => {
      clearInterval(interval);
      controller.aborted = true;
      resolve();
    }, (CONFIG.ulGraceTime + CONFIG.ulMaxTime + 5) * 1000);
  });

  await samplingDone;
  await Promise.allSettled(streamPromises);

  const validSpeeds = speeds.slice(Math.floor(speeds.length * 0.2));
  const upload = validSpeeds.length > 0
    ? parseFloat(Math.max(...validSpeeds).toFixed(2))
    : 0;
  process.stdout.write('\n');
  return { upload, elapsed: Math.round((performance.now() - startTime) / 1000) };
}

async function libreGetIp(node) {
  if (!node.getIpURL) return 'N/A';
  try {
    const info = await httpGetJSON(buildLibreUrl(node, node.getIpURL, 'isp=true&distance=km'), 5000);
    return info.processedString || info.raw || 'N/A';
  } catch {
    return 'N/A';
  }
}

// ═══════════════════════════════════════════════════
// 节点选择
// ═══════════════════════════════════════════════════

function selectNode(mode, ispInfo, preferredNode) {
  const nodes = mode === 'ookla' ? OOKLA_NODES : mode === 'cdn' ? CDN_NODES : LIBRE_NODES;
  const entries = Object.entries(nodes);

  // 如果指定了节点
  if (preferredNode) {
    const found = entries.find(([id]) => id === preferredNode);
    if (found) return { id: found[0], ...found[1] };
    // 也试试匹配 name
    const byName = entries.find(([, n]) => n.name.includes(preferredNode));
    if (byName) return { id: byName[0], ...byName[1] };
    console.log(c('yellow', `⚠ 节点 "${preferredNode}" 未找到，使用自动选择`));
  }

  // CDN 模式默认选第一个
  if (mode === 'cdn') {
    return { id: entries[0][0], ...entries[0][1] };
  }

  // 优先选择上海 + 匹配运营商
  const isp = ispInfo.isp;
  const cityMatch = entries.filter(([, n]) => n.city === '上海');
  const ispMatch = cityMatch.filter(([, n]) => n.isp === isp || n.isp === 'any');
  const fallback = ispMatch.length > 0 ? ispMatch : cityMatch.length > 0 ? cityMatch : entries;

  // 选择第一个可用的
  return { id: fallback[0][0], ...fallback[0][1] };
}

// ═══════════════════════════════════════════════════
// 列出节点
// ═══════════════════════════════════════════════════

function listNodes() {
  console.log(c('bold', '\n📡 LibreSpeed 节点:\n'));
  console.log(c('gray', '  ID'.padEnd(22) + '名称'.padEnd(24) + '城市'.padEnd(8) + '运营商'));
  console.log(c('gray', '  ' + '─'.repeat(70)));
  for (const [id, node] of Object.entries(LIBRE_NODES)) {
    const note = node.note ? c('yellow', ` (${node.note})`) : '';
    console.log(`  ${c('cyan', id.padEnd(20))} ${node.name.padEnd(20)} ${node.city.padEnd(6)} ${node.isp}${note}`);
  }

  console.log(c('bold', '\n📡 Ookla 节点:\n'));
  console.log(c('gray', '  ID'.padEnd(22) + '名称'.padEnd(24) + '城市'.padEnd(8) + '运营商'));
  console.log(c('gray', '  ' + '─'.repeat(70)));
  for (const [id, node] of Object.entries(OOKLA_NODES)) {
    console.log(`  ${c('cyan', id.padEnd(20))} ${node.name.padEnd(20)} ${node.city.padEnd(6)} ${node.isp}`);
  }

  console.log(c('bold', '\n📡 CDN 下载测速节点:\n'));
  console.log(c('gray', '  ID'.padEnd(22) + '名称'.padEnd(24) + '下载源数'));
  console.log(c('gray', '  ' + '─'.repeat(50)));
  for (const [id, node] of Object.entries(CDN_NODES)) {
    const count = node.downloadUrls ? node.downloadUrls.length : 1;
    const upload = node.uploadUrls ? ` | 上传源: ${node.uploadUrls.length}` : '';
    console.log(`  ${c('cyan', id.padEnd(20))} ${node.name.padEnd(20)} ${count}个${upload}`);
  }
  console.log();
}

// ═══════════════════════════════════════════════════
// CDN 测速函数
// ═══════════════════════════════════════════════════

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

async function cdnPing(node, count = CONFIG.pingCount) {
  const target = node.pingUrl || pickRandom(node.downloadUrls) || node.downloadUrl;
  const latencies = [];
  for (let i = 0; i < count; i++) {
    try {
      const start = performance.now();
      await httpGet(target, null, CONFIG.regionTimeout);
      latencies.push(performance.now() - start);
    } catch { }
    await new Promise(r => setTimeout(r, 200));
  }
  if (latencies.length === 0) return { latency: 0, jitter: 0 };
  const latency = Math.min(...latencies);
  let jitter = 0;
  if (latencies.length >= 2) {
    let totalDiff = 0;
    for (let i = 1; i < latencies.length; i++) totalDiff += Math.abs(latencies[i] - latencies[i - 1]);
    jitter = totalDiff / (latencies.length - 1);
  }
  return {
    latency: parseFloat(latency.toFixed(2)),
    jitter: parseFloat(jitter.toFixed(2)),
  };
}

async function cdnDownload(node) {
  const dlUrl = pickRandom(node.downloadUrls) || node.downloadUrl;
  const controller = { aborted: false };
  let totalBytes = 0;
  const startTime = performance.now();
  let graceDone = false;
  let graceStartTime = startTime;
  const speeds = [];

  const streamBytes = new Array(CONFIG.dlStreams).fill(0);
  const streamPromises = [];
  for (let i = 0; i < CONFIG.dlStreams; i++) {
    streamPromises.push((async () => {
      await new Promise(r => setTimeout(r, i * CONFIG.streamDelay));
      while (!controller.aborted) {
        try {
          await httpGet(dlUrl + (dlUrl.includes('?') ? '&' : '?') + '_nocache=' + Math.random(), (bytes) => {
            const delta = bytes - streamBytes[i];
            streamBytes[i] = bytes;
            totalBytes += delta;
          });
        } catch (e) {
          if (e.message === 'timeout' || e.message === 'aborted') break;
        }
      }
    })());
  }

  const samplingDone = new Promise((resolve) => {
    const interval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (!graceDone) {
        if (elapsed > CONFIG.dlGraceTime && totalBytes > 0) {
          graceDone = true;
          graceStartTime = performance.now();
          totalBytes = 0;
        }
        return;
      }
      const measureTime = (performance.now() - graceStartTime) / 1000;
      if (measureTime < 0.2) return;
      const bps = totalBytes / measureTime;
      const mbps = (bps * 8 * CONFIG.overheadFactor) / 1_000_000;
      speeds.push(mbps);
      const progress = Math.min(measureTime / CONFIG.dlMaxTime, 1);
      process.stdout.write(`\r  ${c('cyan', progressBar(progress))} ${c('bold', formatMbps(mbps))} Mbps `);
      if (measureTime >= CONFIG.dlMaxTime) {
        clearInterval(interval);
        controller.aborted = true;
        resolve();
      }
    }, CONFIG.pollInterval);
    setTimeout(() => {
      clearInterval(interval);
      controller.aborted = true;
      resolve();
    }, (CONFIG.dlGraceTime + CONFIG.dlMaxTime + 5) * 1000);
  });

  await samplingDone;
  await Promise.allSettled(streamPromises);

  const validSpeeds = speeds.slice(Math.floor(speeds.length * 0.2));
  const download = validSpeeds.length > 0
    ? parseFloat(Math.max(...validSpeeds).toFixed(2))
    : 0;
  process.stdout.write('\n');
  return { download, elapsed: Math.round((performance.now() - startTime) / 1000) };
}

async function cdnUpload(node) {
  const ulUrl = pickRandom(node.uploadUrls) || node.uploadUrl;
  if (!ulUrl) return { upload: 0, elapsed: 0 };

  const controller = { aborted: false };
  let totalBytes = 0;
  const startTime = performance.now();
  let graceDone = false;
  let graceStartTime = startTime;
  const speeds = [];

  const streamBytes = new Array(CONFIG.ulStreams).fill(0);
  const streamPromises = [];
  for (let i = 0; i < CONFIG.ulStreams; i++) {
    streamPromises.push((async () => {
      await new Promise(r => setTimeout(r, i * CONFIG.streamDelay));
      while (!controller.aborted) {
        try {
          const size = CONFIG.ulBlobSize;
          await httpPost(ulUrl, size);
          totalBytes += size;
        } catch (e) {
          if (e.message === 'timeout' || e.message === 'aborted') break;
        }
      }
    })());
  }

  const samplingDone = new Promise((resolve) => {
    const interval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (!graceDone) {
        if (elapsed > CONFIG.ulGraceTime && totalBytes > 0) {
          graceDone = true;
          graceStartTime = performance.now();
          totalBytes = 0;
        }
        return;
      }
      const measureTime = (performance.now() - graceStartTime) / 1000;
      if (measureTime < 0.2) return;
      const bps = totalBytes / measureTime;
      const mbps = (bps * 8 * CONFIG.overheadFactor) / 1_000_000;
      speeds.push(mbps);
      const progress = Math.min(measureTime / CONFIG.ulMaxTime, 1);
      process.stdout.write(`\r  ${c('cyan', progressBar(progress))} ${c('bold', formatMbps(mbps))} Mbps `);
      if (measureTime >= CONFIG.ulMaxTime) {
        clearInterval(interval);
        controller.aborted = true;
        resolve();
      }
    }, CONFIG.pollInterval);
    setTimeout(() => {
      clearInterval(interval);
      controller.aborted = true;
      resolve();
    }, (CONFIG.ulGraceTime + CONFIG.ulMaxTime + 5) * 1000);
  });

  await samplingDone;
  await Promise.allSettled(streamPromises);

  const validSpeeds = speeds.slice(Math.floor(speeds.length * 0.2));
  const upload = validSpeeds.length > 0
    ? parseFloat(Math.max(...validSpeeds).toFixed(2))
    : 0;
  process.stdout.write('\n');
  return { upload, elapsed: Math.round((performance.now() - startTime) / 1000) };
}

// ═══════════════════════════════════════════════════
// 主测试流程
// ═══════════════════════════════════════════════════

async function runTest(mode, nodeId) {
  console.log(c('bold', '\n🔍 SpeedTest CLI — 纯 Node.js 实现\n'));

  // 1. 检测 ISP
  process.stdout.write(c('dim', '  检测运营商...'));
  const ispInfo = await detectISP();
  console.log(`\r  ${c('green', '✓')} IP: ${c('bold', ispInfo.ip)} | 运营商: ${c('bold', ispInfo.isp)} | 城市: ${ispInfo.city}`);
  if (ispInfo.org) console.log(c('dim', `    ${ispInfo.org}`));

  // 2. 选择节点
  const node = selectNode(mode, ispInfo, nodeId);
  console.log(`  ${c('green', '✓')} 节点: ${c('bold', node.name)} (${node.city})`);
  if (mode === 'cdn') {
    const dlUrl = pickRandom(node.downloadUrls) || node.downloadUrl;
    console.log(c('dim', `    下载源: ${dlUrl.substring(0, 80)}...`));
    if (node.downloadUrls) console.log(c('dim', `    共 ${node.downloadUrls.length} 个下载源，随机选取`));
  } else if (mode === 'libre') {
    console.log(c('dim', `    ${node.server}`));
  } else {
    console.log(c('dim', `    ID: ${node.id} | ${node.host}`));
  }

  if (mode === 'ookla') {
    console.log(c('yellow', '\n  ⚠ Ookla 模式需要 speedtest-cli 二进制文件'));
    console.log(c('dim', '  请安装: https://www.speedtest.net/apps/cli'));
    console.log(c('dim', `  然后运行: speedtest -s ${node.id}`));
    return;
  }

  let pingResult, dlResult, ulResult;

  if (mode === 'cdn') {
    // CDN 模式测速流程
    console.log('');
    process.stdout.write(c('dim', '  测试延迟...'));
    pingResult = await cdnPing(node);
    console.log(`\r  ${c('green', '✓')} 延迟: ${c('bold', pingResult.latency)} ms | 抖动: ${pingResult.jitter} ms`);

    console.log('');
    console.log(c('bold', '  ⬇ 下载测试'));
    dlResult = await cdnDownload(node);
    console.log(`  ${c('green', '✓')} 下载: ${c('bold', formatMbps(dlResult.download))} Mbps (${dlResult.elapsed}s)`);

    console.log('');
    console.log(c('bold', '  ⬆ 上传测试'));
    ulResult = await cdnUpload(node);
    console.log(`  ${c('green', '✓')} 上传: ${c('bold', formatMbps(ulResult.upload))} Mbps (${ulResult.elapsed}s)`);
  } else {
    // LibreSpeed 模式测速流程
    console.log('');
    process.stdout.write(c('dim', '  获取节点 IP 信息...'));
    const clientIp = await libreGetIp(node);
    console.log(`\r  ${c('green', '✓')} 节点视角 IP: ${c('bold', clientIp)}`);

    console.log('');
    process.stdout.write(c('dim', '  测试延迟...'));
    pingResult = await librePing(node);
    console.log(`\r  ${c('green', '✓')} 延迟: ${c('bold', pingResult.latency)} ms | 抖动: ${pingResult.jitter} ms`);

    console.log('');
    console.log(c('bold', '  ⬇ 下载测试'));
    dlResult = await libreDownload(node);
    console.log(`  ${c('green', '✓')} 下载: ${c('bold', formatMbps(dlResult.download))} Mbps (${dlResult.elapsed}s)`);

    console.log('');
    console.log(c('bold', '  ⬆ 上传测试'));
    ulResult = await libreUpload(node);
    console.log(`  ${c('green', '✓')} 上传: ${c('bold', formatMbps(ulResult.upload))} Mbps (${ulResult.elapsed}s)`);
  }

  // 结果汇总
  console.log(c('bold', '\n' + '═'.repeat(50)));
  console.log(c('bold', '  📊 测速结果'));
  console.log(c('bold', '═'.repeat(50)));
  console.log(`  节点:    ${c('cyan', node.name)} (${node.city})`);
  console.log(`  运营商:  ${ispInfo.isp}`);
  console.log(`  延迟:    ${c('yellow', pingResult.latency + ' ms')} (±${pingResult.jitter})`);
  console.log(`  下载:    ${c('green', formatMbps(dlResult.download) + ' Mbps')}`);
  console.log(`  上传:    ${c('blue', formatMbps(ulResult.upload) + ' Mbps')}`);
  console.log(c('bold', '═'.repeat(50) + '\n'));

  return {
    ping: pingResult.latency,
    jitter: pingResult.jitter,
    download: dlResult.download,
    upload: ulResult.upload,
    node: node.name,
    city: node.city,
    isp: ispInfo.isp,
  };
}

// ═══════════════════════════════════════════════════
// CLI 入口
// ═══════════════════════════════════════════════════

function printHelp() {
  console.log(`
${c('bold', 'SpeedTest CLI')} — 纯 Node.js 测速工具

${c('bold', '用法:')}
  node speedtest.mjs [选项]

${c('bold', '选项:')}
  -s, --server <id>     指定节点 ID
  -m, --mode <mode>     测速模式: libre (默认) | ookla | cdn
  -l, --list            列出所有可用节点
  -c, --chunk <MB>      下载块大小 (默认 100MB)
  --dl-streams <n>      下载并发流 (默认 6)
  --ul-streams <n>      上传并发流 (默认 3)
  --dl-time <s>         下载测试时长 (默认 10s)
  --ul-time <s>         上传测试时长 (默认 10s)
  -h, --help            显示帮助

${c('bold', '示例:')}
  node speedtest.mjs                        # 自动选择上海节点
  node speedtest.mjs -s nju-fs              # 使用南大节点
  node speedtest.mjs -s cloudflare          # 使用 CloudFlare
  node speedtest.mjs --mode ookla -s sh-telecom-3633
  node speedtest.mjs -c 200 --dl-streams 12  # 大数据量 + 多流

${c('bold', '上海节点 (默认):')}
  sh-telecom     上海电信 (中科大)
  sh-unicom-5g   上海联通 5G
  sjtu           上海交通大学
  nju-fs         南京大学 文件服务 (稳定推荐)
`);
}

// 解析参数
const args = process.argv.slice(2);
let mode = 'libre';
let nodeId = null;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-h': case '--help':
      printHelp();
      process.exit(0);
    case '-l': case '--list':
      listNodes();
      process.exit(0);
    case '-s': case '--server':
      nodeId = args[++i];
      break;
    case '-m': case '--mode':
      mode = args[++i];
      break;
    case '-c': case '--chunk':
      CONFIG.chunkSize = parseInt(args[++i]) || 100;
      break;
    case '--dl-streams':
      CONFIG.dlStreams = parseInt(args[++i]) || 6;
      break;
    case '--ul-streams':
      CONFIG.ulStreams = parseInt(args[++i]) || 3;
      break;
    case '--dl-time':
      CONFIG.dlMaxTime = parseInt(args[++i]) || 10;
      break;
    case '--ul-time':
      CONFIG.ulMaxTime = parseInt(args[++i]) || 10;
      break;
  }
}

runTest(mode, nodeId).catch((err) => {
  console.error(c('red', `\n✗ 测试失败: ${err.message}\n`));
  process.exit(1);
});
