import fs from 'node:fs';

// ── 🇨🇳 国内 Ookla Speedtest 节点 ──
// 来源: spiritLHLS/speedtest.net-CN-ID
export const OOKLA_CN_SERVERS = {
    "3633": {
        name: "中国电线",
        sponsor: "China Telecom",
        country: "China",
        cc: "CN",
        distance: 1034,
        host: "222.68.195.2:8080"
    },
    "5396": {
        name: "南京",
        sponsor: "China Telecom JiangSu 5G",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "115.169.22.22:8080"
    },
    "59386": {
        name: "杭州",
        sponsor: "China Telecom/浙江电信",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "61.130.56.1:8080"
    },
    "16204": {
        name: "苏州",
        sponsor: "China Mobile/JSQY - Suzhou",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "36.156.46.53:8080"
    },
    "24447": {
        name: "中国联通",
        sponsor: "China Unicom",
        country: "China",
        cc: "CN",
        distance: 1034,
        host: "210.22.155.34:8080"
    },
    "30852": {
        name: "昆山",
        sponsor: "昆山杜克大学",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "speedtest.dukekunshan.edu.cn:8080"
    },
    "36663": {
        name: "镇江",
        sponsor: "江苏电信 5G",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "5gzhenjiang.speedtest.jsinfo.net:8080"
    },
    "43752": {
        name: "北京",
        sponsor: "北京联通",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "beijing.unicomtest.com:8080"
    },
    "59387": {
        name: "宁波",
        sponsor: "浙江电信",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "cesu-nb.zjtelecom.com.cn:8080"
    },
    "17265": {
        name: "中和",
        sponsor: "远传电信 (台湾)",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "fetsz1.seed.net.tw:8080"
    },
    "73010": {
        name: "贺兰",
        sponsor: "Arslan Telecom",
        country: "China",
        cc: "CN",
        distance: 0,
        host: "arslantel.online:8080"
    }
};

