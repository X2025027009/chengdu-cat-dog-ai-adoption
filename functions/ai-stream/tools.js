/**
 * AI 工具层（Function Calling）
 *
 * ── 为什么需要这一层 ──────────────────────────────────────────
 * 改造前：把「全部宠物档案」直接拼进系统提示词。
 *   6 只时能跑，但真实救助站有几十到几百只，**塞不进去**；
 *   而且领养政策、回访记录这两类知识根本没进去——
 *   访客问「你们怎么回访」「领养要花钱吗」，AI 只能编。
 *
 * 改造后：AI 只拿到「有哪些工具」，需要什么自己去查。
 *   档案再多也不怕；回答基于实时数据；并且**每一步查询都留痕**，
 *   页面上能显示"正在查询可领养宠物…"，回答也能列出依据。
 *
 * ── 安全边界（重要）───────────────────────────────────────────
 * 1. 工具**只读**，不写任何数据；
 * 2. 只暴露公开档案与公开政策，**绝不返回申请人信息**；
 * 3. 刻意**不提供**"按联系方式查申请记录"这类工具——
 *    那等于让任何人都能查"某人有没有来申请过"，属于隐私泄露；
 *    这类查询只保留在管理员侧（见方案阶段 3）；
 * 4. 所有参数都做长度截断，查询一律参数化拼装（sqlLiteral 转义单引号）。
 */

/** 单个工具执行超时：任何一个工具卡住都不该拖垮整轮对话。 */
const TOOL_TIMEOUT_MS = 6000;
/** 返回给模型的记录条数上限，避免工具结果本身把上下文撑爆。 */
const MAX_RESULT_ROWS = 20;

