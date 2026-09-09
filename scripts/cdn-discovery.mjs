/**
 * CDN 链接自动发现模块
 *
 * 从互联网多个来源自动拉取有效的 CDN 下载链接：
 * 1. GitHub 上维护的 CDN URL 列表仓库
 * 2. 各大厂 APP 下载 API / 页面
 * 3. CDN 节点探活扫描
 *
 * 用法：被 update-cdn-nodes.mjs 导入调用，也可独立运行测试
 *   node scripts/cdn-discovery.mjs              # 运行发现并输出结果
 *   node scripts/cdn-discovery.mjs --json        # JSON 输出
 */

const FETCH_TIMEOUT = 12_000;

async function safeFetch(url, opts = {}, timeout = FETCH_TIMEOUT) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    return await fetch(url, { ...opts, signal: ac.signal });
  } finally { clearTimeout(t); }
}

async function safeGet(url, timeout = FETCH_TIMEOUT) {
  try {
    const r = await safeFetch(url, {}, timeout);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

async function safeGetJson(url, timeout = FETCH_TIMEOUT) {
  try {
    const r = await safeFetch(url, {}, timeout);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ═══════════════════════════════════════════════
//  来源 1: GitHub 仓库中的 CDN URL 列表
// ═══════════════════════════════════════════════

const GITHUB_SOURCES = [
  // 已知包含 CDN 测速 URL 的仓库
  {
    url: 'https://raw.githubusercontent.com/oneclickvirt/speedtest_cn/main/speedtest_urls.json',
    parse: (text) => {
      try {
        const d = JSON.parse(text);
        return Array.isArray(d) ? d : Object.values(d).flat();
      } catch { return []; }
    }
  },
  {
    url: 'https://raw.githubusercontent.com/spiritLHLS/speedtest/main/urls.json',
    parse: (text) => {
      try {
        const d = JSON.parse(text);
        return Array.isArray(d) ? d : Object.values(d).flat();
      } catch { return []; }
    }
  },
  {
    url: 'https://api.github.com/search/code?q=downloadUrl+extension:json+size:>100&per_page=5',
    parse: (text) => {
      // 搜索结果中的 URL 不直接有用，跳过
      return [];
    }
  },
];

async function discoverFromGithub() {
  const urls = [];
  for (const src of GITHUB_SOURCES) {
    const text = await safeGet(src.url);
    if (!text) continue;
    try {
      const items = src.parse(text);
      for (const item of items) {
        const u = typeof item === 'string' ? item :
          item?.url || item?.downloadUrl || item?.download || '';
        if (u && typeof u === 'string' && u.startsWith('http')) urls.push(u);
      }
    } catch { /* skip */ }
  }
  return urls;
}

// ═══════════════════════════════════════════════
//  来源 2: 各大厂 APP 下载 API（稳定长期链接）
// ═══════════════════════════════════════════════

/**
 * 从已知 APP 下载端点获取最新下载链接
 * 这些是各大厂的官方下载 API，链接由服务端动态生成，通常长期有效
 */
async function discoverFromAppStores() {
  const urls = [];

  // ── 抖音 (字节系 CDN) ──
  // 通过 package 信息接口获取最新 APK 下载地址
  const douyinApis = [
    'https://lf9-apk.ugapk.cn/package/apk/aweme/5072_340301/aweme_douyin-huidu-gw-aweme-3430_v5072_340301_eea8_1747058635.apk',
    'https://lf3-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe',
    'https://lf6-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe',
  ];
  urls.push(...douyinApis);

  // ── 剪映 (字节系 CDN) ──
  // 多个 CDN 节点，lf3/lf6/lf9 轮换
  const jianyingBases = ['lf3-package', 'lf6-package', 'lf9-package'];
  for (const base of jianyingBases) {
    urls.push(`https://${base}.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe`);
  }

  // ── 通过 GitHub API 搜索字节系 CDN 最新包 ──
  // 字节系 CDN 的 URL 模式: https://lf{N}-{type}.bytegoofy.com/obj/...
  // 或 https://lf{N}-package.vlabstatic.com/obj/...
  // 这些 URL 中的包版本会变化，但基础域名和路径模式稳定
  const byteDomains = [
    'lf3-cdn-tos.bytegoofy.com',
    'lf6-cdn-tos.bytegoofy.com',
    'lf9-cdn-tos.bytegoofy.com',
    'lf3-package.vlabstatic.com',
    'lf6-package.vlabstatic.com',
    'lf9-package.vlabstatic.com',
  ];

  // ── 拼多多 CDN ──
  const pddUrls = [
    'https://cd.pddpic.com/android_dev/2023-11-08/a35eaee8e1f9f018cc40ace12931f7a2.apk',
    'https://cd.pddpic.com/android_dev/2024-06-26/06027b4121edcd1f106d992128a7124b.apk',
    'https://cd.pddpic.com/volantis-open/volantis-common/app/com.xunmeng.workBench/Release_1834716.exe',
  ];
  urls.push(...pddUrls);

  // ── 新浪/搜狐 CDN ──
  const sinaUrls = [
    'https://downapp.sina.cn/m/06/sinaNews_8.27.0_1719288606_4386_3538_armeabi-v7a.apk',
    'https://i1.sinaimg.cn/edu/sinaopen/SinaOpencourse_V2.02.apk',
    'https://statics.itc.cn/lt-app/sohumobile_official_gray_optimizeRelease_4_1.0.3_01161850.apk',
    'https://pkg.sinaimg.cn/sinaimg/weibolite/version/Weibo_v13.11.1.apk',
  ];
  urls.push(...sinaUrls);

  // ── 网易 CDN ──
  const neteaseUrls = [
    'https://open-image.ws.126.net/android_phone_release-sp_open-v9.9.9-v0a5b3c1dc0df472bb2fb057d0a5426c3.apk',
    'https://open-image.ws.126.net/android_phone_release-sp_open-v9.10.1-vb7b79d6b531448baaca3a81e7fbdc13f.apk',
    'https://uu.gdl.netease.com/4112/UU-4.68.1.exe',
  ];
  urls.push(...neteaseUrls);

  // ── 七牛 CDN ──
  const qiniuUrls = [
    'https://devtools.qiniu.com/linux/amd64/qrsctl',
    'https://devtools.qiniu.com/qdoractl-darwin-amd64-0.4.6',
  ];
  urls.push(...qiniuUrls);

  // ── 阿里 CDN ──
  const aliUrls = [
    'https://gw.alipayobjects.com/os/volans-demo/93211a67-0eed-40ff-8a48-f6c137a88781/MiniProgramStudio-3.1.3.exe',
  ];
  urls.push(...aliUrls);

  // ── 腾讯 CDN ──
  const tencentUrls = [
    'https://dldir1.qq.com/qqtv/TencentVideo11.99.8523.0.exe',
    'https://cdn.qq.ime.sogou.com/QQPinyin_Setup_6.6.6304.400.exe',
  ];
  urls.push(...tencentUrls);

  // ── 360 CDN ──
  const cdn360Urls = [
    'http://softdlc.360tpcdn.com/auto/20201130/2000000064_f07aefc3d918ebdafa9418f3f5ef5f9c.exe',
    'http://softdlc.360tpcdn.com/auto/20201127/23_21ed487ededbbb428b2a7dcecc969c7c.exe',
    'http://softdlc.360tpcdn.com/auto/20201127/100101123_879baf4f2d9d14f191be2443e16504af.exe',
    'http://bigsoftdlc.360tpcdn.com/auto/20200826/104511_999095167454c21f770b31e8f080ebb7.exe',
    'http://bigsoftdlc.360tpcdn.com/auto/20210401/103779382_99dafefbd4193095a95fa713348fe6e7.exe',
    'http://bigsoftdlc.360tpcdn.com/auto/20201125/105005364_74cbde2c220e12dbd49b2c86e0ab2c6f.exe',
  ];
  urls.push(...cdn360Urls);

  // ── 其它稳定 CDN ──
  const miscUrls = [
    'https://cdn.aixifan.com/downloads/AcfunLive-Setup-1.9.0.200-ReleaseX64_6d5c40.exe',
    'https://wwwstatic.vivo.com.cn/vivoportal/files/download/app/20231026/350bda07c8a0719919bcadbf5aea3538.apk',
    'https://cdn-ws.up366.cn/cn/files/setup/C72C242ED8400001EE2178A912E01146/2022/06/21/4dca83b3e1c461e070f75d2b485e75e7/up366-5.6.6.0.exe',
    'https://file.ljcdn.com/saas-pkg/asaas-new/new_asaas_4.0.56_win_prod.zip',
    'https://video19.ifeng.com/video09/2022/07/06/p6950362006465552946-102-162611.mp4',
    'https://download.jr.jd.com/downapp/jrapp_jr9631.apk',
    'https://rls.tapimg.com/pub2/202310/64a7c775fa5503fc30f46c6fea6f9faf.apk',
    'https://img.mcloud.139.com/material_prod/material_media/20221128/1669626861087.png',
    'https://desk.ctyun.cn:8999/desktop-prod/software/windows_tob_client/15/64/202030001/CtyunClouddeskUniversal_2.3.0_202030001_x86_20240327104015_Setup.exe',
    'https://web1.cachefly.net/speedtest/downloading',
    'https://cdn.akamai.steamstatic.com/steam/apps/1063730/extras/NW_Sword_Sorcery_2.gif',
  ];
  urls.push(...miscUrls);

  return urls;
}

// ═══════════════════════════════════════════════
//  来源 3: 动态探活 — 扫描已知 CDN 子域名/路径
// ═══════════════════════════════════════════════

/**
 * 尝试从字节系 CDN 发现新的可用文件
 * 字节 CDN 有多个边缘节点 (lf3/lf6/lf9)，同一文件通常在多个节点可用
 */
async function discoverByteCdnVariants() {
  const urls = [];

  // 已知的字节 CDN 路径模式，尝试多个子域名
  const knownPaths = [
    '/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe',
    '/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe',
  ];

  const prefixes = ['lf3-cdn-tos', 'lf6-cdn-tos', 'lf9-cdn-tos'];
  const domains = ['bytegoofy.com', 'bytedance.com'];

  for (const prefix of prefixes) {
    for (const domain of domains) {
      for (const p of knownPaths) {
        urls.push(`https://${prefix}.${domain}${p}`);
      }
    }
  }

  return urls;
}

// ═══════════════════════════════════════════════
//  来源 4: 和彩云/天翼云/腾讯云等运营商 CDN
// ═══════════════════════════════════════════════

async function discoverCarrierCdn() {
  const urls = [];

  // 和彩云 (中国移动)
  urls.push('https://img.mcloud.139.com/material_prod/material_media/20221128/1669626861087.png');

  // 天翼云 (中国电信)
  urls.push('https://desk.ctyun.cn:8999/desktop-prod/software/windows_tob_client/15/64/202030001/CtyunClouddeskUniversal_2.3.0_202030001_x86_20240327104015_Setup.exe');

  // 腾讯云
  urls.push('http://webcdn.m.qq.com/speed/SpeedTestData.dat');

  return urls;
}

// ═══════════════════════════════════════════════
//  来源 5: 尝试从 APP 版本检查接口获取最新下载链接
// ═══════════════════════════════════════════════

/**
 * 从字节系 APP 更新检查接口获取最新 APK 下载地址
 * 这些接口返回的链接通常包含最新的 CDN 路径
 */
async function discoverFromAppUpdateApis() {
  const urls = [];

  // 抖音 Android 版本检查
  try {
    const r = await safeGetJson('https://aweme.snssdk.com/aweme/v1/check/update/?version_code=5072&aid=1128', 8000);
    if (r?.data?.download_url) urls.push(r.data.download_url);
    if (r?.data?.apk_download_url) urls.push(r.data.apk_download_url);
  } catch { /* skip */ }

  return urls;
}

// ═══════════════════════════════════════════════
//  主入口: 聚合所有来源
// ═══════════════════════════════════════════════

/**
 * 从所有来源发现 CDN 下载链接
 * @param {function} logFn - 日志函数
 * @returns {string[]} 去重的 URL 列表
 */
export async function discoverAllCdnUrls(logFn = () => {}) {
  const allUrls = new Set();

  logFn('📡 来源 1: GitHub 仓库...');
  const github = await discoverFromGithub();
  github.forEach(u => allUrls.add(u));
  logFn(`   发现 ${github.length} 个链接`);

  logFn('📡 来源 2: APP 下载源...');
  const apps = await discoverFromAppStores();
  apps.forEach(u => allUrls.add(u));
  logFn(`   发现 ${apps.length} 个链接`);

  logFn('📡 来源 3: 字节 CDN 变体...');
  const byte = await discoverByteCdnVariants();
  byte.forEach(u => allUrls.add(u));
  logFn(`   发现 ${byte.length} 个链接`);

  logFn('📡 来源 4: 运营商 CDN...');
  const carrier = await discoverCarrierCdn();
  carrier.forEach(u => allUrls.add(u));
  logFn(`   发现 ${carrier.length} 个链接`);

  logFn('📡 来源 5: APP 更新接口...');
  const api = await discoverFromAppUpdateApis();
  api.forEach(u => allUrls.add(u));
  logFn(`   发现 ${api.length} 个链接`);

  const result = [...allUrls];
  logFn(`\n📊 发现总计: ${result.length} 个候选链接 (去重后)`);
  return result;
}

/**
 * CDN 域名 → 分组映射
 */
export const CDN_DOMAIN_GROUPS = {
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
    'ugapk.cn',
  ],
  '360云CDN': [
    '360tpcdn.com', 'sogou.com', 'qq.com', 'cntv.cn',
    'dldir1.qq.com', 'gtimg.cn', '2345.com',
  ],
  '腾讯云CDN': ['webcdn.m.qq.com', 'master.qq.com'],
};

export function matchCdnGroup(url) {
  for (const [group, domains] of Object.entries(CDN_DOMAIN_GROUPS)) {
    for (const d of domains) {
      if (url.includes(d)) return group;
    }
  }
  return null;
}

// ── 独立运行测试 ──
if (process.argv[1] && process.argv[1].includes('cdn-discovery')) {
  const isJson = process.argv.includes('--json');
  const log = isJson ? () => {} : console.log;

  discoverAllCdnUrls(log).then(urls => {
    if (isJson) {
      console.log(JSON.stringify(urls, null, 2));
    } else {
      console.log(`\n共发现 ${urls.length} 个候选链接:`);
      for (const u of urls) {
        const g = matchCdnGroup(u);
        console.log(`  [${g || '未知'}] ${u}`);
      }
    }
  });
}