// ── 🎓 国内 LibreSpeed 教育网节点 ──
// 来源: builtin-node-config.js 节点6方案
export const LIBRE_CN_SERVERS = {
    "cn-edu-ustc": {
        id: "cn-edu-ustc",
        name: "教育网 · 中科大 (LibreSpeed)",
        server: "https://test.ustc.edu.cn/backend/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
    "cn-edu-tsinghua": {
        id: "cn-edu-tsinghua",
        name: "教育网 · 清华 (LibreSpeed)",
        server: "https://iptv.tsinghua.edu.cn/st/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
    "cn-edu-sjtu": {
        id: "cn-edu-sjtu",
        name: "教育网 · 上交 (LibreSpeed)",
        server: "https://ftp.sjtu.edu.cn/speedtest/backend/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
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
    },
    "cn-edu-whut": {
        id: "cn-edu-whut",
        name: "教育网 · 武汉理工 (LibreSpeed)",
        server: "https://219.140.61.101/backend/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
    "cn-edu-hubei": {
        id: "cn-edu-hubei",
        name: "教育网 · 湖北节点 (LibreSpeed)",
        server: "https://119.36.86.250:81/backend/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    },
    "cn-edu-wh": {
        id: "cn-edu-wh",
        name: "教育网 · 武汉节点 (LibreSpeed)",
        server: "http://211.67.53.2/backend/",
        dlURL: "garbage.php",
        ulURL: "empty.php",
        pingURL: "empty.php",
        getIpURL: "getIP.php"
    }
};

// ── 🌐 CDN 下载测速节点 ──
// 来源: NetworkPanel / speed.do
export const CDN_SERVERS = {
    "cdn-cloudflare-25m": {
        id: "cdn-cloudflare-25m",
        name: "Cloudflare · 25MB",
        downloadUrl: "https://speed.cloudflare.com/__down?bytes=25000000",
        uploadUrl: "https://speed.cloudflare.com/__up",
        pingUrl: "https://speed.cloudflare.com/__down?bytes=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-cloudflare-100m": {
        id: "cdn-cloudflare-100m",
        name: "Cloudflare · 100MB",
        downloadUrl: "https://speed.cloudflare.com/__down?bytes=100000000",
        uploadUrl: "https://speed.cloudflare.com/__up",
        pingUrl: "https://speed.cloudflare.com/__down?bytes=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-cachefly": {
        id: "cdn-cachefly",
        name: "CacheFly 全球 CDN",
        downloadUrl: "https://web1.cachefly.net/speedtest/downloading",
        uploadUrl: "https://speed.cloudflare.com/__up",
        pingUrl: "https://web1.cachefly.net/speedtest/downloading",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-steam-akamai": {
        id: "cdn-steam-akamai",
        name: "Steam Akamai CDN",
        downloadUrl: "https://cdn.akamai.steamstatic.com/steam/apps/1063730/extras/NW_Sword_Sorcery_2.gif",
        uploadUrl: "https://speed.cloudflare.com/__up",
        pingUrl: "https://cdn.akamai.steamstatic.com/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-byte": {
        id: "cdn-byte",
        name: "字节 CDN",
        downloadUrl: "https://lf3-cdn-tos.bytegoofy.com/obj/douyin-pc-client/7044145585217083655/releases/8293088/1.0.8/win32-ia32/douyin-v1.0.8-win32-ia32-douyin.exe",
        uploadUrl: "https://speed.cloudflare.com/__up",
        pingUrl: "https://lf3-cdn-tos.bytecdntp.com/",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-qiniu": {
        id: "cdn-qiniu",
        name: "七牛 CDN",
        downloadUrl: "https://devtools.qiniu.com/linux/amd64/qrsctl",
        uploadUrl: "https://speed.cloudflare.com/__up",
        pingUrl: "https://devtools.qiniu.com/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-aliyun": {
        id: "cdn-aliyun",
        name: "阿里 CDN",
        downloadUrl: "https://gw.alipayobjects.com/os/volans-demo/93211a67-0eed-40ff-8a48-f6c137a88781/MiniProgramStudio-3.1.3.exe",
        uploadUrl: "https://speed.cloudflare.com/__up",
        pingUrl: "https://gw.alipayobjects.com/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-baidu": {
        id: "cdn-baidu",
        name: "百度网盘 CDN",
        downloadUrl: "https://issuepcdn.baidupcs.com/issue/netdisk/LinuxGuanjia/4.17.7/baidunetdisk_4.17.7_amd64.deb",
        uploadUrl: "https://speed.cloudflare.com/__up",
        pingUrl: "https://issuepcdn.baidupcs.com/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-wangyi": {
        id: "cdn-wangyi",
        name: "网易 CDN",
        downloadUrl: "https://open-image.ws.126.net/android_phone_release-sp_open-v9.9.9-v0a5b3c1dc0df472bb2fb057d0a5426c3.apk",
        uploadUrl: "https://speed.cloudflare.com/__up",
        pingUrl: "https://open-image.ws.126.net/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "cdn-microsoft": {
        id: "cdn-microsoft",
        name: "Microsoft Akamai CDN",
        downloadUrl: "https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW16Ptm",
        uploadUrl: "https://speed.cloudflare.com/__up",
        pingUrl: "https://img-prod-cms-rt-microsoft-com.akamaized.net/",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },

    // ── speed.do 节点 ──
    "speeddo-dl1": {
        id: "speeddo-dl1",
        name: "【下载节点1】Ookla 浙江电信",
        downloadUrl: "https://server-59386.prod.hosts.ooklaserver.net:8080/download?size=25000000",
        uploadUrl: "https://server-59386.prod.hosts.ooklaserver.net:8080/upload",
        pingUrl: "https://server-59386.prod.hosts.ooklaserver.net:8080/download?size=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "speeddo-dl2": {
        id: "speeddo-dl2",
        name: "【下载节点2】Ookla 南京电信",
        downloadUrl: "https://server-5396.prod.hosts.ooklaserver.net:8080/download?size=25000000",
        uploadUrl: "https://server-5396.prod.hosts.ooklaserver.net:8080/upload",
        pingUrl: "https://server-5396.prod.hosts.ooklaserver.net:8080/download?size=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "speeddo-cf-us": {
        id: "speeddo-cf-us",
        name: "【CloudFlare】美国节点",
        downloadUrl: "https://speed.cloudflare.com/__down?bytes=25000000",
        uploadUrl: "https://speed.cloudflare.com/__up",
        pingUrl: "https://speed.cloudflare.com/__down?bytes=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "speeddo-telecom-gd": {
        id: "speeddo-telecom-gd",
        name: "【电信节点】广东专线节点",
        downloadUrl: "http://211.136.30.118:9000/speed/10.data",
        uploadUrl: "http://113.229.96.166:8800/Dat/upServer",
        pingUrl: "http://211.136.30.118:9000/speed/10.data",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "speeddo-unicom": {
        id: "speeddo-unicom",
        name: "【联通节点】全国多线节点",
        downloadUrl: "https://server-43752.prod.hosts.ooklaserver.net:8080/download?size=25000000",
        uploadUrl: "https://server-43752.prod.hosts.ooklaserver.net:8080/upload",
        pingUrl: "https://server-43752.prod.hosts.ooklaserver.net:8080/download?size=0",
        streams: 6,
        downloadTime: 10,
        uploadTime: 10
    },
    "speeddo-mobile": {
        id: "speeddo-mobile",
        name: "【移动节点】北京&河北专线节点",
        downloadUrl: "https://server-16204.prod.hosts.ooklaserver.net:8080/download?size=25000000",
        uploadUrl: "http://113.229.96.166:8800/Dat/upServer",
        pingUrl: "https://server-16204.prod.hosts.ooklaserver.net:8080/download?size=0",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    },
    "speeddo-edu": {
        id: "speeddo-edu",
        name: "【教育网】USTC 多线节点",
        downloadUrl: "https://test.ustc.edu.cn/backend/garbage.php",
        uploadUrl: "https://test.ustc.edu.cn/backend/empty.php",
        pingUrl: "https://test.ustc.edu.cn/backend/empty.php?cors=1",
        streams: 4,
        downloadTime: 10,
        uploadTime: 10
    }
};

let ooklaServers;
let libreServers;
let cdnServers;

export const getLibreServers = () => {
    if (libreServers) return libreServers;

    let servers = {};
    if (fs.existsSync("./data/servers/librespeed.json")) {
        try {
            servers = JSON.parse(fs.readFileSync("./data/servers/librespeed.json", "utf8"));
        } catch { }
    }

    // Merge CN education LibreSpeed nodes
    libreServers = { ...servers, ...LIBRE_CN_SERVERS };

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

    // Merge CN Ookla nodes
    ooklaServers = { ...servers, ...OOKLA_CN_SERVERS };

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
