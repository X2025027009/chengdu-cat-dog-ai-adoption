/**
 * 以图搜宠的地址校验测试。
 *
 * 这块是安全边界：服务端会去抓前端给的地址，如果不加限制，
 * 等于对外提供了一个"让服务器帮我访问任意网址"的接口。
 * 因此这里的断言比功能测试更重要——**每一个绕过尝试都必须被拒绝**。
 *
 * 用法：node tools/test-vision-guards.cjs
 */
const { isAllowedUrl } = require('../functions/ai-stream/vision.js');

let passed = 0;
let failed = 0;
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${label}${detail ? ` —— ${detail}` : ''}`);
  }
}

const PATH = 'pets/pet-123/abc.jpg';

console.log('以图搜宠的地址校验\n');

console.log('【1】应当放行');
check('当前实际使用的网关域名', isAllowedUrl(`https://env.api.tcloudbasegateway.com/v1/storage/yard-media/${PATH}?sign=x`, PATH));
check('旧的 tcb.qcloud.la 域名（暂留兼容）', isAllowedUrl(`https://env.tcb.qcloud.la/${PATH}`, PATH));
check('COS 直连域名', isAllowedUrl(`https://bucket.cos.ap-shanghai.myqcloud.com/${PATH}`, PATH));
check('路径经过 URL 编码', isAllowedUrl('https://env.api.tcloudbasegateway.com/v1/storage/yard-media/pets%2Fpet-123%2Fabc.jpg', PATH));

console.log('\n【2】必须拒绝');
check('外部域名', !isAllowedUrl(`https://evil.com/${PATH}`, PATH));
check('域名后缀伪装（evil-tcloudbasegateway.com）', !isAllowedUrl(`https://evil-tcloudbasegateway.com/${PATH}`, PATH));
check('域名后缀伪装（tcloudbasegateway.com.evil.com）', !isAllowedUrl(`https://tcloudbasegateway.com.evil.com/${PATH}`, PATH));
check('同域名但路径不含 storage_path（试图读别的资源）', !isAllowedUrl('https://env.api.tcloudbasegateway.com/other/secret.jpg', PATH));
check('http 明文', !isAllowedUrl(`http://env.api.tcloudbasegateway.com/${PATH}`, PATH));
check('非 URL 字符串', !isAllowedUrl('not-a-url', PATH));
check('空值', !isAllowedUrl('', PATH));
check('file 协议', !isAllowedUrl(`file:///etc/passwd`, PATH));
check('内网地址', !isAllowedUrl(`https://127.0.0.1/${PATH}`, PATH));

console.log('\n【3】路径校验不能形同虚设');
check('路径为空时不做包含判断（由调用方的路径校验兜底）', isAllowedUrl('https://env.api.tcloudbasegateway.com/anything', ''));
check('两个不同路径不能互相通过', !isAllowedUrl('https://env.api.tcloudbasegateway.com/pets/pet-999/other.jpg', PATH));

console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
process.exitCode = failed ? 1 : 0;
