/**
 * CDN 链接自动发现 —— CLI 入口
 *
 * 实际逻辑已移到 server/util/cdnDiscovery.js：编译后的二进制只打包 server/ 下的
 * 依赖树，运行时更新需要直接引用那份实现，这里只做转发，避免两份代码各自漂移。
 *
 * 用法：
 *   node scripts/cdn-discovery.mjs            # 运行发现并输出结果
 *   node scripts/cdn-discovery.mjs --json     # JSON 输出
 */

export * from '../server/util/cdnDiscovery.js';

import {discoverAllCdnUrls, matchCdnGroup} from '../server/util/cdnDiscovery.js';

const isJson = process.argv.includes('--json');
const log = isJson ? () => {} : console.log;

discoverAllCdnUrls(log).then(urls => {
    if (isJson) {
        console.log(JSON.stringify(urls, null, 2));
    } else {
        console.log(`\n共发现 ${urls.length} 个候选链接:`);
        for (const u of urls) {
            console.log(`  [${matchCdnGroup(u) || '未知'}] ${u}`);
        }
    }
});
