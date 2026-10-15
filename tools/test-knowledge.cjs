/**
 * 知识检索层（RAG）单元测试。
 *
 * 用假的 query / embed 注入，不碰数据库也不调外部接口，
 * 因此可以随便跑、不受限频影响。
 *
 * 重点验证四件事：
 *   ① 切块是否合理（来源标签、内容、拆分粒度）
 *   ② 重建索引时生成的 SQL 是否正确（向量字面量、覆盖而非追加）
 *   ③ 相似度阈值是否真的过滤掉了不相关片段
 *   ④ 向量服务故障时是否优雅降级，而不是把异常抛给调用方
 *
 * 用法：node tools/test-knowledge.cjs
 */
const { createKnowledge, buildChunks } = require('../functions/ai-stream/knowledge.js');

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

const CORPUS = {
  pets: [
    {
      id: 'pet-1',
      name: '喜豆',
      type: '狗狗',
      gender: '公',
      age: '1岁',
      status: '待领养',
      tags: ['亲人', '活泼'],
      description: '亲人活泼，喜欢跟人玩',
      health: '疫苗齐全',
      requirements: '封窗、家人同意'
    },
    {
      id: 'pet-2',
      name: 'coco',
      type: '猫咪',
      gender: '公',
      age: '约7岁',
      status: '待领养',
      tags: ['安静'],
      description: '安静不爱动，大部分时间在睡觉',
      health: '过度肥胖，需要控制饮食',
      requirements: ''
    },
    { id: 'pet-3', name: '无要求', type: '猫咪', gender: '母', age: '2岁', status: '待领养', tags: [], description: '', health: '', requirements: '' }
  ],
  policy: { privacy_notice: '仅用于领养沟通与审核', retention_days: 180 },
  updates: [{ id: 'u1', petName: '喜豆', date: '2026-09-01', title: '第一次回访', content: '状态良好，已适应新家' }],
  chunkCount: 0,
  lastIndexedAt: null,
  petUpdatedAt: '2026-10-01T00:00:00Z',
  updateAt: null
};

/** 构造可注入的假实现，并记录它收到了什么。 */
function makeFake({ corpus = CORPUS, embedFails = false, matches = null } = {}) {
  const state = { inserts: [], embedded: [] };
  const fake = {
    query: async sql => {
      if (sql.includes('INSERT INTO public.knowledge_chunks')) {
        state.inserts.push(sql);
        // 粗略统计 VALUES 里的行数（每行以 ("id" 开头）
        return { written: (sql.match(/\(\s*'/g) || []).length };
      }
      if (sql.includes("'matches'")) {
        return { matches: matches || [{ label: 'coco的档案', type: 'pet', content: '安静不爱动', similarity: 0.66 }] };
      }
      return corpus;
    },
    embed: async texts => {
      if (embedFails) throw new Error('向量服务不可用');
      state.embedded.push(texts);
      return texts.map(() => new Array(1024).fill(0.01));
    }
  };
  return { fake, state };
}

(async () => {
  console.log('知识检索层测试\n');

  // ── ① 切块 ────────────────────────────────────────────────
  console.log('【1】切块');
  const chunks = buildChunks(CORPUS);
  const labels = chunks.map(c => c.sourceLabel);
  check('档案与领养要求分开切块', labels.includes('喜豆的档案') && labels.includes('喜豆的领养要求'));
  check('没有领养要求的宠物不产生空块', !labels.includes('coco的领养要求'));
  check('档案内容包含名字与性格', chunks.find(c => c.sourceLabel === '喜豆的档案').content.includes('亲人活泼'));
  check('政策按字段拆开', labels.some(l => l.includes('隐私说明')) && labels.some(l => l.includes('保存期限')));
  check(
    '回访记录单独成块并带日期',
    labels.some(l => l.includes('回访记录') && l.includes('2026-09-01'))
  );
  check(
    '没有任何内容是空的',
    chunks.every(c => c.content.trim().length > 0)
  );
  check(
    '块内内容不超过上限',
    chunks.every(c => c.content.length <= 600),
    `最长 ${Math.max(...chunks.map(c => c.content.length))}`
  );

  // ── ② 重建索引 ────────────────────────────────────────────
  console.log('\n【2】重建索引');
  const { fake, state } = makeFake();
  const knowledge = createKnowledge(fake);
  const rebuilt = await knowledge.rebuild();
  check('重建成功', rebuilt.ok === true);
  check('写入块数大于零', rebuilt.chunks > 0, `实际 ${rebuilt.chunks}`);
  check('调用了向量化', state.embedded.length > 0);
  check('批量提交（没有一块一次请求）', state.embedded.length <= Math.ceil(chunks.length / 1) && state.embedded[0].length > 1, `分了 ${state.embedded.length} 批`);
  const insert = state.inserts.join('\n');
  check('生成向量字面量', insert.includes('::vector'));
  check('覆盖写入而非追加', insert.includes('ON CONFLICT (id) DO UPDATE'));
  check('更新了 updated_at', insert.includes('updated_at = NOW()'));

  // ── ③ 相似度阈值 ──────────────────────────────────────────
  console.log('\n【3】检索与阈值');
  const { fake: fake2 } = makeFake({
    matches: [
      { label: 'coco的档案', type: 'pet', content: '安静不爱动', similarity: 0.66 },
      { label: '不相关内容', type: 'pet', content: '无关内容', similarity: 0.12 }
    ]
  });
  const found = await createKnowledge(fake2).search('想找一只安静的猫');
  check('返回成功', found.ok === true);
  check('过滤掉低于阈值的片段', found.count === 1, `实际 ${found.count} 条`);
  check('保留高相似度片段', found.matches[0].label === 'coco的档案');
  check('给出可展示的来源标签', Array.isArray(found.sources) && found.sources[0] === 'coco的档案');

  const empty = await createKnowledge(makeFake({ matches: [] }).fake).search('完全无关的问题');
  check('没有命中时如实说明', empty.count === 0 && /没有找到相关内容/.test(empty.hint), empty.hint);
  check('没有命中时明确要求不许编造', /不要凭印象作答/.test(empty.hint), empty.hint);

  // ── ④ 降级 ────────────────────────────────────────────────
  console.log('\n【4】向量服务故障时的降级');
  const broken = createKnowledge(makeFake({ embedFails: true }).fake);
  const brokenResult = await broken.search('安静');
  check('不抛异常，返回 ok:false', brokenResult.ok === false);
  check('给出可读原因', /向量服务不可用|知识索引不可用/.test(brokenResult.message || ''), brokenResult.message);

  const neverIndexed = createKnowledge(makeFake({ corpus: { ...CORPUS, chunkCount: 0 }, embedFails: true }).fake);
  const freshResult = await neverIndexed.ensureFresh();
  check('索引重建失败时不抛异常', freshResult.ok === false && typeof freshResult.message === 'string');

  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  process.exit(failed ? 1 : 0);
})();
