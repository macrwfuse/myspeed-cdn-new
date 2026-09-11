import fs from 'node:fs';

// ── 🇨🇳🇭🇰 国内 + 香港 Ookla Speedtest 节点 ──
// 由 scripts/update-ookla-nodes.mjs 自动生成: 候选来自 bench.laset.com 与
// Ookla 官方目录 API, 逐个实测延迟筛选(默认 ≤100ms)。
// 目录外的 ID 会被官方 CLI 拒绝(NoServersException), 故必须先过目录这一关。
// 上次验证: 2026-09-11
// 国内 4 个 / 香港 9 个; 逐节点延迟见 scripts/.last-ookla-report.json
export const OOKLA_CN_SERVERS = {
    "24447": {
        name: "上海",
        sponsor: "China Unicom 5G",
        country: "China",
        cc: "CN",
        distance: 1034,
        host: "mobile.shunicomtest.com.prod.hosts.ooklaserver.net:8080"
    },
    "30852": {
        name: "昆山",
        sponsor: "Duke Kunshan University",
        country: "China",
        cc: "CN",
        distance: 1003,
        host: "speedtest.dukekunshan.edu.cn:8080"
    },
    "3633": {
        name: "上海",
        sponsor: "China Telecom",
        country: "China",
        cc: "CN",
        distance: 1034,
        host: "speedtest1.online.sh.cn:8080"
    },
    "16204": {
        name: "苏州",
        sponsor: "JSQY",
        country: "China",
        cc: "CN",
        distance: 980,
        host: "speedtest.jsqiuying.com:8080"
    },
    "60178": {
        name: "香港",
        sponsor: "Sun Mobile",
        country: "Hong Kong",
        cc: "HK",
        distance: 854,
        host: "sunmobile.hkspeedtest.com.prod.hosts.ooklaserver.net:8080"
    },
    "1536": {
        name: "香港",
        sponsor: "STC",
        country: "Hong Kong",
        cc: "HK",
        distance: 854,
        host: "suntechspeedtest.com.prod.hosts.ooklaserver.net:8080"
    },
    "32155": {
        name: "香港",
        sponsor: "CMHK Mobile Service",
        country: "Hong Kong",
        cc: "HK",
        distance: 850,
        host: "speedtest.hk.chinamobile.com:8080"
    },
    "43356": {
        name: "香港",
        sponsor: "1010",
        country: "Hong Kong",
        cc: "HK",
        distance: 853,
        host: "1010.hkspeedtest.com.prod.hosts.ooklaserver.net:8080"
    },
    "57779": {
        name: "香港",
        sponsor: "ラタトスク",
        country: "Hong Kong",
        cc: "HK",
        distance: 854,
        host: "hoshiyomi.ratatoskr.org.prod.hosts.ooklaserver.net:8080"
    },
    "60177": {
        name: "香港",
        sponsor: "Club SIM by HKT",
        country: "Hong Kong",
        cc: "HK",
        distance: 854,
        host: "hkt.hkspeedtest.com.prod.hosts.ooklaserver.net:8080"
    },
    "13538": {
        name: "香港",
        sponsor: "CSL",
        country: "Hong Kong",
        cc: "HK",
        distance: 846,
        host: "csl.hkspeedtest.com.prod.hosts.ooklaserver.net:8080"
    },
    "63143": {
        name: "香港",
        sponsor: "Netvigator",
        country: "Hong Kong",
        cc: "HK",
        distance: 851,
        host: "hkspeedtest.netvigator.com.prod.hosts.ooklaserver.net:8080"
    },
    "37639": {
        name: "香港",
        sponsor: "CMHK Broadband",
        country: "Hong Kong",
        cc: "HK",
        distance: 850,
        host: "speedtestbb.hk.chinamobile.com:8080"
    }
};

