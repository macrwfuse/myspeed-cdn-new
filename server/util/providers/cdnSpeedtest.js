/**
 * CDN Speed Test Provider
 * HTTP 多流并发下载测速 — 基于 NetworkPanel / speed.do 的测速原理
 *
 * 测速方式：同时发起多个 HTTP GET 请求下载大文件，统计总字节数和耗时，计算带宽。
 * 与 Ookla/LibreSpeed 不同，不需要专用测速服务器，直接利用 CDN 下载链接。
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

// 测速参数
const TEST_DURATION_MS = 10000;   // 下载测速持续时间 (ms)
const GRACE_PERIOD_MS  = 1000;    // 预热时间 (ms)
const STREAMS          = 6;       // 并发流数
const PING_COUNT       = 10;      // ping 次数

// 浏览器 UA — 大量 CDN(腾讯视频/央视/网易等) 对裸请求返回 403 防盗链
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Referer 映射 — 按主机匹配防盗链来源(实测 dldir1.qq.com / download.cntv.cn / video19.ifeng.com
// 裸 HEAD 403, 带 Referer 后 206 可下载); 无映射主机默认 Referer = https://<host>/
const REFERER_MAP = {
    'dldir1.qq.com': 'https://v.qq.com/',
    'imtt.dd.qq.com': 'https://im.qq.com/',
    'download.cntv.cn': 'https://www.cntv.cn/',
    'video19.ifeng.com': 'https://www.ifeng.com/',
    'softdlc.360tpcdn.com': 'https://www.360.cn/',
    'bigsoftdlc.360tpcdn.com': 'https://www.360.cn/',
    'cdn.qq.ime.sogou.com': 'https://pinyin.sogou.com/',
    'dl.2345.com': 'https://www.2345.com/',
    'webcdn.m.qq.com': 'https://www.qq.com/',
    'netsp.master.qq.com': 'https://www.qq.com/',
    'cd.pddpic.com': 'https://www.pinduoduo.com/',
    'lf3-cdn-tos.bytegoofy.com': 'https://www.douyin.com/',
    'lf6-cdn-tos.bytegoofy.com': 'https://www.douyin.com/',
    'lf9-apk.ugapk.cn': 'https://www.douyin.com/',
    'lf3-package.vlabstatic.com': 'https://www.capcut.cn/',
    'lf6-package.vlabstatic.com': 'https://www.capcut.cn/',
    'lf9-package.vlabstatic.com': 'https://www.capcut.cn/',
    'open-image.ws.126.net': 'https://music.163.com/',
    'uu.gdl.netease.com': 'https://uu.163.com/',
};

/** 下载请求头: 完整浏览器 UA + 防盗链 Referer */
function dlHeaders(url) {
    let host = '';
    try { host = new URL(url).hostname; } catch { /* keep '' */ }
    return {
        'User-Agent': BROWSER_UA,
        'Referer': REFERER_MAP[host] || (host ? `https://${host}/` : ''),
    };
}

/**
 * 打乱数组 (Fisher-Yates)
 */
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * 上传端点适配 — 按主机自动匹配请求方式（CDN 上传池 CDN_UPLOAD_URLS 的备注在此落实）
 *   - speed.cloudflare.com/__up : 需带 UA/Origin，URL 不带额外参数
 *   - netsp.master.qq.com       : octet-stream 多流直传（实测 62.7 Mbps; 原 QMUPTEST multipart
 *                                 大包模式服务器解析慢导致测速卡顿, 已弃用）
 *   - 其余（mbd.baidu.com / vcs.zijieapi.com 等）: 多流 octet-stream 直传
 */
function uploadProfile(uploadUrl) {
    let host = '';
    try { host = new URL(uploadUrl).hostname; } catch { return {}; }

    if (host === 'speed.cloudflare.com') {
        return {
            headers: {
                'User-Agent': BROWSER_UA,
                'Origin': 'https://speed.cloudflare.com',
            },
        };
    }
    // netsp.master.qq.com 也走默认 octet-stream 直传(实测服务器接受任意 body 且快),
    // 无需特殊 profile
    return {};
}

/**
 * 通过 HTTP HEAD 测量延迟 (类似 ICMP ping)
 */
