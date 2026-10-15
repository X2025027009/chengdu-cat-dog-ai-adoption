/**
 * 知识检索层（RAG）
 *
 * ── 解决什么问题 ──────────────────────────────────────────────
 * 阶段 1 有了工具，但检索方式还是"按条件精确匹配"（种类/性别/关键词）。
 * 访客说「想找一只安静的猫」「有没有适合上班族的」，关键词匹配不到就返回空——
 * **描述性需求表达不出来**。
 *
 * 这里把宠物档案、领养政策、回访记录都转成向量存进 pgvector，
 * 查询时按语义相似度取回最相关的片段，再交给模型组织回答。
 *
 * ── 几个设计决定 ──────────────────────────────────────────────
 * 1. **按字段切块**，不是整只宠物一个大块：
 *    档案（性格/健康/标签）与领养要求分开，检索"我适合养它吗"时
 *    命中的是要求块而不是性格块，依据更准。
 * 2. **按需重建**：不依赖管理员手动点按钮，也不依赖定时任务。
 *    检索前检查"索引是否落后于档案更新时间"，落后就重建。
 *    代价是首次查询慢两三秒，换来的是永远不会有陈旧索引。
 * 3. **失败即降级**：向量检索不可用时返回 ok:false，由上层退回关键词检索，
 *    匹配助手不会因为向量服务故障而整体失效。
 */

/** 文本切块上限：TokenHub 单条输入上限 1024 token，中文按 1.8 字符/token 折算后留足余量。 */
const MAX_CHUNK_CHARS = 600;
/** 一次请求最多带多少条文本去向量化。 */
const EMBED_BATCH_SIZE = 16;
/** 低于这个相似度的片段不返回——宁可不答，也不要拿不相关的内容凑数。 */
const MIN_SIMILARITY = 0.3;
/** 默认取回几条片段。 */
const DEFAULT_TOP_K = 4;

function clip(value, max) {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}
function quote(value) {
  return value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;
}
/** pgvector 的向量字面量：'[0.1,0.2,...]'::vector */
function vectorLiteral(values) {
  return `'[${values.map(v => (Number.isFinite(v) ? Number(v.toFixed(6)) : 0)).join(',')}]'::vector`;
}

/**
 * 把语料切成可检索的块。
 *
 * 每块都带 sourceLabel——检索命中后要展示给用户看「依据来自哪里」，
 * 这是可解释性的落点，不是装饰。
 */
function buildChunks({ pets, policy, updates }) {
  const chunks = [];

  for (const pet of pets || []) {
    const name = clip(pet.name, 40);
    if (!name) continue;
    const profile = [
      `名称：${name}`,
      `种类：${clip(pet.type, 10)}`,
      `性别：${clip(pet.gender, 10)}`,
      `年龄：${clip(pet.age, 40)}`,
      `领养状态：${clip(pet.status, 20)}`,
      Array.isArray(pet.tags) && pet.tags.length ? `标签：${pet.tags.join('、')}` : '',
      pet.description ? `性格与情况：${clip(pet.description, 400)}` : '',
      pet.health ? `健康情况：${clip(pet.health, 300)}` : '',
      pet.pauseReason ? `暂不开放原因：${clip(pet.pauseReason, 200)}` : ''
    ]
      .filter(Boolean)
      .join('\n');
    chunks.push({
      id: `pet:${clip(pet.id, 80)}:profile`,
      sourceType: 'pet',
      sourceId: clip(pet.id, 80),
      sourceLabel: `${name}的档案`,
      content: profile
    });

    if (clip(pet.requirements, 400)) {
      chunks.push({
        id: `pet:${clip(pet.id, 80)}:requirements`,
        sourceType: 'pet',
        sourceId: clip(pet.id, 80),
        sourceLabel: `${name}的领养要求`,
        content: `宠物：${name}\n领养要求：${clip(pet.requirements, 400)}`
      });
    }
  }

  // 政策按字段拆开：隐私说明和保存期限跟"怎么领养"不是一回事，
  // 混在一起会让检索出来的片段既长又不聚焦。
  const policyParts = [
    ['流程与要求', clip(policy?.description || policy?.text || policy?.content, 800)],
    ['隐私说明', clip(policy?.privacy_notice, 400)],
    ['资料保存期限', policy?.retention_days ? `申请资料保存 ${clip(policy.retention_days, 10)} 天` : '']
  ];
  for (const [label, content] of policyParts) {
    if (!content) continue;
    chunks.push({
      id: `policy:${label}`,
      sourceType: 'policy',
      sourceId: 'application_policy',
      sourceLabel: `领养政策（${label}）`,
      content: `领养政策·${label}：${content}`
    });
  }

  for (const update of updates || []) {
    const content = clip(update.content, 500);
    if (!content) continue;
    const petName = clip(update.petName, 40) || '某只宠物';
    chunks.push({
      id: `followup:${clip(update.id, 80)}`,
      sourceType: 'follow_up',
      sourceId: clip(update.id, 80),
      sourceLabel: `${petName}的回访记录（${clip(update.date, 20)}）`,
      content: [`宠物：${petName}`, `日期：${clip(update.date, 20)}`, clip(update.title, 80), content].filter(Boolean).join('\n')
    });
  }

  // 超长的块截断，避免单条超过模型输入上限
  return chunks.map(chunk => ({ ...chunk, content: clip(chunk.content, MAX_CHUNK_CHARS) }));
}

