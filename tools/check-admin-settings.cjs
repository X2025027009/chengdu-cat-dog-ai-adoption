/**
 * 管理员设置表单的结构检查。
 *
 * 为什么需要这个测试：
 *   后台设置表单是一大段模板字符串，字段一个接一个挤在同一行里，
 *   手工编辑时极易把某个字段的 <div class="field"> 开头吞掉——
 *   页面不会报错，只是那个输入框**静默消失**，很难发现。
 *   本项目已经真实发生过一次（新增字段时删掉了相邻字段的开头标签）。
 *
 * 检查内容：
 *   ① 模板内 <div> 开合是否配平；
 *   ② 所有应当存在的表单控件是否都还在；
 *   ③ 有没有出现"孤儿 input"——前面没有 <label> 也没有字段容器。
 *
 * 用法：node tools/check-admin-settings.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

/** 取出 renderAdminSettings 的完整函数体。 */
function extractSettingsFunction() {
  const start = source.indexOf('function renderAdminSettings');
  if (start < 0) throw new Error('app.js 里找不到 renderAdminSettings');
  let depth = 0;
  let begun = false;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') {
      depth += 1;
      begun = true;
    } else if (source[i] === '}') {
      depth -= 1;
      if (begun && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('renderAdminSettings 的大括号没有闭合');
}

const body = extractSettingsFunction();

let passed = 0;
let failed = 0;

function check(labelText, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${labelText}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${labelText}${detail ? ` —— ${detail}` : ''}`);
  }
}

console.log('管理员设置表单结构检查\n');

// ① div 配平
const openDivs = (body.match(/<div\b/g) || []).length;
const closeDivs = (body.match(/<\/div>/g) || []).length;
check('div 标签开合配平', openDivs === closeDivs, `开 ${openDivs} / 合 ${closeDivs}`);

// ② 必须存在的控件
const requiredFields = [
  ['id="wecomWebhook"', '企业微信机器人地址'],
  ['id="aiApiKey"', 'DeepSeek Key'],
  ['id="tokenhubApiKey"', 'TokenHub Key'],
  ['data-diagnose-ai', 'AI 配置自检按钮'],
  ['name="phone"', '联系电话'],
  ['name="wechat"', '微信号'],
  ['name="hours"', '服务时间'],
  ['name="area"', '服务区域'],
  ['name="intro"', '小院介绍']
];
for (const [needle, label] of requiredFields) {
  check(`存在字段：${label}`, body.includes(needle));
}

// ③ 每个 input 都应当落在某个 <label> 或字段容器之后的合理位置
//    判据：每个 id="xxx" 的输入框，往前 200 字符内应当出现 <label 或 class="field"
const inputs = [...body.matchAll(/<input\b[^>]*id="([^"]+)"/g)];
check('解析到输入框', inputs.length > 0, `共 ${inputs.length} 个`);
for (const match of inputs) {
  const before = body.slice(Math.max(0, match.index - 200), match.index);
  const anchored = /<label\b/.test(before) || /class="field/.test(before);
  check(`输入框 ${match[1]} 有对应的标签/容器`, anchored, '疑似孤儿输入框：前面的字段开头标签可能被误删');
}

// ④ 自检按钮必须是 type="button"，否则会触发表单提交
const diagnoseButton = body.match(/<button[^>]*data-diagnose-ai[^>]*>/);
check('自检按钮是 type="button"', Boolean(diagnoseButton && /type="button"/.test(diagnoseButton[0])), '否则点击会误触发表单提交');

console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
process.exit(failed ? 1 : 0);