async function measurePing(url, count = PING_COUNT) {
    const latencies = [];
    for (let i = 0; i < count; i++) {
        const start = Date.now();
        await new Promise((resolve) => {
            const parsed = new URL(url);
            const mod = parsed.protocol === 'https:' ? https : http;
            const req = mod.request(parsed, { method: 'HEAD', timeout: 5000 }, () => {
                latencies.push(Date.now() - start);
                resolve();
            });
            req.on('error', () => {
                latencies.push(Date.now() - start);
                resolve();
            });
            req.on('timeout', () => {
                req.destroy();
                latencies.push(5000);
                resolve();
            });
            req.end();
        });
        await new Promise(r => setTimeout(r, 200));
    }

    if (latencies.length === 0) return { ping: 0, jitter: 0 };

    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const variance = latencies.reduce((sum, v) => sum + (v - avg) ** 2, 0) / latencies.length;
    const jitter = Math.round(Math.sqrt(variance));

    return { ping: avg, jitter };
}

/**
 * 单个下载流：持续下载直到 stopped=true。
 *
 * 健康检查与换源（修复"抽中死链 10s 空转 → 0 Mbps"）：
 *   - 传入候选 URL 数组 urls（已打乱，fallback 保底在尾部）
 *   - 流内每轮请求前取当前候选；响应 statusCode>=400 或网络错误 → 该 URL 记为死链
 *     (stats.deadUrls)，立即切换到下一候选重试（不空等 10s）
 *   - 全部候选耗尽 → 该流静默结束（resolve），由统计端处理
 * 另: 下载请求带浏览器 UA + 防盗链 Referer（修复腾讯视频/央视/凤凰等 403）
 */
function startDownloadStream(urls, stats, stopped) {
    return new Promise((resolve) => {
        let urlIdx = 0;
        let consecutiveErrors = 0;

        const nextUrl = () => {
            while (urlIdx < urls.length) {
                const u = urls[urlIdx];
                if (!stats.deadUrls.has(u)) return u;
                urlIdx++;
            }
            return null;
        };

        const markDead = (u) => {
            stats.deadUrls.add(u);
            urlIdx++;
        };

        const doRequest = () => {
            if (stopped.value) return resolve();
            const url = nextUrl();
            if (!url) return resolve(); // 候选全部失效

            const parsed = new URL(url);
            const mod = parsed.protocol === 'https:' ? https : http;

            const req = mod.get(url + (url.includes('?') ? '&' : '?') + '_nocache=' + Math.random(), {
                headers: { ...dlHeaders(url), 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
                timeout: 15000,
            }, (res) => {
                // 3xx 重定向: 跟随(带防盗链头)。注意 res2 的 data 回调也必须处理
                // stopped 主动断开(无限流重定向后持续推流, 否则 promise 永不结束)
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, url).toString();
                    res.resume();
                    const redirMod = redirectUrl.startsWith('https') ? https : http;
                    let redirReq;
                    redirReq = redirMod.get(redirectUrl, { headers: dlHeaders(redirectUrl) }, (res2) => {
                        res2.on('data', (chunk) => {
                            if (stopped.value) {
                                try { redirReq.destroy(); } catch { /* ignore */ }
                                resolve();
                                return;
                            }
                            stats.totalBytes += chunk.length;
                        });
                        res2.on('end', () => {
                            if (!stopped.value) doRequest();
                            else resolve();
                        });
                        res2.on('error', () => {
                            if (!stopped.value) setTimeout(doRequest, 50);
                            else resolve();
                        });
                    });
                    redirReq.on('error', () => {
                        if (!stopped.value) setTimeout(doRequest, 50);
                        else resolve();
                    });
                    return;
                }

                // 健康检查: 4xx/5xx = 死链 → 换源(不空转)
                if (res.statusCode >= 400) {
                    markDead(url);
                    res.resume();
                    if (!stopped.value) setTimeout(doRequest, 50);
                    else resolve();
                    return;
                }

                consecutiveErrors = 0;
                res.on('data', (chunk) => {
                    // 测速窗口结束(stopped)后若服务器仍持续推流(如 QQ 4GB 无限流),
                    // 必须主动断开并 resolve, 否则 promise 永不结束导致整个测速挂起
                    if (stopped.value) {
                        try { req.destroy(); } catch { /* ignore */ }
                        resolve();
                        return;
                    }
                    stats.totalBytes += chunk.length;
                });
                res.on('end', () => {
                    if (!stopped.value) doRequest();
                    else resolve();
                });
                res.on('error', () => {
                    if (!stopped.value) setTimeout(doRequest, 50);
                    else resolve();
                });
            });

            req.on('error', () => {
                consecutiveErrors++;
                // 连接层错误也视为该候选不可用 → 换源; 若连续快速失败仍换源直至耗尽
                markDead(url);
                if (!stopped.value) setTimeout(doRequest, 50);
                else resolve();
            });
            req.on('timeout', () => {
                req.destroy();
                markDead(url);
                if (!stopped.value) setTimeout(doRequest, 50);
                else resolve();
            });
        };

        doRequest();
    });
}