// ── 🎓 国内 LibreSpeed 教育网节点 ──
// 2026-09 实测公网可用性: 南大/浙大正常; 其余教育网节点做了 IP 准入控制,
// 校外公网访问必然失败(与请求头无关, 已验证带浏览器 UA/Referer 无效):
//   中科大 test.ustc.edu.cn/backend   → HTTP 500 响应体 "not ustc" (IP 白名单)
//   清华 iptv.tsinghua.edu.cn/st      → 307 跳 oauth.tsinghua.edu.cn LB 统一认证
//   上交 speedtest.sjtu.edu.cn        → 302 report/error.php?err=out (仅校内 IP)
//   武汉理工 219.140.61.101 / 湖北 119.36.86.250 / 武汉 211.67.53.2 → 不可达
// 教育网/校园网内用户如需使用被移除节点, 可从 git 历史恢复。
export const LIBRE_CN_SERVERS = {
    "cn-edu-nju": {
        id: "cn-edu-nju",
        name: "教育网 · 南大 (LibreSpeed)",
        server: "https://fs.nju.edu.cn/speed/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
    "cn-edu-zju": {
        id: "cn-edu-zju",
        name: "教育网 · 浙大 (LibreSpeed)",
        server: "http://speedtest.zju.edu.cn",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    }
};

// ── 🌐 CDN 下载测速节点 ──
// 来源: NetworkPanel / speed.do

// ── CDN 上传测速端点池（实测：mbd.baidu 41.7 / vcs.zijie 55.7 / Cloudflare 28.2 / QQ netspeed 62.7 Mbps）──
// 仅用于 CDN 测速节点（cdn-* / speeddo-cf-us）；Ookla / LibreSpeed 节点不受影响。
// 备注：
//   mbd.baidu.com / vcs.zijieapi.com        多流 octet-stream 直传即可（speed.do/st 核心1/2）
//   speed.cloudflare.com/__up               需带 UA/Origin 且 URL 不带额外参数
// 请求方式的自动适配在 server/util/providers/cdnSpeedtest.js（按主机匹配）。
// 注: netsp.master.qq.com 上传慢(实测大包 multipart 拖长), 不放入共享池, 仅 cdn-tencent 池尾用
export const CDN_UPLOAD_URLS = [
    "https://mbd.baidu.com/ztbox?action=zpblog&nocache=1",
    "https://vcs.zijieapi.com/vc/setting?aid=6383&pageId=6241&nocache=1",
    "https://speed.cloudflare.com/__up"
];

export const CDN_SERVERS = {
    "cdn-cloudflare-25m": {
        id: "cdn-cloudflare-25m",
        name: "Cloudflare · 25MB",
        downloadUrl: "https://speed.cloudflare.com/__down?bytes=25000000",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://speed.cloudflare.com/__down?bytes=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-cloudflare-100m": {
        id: "cdn-cloudflare-100m",
        name: "Cloudflare · 100MB",
        downloadUrl: "https://speed.cloudflare.com/__down?bytes=100000000",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://speed.cloudflare.com/__down?bytes=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-cachefly": {
        id: "cdn-cachefly",
        name: "CacheFly 全球 CDN",
        downloadUrl: "https://web1.cachefly.net/speedtest/downloading",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://web1.cachefly.net/speedtest/downloading",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-steam-akamai": {
        id: "cdn-steam-akamai",
        name: "Steam Akamai CDN",
        downloadUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1063730/extras/NW_Sword_Sorcery_2.gif",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://cdn.akamai.steamstatic.com/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-byte": {
        id: "cdn-byte",
        name: "字节 CDN",
        downloadUrl: "https://lf3-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://lf3-cdn-tos.bytecdntp.com/",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-qiniu": {
        id: "cdn-qiniu",
        name: "七牛 CDN",
        downloadUrl: "https://devtools.qiniu.com/linux/amd64/qrsctl",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://devtools.qiniu.com/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-aliyun": {
        id: "cdn-aliyun",
        name: "阿里 CDN",
        downloadUrl: "https://gw.alipayobjects.com/os/volans-demo/93211a67-0eed-40ff-8a48-f6c137a88781/MiniProgramStudio-3.1.3.exe",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://gw.alipayobjects.com/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-baidu": {
        id: "cdn-baidu",
        name: "百度网盘 CDN",
        downloadUrl: "https://cd.pddpic.com/android_dev/2023-11-08/a35eaee8e1f9f018cc40ace12931f7a2.apk",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://issuepcdn.baidupcs.com/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-wangyi": {
        id: "cdn-wangyi",
        name: "网易 CDN",
        downloadUrl: "https://open-image.ws.126.net/android_phone_release-sp_open-v9.9.9-v0a5b3c1dc0df472bb2fb057d0a5426c3.apk",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://open-image.ws.126.net/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-microsoft": {
        id: "cdn-microsoft",
        name: "Microsoft Akamai CDN",
        downloadUrl: "https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW16Ptm",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://img-prod-cms-rt-microsoft-com.akamaized.net/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },

    // ── speed.do 节点 ──
    // 2026-09-10 实测: dl1(59386)/dl2(5396)/unicom(43752) 全部超时;
    //   telecom-gd(211.136.30.118)/mobile上传点(113.229.96.166) 502;
    //   edu(USTC) IP 白名单拒绝(500 "not ustc")。仅 speeddo-cf-us 存活。
    "speeddo-cf-us": {
        id: "speeddo-cf-us",
        name: "【CloudFlare】美国节点",
        downloadUrl: "https://speed.cloudflare.com/__down?bytes=25000000",
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://speed.cloudflare.com/__down?bytes=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    // ═══════════════════════════════════════════════════
    //  新增 CDN 节点组 — 每组按 CDN 列表名作为节点名
    //  测速时从各自列表中随机选取一个下载链接
    //  Ping 统一使用 http://webcdn.m.qq.com
    // ═══════════════════════════════════════════════════

    // ── 和彩云 CDN ──
    "cdn-mcloud": {
        id: "cdn-mcloud",
        name: "和彩云 CDN",
        downloadUrls: [
            "https://img.mcloud.139.com/material_prod/material_media/20221128/1669626861087.png"
        ],
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "http://webcdn.m.qq.com",
        streams: 15,
        downloadTime: 10,
        uploadTime: 10
    },

    // ── 天翼云 CDN ──
    "cdn-ctyun": {
        id: "cdn-ctyun",
        name: "天翼云 CDN",
        downloadUrls: [
            "https://desk.ctyun.cn:8999/desktop-prod/software/windows_tob_client/15/64/202030001/CtyunClouddeskUniversal_2.3.0_202030001_x86_20240327104015_Setup.exe"
        ],
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "http://webcdn.m.qq.com",
        streams: 15,
        downloadTime: 10,
        uploadTime: 10
    },

    // ── Speedo云 CDN (30个下载源，随机选取) ──
    "cdn-speedo": {
        id: "cdn-speedo",
        name: "Speedo云 CDN",
        downloadUrls: [
            "https://cdn.aixifan.com/downloads/AcfunLive-Setup-1.9.0.200-ReleaseX64_6d5c40.exe",
            "https://devtools.qiniu.com/linux/amd64/qrsctl",
            "https://devtools.qiniu.com/qdoractl-darwin-amd64-0.4.6",
            "https://gw.alipayobjects.com/os/volans-demo/93211a67-0eed-40ff-8a48-f6c137a88781/MiniProgramStudio-3.1.3.exe",
            "https://downapp.sina.cn/m/06/sinaNews_8.27.0_1719288606_4386_3538_armeabi-v7a.apk",
            "https://i1.sinaimg.cn/edu/sinaopen/SinaOpencourse_V2.02.apk",
            "https://lf3-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe",
            "https://open-image.ws.126.net/android_phone_release-sp_open-v9.9.9-v0a5b3c1dc0df472bb2fb057d0a5426c3.apk",
            "https://lf3-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe",
            "https://lf6-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe",
            "https://wwwstatic.vivo.com.cn/vivoportal/files/download/app/20231026/350bda07c8a0719919bcadbf5aea3538.apk",
            "https://cd.pddpic.com/android_dev/2023-11-08/a35eaee8e1f9f018cc40ace12931f7a2.apk",
            "https://cd.pddpic.com/android_dev/2024-06-26/06027b4121edcd1f106d992128a7124b.apk",
            "https://cd.pddpic.com/volantis-open/volantis-common/app/com.xunmeng.workBench/Release_1834716.exe",
            "https://open-image.ws.126.net/android_phone_release-sp_open-v9.10.1-vb7b79d6b531448baaca3a81e7fbdc13f.apk",
            "https://lf3-package.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe",
            "https://lf6-package.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe",
            "https://lf9-package.vlabstatic.com/obj/faceu-packages/Jianying_split_4_8_0_10791_jianyingpro_0.exe",
            "https://file.ljcdn.com/saas-pkg/asaas-new/new_asaas_4.0.56_win_prod.zip",
            "https://video19.ifeng.com/video09/2022/07/06/p6950362006465552946-102-162611.mp4",
            "https://download.jr.jd.com/downapp/jrapp_jr9631.apk"
        ],
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "http://webcdn.m.qq.com",
        fallbackDownloadUrl: "http://webcdn.m.qq.com/speed/SpeedTestData.dat",
        streams: 15,
        downloadTime: 10,
        uploadTime: 10
    },

    // ── 360云 CDN (6个下载源，随机选取) ──
    "cdn-360": {
        id: "cdn-360",
        name: "360云 CDN",
        downloadUrls: [
            "https://cdn.qq.ime.sogou.com/QQPinyin_Setup_6.6.6304.400.exe",
            "http://softdlc.360tpcdn.com/auto/20201130/2000000064_f07aefc3d918ebdafa9418f3f5ef5f9c.exe",
            "https://dldir1.qq.com/qqtv/TencentVideo11.99.8523.0.exe",
            "http://softdlc.360tpcdn.com/auto/20201127/23_21ed487ededbbb428b2a7dcecc969c7c.exe",
            "https://download.cntv.cn/cbox/v6/ysyy_v6.0.3.3_1001_setup_x64.exe?spm=0.PF8WgFTOZypm.ETms2K8Lsimc.6&file=ysyy_v6.0.3.3_1001_setup_x64.exe",
            "http://softdlc.360tpcdn.com/auto/20201127/100101123_879baf4f2d9d14f191be2443e16504af.exe",
            "http://bigsoftdlc.360tpcdn.com/auto/20200826/104511_999095167454c21f770b31e8f080ebb7.exe",
            "http://bigsoftdlc.360tpcdn.com/auto/20210401/103779382_99dafefbd4193095a95fa713348fe6e7.exe",
            "http://bigsoftdlc.360tpcdn.com/auto/20201125/105005364_74cbde2c220e12dbd49b2c86e0ab2c6f.exe"
        ],
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "http://webcdn.m.qq.com",
        fallbackDownloadUrl: "http://webcdn.m.qq.com/speed/SpeedTestData.dat",
        streams: 15,
        downloadTime: 10,
        uploadTime: 10
    },

    // ── 腾讯云 CDN ──
    "cdn-tencent": {
        id: "cdn-tencent",
        name: "腾讯云 CDN",
        downloadUrls: [
            "http://webcdn.m.qq.com/speed/SpeedTestData.dat"
        ],
        // 腾讯节点专属上传池: 共享快端点优先, QQ 管家端点置底(慢, 兜底)
        uploadUrls: [
            ...CDN_UPLOAD_URLS,
            "http://netsp.master.qq.com/cgi-bin/netspeed"
        ],
        pingUrl: "http://webcdn.m.qq.com",
        streams: 20,
        downloadTime: 10,
        uploadTime: 10
    },

    // ── 联想电脑管家 CDN ──
    // 节点获取(与管家插件 WSNetSpeedPlugin.dll 实测流程一致):
    //   GET confUrl (Authorization: Bearer <uploadToken>) → data.dl_list / data.ul_list
    // 测速原理(实测): 7 流并发 HTTP 下载 dl_list 安装包 + 多流 octet-stream POST 上传到
    //   ul_list(管家每流 20MB/请求), 结果经 WinHTTP 上报 osfsr.lenovomm.com/report2
    // 上传点鉴权: 需 JWT(8 小时有效, 设备私钥向 ldc.lenovo.com.cn/api/auth 换取);
    //   uploadToken 留空时上传自动回退共享池(CDN_UPLOAD_URLS), 下载无需鉴权不受影响
    "cdn-lenovo": {
        id: "cdn-lenovo",
        name: "联想电脑管家 CDN",
        downloadUrls: [
            "https://speedtest-fast.lenovo.com.cn/download/lenovopcmanager_apps.exe",
            "https://speedtest-fast.lenovo.com.cn/download/lenovopcmanager_apps_v2.8.exe",
            "https://speedtest-fast.lenovo.com.cn/download/lenovopcmanager_preload_thinkpad_smb_apps.exe"
        ],
        confUrl: "https://ldc.lenovo.com.cn/api/m/speedtest/v1/conf",
        uploadUrl: "https://speedtest.lenovo.com.cn/api/m/upload",
        uploadToken: "",   // 可选: 联想 JWT — 配置后启用联想专属上传; 亦可用环境变量 LENOVO_SPEEDTEST_TOKEN
        uploadUrls: CDN_UPLOAD_URLS,
        pingUrl: "https://speedtest-fast.lenovo.com.cn/download/lenovopcmanager_apps.exe",
        streams: 7,
        downloadTime: 10,
        uploadTime: 10
    }
};

let ooklaServers;
let libreServers;
let cdnServers;

/**
 * 节点自动更新的运行时覆盖层(见 server/util/nodeUpdater.js)。
 *
 * 内置节点是静态 import, 运行时改不了, 因此自动替换结果写在这里:
 *   nodes   — 从备用池提拔进来的节点(可覆盖同 ID 的内置节点)
 *   removed — 探活连续失败被判定失效的节点 ID(墓碑, 用于"删除"内置节点)
 *
 * 文件不存在时返回空覆盖层, 行为与改造前一致。
 */
const readOverlay = (provider) => {
    try {
        const parsed = JSON.parse(fs.readFileSync(`./data/servers/${provider}-managed.json`, "utf8"));
        return {
            nodes: parsed.nodes ?? {},
            removed: Array.isArray(parsed.removed) ? parsed.removed : []
        };
    } catch {
        return {nodes: {}, removed: []};
    }
}

/** 把覆盖层套用到已合并的节点表上 */
const applyOverlay = (merged, overlay) => {
    const result = {...merged};

    for (const id of overlay.removed) delete result[id];
    Object.assign(result, overlay.nodes);

    return result;
}

/** 清空模块级缓存 —— 节点列表更新后必须调用, 否则改动不生效 */
export const clearServerCache = () => {
    ooklaServers = undefined;
    libreServers = undefined;
    cdnServers = undefined;
}

export const getLibreServers = () => {
    if (libreServers) return libreServers;

    let servers = {};
    if (fs.existsSync("./data/servers/librespeed.json")) {
        try {
            servers = JSON.parse(fs.readFileSync("./data/servers/librespeed.json", "utf8"));
        } catch { }
    }

    // Merge CN education LibreSpeed nodes, then apply runtime replacements
    libreServers = applyOverlay({ ...servers, ...LIBRE_CN_SERVERS }, readOverlay("librespeed"));

    return libreServers;
}

export const getOoklaServers = () => {
    if (ooklaServers) return ooklaServers;

    let servers = {};
    if (fs.existsSync("./data/servers/ookla.json")) {
        try {
            servers = JSON.parse(fs.readFileSync("./data/servers/ookla.json", "utf8"));
        } catch { }
    }

    // Merge CN Ookla nodes, then apply runtime replacements
    ooklaServers = applyOverlay({ ...servers, ...OOKLA_CN_SERVERS }, readOverlay("ookla"));

    return ooklaServers;
}

export const getCdnServers = () => {
    if (cdnServers) return cdnServers;

    let servers = {};
    if (fs.existsSync("./data/servers/cdn.json")) {
        try {
            servers = JSON.parse(fs.readFileSync("./data/servers/cdn.json", "utf8"));
        } catch { }
    }

    cdnServers = { ...servers, ...CDN_SERVERS };
    return cdnServers;
}

export const getByMode = (mode) => {
    if (mode === "ookla") return getOoklaServers();
    if (mode === "libre") return getLibreServers();
    if (mode === "cdn") return getCdnServers();
}
