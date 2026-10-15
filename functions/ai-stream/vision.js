/**
 * 以图搜宠：多模态向量检索。
 *
 * ── 为什么访客照片和宠物照片能比相似度 ────────────────────────
 * kinfra-vl-embedding-2b 把图片映射到同一个向量空间，
 * 两张照片的向量越接近，画面内容越相似。这里只比**照片**，不做跨模态文本匹配——
 * 档案里的文字多是「力气大、脾气爆」这类行为描述，和照片视觉特征对不上，
 * 强行跨模态匹配反而更容易误导。
 *
 * ── 怎么解决"照片地址带签名"的问题 ───────────────────────────
 * 宠物照片存在 CloudBase 存储里，公开地址是**带签名的临时链接**，
 * 服务端拼不出来（实测无签名访问返回 418）。做法是：
 *   · **缓存键用 storage_path**（稳定不变），不用带签名的地址；
 *   · 前端每次把当前可用的签名地址一起传过来，**只在缓存未命中时才用它取图**；
 *   · 因此第一次查询会慢一点（要逐张建索引），之后都走缓存。
 *
 * ── 安全边界 ──────────────────────────────────────────────────
 * 服务端会去抓前端给的地址，必须防止被指使去抓任意 URL：
 *   · 域名白名单：只允许本站的云存储域名；
 *   · 路径校验：storage_path 必须真实存在于 pet_media 表里。
 * 两道都过了才会发起请求。
 */

const TOKENHUB_MULTIMODAL_URL = 'https://tokenhub.tencentmaas.com/v1/embeddings/multimodal';
/** 输出 2048 维的多模态模型。维度在服务端会校验，写错模型会立刻报错。 */
const VL_MODEL = process.env.TOKENHUB_VL_MODEL || 'kinfra-vl-embedding-2b';
const VL_DIMENSION = 2048;
/** 单次请求最多处理多少张宠物照片，避免一次查询把额度烧光。 */
const MAX_PHOTOS = 40;
/** 低于这个相似度不作为结果返回。 */
const MIN_SIMILARITY = 0.5;
/** 只允许这些域名，防止服务端被指使去抓任意地址。 */
const ALLOWED_HOST = /(^|\.)(tcloudbasegateway\.com|tcb\.qcloud\.la|myqcloud\.com|tcloudbaseapp\.com)$/i;

function clip(value, max) {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}
function quote(value) {
  return value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;
}
/** halfvec 的字面量：'[0.1,0.2,...]'::halfvec */
function halfvecLiteral(values) {
  return `'[${values.map(v => (Number.isFinite(v) ? Number(v.toFixed(5)) : 0)).join(',')}]'::halfvec`;
}
/**
 * 只允许本站云存储的地址，防止服务端被指使去抓任意 URL。
 *
 * 域名来自实测：CloudBase 存储现在通过网关下发，
 * 实际域名是 `{envId}.api.tcloudbasegateway.com`
 * （旧的 `tcb.qcloud.la` 无签名访问返回 418，已不是当前入口）。
 *
 * 光有域名白名单还不够：攻击者可以拿一个真实存在的 storage_path
 * 配一个指向别处的网关地址。因此再加一道——**地址路径必须包含该 storage_path**，
 * 这样服务端只可能抓到它自己那张照片。
 */