/**
 * 多流并发下载测速（候选 URL 数组, 各流共享死链集合 → 自动避开已失效源）
 */
async function measureDownload(downloadUrls, streams = STREAMS, durationMs = TEST_DURATION_MS) {
    const stats = { totalBytes: 0, deadUrls: new Set() };
    const stopped = { value: false };

    const streamPromises = [];
    for (let i = 0; i < streams; i++) {
        streamPromises.push(
            new Promise(resolve => setTimeout(() => {
                startDownloadStream(downloadUrls, stats, stopped).then(resolve);
            }, i * 100))
        );
    }

    await new Promise(r => setTimeout(r, GRACE_PERIOD_MS));
    stats.totalBytes = 0;

    const startTime = Date.now();
    await new Promise(r => setTimeout(r, durationMs));
    stopped.value = true;

    const elapsed = (Date.now() - startTime) / 1000;
    const bytesPerSec = stats.totalBytes / elapsed;
    const mbps = (bytesPerSec * 8) / 1_000_000;

    await Promise.allSettled(streamPromises);

    return {
        download: parseFloat(mbps.toFixed(2)),
        downloadBytes: stats.totalBytes,
    };
}

/**
 * 测量上传速度
 */
function startUploadStream(url, stats, stopped, profile = {}) {
    return new Promise((resolve) => {
        const chunkSize = 128 * 1024;
        const chunk = Buffer.alloc(chunkSize);
        for (let i = 0; i < chunkSize; i++) chunk[i] = Math.floor(Math.random() * 256);
        const boundary = '----MySpeed' + Math.random().toString(16).slice(2);

        const doUpload = () => {
            if (stopped.value) return resolve();

            let blob = Buffer.concat(Array(16).fill(chunk));
            const headers = { ...(profile.headers || {}) };
            if (profile.multipart && profile.multipartType === 'qmuptest') {
                // QQ管家协议: multipart/form-data, boundary=QMUPTEST (实测多流并发可用)
                const head = Buffer.from(
                    '--QMUPTEST\r\n' +
                    'Content-Disposition: form-data; name="guid"\r\n\r\n' +
                    '00000000-0000-0000-0000-000000000000\r\n' +
                    '--QMUPTEST\r\n' +
                    'Content-Disposition: form-data; name="mainappid"\r\n\r\n' +
                    '10002\r\n' +
                    '--QMUPTEST\r\n' +
                    'Content-Disposition: form-data; name="subappid"\r\n\r\n' +
                    '1400\r\n' +
                    '--QMUPTEST\r\n' +
                    'Content-Disposition: form-data; name="buildver"\r\n\r\n' +
                    '16.9.24712.211\r\n' +
                    '--QMUPTEST\r\n' +
                    'Content-Disposition: form-data; name="fileupload"; filename="uptest.dat"\r\n' +
                    'Content-Type: application/octet-stream\r\n\r\n'
                );
                const tail = Buffer.from('\r\n--QMUPTEST--\r\n');
                blob = Buffer.concat([head, blob, tail]);
                headers['Content-Type'] = 'multipart/form-data; boundary=QMUPTEST';
            } else if (profile.multipart) {
                const head = Buffer.from(
                    `--${boundary}\r\n` +
                    'Content-Disposition: form-data; name="data"; filename="speed.bin"\r\n' +
                    'Content-Type: application/octet-stream\r\n\r\n'
                );
                const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
                blob = Buffer.concat([head, blob, tail]);
                headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
            } else {
                headers['Content-Type'] = 'application/octet-stream';
            }
            headers['Content-Length'] = blob.length;
            // QQ 上传实测任意 body 均 200(不校验字段), 此头仅作标识
            headers['User-Agent'] = headers['User-Agent'] || BROWSER_UA;

            const parsed = new URL(url);
            const mod = parsed.protocol === 'https:' ? https : http;

            const req = mod.request(parsed, {
                method: 'POST',
                headers: headers,
                timeout: 15000,
            }, (res) => {
                res.resume();
                stats.totalBytes += blob.length;
                if (!stopped.value) doUpload();
                else resolve();
            });

            req.on('error', () => {
                if (!stopped.value) setTimeout(doUpload, 1000);
                else resolve();
            });
            req.on('timeout', () => {
                req.destroy();
                if (!stopped.value) setTimeout(doUpload, 1000);
                else resolve();
            });

            req.write(blob);
            req.end();
        };

        doUpload();
    });
}