/**
 * 创建知识检索器。
 *
 * @param {(sql: string) => Promise<any>} query 执行 SQL 并返回解析后的 JSON
 * @param {(texts: string[]) => Promise<number[][]>} embed 批量向量化
 */
function createKnowledge({ query, embed }) {
  /** 读取全部语料，并判断索引是否已落后。 */
  async function readCorpus() {
    const sql = `SELECT jsonb_build_object(
        'pets', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', id, 'name', name, 'type', pet_type, 'gender', gender, 'age', age_text,
            'status', adoption_status, 'tags', tags, 'description', description,
            'health', health, 'requirements', requirements, 'pauseReason', pause_reason
          )), '[]'::jsonb) FROM public.pets WHERE is_published = TRUE),
        'policy', COALESCE((SELECT value FROM public.yard_settings WHERE key='application_policy' LIMIT 1), '{}'::jsonb),
        'updates', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', u.id, 'petName', p.name, 'date', u.update_date, 'title', u.title, 'content', u.body
          )), '[]'::jsonb) FROM public.pet_updates u LEFT JOIN public.pets p ON p.id = u.pet_id),
        'chunkCount', (SELECT count(*) FROM public.knowledge_chunks),
        'lastIndexedAt', (SELECT max(updated_at)::text FROM public.knowledge_chunks),
        'petUpdatedAt', (SELECT max(updated_at)::text FROM public.pets),
        -- pet_updates 只有 created_at，没有 updated_at（核对 information_schema 后确认）
        'updateAt', (SELECT max(created_at)::text FROM public.pet_updates)
      ) AS result`;
    return query(sql);
  }

  /** 索引是否需要重建：从没建过、块数为零、或语料比索引新。 */
  function needsRebuild(corpus) {
    if (!Number(corpus?.chunkCount)) return true;
    const indexed = Date.parse(corpus.lastIndexedAt || '') || 0;
    const newest = Math.max(Date.parse(corpus.petUpdatedAt || '') || 0, Date.parse(corpus.updateAt || '') || 0);
    return newest > indexed;
  }

  /** 重建索引：切块 → 批量向量化 → 覆盖写入。 */
  async function rebuild() {
    const corpus = await readCorpus();
    const chunks = buildChunks(corpus);
    if (!chunks.length) return { ok: true, chunks: 0, note: '暂无可建立索引的内容。' };

    let written = 0;
    for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(start, start + EMBED_BATCH_SIZE);
      const vectors = await embed(batch.map(chunk => chunk.content));
      if (!Array.isArray(vectors) || vectors.length !== batch.length) {
        return { ok: false, message: `向量化返回数量不符（期望 ${batch.length}，实际 ${vectors?.length ?? 0}）。` };
      }
      // 一条 SQL 写入整批，减少往返
      const values = batch
        .map((chunk, index) => {
          const vector = Array.isArray(vectors[index]) && vectors[index].length ? vectorLiteral(vectors[index]) : 'NULL';
          return `(${quote(chunk.id)}, ${quote(chunk.sourceType)}, ${quote(chunk.sourceId)}, ${quote(chunk.sourceLabel)}, ${quote(chunk.content)}, ${vector}, NOW())`;
        })
        .join(',\n');
      const sql = `WITH upserted AS (
          INSERT INTO public.knowledge_chunks (id, source_type, source_id, source_label, content, embedding, updated_at)
          VALUES ${values}
          ON CONFLICT (id) DO UPDATE SET
            source_label = EXCLUDED.source_label,
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            updated_at = NOW()
          RETURNING 1
        ) SELECT jsonb_build_object('written', count(*)) AS result FROM upserted`;
      const result = await query(sql);
      written += Number(result?.written) || 0;
    }
    return { ok: true, chunks: written, indexedAt: new Date().toISOString() };
  }

  /** 索引过期就重建。失败不抛错——检索退回关键词匹配即可，不该让对话崩掉。 */
  async function ensureFresh() {
    try {
      const corpus = await readCorpus();
      if (!needsRebuild(corpus)) return { ok: true, rebuilt: false, chunkCount: Number(corpus.chunkCount) || 0 };
      const result = await rebuild();
      return { ...result, rebuilt: true };
    } catch (error) {
      return { ok: false, rebuilt: false, message: clip(error.message, 150) };
    }
  }

  /**
   * 语义检索：把查询转成向量，取最相似的几块。
   * 命中片段带 sourceLabel，便于在回答下方展示「依据来自哪里」。
   */
  async function search(queryText, topK = DEFAULT_TOP_K) {
    const cleaned = clip(queryText, 200);
    if (!cleaned) return { ok: false, message: '检索内容为空。' };
    const fresh = await ensureFresh();
    if (!fresh.ok) return { ok: false, message: `知识索引不可用：${fresh.message}` };

    const [vector] = await embed([cleaned]);
    if (!Array.isArray(vector) || !vector.length) return { ok: false, message: '查询向量化失败。' };
    const literal = vectorLiteral(vector);
    const limit = Math.min(Math.max(Number(topK) || DEFAULT_TOP_K, 1), 8);

    const sql = `SELECT jsonb_build_object('matches', COALESCE(jsonb_agg(jsonb_build_object(
          'label', source_label, 'type', source_type, 'content', content,
          'similarity', round((1 - distance)::numeric, 4)
        ) ORDER BY distance), '[]'::jsonb)) AS result
      FROM (
        SELECT source_label, source_type, content, (embedding <=> ${literal}) AS distance
        FROM public.knowledge_chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${literal}
        LIMIT ${limit}
      ) t`;
    const payload = await query(sql);
    const matches = (Array.isArray(payload?.matches) ? payload.matches : [])
      .filter(item => Number(item.similarity) >= MIN_SIMILARITY)
      .map(item => ({
        label: clip(item.label, 80),
        type: clip(item.type, 20),
        content: clip(item.content, MAX_CHUNK_CHARS),
        similarity: Number(item.similarity)
      }));

    return {
      ok: true,
      query: cleaned,
      count: matches.length,
      matches,
      sources: [...new Set(matches.map(item => item.label))],
      hint: matches.length ? '以上是小院资料里与问题最相关的片段，请据此回答。' : '知识库里没有找到相关内容。请如实告诉访客没有相关资料，**不要凭印象作答**。'
    };
  }

  return { ensureFresh, rebuild, search, readCorpus, buildChunks };
}

module.exports = { createKnowledge, buildChunks, MIN_SIMILARITY };