function isAllowedUrl(url, storagePath) {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'https:') return false;
    if (!ALLOWED_HOST.test(parsed.hostname)) return false;
    if (storagePath) {
      const path = decodeURIComponent(parsed.pathname);
      if (!path.includes(String(storagePath))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 创建以图搜宠检索器。
 *
 * @param {(sql: string) => Promise<any>} query 执行 SQL 并返回解析后的 JSON
 * @param {(input: {url?: string, dataUrl?: string}) => Promise<number[]>} embedImage 图片向量化
 */
function createVision({ query, embedImage }) {
  /** 校验 storage_path 确实属于本站的宠物照片，避免被塞入任意路径。 */
  async function filterKnownPaths(photos) {
    const raw = Array.isArray(photos) ? photos : [];
    const shaped = raw.map(item => ({
      path: clip(item?.path, 300),
      url: clip(item?.url, 2000),
      petId: clip(item?.petId, 80),
      petName: clip(item?.petName, 40),
      isCover: item?.isCover === true
    }));
    // 诊断信息：出错时把"卡在哪一步"说清楚，而不是只回一句笼统的失败。
    // 只记录域名，不记录完整地址（签名有效期很短，也没必要外传）。
    const hosts = [
      ...new Set(
        shaped
          .map(item => {
            try {
              return new URL(item.url).hostname;
            } catch {
              return '';
            }
          })
          .filter(Boolean)
      )
    ].slice(0, 4);
    const diagnostics = {
      received: raw.length,
      missingPath: shaped.filter(item => !item.path).length,
      rejectedUrl: shaped.filter(item => item.path && !isAllowedUrl(item.url, item.path)).length,
      hosts
    };

    const candidates = shaped.filter(item => item.path && item.petId && isAllowedUrl(item.url, item.path)).slice(0, MAX_PHOTOS);
    if (!candidates.length) return { valid: [], diagnostics };

    const known = await query(
      `SELECT jsonb_build_object('paths', COALESCE(jsonb_agg(storage_path), '[]'::jsonb)) AS result
       FROM public.pet_media WHERE storage_path IN (${candidates.map(item => quote(item.path)).join(',')})`
    );
    const allowed = new Set(Array.isArray(known?.paths) ? known.paths : []);
    const valid = candidates.filter(item => allowed.has(item.path));
    diagnostics.unknownPath = candidates.length - valid.length;
    return { valid, diagnostics };
  }

  /** 给尚未建索引的宠物照片补上向量。单张失败不影响其它张。 */
  async function ensureIndexed(photos) {
    const { valid, diagnostics } = await filterKnownPaths(photos);
    if (!valid.length) {
      const why =
        diagnostics.received === 0
          ? '前端没有传任何宠物照片（可能宠物资料还没加载完）'
          : `收到 ${diagnostics.received} 张，其中地址被拒 ${diagnostics.rejectedUrl} 张、路径不存在 ${diagnostics.unknownPath ?? 0} 张；域名：${diagnostics.hosts.join('、') || '无法解析'}`;
      return { ok: false, message: `没有可用的宠物照片 —— ${why}` };
    }

    const cached = await query(
      `SELECT jsonb_build_object('paths', COALESCE(jsonb_agg(storage_path), '[]'::jsonb)) AS result
       FROM public.pet_photo_vectors WHERE storage_path IN (${valid.map(item => quote(item.path)).join(',')})`
    );
    const known = new Set(Array.isArray(cached?.paths) ? cached.paths : []);
    const missing = valid.filter(item => !known.has(item.path));

    let indexed = 0;
    const failures = [];
    for (const photo of missing) {
      try {
        const vector = await embedImage({ url: photo.url });
        if (!Array.isArray(vector) || vector.length !== VL_DIMENSION) {
          failures.push(`${photo.path}：向量维度异常`);
          continue;
        }
        await query(
          `WITH saved AS (
             INSERT INTO public.pet_photo_vectors (storage_path, pet_id, pet_name, is_cover, embedding, updated_at)
             VALUES (${quote(photo.path)}, ${quote(photo.petId)}, ${quote(photo.petName)}, ${photo.isCover ? 'TRUE' : 'FALSE'}, ${halfvecLiteral(vector)}, NOW())
             ON CONFLICT (storage_path) DO UPDATE SET
               embedding = EXCLUDED.embedding, pet_name = EXCLUDED.pet_name, updated_at = NOW()
             RETURNING 1
           ) SELECT jsonb_build_object('saved', count(*)) AS result FROM saved`
        );
        indexed += 1;
      } catch (error) {
        failures.push(`${photo.path}：${clip(error.message, 100)}`);
      }
    }
    return { ok: true, total: valid.length, cached: known.size, indexed, failures };
  }

  /**
   * 以图搜宠。
   * @param {string} imageDataUrl 访客上传的照片（前端已压到 768px 以内）
   * @param {Array} photos 前端传来的宠物照片列表 [{path,url,petId,petName,isCover}]
   */
  async function search({ imageDataUrl, photos, topK = 3 }) {
    const image = clip(imageDataUrl, 1200000);
    if (!image.startsWith('data:image/')) return { ok: false, message: '请先选择一张照片。' };

    const indexState = await ensureIndexed(photos);
    if (!indexState.ok) return { ok: false, message: indexState.message };

    const queryVector = await embedImage({ dataUrl: image });
    if (!Array.isArray(queryVector) || queryVector.length !== VL_DIMENSION) {
      return { ok: false, message: '照片向量化失败。' };
    }
    const literal = halfvecLiteral(queryVector);
    const limit = Math.min(Math.max(Number(topK) || 3, 1), 6) * 3; // 多取一些，去重后再截断

    const payload = await query(
      `SELECT jsonb_build_object('matches', COALESCE(jsonb_agg(jsonb_build_object(
            'petId', pet_id, 'petName', pet_name, 'storagePath', storage_path,
            'similarity', round((1 - distance)::numeric, 4)
          ) ORDER BY distance), '[]'::jsonb)) AS result
        FROM (
          SELECT pet_id, pet_name, storage_path, (embedding <=> ${literal}) AS distance
          FROM public.pet_photo_vectors
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${literal}
          LIMIT ${limit}
        ) t`
    );

    // 每只宠物只保留最像的那张照片，再按相似度排序
    const best = new Map();
    for (const item of Array.isArray(payload?.matches) ? payload.matches : []) {
      const similarity = Number(item.similarity);
      if (!Number.isFinite(similarity) || similarity < MIN_SIMILARITY) continue;
      const existing = best.get(item.petId);
      if (!existing || similarity > existing.similarity) {
        best.set(item.petId, {
          petId: clip(item.petId, 80),
          petName: clip(item.petName, 40),
          storagePath: clip(item.storagePath, 300),
          similarity
        });
      }
    }
    const matches = [...best.values()].sort((a, b) => b.similarity - a.similarity).slice(0, Math.min(Math.max(Number(topK) || 3, 1), 6));

    return {
      ok: true,
      matches,
      indexed: indexState.indexed,
      cached: indexState.cached + indexState.indexed,
      failures: indexState.failures,
      hint: matches.length
        ? '以上是照片特征最接近的宠物。相似度只反映画面像不像，不代表性格或健康状况合适，仍需按档案与领养要求判断。'
        : '站内没有找到画面特征接近的宠物。可以如实告诉访客，并建议按性格、居住条件来挑选。'
    };
  }

  return { search, ensureIndexed };
}

module.exports = { createVision, isAllowedUrl, VL_DIMENSION, TOKENHUB_MULTIMODAL_URL, VL_MODEL };