async function measureUpload(uploadUrl, streams = STREAMS, durationMs = TEST_DURATION_MS, profile = {}) {
    const stats = { totalBytes: 0 };
    const stopped = { value: false };

    const streamPromises = [];
    for (let i = 0; i < streams; i++) {
        streamPromises.push(
            new Promise(resolve => setTimeout(() => {
                startUploadStream(uploadUrl, stats, stopped, profile).then(resolve);
            }, i * 100))
        );
    }

    await new Promise(r => setTimeout(r, GRACE_PERIOD_MS));
    stats.totalBytes = 0;

    const startTime = Date.now();
    await new Promise(r => setTimeout(r, durationMs));
    stopped.value = true;

    const elapsed = (Date.now() - startTime) / 1000;
    const bytesPerSec = stats.totalBytes / elapsed;
    const mbps = (bytesPerSec * 8) / 1_000_000;

    await Promise.allSettled(streamPromises);

    return {
        upload: parseFloat(mbps.toFixed(2)),
        uploadBytes: stats.totalBytes,
    };
}

/**
 * 从数组中随机选取一个元素
 */
function pickRandom(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 主入口：执行 CDN 测速
 * @param {object} serverConfig - {
 *   name, downloadUrl, downloadUrls, uploadUrl, uploadUrls, pingUrl,
 *   streams?, downloadTime?, uploadTime?
 * }
 * @returns {object} - 与 LibreSpeed 结果格式兼容
 *
 * 多URL支持：
 *   - downloadUrls: 下载链接数组，测速时随机选取一个
 *   - uploadUrls: 上传链接数组，测速时随机选取一个
 *   - 向后兼容 downloadUrl / uploadUrl 单链接
 */
export async function runCdnSpeedtest(serverConfig) {
    const startTime = Date.now();

    const {
        name = 'CDN Server',
        downloadUrl,
        downloadUrls,
        uploadUrl,
        uploadUrls,
        pingUrl,
        fallbackDownloadUrl,   // 保底无限流源(如 QQ 4GB SpeedTestData.dat) — 池全失效时兜底
        streams: numStreams = STREAMS,
        downloadTime = 10,
        uploadTime = 10,
    } = serverConfig;

    // 下载候选数组: 池内多源打乱(流内随机换源) + 保底源追加尾部。
    // 流内健康检查(statusCode>=400/网络错)会将死链记入共享集合并自动换下一候选,
    // 全部池源失效后由保底无限流源兜底 → 不再出现整次测速 0 Mbps。
    const poolSources = (downloadUrls && downloadUrls.length ? downloadUrls : downloadUrl ? [downloadUrl] : []);
    const dlCandidates = [...shuffle(poolSources)];
    if (fallbackDownloadUrl) dlCandidates.push(fallbackDownloadUrl);
    if (dlCandidates.length === 0) throw new Error('CDN 测速需要 downloadUrl / downloadUrls / fallbackDownloadUrl');

    // 确定上传URL：优先从 uploadUrls 数组随机选取，否则用 uploadUrl
    const resolvedUlUrl = pickRandom(uploadUrls) || uploadUrl;
    // 上传端点请求方式/流数适配（CF 带 UA/Origin；QQ multipart QMUPTEST 多流）
    const ulProfile = resolvedUlUrl ? uploadProfile(resolvedUlUrl) : null;

    // 1. Ping
    const pingTarget = pingUrl || dlCandidates[0];
    const { ping, jitter } = await measurePing(pingTarget);

    // 2. Download (候选数组, 死链自动换源 + 保底)
    const dlResult = await measureDownload(dlCandidates, numStreams, downloadTime * 1000);

    // 3. Upload (如果配置了上传 URL)
    let ulResult = { upload: 0, uploadBytes: 0 };
    if (resolvedUlUrl) {
        const ulStreams = ulProfile && ulProfile.singleStream ? 1 : numStreams;
        ulResult = await measureUpload(resolvedUlUrl, ulStreams, uploadTime * 1000, ulProfile);
    }

    const elapsed = Date.now() - startTime;

    return {
        ping: ping,
        jitter: jitter,
        download: dlResult.download,
        upload: ulResult.upload,
        server: {
            name: name,
            url: dlCandidates[0],
        },
        elapsed: elapsed,
        downloadBytes: dlResult.downloadBytes,
        uploadBytes: ulResult.uploadBytes,
    };
}