/**
 * 工具定义：交给模型的"能力清单"（OpenAI Function Calling 格式）。
 *
 * search_knowledge 与 search_pets 的分工：
 *   描述性、说不清条件的需求（"安静的""适合上班族的"）走语义检索；
 *   条件明确的（"有没有公猫"）走结构化查询，更快也更准。
 *   两者都提供，让模型自己选——这本来就是它该判断的事。
 */
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description:
        '按意思检索小院的全部文字资料：宠物性格与健康状况、领养要求、领养政策、历史回访记录。当访客用描述性说法提问时优先用它，例如「想找一只安静的猫」「有没有适合上班族的」「它以前被人养过吗」「你们怎么回访」。返回最相关的片段及来源标签。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '检索用的自然语言，尽量保留访客的原话和关键条件' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_pets',
      description:
        '按条件检索小院在册的宠物。当访客描述了想要的种类、性别、性格（温顺、活泼、粘人等）或明确表示想看看有哪些时使用。返回精简列表（名字、品种、性别、年龄、状态、标签、一句话简介），需要细节再用 get_pet_profile 查。',
      parameters: {
        type: 'object',
        properties: {
          petType: { type: 'string', enum: ['猫咪', '狗狗'], description: '物种，不确定就不要传' },
          gender: { type: 'string', description: '性别，例如 公、母' },
          adoptableOnly: { type: 'boolean', description: '是否只看当前可领养（状态为「待领养」）的宠物，默认 true' },
          keyword: { type: 'string', description: '性格或特征关键词，例如 温顺、亲人、安静、活泼、适合新手' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pet_profile',
      description: '读取某一只宠物的完整档案：性别、年龄、健康情况、性格描述、领养要求、当前状态。准备推荐某只宠物前，用它确认细节。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '宠物名字，例如 喜豆' },
          petId: { type: 'string', description: '宠物编号，已知时用这个更准确' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_adoption_policy',
      description: '读取小院的领养政策原文，包含领养流程、是否收费、回访安排等。访客问「怎么领养」「要花钱吗」「会不会回访」「需要什么条件」这类问题时使用。',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_follow_up_history',
      description: '读取某只宠物的历史回访与近况记录。访客关心「它以前被人养过吗」「后来怎么样了」时使用。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '宠物名字' },
          petId: { type: 'string', description: '宠物编号' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_requirement_gaps',
      description:
        '把访客自述的情况与常见领养要求逐条对照，返回「哪些已经说明、哪些还没提到」。当访客问「我适合养它吗」「我条件够吗」，或你自己需要判断还缺哪些信息时使用。注意：它只能判断"有没有提到"，不能判断"是否达标"——达标与否由你结合档案说明。',
      parameters: {
        type: 'object',
        properties: {
          conditions: { type: 'string', description: '访客自述的居住、作息、养宠经验、家人态度、是否有房东等情况的原文或摘要' }
        },
        required: ['conditions']
      }
    }
  }
];

/**
 * 领养前最常出问题的几件事。
 *
 * 这里刻意只判断「访客有没有说明」，不判断「是否合格」——
 * 关键词匹配做不到语义判断，硬判会给出错误结论。
 * 让规则负责"找缺口"、模型负责"讲道理"，各做各擅长的事。
 *
 * 同义词要尽量收全：漏掉一个常见说法，就会把"已经说明"误报成"未提及"，
 * 反而让访客以为自己做错了什么（自测时「家里人」漏判过，故补全）。
 */
const REQUIREMENT_CHECKS = [
  { label: '居住地能否养宠（租房需房东同意）', keys: ['房东', '租房', '租的', '租住', '自有', '有房', '买房', '买的房', '自己的房', '宿舍', '公寓', '家里住'] },
  { label: '家人是否同意', keys: ['家人', '家里人', '家里都', '全家人', '父母', '爸妈', '家长', '配偶', '老公', '老婆', '对象', '室友', '同住', '一起住', '都支持', '都同意'] },
  { label: '白天家中是否有人', keys: ['白天', '在家', '不上班', '居家', '自由职业', '退休', '全职', '在家办公'] },
  { label: '封窗与安全防护', keys: ['封窗', '纱窗', '防护', '阳台', '窗户', '金刚网', '防坠', '安全网'] },
  { label: '养宠经验', keys: ['养过', '以前养', '没养过', '第一次', '有经验', '没有经验', '养了'] },
  { label: '现有宠物情况', keys: ['现有', '已经养', '原住民', '另一只', '家里有', '还有一只', '没有别的'] },
  { label: '时间与精力投入', keys: ['上班', '工作', '加班', '出差', '学生', '空闲', '时间', '作息'] },
  { label: '是否接受回访', keys: ['回访', '上门', '视频', '接受', '可以来看', '欢迎来'] }
];

function makeHelpers() {
  const clip = (value, max) =>
    String(value ?? '')
      .trim()
      .slice(0, max);
  const quote = value => (value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`);
  return { clip, quote };
}

/**
 * 创建工具集。
 *
 * @param {(sql: string) => Promise<any>} query 执行 SQL 并返回解析后的 JSON。
 *        由调用方注入，工具层不关心底层是 OpenAPI 还是别的通道，
 *        便于单测时替换成假实现。
 */
function createToolkit({ query, knowledge }) {
  const { clip, quote } = makeHelpers();

  /** 统一的工具超时包装：超时不抛错，而是回一句可读的降级说明。 */
  async function runWithTimeout(run) {
    return Promise.race([run(), new Promise(resolve => setTimeout(() => resolve({ ok: false, message: '查询超时，请改用更简单的条件重试。' }), TOOL_TIMEOUT_MS))]);
  }

  /** 把宠物行统一成对模型友好的结构，同时裁掉无用字段。 */
  function shapePet(row, { full = false } = {}) {
    const base = {
      id: clip(row.id, 80),
      name: clip(row.name, 40),
      type: clip(row.pet_type, 10),
      gender: clip(row.gender, 10),
      age: clip(row.age_text, 40),
      status: clip(row.adoption_status, 20),
      tags: Array.isArray(row.tags) ? row.tags.slice(0, 8).map(tag => clip(tag, 20)) : []
    };
    if (!full) return { ...base, summary: clip(row.description, 120) };
    return {
      ...base,
      description: clip(row.description, 600),
      health: clip(row.health, 400),
      requirements: clip(row.requirements, 400),
      pauseReason: clip(row.pause_reason, 200)
    };
  }

  const PET_COLUMNS = 'id, name, pet_type, gender, age_text, adoption_status, tags, description, health, requirements, pause_reason';

  async function searchPets(args = {}) {
    const conditions = ['is_published = TRUE'];
    const petType = clip(args.petType, 10);
    if (petType) conditions.push(`pet_type = ${quote(petType)}`);
    const gender = clip(args.gender, 10);
    if (gender) conditions.push(`gender = ${quote(gender)}`);
    if (args.adoptableOnly !== false) conditions.push(`adoption_status = '待领养'`);
    const keyword = clip(args.keyword, 40);
    if (keyword) {
      // 标签是数组，先转成文本再匹配；命中的记录优先排在前面
      const like = quote(`%${keyword}%`);
      conditions.push(`(description ILIKE ${like} OR requirements ILIKE ${like} OR health ILIKE ${like} OR array_to_string(tags, ' ') ILIKE ${like})`);
    }
    const sql = `SELECT jsonb_build_object('pets', COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)) AS result FROM (
        SELECT ${PET_COLUMNS} FROM public.pets
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at LIMIT ${MAX_RESULT_ROWS}
      ) t`;
    const payload = await query(sql);
    const pets = Array.isArray(payload?.pets) ? payload.pets : [];
    if (!pets.length) return { ok: true, count: 0, pets: [], hint: '没有符合条件的宠物。可以放宽条件（去掉种类或关键词）再试一次。' };
    return { ok: true, count: pets.length, pets: pets.map(row => shapePet(row)) };
  }

  /** 按名字或编号定位一只宠物。名字不唯一时返回候选，让模型自己确认。 */
  async function findPet(args = {}) {
    const petId = clip(args.petId, 80);
    const name = clip(args.name, 40);
    const where = petId ? `id = ${quote(petId)}` : name ? `name = ${quote(name)}` : '';
    if (!where) return { ok: false, message: '需要提供宠物名字或编号。' };
    const sql = `SELECT jsonb_build_object('pets', COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)) AS result FROM (
        SELECT ${PET_COLUMNS} FROM public.pets WHERE ${where} AND is_published = TRUE LIMIT 5
      ) t`;
    const payload = await query(sql);
    const pets = Array.isArray(payload?.pets) ? payload.pets : [];
    return pets.length ? { ok: true, pets } : { ok: false, message: `没有找到叫「${name || petId}」的在册宠物。` };
  }

  async function getPetProfile(args = {}) {
    const found = await findPet(args);
    if (!found.ok) return found;
    if (found.pets.length > 1) {
      return { ok: false, message: '有多个同名宠物，请让访客确认是哪一只。', candidates: found.pets.map(row => shapePet(row)) };
    }
    return { ok: true, pet: shapePet(found.pets[0], { full: true }) };
  }

  /**
   * 读取领养政策。
   *
   * 如实反映"小院到底填了没有"：政策文本缺失时，明确告诉模型别推测，
   * 而不是回一句"暂无"让模型自由发挥——费用、家访这类事一旦编错，
   * 对访客是实实在在的误导。
   */
  async function getAdoptionPolicy() {
    const sql = `SELECT jsonb_build_object('policy', COALESCE((SELECT value FROM public.yard_settings WHERE key='application_policy' LIMIT 1), '{}'::jsonb)) AS result`;
    const payload = await query(sql);
    const policy = payload?.policy || {};
    const policyText = clip(policy.description || policy.text || policy.content, 1200);
    const lines = [];
    if (policyText) lines.push(policyText);
    if (policy.privacy_notice) lines.push(`隐私说明：${clip(policy.privacy_notice, 300)}`);
    if (policy.retention_days) lines.push(`申请资料保存期限：${clip(policy.retention_days, 10)} 天`);
    return {
      ok: true,
      hasPolicyText: Boolean(policyText),
      policy: lines.length ? lines.join('\n') : '（小院尚未填写领养流程与费用说明）',
      note: policyText
        ? '以上为小院公布的领养政策原文，请据此回答。'
        : '小院尚未公布领养流程、费用与回访安排。请如实告诉访客"这部分还没公布，建议直接联系小院确认"，**不要自行推测收费与否或回访次数**。'
    };
  }

  async function getFollowUpHistory(args = {}) {
    const found = await findPet(args);
    if (!found.ok) return found;
    const petId = clip(found.pets[0].id, 80);
    // 注意：pet_updates 的正文列名是 body，不是 content（核对 information_schema 后确认）
    const sql = `SELECT jsonb_build_object('updates', COALESCE(jsonb_agg(jsonb_build_object(
        'date', update_date, 'title', title, 'content', body
      ) ORDER BY update_date DESC), '[]'::jsonb)) AS result
      FROM (SELECT update_date, title, body FROM public.pet_updates WHERE pet_id = ${quote(petId)} ORDER BY update_date DESC LIMIT 10) t`;
    const payload = await query(sql);
    const updates = Array.isArray(payload?.updates) ? payload.updates : [];
    return {
      ok: true,
      petName: clip(found.pets[0].name, 40),
      hasHistory: updates.length > 0,
      updates: updates.map(item => ({
        date: clip(item.date, 20),
        title: clip(item.title, 80),
        content: clip(item.content, 400)
      }))
    };
  }

  /**
   * 逐条对照「常见领养要求」与访客自述，标出哪些已经说明、哪些还没提到。
   * **只判断有没有提到，不判断是否合格** —— 这一点必须如实告诉模型，
   * 否则它会把"没提到"当成"不合格"，给出误导结论。
   */
  function checkRequirementGaps(args = {}) {
    const conditions = clip(args.conditions, 1000);
    if (!conditions) return { ok: false, message: '需要先提供访客自述的情况。' };
    const items = REQUIREMENT_CHECKS.map(check => {
      const hit = check.keys.find(key => conditions.includes(key));
      return { item: check.label, status: hit ? '已说明' : '未提及', evidence: hit ? `访客提到「${hit}」` : '' };
    });
    const missing = items.filter(entry => entry.status === '未提及').map(entry => entry.item);
    return {
      ok: true,
      items,
      missingCount: missing.length,
      missing,
      note: '以上只反映访客是否提到过，不代表是否达标——是否合适请结合宠物档案与访客具体情况判断。'
    };
  }

  /**
   * 语义检索。检索不可用时返回 ok:false，模型可以改用 search_pets 之类的
   * 结构化查询继续——工具层任何一环故障都不该让对话中断。
   */
  async function searchKnowledge(args = {}) {
    if (!knowledge) return { ok: false, message: '语义检索暂不可用，请改用 search_pets 按条件查询。' };
    const question = clip(args.query, 200);
    if (!question) return { ok: false, message: '需要提供检索内容。' };
    return knowledge.search(question);
  }

  const EXECUTORS = {
    search_knowledge: searchKnowledge,
    search_pets: searchPets,
    get_pet_profile: getPetProfile,
    get_adoption_policy: getAdoptionPolicy,
    get_follow_up_history: getFollowUpHistory,
    check_requirement_gaps: checkRequirementGaps
  };

  /**
   * 执行一次工具调用。
   *
   * 永不抛错：任何异常都转成 `{ ok:false, message }` 交给模型，
   * 让它可以换个方式继续，而不是让整轮对话崩掉。
   */
  async function execute(name, rawArguments) {
    const executor = EXECUTORS[name];
    if (!executor) return { ok: false, message: `没有名为 ${name} 的工具。` };
    let args = {};
    try {
      args = typeof rawArguments === 'string' ? JSON.parse(rawArguments || '{}') : rawArguments || {};
    } catch {
      return { ok: false, message: '工具参数不是合法 JSON。' };
    }
    try {
      return await runWithTimeout(() => executor(args));
    } catch (error) {
      return { ok: false, message: `工具执行失败：${clip(error.message, 120)}` };
    }
  }

  /**
   * 降级路径：一次性读取全部公开档案。
   * 当模型不支持工具调用、或工具轮次异常时，仍然回到"直接注入档案"的老办法，
   * 保证匹配助手不会因为工具层故障而整体失效。
   */
  async function loadPetCatalog() {
    const sql = `SELECT jsonb_build_object('pets', COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)) AS result FROM (
        SELECT ${PET_COLUMNS} FROM public.pets WHERE is_published = TRUE ORDER BY created_at LIMIT 200
      ) t`;
    const payload = await query(sql);
    const pets = Array.isArray(payload?.pets) ? payload.pets : [];
    return pets.map(row => shapePet(row, { full: true }));
  }

  return { definitions: TOOL_DEFINITIONS, execute, loadPetCatalog, searchPets };
}

module.exports = { createToolkit, TOOL_DEFINITIONS, REQUIREMENT_CHECKS };
