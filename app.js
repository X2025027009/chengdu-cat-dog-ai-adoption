const DEFAULT_SETTINGS = {
  phone: '待管理员设置',
  wechat: '待管理员设置',
  hours: '建议提前预约',
  area: '四川省成都市',
  intro: '成都猫狗小院为流浪猫狗提供暂时的安全角落，也为愿意负责的人留下一条认识它们的路。',
  wechatQrUrl: '',
  wechatQrPath: '',
  wechatQrStorageId: ''
};

const DEFAULT_PETS = [
  {
    id: 'xiaomai', name: '小麦', type: '猫咪', status: '待领养', age: '约 2 岁', gender: '母',
    image: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=1100&q=90',
    video: '', tags: ['慢热', '亲人后黏人', '喜欢晒太阳'],
    description: '刚到陌生环境时会安静观察，熟悉之后喜欢靠在人身边打盹。',
    health: '已完成基础驱虫，精神和食欲稳定；绝育安排请以管理员更新为准。',
    requirements: '默认领养要求：稳定住所、家庭成员同意、做好封窗和安全防护、接受后续回访。小麦希望有一个相对安静的居住环境。',
    reason: '', updates: []
  },
  {
    id: 'afu', name: '阿福', type: '狗狗', status: '待领养', age: '约 3 岁', gender: '公',
    image: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1100&q=90',
    video: '', tags: ['爱散步', '友好', '精力充沛'],
    description: '看到牵引绳就会开心地原地转圈，是一只很喜欢和人一起出门的狗狗。',
    health: '已完成基础驱虫；其余健康、疫苗和绝育信息可由管理员在后台更新。',
    requirements: '默认领养要求：稳定住所、家庭成员同意、出门使用牵引、接受后续回访。阿福需要每天稳定的散步时间。',
    reason: '', updates: []
  },
  {
    id: 'huajuan', name: '花卷', type: '猫咪', status: '待领养', age: '约 1 岁', gender: '公',
    image: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=1100&q=90',
    video: '', tags: ['好奇', '会玩', '适应力不错'],
    description: '对逗猫棒和纸箱没有抵抗力，习惯之后很愿意主动来找人玩。',
    health: '已完成基础体外驱虫，更多医疗信息将在档案中持续补充。',
    requirements: '默认领养要求：稳定住所、家庭成员同意、做好封窗和安全防护、接受后续回访。',
    reason: '', updates: []
  },
  {
    id: 'yuanbao', name: '元宝', type: '猫咪', status: '已领养', age: '约 4 岁', gender: '母',
    image: 'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?auto=format&fit=crop&w=1100&q=90',
    video: '', tags: ['已找到家', '爱窗台', '回访中'],
    description: '元宝已经在新家安顿下来。她最喜欢的新习惯，是每天午后守在窗边看楼下的树影。',
    health: '已完成领养，后续生活状态将由回访档案持续补充。',
    requirements: '元宝已经找到温暖的家，感谢每一位曾经关注她的人。',
    reason: '', updates: [
      { date: '第一次回访', text: '新家庭分享了元宝在窗台上打盹的照片。' },
      { date: '一个月后', text: '开始主动陪家人看电视，也愿意接受梳毛。' }
    ]
  },
  {
    id: 'heitang', name: '黑糖', type: '狗狗', status: '暂不适合领养', age: '约 5 岁', gender: '母',
    image: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1100&q=90',
    video: '', tags: ['需要恢复', '安静陪伴', '可预约关注'],
    description: '黑糖正在慢慢适应新的环境。她喜欢安静待在人旁边，但目前还需要更多恢复和观察时间。',
    health: '当前处于恢复与观察阶段，开放领养时间请以小院后续更新为准。',
    requirements: '如未来开放领养，将优先沟通能够提供稳定、耐心照顾环境的预约人。',
    reason: '当前仍在恢复与观察中，暂不开放正式领养；可以提前预约关注。', updates: []
  },
  {
    id: 'dongzhi', name: '冬至', type: '狗狗', status: '暂不适合领养', age: '约 2 岁', gender: '公',
    image: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=1100&q=90',
    video: '', tags: ['需要训练', '爱吃零食', '可预约关注'],
    description: '冬至很聪明，也很有自己的主意。目前正在学习更平稳地和陌生人相处。',
    health: '身体状态稳定，正在进行日常适应与行为训练。',
    requirements: '如未来开放领养，希望领养人愿意了解并配合持续训练。',
    reason: '仍在进行行为适应训练，暂不开放正式领养；可以预约关注。', updates: []
  }
];

const APPLICATION_STATUSES = ['未处理', '沟通中', '已通过', '已登记', '等待宠物开放', '已通知', '已转为正式领养申请', '暂不考虑'];
const SITE_PAGE = document.body.dataset.page || 'home';
const LOCAL_REVIEW = window.YARD_LOCAL_REVIEW === true;
const ADMIN_TABS = ['overview', 'pets', 'applications', 'settings'];
// 本机保存「资料修改凭证」，方便同一台浏览器事后自行修改申请。
const EDIT_TOKEN_KEY = 'cd-yard-edit-tokens';
const EDIT_NOTICE_DISMISSED_KEY = 'cd-yard-edit-notice-dismissed';
const store = {
  get(key, fallback) {
    try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* demo works without persistence */ } }
};

const localPetDrafts = store.get('cd-yard-pets', null);
const hasLocalPetDrafts = Array.isArray(localPetDrafts);
let applications = store.get('cd-yard-applications', []);
const localSettingsDraft = store.get('cd-yard-settings', null);
const hasLocalSettingsDraft = Boolean(localSettingsDraft && typeof localSettingsDraft === 'object' && !Array.isArray(localSettingsDraft));
let pets = DEFAULT_PETS;
let settings = { ...DEFAULT_SETTINGS };
let publicDataSource = 'loading';
let cloudState = { connected: false, checked: false, hasLocalBackup: hasLocalPetDrafts || hasLocalSettingsDraft, error: '' };
let cloudApp = null;
let cloudDb = null;
let cloudMediaBucket = null;
let adminAuthUser = null;
let adminAccessGranted = false;
let cloudApplications = null;
// 企业微信机器人地址是私密配置：只有管理员能读，公开访客读不到这个 key。
let cloudWecomWebhook = '';
let cloudWecomWebhookLoaded = false;
let cloudWecomStatus = null;
/**
 * AI 模型配置状态。
 *
 * 刻意**只保留「是否已配置」和掩码提示**，不在前端状态里留存完整密钥——
 * 管理员不需要回看它，前端也就没有理由持有它。
 */
let cloudAiKey = { loaded: false, configured: false, hint: '' };
// TokenHub 的 Key：用于文本向量、多模态向量与视觉理解（RAG 与以图搜宠的基础）。
let cloudTokenhubKey = { loaded: false, configured: false, hint: '' };

/**
 * 把密钥渲染成可安全展示的掩码。
 *
 * 短于 12 位的（多数非标准 Key）只显示首尾各 2 位，避免把整个密钥暴露出来。
 */
function maskKey(value) {
  const text = String(value || '');
  if (!text) return '';
  return text.length > 12 ? `${text.slice(0, 4)}••••••${text.slice(-4)}` : `${text.slice(0, 2)}••••`;
}
let filters = { status: '待领养', type: '全部' };
let adminTab = 'overview';
let adminEditing = null;
let returnFocus = null;
let featuredPetIndexes = { hero: 0, story: 0 };
let featuredPetTimer = null;
let featuredSwapTimer = null;
let pendingCoverFile = null;
let pendingGalleryFiles = [];
let cropQueue = [];
let cropQueueIndex = 0;
let cropState = null;
let publicApplicationAuthPromise = null;

const $ = (selector, root = document) => root?.querySelector(selector) || null;
const $$ = (selector, root = document) => [...(root?.querySelectorAll(selector) || [])];
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const petById = (id) => pets.find(pet => pet.id === id);
const makeMediaId = () => `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
function adminTabFromUrl() {
  const tab = new URL(window.location.href).searchParams.get('tab');
  return ADMIN_TABS.includes(tab) ? tab : 'overview';
}
function changeAdminTab(tab, updateHistory = true) {
  if (!ADMIN_TABS.includes(tab)) return;
  resetPendingPhotoSelection();
  adminEditing = null;
  adminTab = tab;
  if (SITE_PAGE === 'admin' && updateHistory) {
    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') !== tab) {
      url.searchParams.set('tab', tab);
      window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }
  renderAdmin();
}
function browserApplicationToken() {
  const key = 'cd-yard-application-browser-token';
  let token = localStorage.getItem(key);
  if (token) return token;
  if (window.crypto?.randomUUID) token = window.crypto.randomUUID();
  else {
    const values = new Uint32Array(4);
    window.crypto?.getRandomValues?.(values);
    token = [...values].map(value => value.toString(16)).join('') || `${Date.now()}-${Math.random()}`;
  }
  try { localStorage.setItem(key, token); } catch { /* the server also uses IP and contact checks */ }
  return token;
}

const mediaDb = {
  db: null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('cd-yard-media', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  },
  async put(id, file) {
    const db = await this.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put({ id, blob: file, type: file.type, updatedAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return URL.createObjectURL(file);
  },
  async url(id) {
    const db = await this.open();
    return new Promise(resolve => {
      const request = db.transaction('files', 'readonly').objectStore('files').get(id);
      request.onsuccess = () => resolve(request.result?.blob ? URL.createObjectURL(request.result.blob) : '');
      request.onerror = () => resolve('');
    });
  },
  async delete(id) {
    const db = await this.open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
};

function mediaItems(pet) {
  const listed = Array.isArray(pet.media) ? pet.media.filter(item => item && (item.url || item.storageId)) : [];
  if (listed.length) return listed;
  const legacy = pet.image ? [{ id: 'cover', type: 'image', url: pet.image, isCover: true, caption: '封面照片' }] : [];
  if (pet.video) legacy.push({ id: 'legacy-video', type: 'video', url: pet.video, isCover: false, caption: '视频' });
  return legacy;
}
function coverMedia(pet) {
  return mediaItems(pet).find(item => item.isCover && item.type === 'image') || mediaItems(pet).find(item => item.type === 'image') || mediaItems(pet)[0] || { type: 'image', url: DEFAULT_PETS[0].image };
}
function mediaUrl(item) { return item?.url || ''; }
function isDirectVideo(item) {
  const url = mediaUrl(item);
  return Boolean(item?.storageId || url.startsWith('blob:') || /\.(mp4|webm|ogg)(?:$|[?#])/i.test(url));
}
function galleryStageMarkup(item, pet, index = 0) {
  const url = mediaUrl(item);
  if (!url) return `<div class="gallery-unavailable" role="status"><strong>这条影像暂时无法读取</strong><span>它可能只保存在上传时使用的浏览器中，请在原设备重新打开或重新上传。</span></div>`;
  if (item.type === 'video') {
    if (isDirectVideo(item)) return `<video class="gallery-stage-media" controls playsinline preload="metadata" src="${escapeHtml(url)}" aria-label="${escapeHtml(pet.name)}的视频 ${index + 1}"></video>`;
    return `<div class="gallery-external"><strong>这是一条外部视频</strong><span>视频号、抖音或哔哩哔哩页面不能直接嵌入播放器，请在新窗口打开。</span><a class="button button-light" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">打开外部视频</a></div>`;
  }
  return `<img class="gallery-stage-media" src="${escapeHtml(url)}" alt="${escapeHtml(pet.name)}的照片 ${index + 1}" />`;
}
async function hydrateLocalMedia() {
  for (const pet of pets) {
    for (const item of mediaItems(pet)) {
      if (item.storageId && !item.url) {
        try { item.url = await mediaDb.url(item.storageId); }
        catch (error) { item.url = ''; }
      }
    }
  }
}
async function hydrateLocalSettingsMedia() {
  if (settings.wechatQrStorageId && !settings.wechatQrUrl) {
    try { settings.wechatQrUrl = await mediaDb.url(settings.wechatQrStorageId); }
    catch { settings.wechatQrUrl = ''; }
  }
}
function cloudRows(result, label) {
  if (result?.error) throw new Error(result.error.message || `${label}失败`);
  return Array.isArray(result?.data) ? result.data : [];
}
async function cloudMediaUrl(item) {
  if (item.external_url && !item.external_url.startsWith('blob:')) return item.external_url;
  if (!item.storage_path || !cloudMediaBucket) return '';
  const result = await cloudMediaBucket.getPublicUrl(item.storage_path);
  return result?.data?.publicUrl || '';
}
async function activateLocalBackup() {
  pets = hasLocalPetDrafts ? localPetDrafts : DEFAULT_PETS;
  settings = { ...DEFAULT_SETTINGS, ...(hasLocalSettingsDraft ? localSettingsDraft : {}) };
  await hydrateLocalMedia();
  await hydrateLocalSettingsMedia();
  publicDataSource = 'local';
  renderAll();
}
async function loadCloudPublicData() {
  if (LOCAL_REVIEW) {
    cloudState = { ...cloudState, connected: false, checked: true, error: '' };
    await activateLocalBackup();
    renderAdminSyncNotice();
    return;
  }
  const config = window.YARD_CLOUD_CONFIG;
  if (!config?.env || !config?.accessKey || !window.cloudbase) {
    cloudState = { ...cloudState, checked: true, error: '云端组件未加载' };
    await activateLocalBackup();
    renderAdminSyncNotice();
    return;
  }
  try {
    cloudApp = window.cloudbase.init(config);
    cloudDb = cloudApp.rdb();
    cloudMediaBucket = cloudApp.storage.from('yard-media');
    const [petResult, mediaResult, updateResult, settingResult] = await Promise.all([
      cloudDb.from('pets').select('*').eq('is_published', true).order('updated_at', { ascending: false }).limit(200),
      cloudDb.from('pet_media').select('*').eq('is_public', true).order('sort_order', { ascending: true }).limit(1000),
      cloudDb.from('pet_updates').select('*').order('update_date', { ascending: false }).limit(1000),
      cloudDb.from('yard_settings').select('key,value').in('key', ['public_contact', 'application_policy']).limit(20)
    ]);
    const petRows = cloudRows(petResult, '读取云端宠物资料');
    const mediaRows = cloudRows(mediaResult, '读取云端影像资料');
    const updateRows = cloudRows(updateResult, '读取云端回访资料');
    const settingRows = cloudRows(settingResult, '读取云端网站设置');
    const resolvedMedia = await Promise.all(mediaRows.map(async item => ({
      id: item.id,
      type: item.media_type,
      url: await cloudMediaUrl(item),
      cloudPath: item.storage_path || '',
      isCover: Boolean(item.is_cover),
      caption: item.caption || '',
      altText: item.alt_text || '',
      sortOrder: Number(item.sort_order || 0)
    })));
    const cloudPets = petRows.map(pet => {
      const media = resolvedMedia.filter(item => item.url && !item.url.startsWith('blob:') && mediaRows.find(row => row.id === item.id)?.pet_id === pet.id)
        .sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.sortOrder - b.sortOrder);
      const cover = media.find(item => item.isCover && item.type === 'image') || media.find(item => item.type === 'image') || media[0];
      return {
        id: pet.id,
        name: pet.name,
        type: pet.pet_type,
        status: pet.adoption_status,
        age: pet.age_text,
        gender: pet.gender,
        image: cover?.url || DEFAULT_PETS[0].image,
        video: media.find(item => item.type === 'video')?.url || '',
        media,
        tags: Array.isArray(pet.tags) ? pet.tags : [],
        description: pet.description || '',
        health: pet.health || '',
        requirements: pet.requirements || '',
        reason: pet.pause_reason || '',
        updates: updateRows.filter(item => item.pet_id === pet.id).map(item => ({ date: item.title || item.update_date, text: item.body || '' }))
      };
    });
    const cloudSettings = Object.fromEntries(settingRows.map(item => [item.key, item.value]));
    pets = cloudPets;
    settings = { ...DEFAULT_SETTINGS, ...(cloudSettings.public_contact || {}) };
    publicDataSource = 'cloud';
    cloudState = { connected: true, checked: true, hasLocalBackup: hasLocalPetDrafts || hasLocalSettingsDraft, error: '' };
    renderAll();
    renderAdminSyncNotice();
  } catch (error) {
    cloudState = { ...cloudState, connected: false, checked: true, error: error.message || '连接失败' };
    await activateLocalBackup();
    renderAdminSyncNotice();
    console.error('CloudBase public data unavailable:', error);
  }
}
function renderAdminSyncNotice() {
  const notice = $('.admin-notice');
  if (!notice) return;
  const title = $('strong', notice);
  const copy = $('span', notice);
  if (!title || !copy) return;
  if (LOCAL_REVIEW) {
    title.textContent = '本地审核';
    copy.textContent = '当前只显示本机示例和草稿。编辑仅保存在这台浏览器，不连接云端，也不会同步到线上网站。';
    return;
  }
  if (!cloudState.checked) {
    title.textContent = '正在连接';
    copy.textContent = '正在读取 CloudBase 云端公开资料。网站会优先显示最新云端档案。';
    return;
  }
  if (cloudState.connected && cloudState.hasLocalBackup) {
    title.textContent = '云端优先';
    copy.textContent = '当前显示 CloudBase 云端资料。此浏览器仍保留旧本地草稿，仅在云端不可用时才作为备份显示。';
    return;
  }
  if (cloudState.connected) {
    title.textContent = '云端已连接';
    copy.textContent = '当前公开资料来自 CloudBase 云端。';
    return;
  }
  title.textContent = '离线备份';
  copy.textContent = `暂时无法读取云端资料，当前显示本浏览器的备份内容。${cloudState.error ? `原因：${cloudState.error}` : ''}`;
}
function galleryMarkup(pet) {
  const media = mediaItems(pet);
  const initial = coverMedia(pet);
  const initialIndex = Math.max(0, media.indexOf(initial));
  const stage = galleryStageMarkup(initial, pet, initialIndex);
  const thumbs = media.map((item, index) => {
    const url = mediaUrl(item);
    const label = item.type === 'video' ? (isDirectVideo(item) ? '视频' : '外部视频') : '照片';
    const preview = item.type === 'video'
      ? `<span class="video-thumb">${label}</span>`
      : url ? `<img src="${escapeHtml(url)}" alt="" />` : `<span class="video-thumb media-missing">不可用</span>`;
    return `<button class="gallery-thumb ${item === initial ? 'active' : ''}" type="button" data-gallery-pet="${escapeHtml(pet.id)}" data-gallery-index="${index}" aria-label="查看${escapeHtml(pet.name)}的${label} ${index + 1}" aria-pressed="${item === initial}">${preview}</button>`;
  }).join('');
  return `<div class="pet-gallery" data-gallery-root="${escapeHtml(pet.id)}"><div class="gallery-stage" data-gallery-stage>${stage}</div>${media.length > 1 ? `<div class="gallery-thumbs" aria-label="${escapeHtml(pet.name)}的影像列表">${thumbs}</div>` : ''}</div>`;
}
function switchGallery(petId, index) {
  const pet = petById(petId);
  if (!pet) return;
  const media = mediaItems(pet);
  const item = media[index];
  const root = document.querySelector(`[data-gallery-root="${CSS.escape(petId)}"]`);
  if (!item || !root) return;
  const stage = $('[data-gallery-stage]', root);
  stage.innerHTML = galleryStageMarkup(item, pet, index);
  $$('[data-gallery-index]', root).forEach(button => {
    const isActive = Number(button.dataset.galleryIndex) === index;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}
const savePets = () => store.set('cd-yard-pets', pets.map(pet => ({ ...pet, image: pet.image?.startsWith('blob:') ? '' : pet.image, media: (pet.media || []).map(item => item.storageId ? ({ ...item, url: '' }) : item) })));async function savePetTextToCloud(pet) {
  if (!cloudState.connected || !cloudDb || !adminAuthUser) return false;
  const result = await cloudDb.from('pets').upsert({
    id: pet.id,
    name: pet.name,
    pet_type: pet.type,
    adoption_status: pet.status,
    gender: pet.gender,
    age_text: pet.age,
    tags: Array.isArray(pet.tags) ? pet.tags : [],
    description: pet.description,
    health: pet.health,
    requirements: pet.requirements,
    pause_reason: pet.reason || null,
    is_published: true,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' });
  if (result?.error) throw new Error(result.error.message || '云端宠物资料保存失败。');
  return true;
}
const saveApplications = () => store.set('cd-yard-applications', applications);
const saveSettings = () => store.set('cd-yard-settings', {
  ...settings,
  wechatQrUrl: settings.wechatQrStorageId ? '' : settings.wechatQrUrl
});
const adminApplications = () => Array.isArray(cloudApplications) ? cloudApplications : applications;
function formatApplicationDate(value) {
  if (!value) return '提交时间未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(date);
}
function applicationStatusOptions(selected) {
  return APPLICATION_STATUSES.map(status => `<option value="${escapeHtml(status)}" ${status === selected ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('');
}

function statusClass(status) {
  return status === '待领养' ? 'waiting' : status === '已领养' ? 'adopted' : 'pause';
}
function statusAction(status) {
  if (status === '待领养') return '申请领养';
  if (status === '暂不适合领养') return '预约关注';
  return '查看生活档案';
}
function statusDescription(status) {
  if (status === '待领养') return '正在等待合适的家庭';
  if (status === '暂不适合领养') return '现在不开放正式领养，但可以提前预约关注';
  return '已经找到温暖的家，档案会持续更新';
}

function featureStatusLabel(pet) {
  if (pet.status === '待领养') return '正在等家';
  if (pet.status === '暂不适合领养') return '等待开放';
  return '已找到家';
}
function featureActionLabel(pet) {
  if (pet.status === '待领养') return `认识${pet.name}`;
  if (pet.status === '暂不适合领养') return `了解${pet.name}`;
  return `查看${pet.name}的生活档案`;
}
function rotatingPet(candidates, index) {
  return candidates.length ? candidates[index % candidates.length] : null;
}
function renderFeaturedLoadingState() {
  const heroImage = $('#heroFeatureImage');
  const heroStamp = $('#heroFeatureStamp');
  const heroStatus = $('#heroFeatureStatus');
  const heroName = $('#heroFeatureName');
  const heroDescription = $('#heroFeatureDescription');
  const heroButton = $('#heroFeatureButton');
  const storyImage = $('#storyFeatureImage');
  const storyLabel = $('#storyFeatureLabel');
  const storyHeading = $('#storyFeatureHeading');
  const storyDescription = $('#storyFeatureDescription');
  const storyButton = $('#storyFeatureButton');
  if (heroImage) { heroImage.src = 'assets/brand/companions.png'; heroImage.alt = '正在读取最新宠物档案'; }
  if (heroStamp) heroStamp.textContent = '正在读取';
  if (heroStatus) heroStatus.textContent = '正在读取';
  if (heroName) heroName.textContent = '正在读取最新档案';
  if (heroDescription) heroDescription.textContent = '正在从小院云端更新宠物资料和影像。';
  if (heroButton) heroButton.hidden = true;
  if (storyImage) { storyImage.src = 'assets/brand/companions.png'; storyImage.alt = '正在读取已领养生活档案'; }
  if (storyLabel) storyLabel.textContent = '回访档案 · 正在读取';
  if (storyHeading) storyHeading.innerHTML = '正在读取新的生活档案。';
  if (storyDescription) storyDescription.textContent = '云端资料加载完成后，会在这里显示最新回访。';
  if (storyButton) storyButton.hidden = true;
}
function updateFeaturedPetCards() {
  const heroCandidates = pets.filter(pet => pet.status === '待领养' || pet.status === '暂不适合领养');
  const heroPet = rotatingPet(heroCandidates.length ? heroCandidates : pets, featuredPetIndexes.hero);
  if (heroPet) {
    const image = $('#heroFeatureImage');
    const stamp = $('#heroFeatureStamp');
    const status = $('#heroFeatureStatus');
    const name = $('#heroFeatureName');
    const description = $('#heroFeatureDescription');
    const button = $('#heroFeatureButton');
    const cover = mediaUrl(coverMedia(heroPet));
    if (image) { image.src = cover; image.alt = `${heroPet.name}，${heroPet.type}照片`; }
    if (stamp) stamp.textContent = featureStatusLabel(heroPet);
    if (status) status.textContent = featureStatusLabel(heroPet);
    if (name) name.textContent = `${heroPet.name} · ${heroPet.age}`;
    if (description) description.textContent = heroPet.description || statusDescription(heroPet.status);
    if (button) {
      button.hidden = false;
      button.dataset.openPet = heroPet.id;
      button.setAttribute('aria-label', featureActionLabel(heroPet));
      button.innerHTML = `${escapeHtml(featureActionLabel(heroPet))} <span aria-hidden="true">↗</span>`;
    }
  }

  const storyPet = rotatingPet(pets.filter(pet => pet.status === '已领养'), featuredPetIndexes.story);
  const storyImage = $('#storyFeatureImage');
  const storyLabel = $('#storyFeatureLabel');
  const storyHeading = $('#storyFeatureHeading');
  const storyDescription = $('#storyFeatureDescription');
  const storyButton = $('#storyFeatureButton');
  if (!storyPet) {
    if (storyLabel) storyLabel.textContent = '回访档案 · 等待更新';
    if (storyHeading) storyHeading.innerHTML = '新的生活档案，<br />会在这里继续。';
    if (storyDescription) storyDescription.textContent = '当小院里的伙伴找到新家，照片、视频和回访片段会持续补充在这里。';
    if (storyButton) storyButton.hidden = true;
    return;
  }
  const cover = mediaUrl(coverMedia(storyPet));
  const latestUpdate = storyPet.updates?.[0];
  if (storyImage) { storyImage.src = cover; storyImage.alt = `${storyPet.name}，已领养生活档案照片`; }
  if (storyLabel) storyLabel.textContent = '已领养档案 · 持续更新';
  if (storyHeading) storyHeading.innerHTML = `${escapeHtml(storyPet.name)}的生活档案，<br />仍在继续。`;
  if (storyDescription) {
    storyDescription.textContent = latestUpdate
      ? `最近回访：${latestUpdate.date}，${latestUpdate.text}`
      : (storyPet.description || '新的生活照片、视频和回访片段，会慢慢补进来。');
  }
  if (storyButton) {
    storyButton.hidden = false;
    storyButton.dataset.openPet = storyPet.id;
    storyButton.setAttribute('aria-label', `查看${storyPet.name}的生活档案`);
    storyButton.innerHTML = `查看${escapeHtml(storyPet.name)}的生活档案 <span aria-hidden="true">→</span>`;
  }
}
function renderFeaturedPetCards(animate = false) {
  if (publicDataSource === 'loading') {
    renderFeaturedLoadingState();
    return;
  }
  const heroRoot = $('.hero-feature');
  const storyRoot = $('.story-grid');
  const update = () => {
    featuredSwapTimer = null;
    updateFeaturedPetCards();
    [heroRoot, storyRoot].forEach(root => root?.classList.remove('is-rotating'));
  };
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!animate || reduceMotion || (!heroRoot && !storyRoot)) {
    update();
    return;
  }
  if (featuredSwapTimer) window.clearTimeout(featuredSwapTimer);
  [heroRoot, storyRoot].forEach(root => root?.classList.add('is-rotating'));
  featuredSwapTimer = window.setTimeout(() => {
    update();
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      [heroRoot, storyRoot].forEach(root => root?.classList.remove('is-rotating'));
    }));
  }, 240);
}
function startFeaturedPetRotation() {
  if (featuredPetTimer) window.clearInterval(featuredPetTimer);
  if (!$('.hero-feature') && !$('.story-grid')) return;
  featuredPetTimer = window.setInterval(() => {
    featuredPetIndexes = {
      hero: featuredPetIndexes.hero + 1,
      story: featuredPetIndexes.story + 1
    };
    renderFeaturedPetCards(true);
  }, 8000);
}

function renderStats() {
  const stats = $('#stats');
  if (!stats) return;
  if (publicDataSource === 'loading') {
    stats.innerHTML = '<div class="stat stat-loading" role="status"><strong>正在读取最新档案</strong><span>请稍候，正在连接小院云端。</span></div>';
    return;
  }
  const waiting = pets.filter(pet => pet.status === '待领养').length;
  const adopted = pets.filter(pet => pet.status === '已领养').length;
  const appointments = applications.filter(app => app.kind === '预约申请').length;
  stats.innerHTML = `
    <div class="stat"><strong>${waiting}</strong><span>正在等待合适的家</span></div>
    <div class="stat"><strong>${adopted}</strong><span>已领养生活档案</span></div>
    <div class="stat"><strong>${appointments}</strong><span>预约关注记录</span></div>`;
}

function renderContact() {
  const contact = $('#contactList');
  if (!contact) return;
  if (publicDataSource === 'loading') {
    contact.innerHTML = '<div><dt>最新联系方式</dt><dd>正在从云端读取…</dd></div>';
    return;
  }
  contact.innerHTML = `
    <div><dt>所在区域</dt><dd>${escapeHtml(settings.area)}</dd></div>
    <div><dt>咨询时间</dt><dd>${escapeHtml(settings.hours)}</dd></div>
    <div><dt>联系电话</dt><dd>${escapeHtml(settings.phone || '待管理员设置')}</dd></div>
    <div><dt>微信咨询</dt><dd>${escapeHtml(settings.wechat || '待管理员设置')}</dd></div>`;
}

function renderPets() {
  const grid = $('#petGrid');
  const empty = $('#emptyState');
  if (!grid || !empty) return;
  if (publicDataSource === 'loading') {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = '<div class="pet-loading" role="status"><strong>正在读取最新档案</strong><span>正在从小院云端更新宠物资料和影像。</span></div>';
    empty.classList.add('hidden');
    return;
  }
  const matchingPets = pets.filter(pet => {
    const statusMatches = pet.status === filters.status;
    const typeMatches = filters.type === '全部' || pet.type === filters.type;
    return statusMatches && typeMatches;
  });
  grid.setAttribute('aria-busy', 'false');
  grid.innerHTML = matchingPets.map(petCardMarkup).join('');
  empty.classList.toggle('hidden', matchingPets.length > 0);
}

function renderHomePets() {
  const grid = $('#homePetsGrid');
  const empty = $('#homePetsEmpty');
  if (!grid || !empty) return;
  if (publicDataSource === 'loading') {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = '<div class="pet-loading" role="status"><strong>正在读取最新档案</strong><span>小院的伙伴很快就会出现在这里。</span></div>';
    empty.classList.add('hidden');
    return;
  }
  const waitingPets = pets.filter(pet => pet.status === '待领养').slice(0, 3);
  grid.setAttribute('aria-busy', 'false');
  grid.innerHTML = waitingPets.map(petCardMarkup).join('');
  empty.classList.toggle('hidden', waitingPets.length > 0);
}

function petCardMarkup(pet) {
  return `
    <article class="pet-card">
      <button class="pet-card-image" data-open-pet="${escapeHtml(pet.id)}" aria-label="查看${escapeHtml(pet.name)}的详情">
        <img src="${escapeHtml(mediaUrl(coverMedia(pet)))}" alt="${escapeHtml(pet.name)}，${escapeHtml(pet.type)}照片" />
        <span class="status-pill ${statusClass(pet.status)}">${escapeHtml(pet.status)}</span>
      </button>
      <div class="pet-card-content">
        <div class="pet-card-top"><h3>${escapeHtml(pet.name)}</h3><span class="pet-card-meta">${escapeHtml(pet.type)} · ${escapeHtml(pet.gender)} · ${escapeHtml(pet.age)}</span></div>
        <p class="pet-card-description">${escapeHtml(pet.description)}</p>
        <div class="pet-tags">${pet.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
        <button class="card-action" data-open-pet="${escapeHtml(pet.id)}">${statusAction(pet.status)} <span aria-hidden="true">→</span></button>
      </div>
    </article>`;
}

function renderStories() {
  const grid = $('#storiesGrid');
  const empty = $('#storiesEmpty');
  if (!grid || !empty) return;
  if (publicDataSource === 'loading') {
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = '<div class="pet-loading" role="status"><strong>正在读取生活档案</strong><span>照片、影像和回访记录正在更新。</span></div>';
    empty.classList.add('hidden');
    return;
  }
  const adoptedPets = pets.filter(pet => pet.status === '已领养');
  grid.setAttribute('aria-busy', 'false');
  grid.innerHTML = adoptedPets.map(petCardMarkup).join('');
  empty.classList.toggle('hidden', adoptedPets.length > 0);
}

function openModal(content) {
  returnFocus = document.activeElement;
  const backdrop = $('#modalBackdrop');
  const modal = $('#modal');
  if (!backdrop || !modal) return;
  modal.innerHTML = content;
  backdrop.classList.remove('hidden');
  backdrop.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  setTimeout(() => $('.modal-close')?.focus(), 20);
}
function closeModal() {
  cropState = null;
  cropQueue = [];
  cropQueueIndex = 0;
  const backdrop = $('#modalBackdrop');
  backdrop?.classList.remove('crop-backdrop');
  backdrop?.classList.add('hidden');
  backdrop?.setAttribute('aria-hidden', 'true');
  const modal = $('#modal');
  if (modal) modal.innerHTML = '';
  document.body.classList.remove('modal-open');
  returnFocus?.focus?.();
}

function cropFileName(name) {
  return `${String(name || 'photo').replace(/\.[^.]+$/, '')}-裁切.jpg`;
}
function cropStageMetrics() {
  const stage = $('#cropStage');
  const frame = $('.crop-frame', stage);
  const canvas = $('#cropCanvas');
  if (!stage || !frame || !canvas || !cropState?.image) return null;
  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);
  const frameWidth = frame.offsetWidth;
  const frameHeight = frame.offsetHeight;
  const baseScale = Math.max(frameWidth / cropState.image.naturalWidth, frameHeight / cropState.image.naturalHeight);
  const scale = baseScale * cropState.zoom;
  const imageWidth = cropState.image.naturalWidth * scale;
  const imageHeight = cropState.image.naturalHeight * scale;
  const offsetXLimit = Math.max(0, (imageWidth - frameWidth) / 2);
  const offsetYLimit = Math.max(0, (imageHeight - frameHeight) / 2);
  cropState.offsetX = Math.max(-offsetXLimit, Math.min(offsetXLimit, cropState.offsetX));
  cropState.offsetY = Math.max(-offsetYLimit, Math.min(offsetYLimit, cropState.offsetY));
  return {
    width, height, frameWidth, frameHeight, scale,
    frameX: (width - frameWidth) / 2,
    frameY: (height - frameHeight) / 2,
    imageWidth, imageHeight,
    imageX: (width - imageWidth) / 2 + cropState.offsetX,
    imageY: (height - imageHeight) / 2 + cropState.offsetY
  };
}
function drawCropCanvas() {
  const canvas = $('#cropCanvas');
  if (!canvas || !cropState?.image) return;
  const metrics = cropStageMetrics();
  if (!metrics) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(metrics.width * ratio);
  canvas.height = Math.round(metrics.height * ratio);
  canvas.style.width = `${metrics.width}px`;
  canvas.style.height = `${metrics.height}px`;
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, metrics.width, metrics.height);
  context.fillStyle = '#e8dfcc';
  context.fillRect(0, 0, metrics.width, metrics.height);
  context.drawImage(cropState.image, metrics.imageX, metrics.imageY, metrics.imageWidth, metrics.imageHeight);
  cropState.metrics = metrics;
}
function bindCropInteractions() {
  const stage = $('#cropStage');
  if (!stage) return;
  stage.addEventListener('pointerdown', event => {
    if (!cropState) return;
    cropState.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: cropState.offsetX, offsetY: cropState.offsetY };
    stage.setPointerCapture?.(event.pointerId);
    stage.classList.add('is-dragging');
  });
  stage.addEventListener('pointermove', event => {
    if (!cropState?.drag || cropState.drag.pointerId !== event.pointerId) return;
    cropState.offsetX = cropState.drag.offsetX + event.clientX - cropState.drag.x;
    cropState.offsetY = cropState.drag.offsetY + event.clientY - cropState.drag.y;
    drawCropCanvas();
  });
  const stopDragging = event => {
    if (!cropState?.drag || cropState.drag.pointerId !== event.pointerId) return;
    cropState.drag = null;
    stage.classList.remove('is-dragging');
    stage.releasePointerCapture?.(event.pointerId);
  };
  stage.addEventListener('pointerup', stopDragging);
  stage.addEventListener('pointercancel', stopDragging);
}
function photoCropMarkup(item) {
  return `<div class="form-modal crop-modal">
    <div class="form-modal-header"><div><h2 id="modalTitle">裁切照片</h2><p>拖动照片调整取景，再用滑块调整大小。</p></div><button class="modal-close" type="button" data-crop-cancel aria-label="取消裁切"><svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
    <div class="crop-stage" id="cropStage"><canvas id="cropCanvas"></canvas><div class="crop-frame" aria-hidden="true"></div></div>
    <div class="crop-controls">
      <label for="cropZoom">放大照片</label>
      <input id="cropZoom" type="range" min="1" max="3" step="0.01" value="1" />
      <span class="form-hint">正在处理第 ${cropQueueIndex + 1} 张，共 ${cropQueue.length} 张：${escapeHtml(item.file.name)}</span>
    </div>
    <div class="modal-actions"><button class="button button-ghost" type="button" data-crop-cancel>取消这次选择</button><button class="button button-primary" type="button" data-crop-apply>使用这次裁切</button></div>
  </div>`;
}
function openNextPhotoCrop() {
  const item = cropQueue[cropQueueIndex];
  if (!item) return;
  const reader = new FileReader();
  reader.onerror = () => { closeModal(); toast('照片读取失败，请重新选择图片'); };
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => { closeModal(); toast('照片无法读取，请换一张图片'); };
    image.onload = () => {
      cropState = { image, file: item.file, target: item.target, zoom: 1, offsetX: 0, offsetY: 0, drag: null, metrics: null };
      openModal(photoCropMarkup(item));
      $('#modalBackdrop').classList.add('crop-backdrop');
      requestAnimationFrame(() => {
        drawCropCanvas();
        bindCropInteractions();
        $('#cropZoom')?.addEventListener('input', event => {
          if (!cropState) return;
          cropState.zoom = Number(event.target.value) || 1;
          drawCropCanvas();
        });
        $('[data-crop-apply]')?.addEventListener('click', applyPhotoCrop);
        $$('[data-crop-cancel]').forEach(button => button.addEventListener('click', cancelPhotoCrop));
      });
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(item.file);
}
function cancelPhotoCrop() {
  const target = cropQueue[0]?.target;
  cropQueue = [];
  cropQueueIndex = 0;
  cropState = null;
  if (target === 'cover') pendingCoverFile = null;
  if (target === 'gallery') pendingGalleryFiles = [];
  closeModal();
  toast('已取消这次照片选择');
}
function resetPendingPhotoSelection() {
  pendingCoverFile = null;
  pendingGalleryFiles = [];
  cropQueue = [];
  cropQueueIndex = 0;
  cropState = null;
}
function startPhotoCrop(files, target) {
  const usable = files.filter(file => /^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= 8 * 1024 * 1024);
  if (!usable.length) {
    toast('请选择 JPG、PNG 或 WebP 图片，且每张不超过 8 MB');
    return;
  }
  if (target === 'cover') pendingCoverFile = null;
  if (target === 'gallery') pendingGalleryFiles = [];
  cropQueue = (target === 'cover' ? usable.slice(0, 1) : usable).map(file => ({ file, target }));
  cropQueueIndex = 0;
  openNextPhotoCrop();
}
function applyPhotoCrop() {
  if (!cropState?.image || !cropState.metrics) return;
  const { metrics, image, file, target } = cropState;
  const sourceX = Math.max(0, (metrics.frameX - metrics.imageX) / metrics.scale);
  const sourceY = Math.max(0, (metrics.frameY - metrics.imageY) / metrics.scale);
  const sourceWidth = Math.min(image.naturalWidth - sourceX, metrics.frameWidth / metrics.scale);
  const sourceHeight = Math.min(image.naturalHeight - sourceY, metrics.frameHeight / metrics.scale);
  const outputWidth = 1200;
  const outputHeight = Math.round(outputWidth * metrics.frameHeight / metrics.frameWidth);
  const output = document.createElement('canvas');
  output.width = outputWidth;
  output.height = outputHeight;
  const context = output.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
  output.toBlob(blob => {
    if (!blob) { toast('裁切失败，请重新选择照片'); return; }
    const cropped = new File([blob], cropFileName(file.name), { type: 'image/jpeg', lastModified: Date.now() });
    if (target === 'cover') pendingCoverFile = cropped;
    else pendingGalleryFiles.push(cropped);
    cropQueueIndex += 1;
    cropState = null;
    if (cropQueueIndex < cropQueue.length) {
      openNextPhotoCrop();
      return;
    }
    const count = cropQueue.length;
    const finishedTarget = cropQueue[0]?.target;
    cropQueue = [];
    cropQueueIndex = 0;
    closeModal();
    toast(finishedTarget === 'cover' ? '封面照片已完成裁切' : `${count} 张生活照片已完成裁切`);
  }, 'image/jpeg', 0.9);
}

function openPetDetail(id) {
  const pet = petById(id);
  if (!pet) return;
  const updates = pet.updates?.length ? `<ul class="archive-updates">${pet.updates.map(update => `<li><strong>${escapeHtml(update.date)}</strong> · ${escapeHtml(update.text)}</li>`).join('')}</ul>` : '';
  const extra = pet.status === '暂不适合领养' ? `<div class="detail-block"><h3>当前说明</h3><p>${escapeHtml(pet.reason || statusDescription(pet.status))}</p></div>` : '';
  const archive = pet.status === '已领养' ? `<div class="detail-block"><h3>回访更新</h3>${updates || '<p>新的生活照片和回访记录会持续补充。</p>'}</div>` : '';
  const action = pet.status === '待领养'
    ? `<button class="button button-primary" data-apply-pet="${pet.id}" data-application-kind="正式领养申请">申请领养</button>`
    : pet.status === '暂不适合领养'
      ? `<button class="button button-primary" data-apply-pet="${pet.id}" data-application-kind="预约申请">预约领养</button>`
      : `<button class="button button-primary" data-scroll-updates>查看回访记录</button>`;
  openModal(`
    <div class="modal-detail modal-detail-media">
      <div class="modal-image">${galleryMarkup(pet)}<span class="status-pill ${statusClass(pet.status)}">${escapeHtml(pet.status)}</span></div>
      <div class="modal-main">
        <button class="modal-close" data-close-modal aria-label="关闭详情"><svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        <p class="modal-overline">${escapeHtml(statusDescription(pet.status))} · ${mediaItems(pet).length} 个影像记录</p>
        <h2 id="modalTitle">${escapeHtml(pet.name)}</h2>
        <p class="modal-description">${escapeHtml(pet.description)}</p>
        <dl class="fact-list"><div><dt>种类</dt><dd>${escapeHtml(pet.type)}</dd></div><div><dt>性别 / 年龄</dt><dd>${escapeHtml(pet.gender)} · ${escapeHtml(pet.age)}</dd></div><div><dt>所在地区</dt><dd>成都 · 猫狗小院</dd></div><div><dt>当前状态</dt><dd>${escapeHtml(pet.status)}</dd></div></dl>
        <div class="detail-block"><h3>健康情况</h3><p>${escapeHtml(pet.health)}</p></div>
        <div class="detail-block"><h3>${pet.status === '已领养' ? '领养后的故事' : '领养要求'}</h3><p>${escapeHtml(pet.requirements)}</p></div>
        ${extra}${archive}
        <div class="modal-actions">${action}<button class="button button-ghost" data-contact-open>咨询管理员</button></div>
      </div>
    </div>`);
}
function openApplicationForm(id, kind) {
  const pet = petById(id);
  if (!pet) return;
  const isAppointment = kind === '预约申请';
  openModal(`
    <div class="form-modal">
      <div class="form-modal-header">
        <div><h2 id="modalTitle">${isAppointment ? '预约关注' : '申请领养'} · ${escapeHtml(pet.name)}</h2><p>${isAppointment ? '${escapeHtml(pet.name)}暂不开放正式领养。留下信息后，小院在开放时会优先与你联系。' : '提交申请不代表立刻领养成功。我们会认真阅读，并在合适时和你沟通。'}</p></div>
        <button class="modal-close" data-close-modal aria-label="关闭表单"><svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
      <form id="applicationForm" data-pet-id="${pet.id}" data-kind="${kind}" data-started-at="${Date.now()}">
        <div class="application-honeypot" aria-hidden="true">
          <label for="appWebsite">网站</label>
          <input id="appWebsite" name="website" type="text" tabindex="-1" autocomplete="off" />
        </div>
        <div class="form-grid">
          <div class="field"><label for="appName">姓名</label><input id="appName" name="name" required autocomplete="name" /></div>
          <div class="field"><label for="appAge">年龄</label><input id="appAge" name="age" inputmode="numeric" required /></div>
          <div class="field"><label for="appGender">性别</label><select id="appGender" name="gender" required><option value="">请选择</option><option>女</option><option>男</option><option>不方便说明</option></select></div>
          <div class="field"><label for="appContact">联系方式</label><input id="appContact" name="contact" required placeholder="微信或手机号码" /></div>
          <div class="field"><label for="appHome">是否在成都及周边有住所</label><select id="appHome" name="home" required><option value="">请选择</option><option>是</option><option>否</option></select></div>
          <div class="field"><label for="appExperience">是否有养宠经验</label><select id="appExperience" name="experience" required><option value="">请选择</option><option>有</option><option>没有</option><option>正在了解</option></select></div>
          <div class="field"><label for="appFamily">家庭成员是否同意</label><select id="appFamily" name="family" required><option value="">请选择</option><option>全部同意</option><option>部分同意</option><option>尚未沟通</option></select></div>
          <div class="field"><label for="appOtherPets">是否有其他宠物</label><select id="appOtherPets" name="otherPets" required><option value="">请选择</option><option>没有</option><option>有猫</option><option>有狗</option><option>有其他宠物</option></select></div>
          <div class="field full"><label for="appNote">补充说明（可选）</label><textarea id="appNote" name="note" placeholder="如果有想让管理员提前了解的情况，可以写在这里。"></textarea></div>
        </div>
        <p class="form-hint">这些资料仅供成都猫狗小院管理员沟通领养或预约使用，不会在网站公开。</p>
        <button class="button button-primary form-submit" type="submit">提交${isAppointment ? '预约' : '申请'}</button>
      </form>
    </div>`);
}

function openContactModal() {
  if (publicDataSource === 'loading') {
    toast('正在读取最新联系方式，请稍候。');
    return;
  }
  const qr = settings.wechatQrUrl
    ? `<div class="contact-qr"><img src="${escapeHtml(settings.wechatQrUrl)}" alt="成都猫狗小院微信二维码" /><p>可保存或使用微信扫一扫识别二维码。</p></div>`
    : '<p class="contact-qr-empty">管理员暂未上传微信二维码，可先通过电话或微信号咨询。</p>';
  openModal(`
    <div class="form-modal">
      <div class="form-modal-header"><div><h2 id="modalTitle">联系成都猫狗小院</h2><p>联系方式可以在管理员后台随时修改。</p></div><button class="modal-close" data-close-modal aria-label="关闭"><svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
      <dl class="contact-modal-list">
        <div><dt>所在区域</dt><dd>${escapeHtml(settings.area)}</dd></div>
        <div><dt>咨询时间</dt><dd>${escapeHtml(settings.hours)}</dd></div>
        <div><dt>电话</dt><dd>${escapeHtml(settings.phone || '待管理员设置')}</dd></div>
        <div><dt>微信</dt><dd>${escapeHtml(settings.wechat || '待管理员设置')}</dd></div>
      </dl>
      ${qr}
    </div>`);
}

function toast(message) {
  const toastElement = $('#toast');
  if (!toastElement) return;
  toastElement.textContent = message;
  toastElement.classList.remove('hidden');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toastElement.classList.add('hidden'), 3200);
}

function openAdminLogin(message = '') {
  if (LOCAL_REVIEW) { openAdmin(); return; }
  openModal(`
    <div class="form-modal admin-login-modal">
      <div class="form-modal-header"><div><h2 id="modalTitle">管理员登录</h2><p>请输入 CloudBase 用户名和密码。密码只在当前浏览器中使用，不会发送到聊天。</p></div><button class="modal-close" data-close-modal aria-label="关闭登录"><svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
      ${message ? `<p class="admin-login-error" role="alert">${escapeHtml(message)}</p>` : ''}
      <form id="adminLoginForm"><div class="field"><label for="adminUsername">用户名</label><input id="adminUsername" name="username" autocomplete="username" required /></div><div class="field"><label for="adminPassword">密码</label><input id="adminPassword" name="password" type="password" autocomplete="current-password" required /></div><p class="form-hint">请使用小院管理员账号登录。若忘记密码，请在 CloudBase 身份认证中重置。</p><button class="button button-primary form-submit" type="submit">登录管理员后台</button></form>
    </div>`);
}
async function getAdminUser() {
  if (!cloudApp) return null;
  const result = await cloudApp.auth().getSession();
  return result?.data?.user || null;
}
async function ensureAdminAccess() {
  adminAccessGranted = false;
  if (LOCAL_REVIEW) { adminAccessGranted = true; return true; }
  if (!cloudState.connected || !cloudApp || !cloudDb) {
    renderAdminAccessGate('管理员登录暂时不可用，请等待云端连接恢复后重试。');
    return false;
  }
  const user = await getAdminUser();
  if (!user) { openAdminLogin(); return false; }
  const authUid = user.id || user.uid || user.user_id || '';
  const adminRows = cloudRows(await cloudDb.from('yard_administrators').select('auth_uid,display_name').eq('auth_uid', authUid).limit(1), '检查管理员权限');
  if (!adminRows.length) { await cloudApp.auth().signOut(); openAdminLogin('当前账号还没有被登记为小院管理员。'); return false; }
  adminAuthUser = { ...user, uid: authUid, ...adminRows[0] };
  adminAccessGranted = true;
  return true;
}
async function loadCloudAdminData() {
  if (!adminAuthUser || !cloudDb) return;
  try {
    const result = await cloudDb.from('applications').select('*').order('submitted_at', { ascending: false }).limit(200);
    cloudApplications = cloudRows(result, '读取云端申请记录').map(item => ({ ...item, name: item.applicant_name, age: item.applicant_age, gender: item.applicant_gender, petId: item.pet_id, petName: petById(item.pet_id)?.name || '', kind: item.application_type, status: item.internal_status, contact: item.contact, home: item.has_chengdu_home ? '是' : '否', experience: item.experience, family: item.family_agreement, otherPets: item.other_pets, note: item.note, internalNote: item.internal_note || '', createdAt: item.submitted_at, aiSummary: item.ai_summary || null, aiSummaryAt: item.ai_summary_at || '', aiSummaryStale: Boolean(item.ai_summary) && String(item.ai_summary_source_updated_at || '') !== String(item.updated_at || '') }));
  } catch (error) { cloudApplications = null; toast(error.message || '云端申请记录读取失败'); }
}
/**
 * 读取只有管理员能看的私密设置：企业微信机器人地址、AI 模型 API Key。
 * 这些 key 不在公开只读策略里，匿名访客读不到，只能在登录后单独拉取。
 */
async function loadAdminPrivateSettings() {
  cloudWecomWebhook = '';
  cloudWecomWebhookLoaded = false;
  cloudWecomStatus = null;
  cloudAiKey = { loaded: false, configured: false, hint: '' };
  cloudTokenhubKey = { loaded: false, configured: false, hint: '' };
  if (!adminAuthUser || !cloudDb) return;
  try {
    const result = await cloudDb.from('yard_settings').select('key,value').in('key', ['wecom_webhook', 'ai_config']).limit(5);
    const list = cloudRows(result, '读取管理员私密设置');

    const wecom = list.find(item => item.key === 'wecom_webhook')?.value || {};
    cloudWecomWebhook = String(wecom.url || '');
    if (typeof wecom.lastOk === 'boolean') {
      cloudWecomStatus = { ok: wecom.lastOk, reason: String(wecom.lastReason || ''), at: String(wecom.lastAt || '') };
    }
    cloudWecomWebhookLoaded = true;

    const aiConfig = list.find(item => item.key === 'ai_config')?.value || {};
    const apiKey = String(aiConfig.apiKey || '');
    cloudAiKey = { loaded: true, configured: Boolean(apiKey), hint: maskKey(apiKey) };
    const tokenhubKey = String(aiConfig.tokenhubApiKey || '');
    cloudTokenhubKey = { loaded: true, configured: Boolean(tokenhubKey), hint: maskKey(tokenhubKey) };
  } catch (error) {
    toast(error.message || '管理员设置读取失败');
  }
}
/** 把最近一次企业微信提醒的结果渲染成一行提示，方便管理员自查。 */
function wecomStatusHint() {
  if (!cloudWecomStatus) return '';
  const at = cloudWecomStatus.at ? new Date(cloudWecomStatus.at) : null;
  const atText = at && !Number.isNaN(at.getTime())
    ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at)
    : '';
  const when = atText ? `（${escapeHtml(atText)}）` : '';
  return cloudWecomStatus.ok
    ? `<span class="form-hint wecom-status is-ok">最近一次提醒：发送成功${when}</span>`
    : `<span class="form-hint wecom-status is-error">最近一次提醒：发送失败${when}${cloudWecomStatus.reason ? ` 原因：${escapeHtml(cloudWecomStatus.reason)}` : ''}</span>`;
}
async function openAdmin() {
  const backdrop = $('#adminBackdrop');
  if (!backdrop) { window.location.assign('admin.html'); return; }
  returnFocus = document.activeElement;
  renderAdminAccessGate();
  try {
    if (!(await ensureAdminAccess())) return;
    backdrop.classList.remove('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    if (SITE_PAGE !== 'admin') document.body.classList.add('modal-open');
    await loadCloudAdminData();
    await loadAdminPrivateSettings();
    renderAdmin();
  } catch (error) {
    adminAccessGranted = false;
    renderAdminAccessGate(error.message || '暂时无法验证管理员身份，请稍后重试。');
  }
}
function closeAdmin() {
  if (SITE_PAGE === 'admin') return;
  $('#adminBackdrop')?.classList.add('hidden');
  $('#adminBackdrop')?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  returnFocus?.focus?.();
}

function adminPageHead(title, copy, action = '') {
  return `<div class="admin-page-head"><div><h3>${title}</h3><p>${copy}</p></div>${action}</div>`;
}
function renderAdminAccessGate(message = '') {
  const content = $('#adminContent');
  if (!content) return;
  const checking = !cloudState.checked && !LOCAL_REVIEW;
  content.innerHTML = `${adminPageHead(checking ? '正在验证管理员入口' : '登录管理员工作台', '宠物编辑、申请记录和网站设置仅向管理员开放。')}
    ${message ? `<p class="admin-login-error" role="alert">${escapeHtml(message)}</p>` : ''}
    ${checking ? '<p class="form-hint" role="status">正在连接小院服务，请稍候。</p>' : '<button class="button button-primary" type="button" data-admin-login>管理员登录</button>'}`;
  renderAdminSyncNotice();
}
function renderAdmin() {
  const content = $('#adminContent');
  if (!content) return;
  const art = $('#adminTabArt');
  if (art) {
    const artwork = {
      overview: 'assets/brand/admin-play-and-stretch.png',
      pets: 'assets/brand/admin-cushion-peek.png',
      applications: 'assets/brand/admin-walk-together.png',
      settings: 'assets/brand/admin-settings-companions.png'
    };
    art.src = artwork[adminTab];
  }
  if (!adminAccessGranted) { renderAdminAccessGate(); return; }
  $$('.admin-nav-button').forEach(button => {
    const active = button.dataset.adminTab === adminTab;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (adminTab === 'overview') content.innerHTML = renderAdminOverview();
  if (adminTab === 'pets') content.innerHTML = renderAdminPets();
  if (adminTab === 'applications') content.innerHTML = renderAdminApplications();
  if (adminTab === 'settings') content.innerHTML = renderAdminSettings();
  bindAdminEvents();
  renderAdminSyncNotice();
}
function renderAdminOverview() {
  const waiting = pets.filter(pet => pet.status === '待领养').length;
  const adopted = pets.filter(pet => pet.status === '已领养').length;
  const paused = pets.filter(pet => pet.status === '暂不适合领养').length;
  const inbox = adminApplications();
  const openApps = inbox.filter(app => app.status === '未处理').length;
  const recent = inbox.slice(0, 4);
  return `${adminPageHead('今天的小院', '管理员拥有相同的编辑与查看权限。')}
    <div class="dashboard-stats">
      <div class="dashboard-stat"><strong>${waiting}</strong><span>待领养</span></div>
      <div class="dashboard-stat"><strong>${adopted}</strong><span>已领养档案</span></div>
      <div class="dashboard-stat"><strong>${paused}</strong><span>暂不适合领养</span></div>
      <div class="dashboard-stat"><strong>${openApps}</strong><span>待处理申请</span></div>
    </div>
    <div class="admin-block"><h4>最近提交的申请</h4>${recent.length ? `<div class="mini-list">${recent.map(app => `<div class="mini-list-row"><img src="${escapeHtml(mediaUrl(coverMedia(petById(app.petId) || DEFAULT_PETS[0])))}" alt="" /><div><strong>${escapeHtml(app.name)} · ${escapeHtml(app.kind)}</strong><p>${escapeHtml(app.petName)} · ${escapeHtml(app.contact)}</p></div><span>${escapeHtml(app.status)}</span></div>`).join('')}</div><button class="admin-edit application-inbox-link" type="button" data-open-applications>查看并处理全部申请</button>` : '<div class="admin-empty">还没有申请记录。访客提交的领养或预约申请会显示在这里。</div>'}</div>`;
}
function renderAdminPets() {
  const editPet = adminEditing === 'new' ? { id: '', name: '', type: '猫咪', status: '待领养', age: '', gender: '母', image: '', video: '', tags: [], description: '', health: '', requirements: '默认领养要求：稳定住所、家庭成员同意、做好安全防护、接受后续回访。', reason: '', updates: [] } : petById(adminEditing);
  const rows = pets.map(pet => `<div class="admin-row"><img src="${escapeHtml(mediaUrl(coverMedia(pet)))}" alt="" /><div><strong>${escapeHtml(pet.name)}</strong><p>${escapeHtml(pet.type)} · ${escapeHtml(pet.gender)} · ${escapeHtml(pet.age)}</p></div><select data-pet-status="${pet.id}">${['待领养','已领养','暂不适合领养'].map(status => `<option ${pet.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select><span class="status-pill ${statusClass(pet.status)}" style="position:static;justify-self:start">${escapeHtml(pet.status)}</span><div class="admin-row-actions"><button class="admin-edit" data-edit-pet="${pet.id}">编辑</button><button class="admin-delete" type="button" data-delete-pet="${pet.id}">删除档案</button></div></div>`).join('');
  return `${adminPageHead('宠物档案', '添加、编辑或删除档案，管理照片、视频、领养状态及每只宠物的单独要求。', '<button class="admin-primary" data-new-pet>添加宠物</button>')}
    <div class="admin-table">${rows || '<div class="admin-empty">还没有宠物档案。</div>'}</div>
    ${editPet ? renderPetEditor(editPet) : ''}`;
}
function renderExistingMediaManager(pet) {
  const currentMedia = mediaItems(pet);
  if (!currentMedia.length) return '<div class="media-manager-empty">目前还没有照片或视频。</div>';
  const currentCover = coverMedia(pet);
  const rows = currentMedia.map((item, index) => {
    const url = mediaUrl(item);
    const isImage = item.type === 'image';
    const typeLabel = isImage ? '照片' : isDirectVideo(item) ? '视频' : '外部视频';
    const preview = isImage && url
      ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(pet.name)}的${typeLabel} ${index + 1}" />`
      : `<span class="media-manager-type">${typeLabel}</span>`;
    const caption = item.caption || `${typeLabel} ${index + 1}`;
    const coverChoice = isImage ? `<label class="media-cover-choice"><input type="radio" name="coverMediaId" value="${escapeHtml(item.id)}" ${item.id === currentCover.id ? 'checked' : ''} /><span>设为封面</span></label>` : '';
    return `<div class="media-manager-item" data-existing-media="${escapeHtml(item.id)}">
      <input class="media-keep-checkbox" type="checkbox" name="keepMedia" value="${escapeHtml(item.id)}" checked hidden />
      <div class="media-manager-preview">${preview}</div>
      <div class="media-manager-copy"><strong>${escapeHtml(caption)}</strong><span>${typeLabel}${item.id === currentCover.id ? ' · 当前封面' : ''}</span></div>
      ${coverChoice}
      <button class="media-delete-button" type="button" data-remove-media="${escapeHtml(item.id)}" aria-pressed="false">删除</button>
    </div>`;
  }).join('');
  return `<div class="media-manager"><div class="media-manager-head"><strong>管理现有影像</strong><span>删除或更换封面后，请点击页面底部的“保存档案”。</span></div><div class="media-manager-list">${rows}</div></div>`;
}
function renderPetEditor(pet) {
  const isNew = !pet.id;
  const currentMedia = mediaItems(pet);
  const currentMediaManager = isNew ? '' : `<div class="field full"><label>已上传的照片和视频</label>${renderExistingMediaManager(pet)}</div>`;
  const currentMediaNotice = currentMedia.length ? `<p class="form-hint">当前已有 ${currentMedia.length} 个影像记录。可以在上方删除照片或视频，也可以选择新的封面。</p>` : '';
  return `<div class="admin-block" id="petEditor"><h4>${isNew ? '添加宠物档案' : `编辑 ${escapeHtml(pet.name)} 的档案`}</h4>
    <form id="petEditForm" data-pet-id="${escapeHtml(pet.id)}" class="settings-form">
      <div class="form-grid">
        <div class="field"><label>名字</label><input name="name" value="${escapeHtml(pet.name)}" required /></div>
        <div class="field"><label>种类</label><select name="type"><option ${pet.type === '猫咪' ? 'selected' : ''}>猫咪</option><option ${pet.type === '狗狗' ? 'selected' : ''}>狗狗</option></select></div>
        <div class="field"><label>状态</label><select name="status"><option ${pet.status === '待领养' ? 'selected' : ''}>待领养</option><option ${pet.status === '已领养' ? 'selected' : ''}>已领养</option><option ${pet.status === '暂不适合领养' ? 'selected' : ''}>暂不适合领养</option></select></div>
        <div class="field"><label>性别</label><select name="gender"><option ${pet.gender === '母' ? 'selected' : ''}>母</option><option ${pet.gender === '公' ? 'selected' : ''}>公</option></select></div>
        <div class="field"><label>年龄</label><input name="age" value="${escapeHtml(pet.age)}" placeholder="例如：约 2 岁" required /></div>
        <div class="field"><label>封面照片链接</label><input name="coverImage" value="${escapeHtml(mediaUrl(coverMedia(pet)))}" placeholder="粘贴封面图片链接" /></div>
        ${currentMediaManager}
        <div class="field full"><label>上传或替换封面照片</label><input id="petCoverFile" type="file" accept="image/jpeg,image/png,image/webp" /><span class="form-hint">选择照片后会打开裁切窗口，可拖动和放大调整取景。图片建议不超过 8 MB。</span></div>
        <div class="field full"><label>生活照片</label><p class="media-field-note">照片会作为小院档案的一部分保存；测试版保存在当前浏览器，正式版会保存到 CloudBase 云端媒体库。</p></div>
        <div class="field full"><label>上传生活照片（可多选）</label><input id="petGalleryFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple /><span class="form-hint">选择多张照片后会逐张打开裁切窗口；完成裁切后再保存档案。</span></div>
        <div class="field full"><label>外部视频链接（备用，可选）</label><textarea name="videoLinks" placeholder="如果视频在抖音、视频号或 B 站，可粘贴链接；直接上传视频后不需要填写。"></textarea></div>
        <div class="field full"><label>上传短视频（可多选）</label><input id="petVideoFiles" type="file" accept="video/mp4" multiple /><span class="form-hint">建议 MP4、每个不超过 60 MB、时长不超过 90 秒。</span>${currentMediaNotice}</div>
        <div class="field full"><label>简短介绍</label><textarea name="description" required>${escapeHtml(pet.description)}</textarea><button class="admin-edit" type="button" data-describe-photo>用封面照片自动写一段</button><span class="form-hint">选好封面照片后点一下，AI 会读照片写一段描述初稿。<strong>它只写照片里看得见的东西</strong>（毛色、体型、精神状貌），性格与病史照片看不出来，仍需你自己判断填写。</span></div>
        <div class="field full"><label>健康情况</label><textarea name="health" required>${escapeHtml(pet.health)}</textarea></div>
        <div class="field full"><label>默认 / 单独领养要求</label><textarea name="requirements" required>${escapeHtml(pet.requirements)}</textarea></div>
        <div class="field full"><label>暂不适合领养说明（仅该状态需要）</label><textarea name="reason">${escapeHtml(pet.reason)}</textarea></div>
      </div>
      <div class="modal-actions"><button class="button button-primary" type="submit">保存档案</button><button class="button button-ghost" type="button" data-cancel-pet>取消</button></div>
    </form>
  </div>`;
}
/**
 * 收集管理员对「申请人资料」的更正。
 *
 * 只返回**真正被改动过**的字段，避免管理员只是改一下处理状态，
 * 却把申请人在别处刚做的自助修改覆盖回旧值。
 * 字段取值不合法时直接报错，不写入半截数据。
 */
function applicantEditsFromForm(form, app) {
  const read = name => String(new FormData(form).get(name) ?? '').trim();
  const patch = {};
  const view = {};

  const name = read('applicantName');
  if (name !== String(app.name || '')) {
    if (!name) throw new Error('申请人姓名不能为空。');
    patch.applicant_name = name; view.name = name;
  }

  const ageText = read('applicantAge');
  if (ageText !== String(app.age ?? '')) {
    const age = Number(ageText);
    if (!Number.isInteger(age) || age < 18 || age > 100) throw new Error('申请人年龄需要是 18 到 100 之间的整数。');
    patch.applicant_age = age; view.age = age;
  }

  const gender = read('applicantGender');
  if (gender !== String(app.gender || '')) {
    if (!['女', '男', '不方便说明'].includes(gender)) throw new Error('请选择有效的性别。');
    patch.applicant_gender = gender; view.gender = gender;
  }

  const contact = read('applicantContact');
  if (contact !== String(app.contact || '')) {
    if (!contact) throw new Error('联系方式不能为空。');
    patch.contact = contact;
    patch.contact_normalized = contact.replace(/[\s-]/g, '').toLowerCase();
    view.contact = contact;
  }

  const home = read('applicantHome');
  if (home !== String(app.home || '')) {
    if (!['是', '否'].includes(home)) throw new Error('请选择是否在成都及周边有住所。');
    patch.has_chengdu_home = home === '是'; view.home = home;
  }

  const experience = read('applicantExperience');
  if (experience !== String(app.experience || '')) {
    if (!['有', '没有', '正在了解'].includes(experience)) throw new Error('请选择有效的养宠经验。');
    patch.experience = experience; view.experience = experience;
  }

  const family = read('applicantFamily');
  if (family !== String(app.family || '')) {
    if (!['全部同意', '部分同意', '尚未沟通'].includes(family)) throw new Error('请选择有效的家庭成员意见。');
    patch.family_agreement = family; view.family = family;
  }

  const otherPets = read('applicantOtherPets');
  if (otherPets !== String(app.otherPets || '')) {
    if (!['没有', '有猫', '有狗', '有其他宠物'].includes(otherPets)) throw new Error('请选择有效的现有宠物情况。');
    patch.other_pets = otherPets; view.otherPets = otherPets;
  }

  const note = read('applicantNote');
  if (note !== String(app.note || '')) {
    patch.note = note || null; view.note = note;
  }

  return { patch, view };
}
function renderAdminApplications() {
  const inbox = adminApplications();
  const rows = inbox.map(app => {
    const pet = petById(app.petId);
    const petName = app.petName || pet?.name || '未找到对应宠物';
    const submittedAt = formatApplicationDate(app.createdAt);
    return `<article class="application-record">
      <div class="application-record-head">
        <div class="application-person">
          <strong>${escapeHtml(app.name)} <span>· ${escapeHtml(app.kind)}</span></strong>
          <p>${escapeHtml(app.contact)} · ${escapeHtml(app.age)} 岁 · ${escapeHtml(app.gender)}</p>
        </div>
        <div class="application-pet">
          <span>意向宠物</span>
          <strong>${escapeHtml(petName)}</strong>
        </div>
        <div class="application-status-field">
          <label for="application-status-${escapeHtml(app.id)}">处理状态</label>
          <select id="application-status-${escapeHtml(app.id)}" name="status">${applicationStatusOptions(app.status)}</select>
        </div>
      </div>
      <dl class="application-detail-grid">
        <div><dt>成都及周边住所</dt><dd>${escapeHtml(app.home || '未填写')}</dd></div>
        <div><dt>养宠经验</dt><dd>${escapeHtml(app.experience || '未填写')}</dd></div>
        <div><dt>家庭成员意见</dt><dd>${escapeHtml(app.family || '未填写')}</dd></div>
        <div><dt>现有宠物</dt><dd>${escapeHtml(app.otherPets || '未填写')}</dd></div>
        <div class="application-note"><dt>申请人补充说明</dt><dd>${escapeHtml(app.note || '申请人未填写补充说明')}</dd></div>
        <div><dt>提交时间</dt><dd>${escapeHtml(submittedAt)}</dd></div>
      </dl>
      <form class="application-action-form" data-application-form="${escapeHtml(app.id)}">
        <details class="application-edit">
          <summary>代申请人更正资料</summary>
          <div class="form-grid">
            <div class="field"><label>姓名</label><input name="applicantName" value="${escapeHtml(app.name || '')}" /></div>
            <div class="field"><label>年龄</label><input name="applicantAge" value="${escapeHtml(String(app.age ?? ''))}" inputmode="numeric" /></div>
            <div class="field"><label>性别</label><select name="applicantGender">${selectOptions(['女', '男', '不方便说明'], app.gender)}</select></div>
            <div class="field"><label>联系方式</label><input name="applicantContact" value="${escapeHtml(app.contact || '')}" /></div>
            <div class="field"><label>成都及周边住所</label><select name="applicantHome">${selectOptions(['是', '否'], app.home)}</select></div>
            <div class="field"><label>养宠经验</label><select name="applicantExperience">${selectOptions(['有', '没有', '正在了解'], app.experience)}</select></div>
            <div class="field"><label>家庭成员意见</label><select name="applicantFamily">${selectOptions(['全部同意', '部分同意', '尚未沟通'], app.family)}</select></div>
            <div class="field"><label>现有宠物</label><select name="applicantOtherPets">${selectOptions(['没有', '有猫', '有狗', '有其他宠物'], app.otherPets)}</select></div>
            <div class="field full"><label>申请人补充说明</label><textarea name="applicantNote">${escapeHtml(app.note || '')}</textarea></div>
          </div>
          <p class="form-hint">用于电话里帮申请人更正他填错的内容（比如上了年纪的申请人自己改不动网站时）。只有真正改动过的字段才会写入，不会覆盖申请人自己的自助修改。意向宠物和申请类型不在这里修改。</p>
        </details>
        <label for="application-note-${escapeHtml(app.id)}">管理员内部备注</label>
        <textarea id="application-note-${escapeHtml(app.id)}" name="internalNote" placeholder="例如：已电话沟通，等待家人确认。此内容不会公开。">${escapeHtml(app.internalNote || '')}</textarea>
        <div class="application-action-buttons">
          <button class="admin-primary" type="submit">保存处理结果</button>
          <button class="admin-edit" type="button" data-summarize-application="${escapeHtml(app.id)}">${app.aiSummary ? '重新生成摘要' : 'AI 摘要'}</button>
          <button class="admin-delete" type="button" data-delete-application="${escapeHtml(app.id)}">删除申请</button>
        </div>
        <div class="application-ai-summary" data-ai-summary-for="${escapeHtml(app.id)}"${app.aiSummary ? '' : ' hidden'}>${app.aiSummary ? applicationSummaryHtml(app.aiSummary) : ''}</div>
        ${app.aiSummaryStale ? `<p class="ai-summary-stale" data-ai-summary-stale>申请资料在上次摘要之后有过改动，旧结论的依据已经变了，建议重新生成。</p>` : ''}
      </form>
    </article>`;
  }).join('');
  const stateNotice = window.YARD_LOCAL_REVIEW
    ? '本地审核预览：只显示本浏览器中的示例与草稿，不连接云端。'
    : Array.isArray(cloudApplications)
      ? '这里显示的是云端申请资料；修改状态或内部备注后会同步到云端。'
      : '暂时未能读取云端申请资料；当前显示本浏览器中的申请记录。';
  return `${adminPageHead('申请记录', stateNotice)}
    <div class="application-list">${rows || '<div class="admin-empty">还没有申请记录。访客提交表单后会出现在这里。</div>'}</div>`;
}
function renderAdminSettings() {
  const qrPreview = settings.wechatQrUrl
    ? `<div class="settings-qr-preview"><img src="${escapeHtml(settings.wechatQrUrl)}" alt="当前微信二维码" /><div><strong>当前微信二维码</strong><span>更换二维码后，保存网站设置才会生效。</span><label class="settings-qr-remove"><input type="checkbox" name="removeWechatQr" /> 删除当前二维码</label></div></div>`
    : '<p class="form-hint settings-qr-empty">暂未上传微信二维码。上传后会显示在访客的“查看咨询方式”弹窗中。</p>';
  return `${adminPageHead('网站设置', '修改公开显示的联系方式、所在区域和首页说明。')}
    <form id="settingsForm" class="settings-form">
      <div class="form-grid">
        <div class="field"><label>联系电话</label><input name="phone" value="${escapeHtml(settings.phone)}" /></div>
        <div class="field"><label>微信号 / 微信咨询说明</label><input name="wechat" value="${escapeHtml(settings.wechat)}" /></div>
        <div class="field"><label>咨询时间</label><input name="hours" value="${escapeHtml(settings.hours)}" /></div>
        <div class="field"><label>所在区域</label><input name="area" value="${escapeHtml(settings.area)}" /></div>
        <div class="field full"><label for="wechatQrFile">微信二维码</label><input id="wechatQrFile" type="file" accept="image/jpeg,image/png,image/webp" /><span class="form-hint">支持 JPG、PNG、WebP，单张不超过 8 MB。二维码会在保存网站设置后公开显示。</span>${qrPreview}</div>
        <div class="field full"><label>首页简介</label><textarea name="intro">${escapeHtml(settings.intro)}</textarea></div>
        <div class="field full"><label for="wecomWebhook">企业微信机器人地址</label><input id="wecomWebhook" name="wecomWebhook" value="${escapeHtml(cloudWecomWebhook)}" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." autocomplete="off" /><span class="form-hint">在企业微信群里点「群机器人 → 添加机器人」，把拿到的 Webhook 地址粘贴到这里。保存后，新申请会推送宠物、类型、时间及申请人填写的资料，供负责人联系审核。接收群须限制为有权处理申请的人员；内部备注、来源哈希与修改令牌不会推送。留空表示关闭提醒。</span>${wecomStatusHint()}</div>
        <div class="field full"><label for="aiApiKey">AI 模型 API Key（DeepSeek）</label><input id="aiApiKey" name="aiApiKey" placeholder="${cloudAiKey.configured ? '如需更换请填入新的 Key，留空表示保持现状' : 'sk-...'}" autocomplete="off" /><span class="form-hint ${cloudAiKey.configured ? 'ai-key-status is-ok' : 'ai-key-status'}">${cloudAiKey.configured ? `已配置（${escapeHtml(cloudAiKey.hint)}）：AI 匹配助手使用真实模型。` : '尚未配置：AI 匹配助手运行在演示模式，回复由内置示例生成，不会调用真实模型。'}出于安全考虑不回显完整密钥，填入新值即视为替换。该密钥只保存在管理员专属设置中，匿名访客读不到，也不会出现在任何前端代码或仓库里。</span></div>
        <div class="field full"><label for="tokenhubApiKey">腾讯云 TokenHub API Key（向量检索与图像理解）</label><input id="tokenhubApiKey" name="tokenhubApiKey" placeholder="${cloudTokenhubKey.configured ? '如需更换请填入新的 Key，留空表示保持现状' : '在 TokenHub 控制台「API Key 管理」创建'}" autocomplete="off" /><span class="form-hint ${cloudTokenhubKey.configured ? 'ai-key-status is-ok' : 'ai-key-status'}">${cloudTokenhubKey.configured ? `已配置（${escapeHtml(cloudTokenhubKey.hint)}）：可按档案语义检索、可用照片搜宠物。` : '尚未配置：宠物检索暂时只能靠关键词匹配，也不能用照片搜宠物。'}用于把宠物档案、领养政策、回访记录转换成向量以便按意思检索，以及把照片转换成向量做「以图搜宠」。与上面的对话 Key 互不影响，各自独立保存。同样不回显完整密钥。</span></div>
        <div class="field full"><label>AI 配置自检</label><button class="admin-edit" type="button" data-diagnose-ai>检查 AI 配置</button><span class="form-hint">换完 Key 之后点一下：检查两个 Key 是否可用、向量模型的维度与语义方向是否正确。<strong>不会显示密钥内容</strong>，测试用的是固定字符串，不涉及任何申请人数据。</span><div class="ai-diagnose-result" data-diagnose-result hidden></div></div>
      </div>
      <button class="button button-primary form-submit" type="submit">保存网站设置</button>
    </form>`;
}

function bindAdminEvents() {
  $$('[data-pet-status]').forEach(select => select.addEventListener('change', async () => {
    const pet = petById(select.dataset.petStatus);
    if (!pet) return;
    const previousStatus = pet.status;
    pet.status = select.value;
    try {
      const cloudSaved = await savePetTextToCloud(pet);
      savePets(); renderAll(); renderAdmin(); toast(cloudSaved ? `${pet.name} 已同步到云端` : `${pet.name} 已在本地更新`);
    } catch (error) {
      pet.status = previousStatus;
      renderAdmin();
      toast(error.message || '云端保存失败，状态未更新');
    }
  }));
  $$('[data-edit-pet]').forEach(button => button.addEventListener('click', () => {
    resetPendingPhotoSelection();
    adminEditing = button.dataset.editPet;
    renderAdmin();
    setTimeout(() => $('#petEditor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }));
  $('[data-new-pet]')?.addEventListener('click', () => {
    resetPendingPhotoSelection();
    adminEditing = 'new';
    renderAdmin();
    setTimeout(() => $('#petEditor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  });
  $('[data-cancel-pet]')?.addEventListener('click', () => {
    resetPendingPhotoSelection();
    adminEditing = null;
    renderAdmin();
  });
  $$('[data-remove-media]').forEach(button => button.addEventListener('click', () => {
    const row = button.closest('[data-existing-media]');
    const keep = $('.media-keep-checkbox', row);
    const coverChoice = $('input[name="coverMediaId"]', row);
    if (!row || !keep) return;
    const shouldRemove = keep.checked;
    keep.checked = !shouldRemove;
    row.classList.toggle('is-removed', shouldRemove);
    button.textContent = shouldRemove ? '撤销删除' : '删除';
    button.setAttribute('aria-pressed', String(shouldRemove));
    if (coverChoice) coverChoice.disabled = shouldRemove;
    if (shouldRemove && coverChoice?.checked) {
      const replacement = $$('.media-manager-item:not(.is-removed) input[name="coverMediaId"]', $('#petEditForm')).find(input => !input.disabled);
      if (replacement) replacement.checked = true;
    }
  }));
  $('#petEditForm')?.addEventListener('submit', handlePetSave);
  $('[data-open-applications]')?.addEventListener('click', () => {
    changeAdminTab('applications');
  });
  $$('[data-application-form]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const applicationId = form.dataset.applicationForm;
    const status = $('select[name="status"]', form.closest('.application-record'))?.value || '';
    const internalNote = String(new FormData(form).get('internalNote') || '').trim();
    const app = adminApplications().find(item => item.id === applicationId);
    if (!app || !APPLICATION_STATUSES.includes(status)) {
      toast('没有找到这条申请，请刷新管理员后台后重试。');
      return;
    }
    let applicantEdits;
    try { applicantEdits = applicantEditsFromForm(form, app); }
    catch (error) { toast(error.message); return; }
    const changedFields = Object.keys(applicantEdits.patch);
    const button = $('button[type="submit"]', form);
    const previousLabel = button?.textContent;
    if (button) { button.disabled = true; button.textContent = '正在保存…'; }
    try {
      if (Array.isArray(cloudApplications) && cloudDb && adminAuthUser) {
        const patch = {
          internal_status: status,
          internal_note: internalNote || null,
          updated_at: new Date().toISOString(),
          resolved_at: ['已通过', '暂不考虑'].includes(status) ? new Date().toISOString() : null,
          ...applicantEdits.patch
        };
        const result = await cloudDb.from('applications').update(patch).eq('id', applicationId);
        if (result?.error) throw new Error(result.error.message || '云端申请处理结果保存失败。');
        if (changedFields.length) {
          // 管理员代改申请人资料的痕迹：只记字段名，不记任何内容。
          try {
            await cloudDb.from('application_events').insert({
              id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              application_id: applicationId,
              event_type: 'admin_applicant_corrected',
              detail: { fields: changedFields }
            });
          } catch { /* 事件写入失败不应当影响保存结果 */ }
        }
      }
      app.status = status;
      app.internalNote = internalNote;
      Object.assign(app, applicantEdits.view);
      const localApp = applications.find(item => item.id === applicationId);
      if (localApp) {
        localApp.status = status;
        localApp.internalNote = internalNote;
        Object.assign(localApp, applicantEdits.view);
        saveApplications();
      }
      renderStats();
      toast(changedFields.length
        ? '处理结果与申请人资料都已保存'
        : (Array.isArray(cloudApplications) ? '申请处理结果已同步到云端' : '申请处理结果已保存到本地'));
    } catch (error) {
      toast(error.message || '申请处理结果保存失败，请稍后重试。');
    } finally {
      if (button) { button.disabled = false; button.textContent = previousLabel || '保存处理结果'; }
    }
  }));
  $('#settingsForm')?.addEventListener('submit', saveWebsiteSettings);
}

function safeCloudFileName(name) {
  return String(name || 'media').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'media';
}
function validContactQrFile(file) {
  return Boolean(file && /^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= 8 * 1024 * 1024);
}
function publicContactPayload(value) {
  return {
    phone: String(value.phone || '').trim(),
    wechat: String(value.wechat || '').trim(),
    hours: String(value.hours || '').trim(),
    area: String(value.area || '').trim(),
    intro: String(value.intro || '').trim(),
    wechatQrUrl: String(value.wechatQrUrl || '').trim(),
    wechatQrPath: String(value.wechatQrPath || '').trim()
  };
}
async function saveContactSettingsToCloud(nextSettings) {
  if (!cloudState.connected || !cloudDb || !adminAuthUser) return false;
  const result = await cloudDb.from('yard_settings').upsert({
    key: 'public_contact',
    value: publicContactPayload(nextSettings),
    updated_at: new Date().toISOString()
  }, { onConflict: 'key' });
  if (result?.error) throw new Error(result.error.message || '云端联系方式保存失败。');
  return true;
}
/** 保存企业微信机器人地址。这个 key 不在公开只读策略里，只有管理员读得到。 */
async function saveWeComWebhookToCloud(value) {
  if (!cloudState.connected || !cloudDb || !adminAuthUser) return false;
  const result = await cloudDb.from('yard_settings').upsert({
    key: 'wecom_webhook',
    value: { url: value },
    updated_at: new Date().toISOString()
  }, { onConflict: 'key' });
  if (result?.error) throw new Error(result.error.message || '企业微信机器人地址保存失败。');
  return true;
}
/**
 * 保存 AI 相关配置（DeepSeek / TokenHub 的 Key）。
 *
 * 同样存在 yard_settings 的管理员专属 key 里（`ai_config`）：
 * 不进代码、不进仓库、不用重新部署云函数，随时可换。
 *
 * **只更新传入的字段，其余保持不变** —— 先读再合并再写。
 * 否则填 TokenHub Key 时会把 DeepSeek Key 整列覆盖掉。
 */
async function saveAiConfigToCloud(patch) {
  if (!cloudState.connected || !cloudDb || !adminAuthUser) return false;
  const current = await cloudDb.from('yard_settings').select('value').eq('key', 'ai_config').limit(1);
  const existing = cloudRows(current, '读取 AI 配置')[0]?.value || {};
  const result = await cloudDb.from('yard_settings').upsert({
    key: 'ai_config',
    value: { ...existing, ...patch, updatedAt: new Date().toISOString() },
    updated_at: new Date().toISOString()
  }, { onConflict: 'key' });
  if (result?.error) throw new Error(result.error.message || 'AI 配置保存失败。');
  return true;
}
async function uploadContactQrToCloud(file) {
  const cloudPath = `settings/wechat-qr/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeCloudFileName(file.name)}`;
  const uploadResult = await cloudMediaBucket.upload(cloudPath, file, { upsert: true, contentType: file.type });
  if (uploadResult?.error) throw new Error(uploadResult.error.message || '微信二维码上传失败。');
  const publicResult = await cloudMediaBucket.getPublicUrl(cloudPath);
  if (publicResult?.error || !publicResult?.data?.publicUrl) throw new Error('微信二维码上传成功，但无法生成访问地址。');
  return { wechatQrUrl: publicResult.data.publicUrl, wechatQrPath: cloudPath, wechatQrStorageId: '' };
}
async function saveContactQrLocally(file) {
  const storageId = `contact-qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const url = await mediaDb.put(storageId, file);
  return { wechatQrUrl: url, wechatQrPath: '', wechatQrStorageId: storageId };
}
async function removeContactQrFile(value) {
  if (value.wechatQrPath && cloudMediaBucket && adminAuthUser) {
    const result = await cloudMediaBucket.remove([value.wechatQrPath]);
    if (result?.error) throw new Error(result.error.message || '旧微信二维码删除失败。');
  }
  if (value.wechatQrStorageId) {
    await mediaDb.delete(value.wechatQrStorageId);
    if (value.wechatQrUrl?.startsWith('blob:')) URL.revokeObjectURL(value.wechatQrUrl);
  }
}
async function saveWebsiteSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const oldSettings = { ...settings };
  const qrFile = $('#wechatQrFile', form)?.files?.[0];
  const removeQr = new FormData(form).get('removeWechatQr') === 'on';
  const webhookValue = String(new FormData(form).get('wecomWebhook') || '').trim();
  // 只有确实读到过旧值时才允许把地址清空；没读到过就只在管理员填了新地址时才写入，
  // 避免因读取失败而误把已配置好的地址覆盖成空。
  const shouldSaveWebhook = cloudWecomWebhookLoaded ? webhookValue !== cloudWecomWebhook : Boolean(webhookValue);
  // AI Key 与机器人地址同理：只有确实读到过旧值时才允许清空，避免读取失败误清已配置的密钥。
  const aiKeyValue = String(new FormData(form).get('aiApiKey') || '').trim();
  const shouldSaveAiKey = Boolean(aiKeyValue);
  const tokenhubKeyValue = String(new FormData(form).get('tokenhubApiKey') || '').trim();
  const shouldSaveTokenhubKey = Boolean(tokenhubKeyValue);
  if (qrFile && !validContactQrFile(qrFile)) {
    toast('微信二维码请选择 JPG、PNG 或 WebP 图片，且文件不超过 8 MB。');
    return;
  }
  const changesQr = Boolean(qrFile || removeQr);
  if (changesQr && oldSettings.wechatQrPath && (!cloudState.connected || !cloudDb || !adminAuthUser)) {
    toast('当前二维码在云端，请登录管理员账号并连接云端后再更换或删除。');
    return;
  }
  const button = $('button[type="submit"]', form);
  const previousLabel = button?.textContent;
  if (button) { button.disabled = true; button.textContent = '正在保存…'; }
  let nextSettings = {
    ...settings,
    phone: String(new FormData(form).get('phone') || '').trim(),
    wechat: String(new FormData(form).get('wechat') || '').trim(),
    hours: String(new FormData(form).get('hours') || '').trim(),
    area: String(new FormData(form).get('area') || '').trim(),
    intro: String(new FormData(form).get('intro') || '').trim()
  };
  let replacementQr = null;
  try {
    if (qrFile) {
      replacementQr = cloudState.connected && cloudMediaBucket && adminAuthUser
        ? await uploadContactQrToCloud(qrFile)
        : await saveContactQrLocally(qrFile);
      nextSettings = { ...nextSettings, ...replacementQr };
    } else if (removeQr) {
      nextSettings = { ...nextSettings, wechatQrUrl: '', wechatQrPath: '', wechatQrStorageId: '' };
    }
    const cloudSaved = await saveContactSettingsToCloud(nextSettings);
    let webhookSaved = false;
    if (shouldSaveWebhook) {
      webhookSaved = await saveWeComWebhookToCloud(webhookValue);
      if (webhookSaved) { cloudWecomWebhook = webhookValue; cloudWecomWebhookLoaded = true; }
    }
    let aiKeySaved = false;
    if (shouldSaveAiKey) {
      aiKeySaved = await saveAiConfigToCloud({ apiKey: aiKeyValue });
      if (aiKeySaved) {
        cloudAiKey = { loaded: true, configured: true, hint: maskKey(aiKeyValue) };
      }
    }
    let tokenhubKeySaved = false;
    if (shouldSaveTokenhubKey) {
      tokenhubKeySaved = await saveAiConfigToCloud({ tokenhubApiKey: tokenhubKeyValue });
      if (tokenhubKeySaved) {
        cloudTokenhubKey = { loaded: true, configured: true, hint: maskKey(tokenhubKeyValue) };
      }
    }
    settings = nextSettings;
    saveSettings();
    renderContact();
    if (changesQr && (oldSettings.wechatQrPath || oldSettings.wechatQrStorageId)) {
      try { await removeContactQrFile(oldSettings); }
      catch (error) { toast('联系方式已保存，但旧二维码暂未清理。请稍后重新保存一次。'); }
    }
    renderAdmin();
    if (shouldSaveWebhook && !webhookSaved) {
      toast('网站设置已保存，但企业微信机器人地址没能写入云端，请连接云端后重新保存一次。');
    } else if (shouldSaveAiKey && !aiKeySaved) {
      toast('网站设置已保存，但 AI 模型 Key 没能写入云端，请连接云端后重新保存一次。');
    } else if (shouldSaveTokenhubKey && !tokenhubKeySaved) {
      toast('网站设置已保存，但 TokenHub Key 没能写入云端，请连接云端后重新保存一次。');
    } else if (aiKeySaved && tokenhubKeySaved) {
      toast('两个 Key 都已保存');
    } else if (aiKeySaved) {
      toast('AI 模型 Key 已保存，下一条提问就会用真实模型回答');
    } else if (tokenhubKeySaved) {
      toast('TokenHub Key 已保存，宠物检索与以图搜宠已就绪');
    } else if (webhookSaved && !webhookValue) toast('网站设置已保存，企业微信提醒已关闭');
    else if (webhookSaved) toast('网站设置已保存，企业微信提醒已开启');
    else toast(cloudSaved ? '联系方式和二维码已同步到云端' : '联系方式和二维码已保存到本地');
  } catch (error) {
    if (replacementQr?.wechatQrPath && cloudMediaBucket) {
      await cloudMediaBucket.remove([replacementQr.wechatQrPath]);
    }
    if (replacementQr?.wechatQrStorageId) {
      await mediaDb.delete(replacementQr.wechatQrStorageId);
      if (replacementQr.wechatQrUrl?.startsWith('blob:')) URL.revokeObjectURL(replacementQr.wechatQrUrl);
    }
    toast(error.message || '网站设置保存失败，请稍后重试。');
  } finally {
    if (button) { button.disabled = false; button.textContent = previousLabel || '保存网站设置'; }
  }
}
async function uploadCloudMedia(file, type, petId) {
  if (!cloudMediaBucket || !adminAuthUser) return null;
  const cloudPath = `pets/${petId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeCloudFileName(file.name)}`;
  const uploadResult = await cloudMediaBucket.upload(cloudPath, file, { upsert: true, contentType: file.type });
  if (uploadResult?.error) throw new Error(uploadResult.error.message || '媒体上传失败。');
  const publicResult = await cloudMediaBucket.getPublicUrl(cloudPath);
  if (publicResult?.error || !publicResult?.data?.publicUrl) throw new Error('媒体上传成功，但无法生成访问地址。');
  return { id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, url: publicResult.data.publicUrl, cloudPath, isCover: false, caption: file.name };
}
async function readFilesAsMedia(files, type, petId) {
  const usable = [...files].filter(file => {
    const validType = type === 'image' ? /^image\/(jpeg|png|webp)$/.test(file.type) : file.type === 'video/mp4';
    const limit = type === 'image' ? 8 * 1024 * 1024 : 60 * 1024 * 1024;
    return validType && file.size <= limit;
  });
  return Promise.all(usable.map(async file => {
    if (cloudState.connected && cloudMediaBucket && adminAuthUser) {
      return uploadCloudMedia(file, type, petId);
    }
    const id = makeMediaId();
    const url = await mediaDb.put(id, file);
    return { id, storageId: id, type, url, isCover: false, caption: file.name };
  }));
}
async function syncCloudMedia(pet, previousMedia) {
  if (!cloudDb || !cloudMediaBucket || !adminAuthUser) return false;
  const previousCloud = previousMedia.filter(item => item.cloudPath);
  const currentCloud = pet.media.filter(item => item.cloudPath);
  const currentPaths = new Set(currentCloud.map(item => item.cloudPath));
  const removedCloud = previousCloud.filter(item => !currentPaths.has(item.cloudPath));
  if (removedCloud.length) {
    const removeResult = await cloudMediaBucket.remove(removedCloud.map(item => item.cloudPath));
    if (removeResult?.error) throw new Error(removeResult.error.message || '云端媒体删除失败。');
    for (const item of removedCloud) {
      const deleteResult = await cloudDb.from('pet_media').delete().eq('id', item.id);
      if (deleteResult?.error) throw new Error(deleteResult.error.message || '云端媒体记录删除失败。');
    }
  }
  const resetCover = await cloudDb.from('pet_media').update({ is_cover: false }).eq('pet_id', pet.id);
  if (resetCover?.error) throw new Error(resetCover.error.message || '云端封面状态更新失败。');
  const records = pet.media.filter(item => item.cloudPath || (item.url && !item.url.startsWith('blob:'))).map((item, index) => ({
    id: item.id,
    pet_id: pet.id,
    media_type: item.type,
    storage_path: item.cloudPath || null,
    external_url: item.cloudPath ? null : (item.url || null),
    caption: item.caption || null,
    alt_text: item.altText || `${pet.name}的${item.type === 'video' ? '视频' : '照片'}`,
    is_cover: index === 0,
    is_public: true,
    sort_order: index
  })).filter(item => item.storage_path || item.external_url);
  if (records.length) {
    const upsertResult = await cloudDb.from('pet_media').upsert(records, { onConflict: 'id' });
    if (upsertResult?.error) throw new Error(upsertResult.error.message || '云端媒体记录保存失败。');
  }
  return true;
}
function parseMediaLinks(text, type) {
  return String(text || '').split(/\r?\n/).map(value => value.trim()).filter(value => /^https?:\/\//i.test(value)).map(url => ({ id: makeMediaId(), type, url, isCover: false, caption: type === 'video' ? '短视频' : '生活照片' }));
}
async function deletePetFromCloud(pet) {
  if (!cloudState.connected || !cloudDb || !adminAuthUser) return false;
  const applicationRows = cloudRows(
    await cloudDb.from('applications').select('id').eq('pet_id', pet.id).limit(1000),
    '读取宠物关联申请'
  );
  if (applicationRows.length) {
    const applicationsDeleteResult = await cloudDb.from('applications').delete().eq('pet_id', pet.id);
    if (applicationsDeleteResult?.error) throw new Error(applicationsDeleteResult.error.message || '关联申请记录删除失败。');
  }
  const mediaRows = cloudRows(
    await cloudDb.from('pet_media').select('id,storage_path').eq('pet_id', pet.id).limit(1000),
    '读取宠物媒体记录'
  );
  const storagePaths = mediaRows.map(item => item.storage_path).filter(Boolean);
  if (storagePaths.length && cloudMediaBucket) {
    const removeResult = await cloudMediaBucket.remove(storagePaths);
    if (removeResult?.error) throw new Error(removeResult.error.message || '宠物媒体文件删除失败。');
  }
  const mediaDeleteResult = await cloudDb.from('pet_media').delete().eq('pet_id', pet.id);
  if (mediaDeleteResult?.error) throw new Error(mediaDeleteResult.error.message || '云端媒体记录删除失败。');
  const updatesDeleteResult = await cloudDb.from('pet_updates').delete().eq('pet_id', pet.id);
  if (updatesDeleteResult?.error) throw new Error(updatesDeleteResult.error.message || '云端回访记录删除失败。');
  const deleteResult = await cloudDb.from('pets').delete().eq('id', pet.id);
  if (deleteResult?.error) throw new Error(deleteResult.error.message || '云端宠物档案删除失败。');
  return { deletedApplications: applicationRows.length };
}
async function deletePetFromLocal(pet) {
  await Promise.allSettled(mediaItems(pet).filter(item => item.storageId).map(async item => {
    await mediaDb.delete(item.storageId);
    if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url);
  }));
}
async function handlePetDelete(id) {
  const pet = petById(id);
  if (!pet) return;
  const relatedApplications = adminApplications().filter(application => application.petId === pet.id);
  const hasCloudMedia = mediaItems(pet).some(item => item.cloudPath);
  if (hasCloudMedia && (!cloudState.connected || !cloudDb || !adminAuthUser)) {
    toast('这只宠物包含云端影像，请先登录并连接云端后再删除，避免只删掉本地记录。');
    return;
  }
  const applicationWarning = relatedApplications.length
    ? `\n\n注意：这只宠物有 ${relatedApplications.length} 条申请记录。确认后，申请资料、内部备注和处理历史也会一并删除。`
    : '';
  const confirmed = window.confirm(`确定删除“${pet.name}”的宠物档案吗？\n\n这会同时移除公开资料、照片、视频和回访记录。此操作不能撤销。${applicationWarning}`);
  if (!confirmed) return;
  try {
    const cloudResult = await deletePetFromCloud(pet);
    await deletePetFromLocal(pet);
    pets = pets.filter(item => item.id !== pet.id);
    applications = applications.filter(application => application.petId !== pet.id);
    if (Array.isArray(cloudApplications)) cloudApplications = cloudApplications.filter(application => application.petId !== pet.id);
    savePets();
    saveApplications();
    if (adminEditing === pet.id) adminEditing = null;
    renderAll();
    renderAdmin();
    const applicationNote = relatedApplications.length ? `，以及 ${relatedApplications.length} 条关联申请` : '';
    toast(cloudResult ? `${pet.name} 的档案、云端媒体${applicationNote}已删除` : `${pet.name} 的档案${applicationNote}已从本地删除`);
  } catch (error) {
    toast(error.message || '宠物档案删除失败，请稍后重试。');
  }
}
/**
 * 渲染 AI 申请摘要。
 *
 * 呈现上刻意把「核对结果」和「建议追问」分开，并保留一行来源说明
 * （由 AI 生成 / 规则比对 / 模型失败），避免管理员把兜底结果当成模型结论。
 */
function applicationSummaryHtml(result) {
  const summary = result?.summary;
  if (!summary) return '';
  const statusClass = status => /满足/.test(status) ? 'is-ok' : /缺失/.test(status) ? 'is-bad' : 'is-warn';
  const fitRows = (summary.fit || []).map(item => `
    <li class="ai-fit-row ${statusClass(item.status || '')}">
      <span class="ai-fit-status">${escapeHtml(item.status || '')}</span>
      <strong>${escapeHtml(item.label || '')}</strong>
      ${item.note ? `<span class="ai-fit-note">${escapeHtml(item.note)}</span>` : ''}
    </li>`).join('');
  const questions = (summary.questions || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  // 展示 AI 实际查了哪些东西：让管理员能判断结论的覆盖面，
  // 也能看出"回答不准"是因为没查、还是资料本身缺失。
  const steps = (result.steps || []).map(step => `
    <li class="ai-step${step.ok === false ? ' is-failed' : ''}">
      <span class="ai-step-mark">${step.ok === false ? '未完成' : '已查'}</span>
      <span>${escapeHtml(step.label || step.tool || '')}${step.summary ? `：${escapeHtml(step.summary)}` : ''}</span>
    </li>`).join('');
  const generatedAt = result.cachedAt ? ` · ${formatSummaryTime(result.cachedAt)}` : '';

  return `
    <div class="ai-summary-head">
      <strong>AI 摘要</strong>
      <span class="ai-summary-mode${result.mock ? ' is-fallback' : ''}">${escapeHtml(result.mode || '')}${generatedAt}</span>
    </div>
    <p class="ai-summary-headline">${escapeHtml(summary.headline || '')}</p>
    ${fitRows ? `<ul class="ai-fit-list">${fitRows}</ul>` : ''}
    ${questions ? `<div class="ai-summary-block"><h5>建议电话里问</h5><ul>${questions}</ul></div>` : ''}
    ${summary.caution ? `<p class="ai-summary-caution">${escapeHtml(summary.caution)}</p>` : ''}
    ${steps ? `<div class="ai-summary-block"><h5>AI 审核过程</h5><ul class="ai-step-list">${steps}</ul></div>` : ''}
    <p class="ai-summary-note">AI 只做信息整理与提示，是否通过由你来判断。</p>`;
}

/** 摘要生成时间只显示到分钟，且用本地时间，方便管理员判断"这是刚才算的还是昨天的"。 */
function formatSummaryTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} 生成`;
}

function renderApplicationSummary(container, result) {
  if (!container) return;
  const html = applicationSummaryHtml(result);
  if (!html) { container.hidden = true; return; }
  container.hidden = false;
  container.innerHTML = html;
}
async function handleApplicationSummarize(id, button) {
  const container = $(`[data-ai-summary-for="${id}"]`);
  const previous = button?.textContent;
  if (button) { button.disabled = true; button.textContent = '生成中…'; }
  try {
    // 已有摘要时带上 force：管理员点"重新生成"就是要重算，
    // 不该拿缓存把这次点击挡回去
    const application = adminApplications().find(item => item.id === id);
    const result = await callYardApi({ action: 'admin.application.summarize', applicationId: id, force: Boolean(application?.aiSummary) });
    if (result?.ok !== true) throw new Error(result?.message || '生成摘要失败。');
    renderApplicationSummary(container, result);
    // 把结果写回本地列表，避免重新渲染时又变回旧内容
    if (application) {
      application.aiSummary = { mock: result.mock, mode: result.mode, steps: result.steps, summary: result.summary, cachedAt: result.cachedAt };
      application.aiSummaryStale = false;
    }
    $('[data-ai-summary-stale]')?.remove();
    toast(result.cached ? '已读取上次生成的摘要' : '摘要已保存，下次打开不用重新生成');
  } catch (error) {
    if (container) {
      container.hidden = false;
      container.innerHTML = `<p class="ai-summary-caution">生成摘要失败：${escapeHtml(error.message || '请稍后重试')}</p>`;
    }
  } finally {
    if (button) { button.disabled = false; button.textContent = previous || 'AI 摘要'; }
  }
}
/**
 * 渲染 AI 配置自检结果。
 *
 * 重点是把「配好了」和「真的能用」区分开 —— 光有 Key 不代表接口通，
 * 所以除了是否配置，还要显示向量维度、耗时和语义方向是否正常。
 */
function renderDiagnoseResult(container, report) {
  if (!container) return;
  const embedding = report?.embedding || null;
  const items = [
    { label: '对话模型（DeepSeek）', ok: Boolean(report?.deepseek?.configured), text: report?.deepseek?.configured ? '已配置' : '未配置 —— AI 匹配助手运行在演示模式' },
    { label: '向量与图像（TokenHub）', ok: Boolean(report?.tokenhub?.configured), text: report?.tokenhub?.configured ? '已配置' : '未配置 —— 暂时只能按关键词检索' }
  ];
  if (embedding) {
    items.push({
      label: '向量接口连通性',
      ok: Boolean(embedding.ok),
      text: embedding.ok
        ? `${embedding.model}，${embedding.dimension} 维，耗时 ${embedding.elapsedMs}ms`
        : `调用失败：${embedding.message || '原因未知'}`
    });
    if (embedding.ok) {
      items.push({
        label: '语义方向',
        ok: embedding.semanticDirectionCorrect === true,
        text: `领养相关两句相似度 ${embedding.relatedScore}，与无关句 ${embedding.unrelatedScore} —— ${embedding.semanticDirectionCorrect ? '方向正确（相关的高于无关的）' : '方向异常，检索结果会不可靠'}`
      });
    }
  }
  if (report?.corpus) {
    items.push({ label: '可检索内容', ok: true, text: `已发布宠物 ${report.corpus.publishedPets} 只，公开照片 ${report.corpus.publicPhotos} 张` });
  }

  container.hidden = false;
  container.innerHTML = `
    <ul class="ai-fit-list">
      ${items.map(item => `
        <li class="ai-fit-row ${item.ok ? 'is-ok' : 'is-bad'}">
          <span class="ai-fit-status">${item.ok ? '正常' : '待办'}</span>
          <strong>${escapeHtml(item.label)}</strong>
          <span class="ai-fit-note">${escapeHtml(item.text)}</span>
        </li>`).join('')}
    </ul>`;
}
async function handleDiagnoseAi(button) {
  const container = $('[data-diagnose-result]');
  const previous = button?.textContent;
  if (button) { button.disabled = true; button.textContent = '检查中…'; }
  try {
    const result = await callYardApi({ action: 'admin.ai.diagnose' });
    if (result?.ok !== true) throw new Error(result?.message || '自检失败。');
    renderDiagnoseResult(container, result);
  } catch (error) {
    if (container) {
      container.hidden = false;
      container.innerHTML = `<p class="ai-summary-caution">自检失败：${escapeHtml(error.message || '请稍后重试')}</p>`;
    }
  } finally {
    if (button) { button.disabled = false; button.textContent = previous || '检查 AI 配置'; }
  }
}
/**
 * 把本地图片压缩成 data URL。
 *
 * 为什么要压：原图动辄几 MB，转成 base64 会更大，请求体直接超限。
 * 视觉模型也不需要那么高的分辨率，压到 768px、JPEG 0.82 足够看清毛色与体型，
 * 体积从几 MB 降到几十 KB。
 */
function downscaleImageToDataUrl(file, maxSize = 768) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败。'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('这个文件不是能识别的图片格式。'));
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width || 1, image.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((image.width || 1) * scale));
        canvas.height = Math.max(1, Math.round((image.height || 1) * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

async function handleDescribePhoto(button) {
  const file = $('#petCoverFile')?.files?.[0];
  if (!file) {
    toast('请先选择封面照片，再点「用封面照片自动写一段」。');
    return;
  }
  const form = button.closest('form');
  const textarea = form?.querySelector('textarea[name="description"]');
  const previous = button.textContent;
  button.disabled = true;
  button.textContent = '正在读照片…';
  try {
    const image = await downscaleImageToDataUrl(file);
    const species = form?.querySelector('select[name="petType"]')?.value || '';
    const result = await callYardApi({ action: 'admin.pet.describePhoto', image, species });
    if (result?.ok !== true) throw new Error(result?.message || '识别失败。');
    if (textarea) {
      textarea.value = result.description;
      textarea.focus();
    }
    toast('已写入描述，请按实际情况修改后再保存');
  } catch (error) {
    toast(error.message || '识别失败，请稍后重试。');
  } finally {
    button.disabled = false;
    button.textContent = previous || '用封面照片自动写一段';
  }
}

async function handleApplicationDelete(id) {
  const application = adminApplications().find(item => item.id === id);
  if (!application) { toast('没有找到这条申请，请刷新管理员后台后重试。'); return; }
  const petName = application.petName || petById(application.petId)?.name || '对应宠物';
  const confirmed = window.confirm(`确定删除“${application.name}”提交给“${petName}”的申请吗？\n\n申请资料、内部备注和处理历史都会被删除，且无法恢复。`);
  if (!confirmed) return;
  try {
    const isCloudInbox = Array.isArray(cloudApplications);
    if (cloudState.connected && adminAuthUser && !isCloudInbox) {
      throw new Error('暂时无法读取云端申请记录，请刷新管理员后台后再删除。');
    }
    if (isCloudInbox) {
      // 走云函数的特权通道删除，而不是前端直接删数据库：
      // 删除不可逆，摆在服务端能明确鉴权，也能确认"确实删掉了"。
      const result = await callYardApi({ action: 'admin.application.delete', applicationId: id });
      if (result?.ok !== true) throw new Error(result?.message || '云端申请删除失败。');
      cloudApplications = cloudApplications.filter(item => item.id !== id);
    }
    applications = applications.filter(item => item.id !== id);
    saveApplications();
    renderStats();
    renderAdmin();
    toast(isCloudInbox ? '申请记录已删除' : '申请记录已从本地删除');
  } catch (error) {
    toast(error.message || '申请记录删除失败，请稍后重试。');
  }
}
async function handlePetSave(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  const id = form.dataset.petId;
  const oldPet = id ? petById(id) : null;
  const oldMedia = oldPet ? mediaItems(oldPet) : [];
  const keptIds = new Set(formData.getAll('keepMedia').map(String));
  const keptMedia = oldPet ? oldMedia.filter(item => keptIds.has(String(item.id))) : [];
  const coverFile = pendingCoverFile;
  const galleryFiles = pendingGalleryFiles;
  const videoFiles = $('#petVideoFiles')?.files || [];
  try {
    const petId = id || `pet-${Date.now()}`;
    const [coverUpload, galleryUploads, videoUploads] = await Promise.all([
      coverFile ? readFilesAsMedia([coverFile], 'image', petId) : Promise.resolve([]),
      readFilesAsMedia(galleryFiles, 'image', petId),
      readFilesAsMedia(videoFiles, 'video', petId)
    ]);
    const oldCover = oldPet ? coverMedia(oldPet) : null;
    const selectedExistingCover = keptMedia.find(item => item.id === data.coverMediaId && item.type === 'image');
    const coverLink = String(data.coverImage || '').trim();
    const coverLinkChanged = Boolean(coverLink && coverLink !== mediaUrl(oldCover));
    const linkedCover = coverLinkChanged ? { id: makeMediaId(), type: 'image', url: coverLink, isCover: true, caption: '封面照片' } : null;
    const fallbackExistingCover = keptMedia.find(item => item.isCover && item.type === 'image') || keptMedia.find(item => item.type === 'image');
    const uploadedGalleryCover = galleryUploads.find(item => item.type === 'image');
    const cover = coverUpload[0] || linkedCover || selectedExistingCover || fallbackExistingCover || uploadedGalleryCover;
    if (!cover) {
      toast('请至少保留一张照片，或上传一张新的封面照片');
      return;
    }
    const candidates = [
      { ...cover, type: 'image', isCover: true, caption: cover.caption || '封面照片' },
      ...keptMedia.map(item => ({ ...item, isCover: false })),
      ...galleryUploads.map(item => ({ ...item, isCover: false })),
      ...parseMediaLinks(data.videoLinks, 'video'),
      ...videoUploads
    ];
    const seen = new Set();
    const media = candidates.filter(item => {
      const key = item.storageId ? `storage:${item.storageId}` : item.url ? `url:${item.url}` : `id:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(item.url || item.storageId);
    }).slice(0, 16).map((item, index) => ({ ...item, isCover: index === 0 }));
    const finalCover = media[0];
    const object = {
      id: petId,
      name: data.name.trim(), type: data.type, status: data.status, age: data.age.trim(), gender: data.gender,
      image: finalCover.storageId ? '' : finalCover.url, video: media.find(item => item.type === 'video')?.url || '', media, tags: id ? (oldPet?.tags || []) : ['新档案'],
      description: data.description.trim(), health: data.health.trim(), requirements: data.requirements.trim(), reason: data.reason.trim(), updates: id ? (oldPet?.updates || []) : []
    };
    if (id) pets = pets.map(pet => pet.id === id ? object : pet); else pets.unshift(object);
    const cloudSaved = await savePetTextToCloud(object);
    const cloudMediaChanged = object.media.some(item => item.cloudPath) || oldMedia.some(item => item.cloudPath);
    if (cloudMediaChanged) await syncCloudMedia(object, oldMedia);
    savePets();
    const remainingStorageIds = new Set(media.map(item => item.storageId).filter(Boolean));
    const removedLocalMedia = oldMedia.filter(item => item.storageId && !remainingStorageIds.has(item.storageId));
    await Promise.allSettled(removedLocalMedia.map(async item => {
      await mediaDb.delete(item.storageId);
      if (item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url);
    }));
    pendingCoverFile = null;
    pendingGalleryFiles = [];
    adminEditing = null; renderAll(); renderAdmin(); toast(cloudSaved ? (id ? '宠物档案和影像记录已同步到云端' : '新的宠物档案已同步到云端') : (id ? '宠物档案和影像记录已保存到本地' : '新的宠物档案已保存到本地'));
  } catch (error) {
    toast(error.message || '部分文件无法读取，请检查图片或视频格式和大小');
  }
}
function renderAll() {
  document.body.classList.toggle('public-data-loading', publicDataSource === 'loading');
  renderFeaturedPetCards(); renderStats(); renderContact(); renderPets(); renderHomePets(); renderStories();
}

function setFilter(group, value) {
  filters[group] = value;
  $$(`[data-filter="${group}"]`).forEach(button => {
    const isActive = button.dataset.value === value;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  renderPets();
}

document.addEventListener('change', event => {
  const input = event.target;
  if (input.id === 'petCoverFile' || input.id === 'petGalleryFiles') {
    const files = [...input.files];
    input.value = '';
    startPhotoCrop(files, input.id === 'petCoverFile' ? 'cover' : 'gallery');
  }
});
document.addEventListener('click', event => {
  const galleryTarget = event.target.closest('[data-gallery-pet]');
  if (galleryTarget) { switchGallery(galleryTarget.dataset.galleryPet, Number(galleryTarget.dataset.galleryIndex)); return; }
  const petTarget = event.target.closest('[data-open-pet]');
  if (petTarget) { openPetDetail(petTarget.dataset.openPet); return; }
  const applyTarget = event.target.closest('[data-apply-pet]');
  if (applyTarget) { openApplicationForm(applyTarget.dataset.applyPet, applyTarget.dataset.applicationKind); return; }
  if (event.target.closest('[data-close-modal]')) { closeModal(); return; }
  if (event.target.closest('[data-contact-open]')) { openContactModal(); return; }
  if (event.target.closest('[data-scroll-updates]')) {
    closeModal();
    if (SITE_PAGE === 'stories') $('#storiesGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.location.assign('stories.html');
    return;
  }
  const filterButton = event.target.closest('[data-filter]');
  if (filterButton) { setFilter(filterButton.dataset.filter, filterButton.dataset.value); return; }
  const deleteApplicationButton = event.target.closest('[data-delete-application]');
  if (deleteApplicationButton) { handleApplicationDelete(deleteApplicationButton.dataset.deleteApplication); return; }
  const summarizeButton = event.target.closest('[data-summarize-application]');
  if (summarizeButton) { handleApplicationSummarize(summarizeButton.dataset.summarizeApplication, summarizeButton); return; }
  if (event.target.closest('[data-diagnose-ai]')) { handleDiagnoseAi(event.target.closest('[data-diagnose-ai]')); return; }
  const describeButton = event.target.closest('[data-describe-photo]');
  if (describeButton) { handleDescribePhoto(describeButton); return; }
  const photoAsk = event.target.closest('[data-match-photo-ask]');
  if (photoAsk) {
    const name = photoAsk.dataset.matchPhotoAsk;
    if (name) matchAsk(`我看到一张照片，很像${name}。能介绍一下它吗？我适合养它吗？`);
    return;
  }
  const deletePetButton = event.target.closest('[data-delete-pet]');
  if (deletePetButton) { handlePetDelete(deletePetButton.dataset.deletePet); return; }
  if (event.target.closest('[data-admin-login]')) { openAdmin(); return; }
  if (event.target.closest('#footerEditApplication')) { openMyApplicationEditor(); return; }
  if (event.target.closest('[data-open-my-application]')) { openMyApplicationEditor(); return; }
  if (event.target.closest('[data-dismiss-applicant-notice]')) { dismissApplicantEditBanner(); return; }
  if (event.target.closest('[data-copy-edit-token]')) { copyEditToken(); return; }
  if (event.target.closest('[data-edit-with-token]')) { openMyApplicationEditor(); return; }
  if (event.target.closest('#contactButton')) { openContactModal(); return; }
  if (event.target.closest('#closeAdmin')) { resetPendingPhotoSelection(); closeAdmin(); return; }
  const adminTabButton = event.target.closest('[data-admin-tab]');
  if (adminTabButton) {
    event.preventDefault();
    if (!adminAccessGranted) { openAdmin(); return; }
    changeAdminTab(adminTabButton.dataset.adminTab);
  }
});

$('#modalBackdrop')?.addEventListener('click', event => { if (event.target === $('#modalBackdrop')) { if (cropState) cancelPhotoCrop(); else closeModal(); } });
$('#adminBackdrop')?.addEventListener('click', event => { if (SITE_PAGE !== 'admin' && event.target === $('#adminBackdrop')) closeAdmin(); });

document.addEventListener('submit', async event => {
  if (event.target.id !== 'adminLoginForm') return;
  event.preventDefault();
  if (LOCAL_REVIEW) { closeModal(); await openAdmin(); return; }
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  if (!cloudApp) { openAdminLogin('云端登录组件尚未加载，请刷新页面后重试。'); return; }
  try {
    const result = await cloudApp.auth().signInWithPassword({ username: String(data.username || '').trim(), password: String(data.password || '') });
    if (result?.error) { openAdminLogin(result.error.message || '用户名或密码不正确。'); return; }
    if (!(await ensureAdminAccess())) return;
    closeModal();
    await openAdmin();
  } catch (error) {
    openAdminLogin(error.message || '登录暂时不可用，请稍后重试。');
  }
});
async function ensurePublicApplicationSession() {
  if (!cloudApp?.auth) throw new Error('云端申请服务尚未就绪，请稍后再试。');
  if (publicApplicationAuthPromise) return publicApplicationAuthPromise;
  publicApplicationAuthPromise = (async () => {
    try {
      const currentUser = await cloudApp.auth().getCurrentUser?.();
      if (currentUser) return;
      const result = await cloudApp.auth().signInAnonymously();
      if (result?.error) throw new Error(result.error.message || '匿名登录失败。');
    } catch (error) {
      publicApplicationAuthPromise = null;
      throw error;
    }
  })();
  return publicApplicationAuthPromise;
}
async function callYardApi(data) {
  if (LOCAL_REVIEW) throw new Error('本地审核版未连接云端，这项操作暂不可用。填写的资料不会发送或同步到线上。');
  if (!cloudState.connected || !cloudApp?.callFunction) throw new Error('云端连接尚未就绪，请稍后再试。');
  try { await ensurePublicApplicationSession(); }
  // 保留原始错误作为 cause：访客看到的仍是通用提示，但排查时能在控制台看到真实原因。
  catch (error) { throw new Error('申请服务暂未启用，请稍后再试。', { cause: error }); }
  const response = await cloudApp.callFunction({ name: 'yard-api', parse: true, data });
  const result = typeof response?.result === 'string' ? JSON.parse(response.result) : response?.result;
  if (!result) throw new Error('申请服务返回异常，请稍后再试。');
  return result;
}
async function submitApplicationThroughFunction(form, pet, data, kind) {
  const result = await callYardApi({
    action: 'application.submit',
    petId: pet.id,
    applicationType: kind,
    name: data.name,
    age: data.age,
    gender: data.gender,
    contact: data.contact,
    hasChengduHome: data.home === '是',
    experience: data.experience,
    familyAgreement: data.family,
    otherPets: data.otherPets,
    note: data.note,
    website: data.website,
    formStartedAt: Number(form.dataset.startedAt || 0),
    browserToken: browserApplicationToken()
  });
  if (!result.ok) throw new Error(result.message || '申请提交失败，请稍后重试。');
  return result;
}
function selectOptions(options, current) {
  return options.map(option => `<option${option === current ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('');
}
function rememberEditToken(applicationId, token) {
  if (!applicationId || !token) return;
  const all = store.get(EDIT_TOKEN_KEY, {});
  all[applicationId] = { token, savedAt: new Date().toISOString() };
  const entries = Object.entries(all).sort((a, b) => String(b[1].savedAt).localeCompare(String(a[1].savedAt))).slice(0, 5);
  store.set(EDIT_TOKEN_KEY, Object.fromEntries(entries));
}
function latestEditToken() {
  const all = store.get(EDIT_TOKEN_KEY, {});
  const entries = Object.entries(all).sort((a, b) => String(b[1].savedAt).localeCompare(String(a[1].savedAt)));
  return entries.length ? entries[0][1].token : '';
}
/**
 * 主路径：同一台设备上不需要申请人看到任何凭证。
 * 直接用本机记住的令牌取回资料并打开修改表单。
 */
async function openMyApplicationEditor() {
  const token = latestEditToken();
  if (!token) { openEditTokenModal(''); return; }
  const button = $('#applicantNotice button');
  if (button) { button.disabled = true; }
  try {
    const result = await callYardApi({ action: 'application.lookup', token });
    if (!result.ok) throw new Error(result.message || '修改凭证无效。');
    openApplicationEditForm(result, token);
  } catch (error) {
    toast(`${error.message || '修改凭证校验失败'} 也可以直接联系管理员帮你改。`);
  } finally {
    if (button) { button.disabled = false; }
  }
}
function renderApplicantEditBanner() {
  const host = $('#applicantNotice');
  if (!host) return;
  const dismissed = store.get(EDIT_NOTICE_DISMISSED_KEY, false);
  if (!latestEditToken() || dismissed) { host.hidden = true; host.innerHTML = ''; return; }
  host.innerHTML = `<div class="applicant-notice">
    <div class="applicant-notice-copy">
      <strong>你在这台设备上提交过申请</strong>
      <p>如果资料填错了，现在可以直接修改，不需要再去找修改凭证。</p>
    </div>
    <div class="applicant-notice-actions">
      <button class="button button-primary" type="button" data-open-my-application>修改我的申请</button>
      <button class="text-link" type="button" data-dismiss-applicant-notice>暂时不用</button>
    </div>
  </div>`;
  host.hidden = false;
}
function dismissApplicantEditBanner() {
  store.set(EDIT_NOTICE_DISMISSED_KEY, true);
  renderApplicantEditBanner();
}
function openApplicationSuccessModal(pet, kind, result) {
  const isAppointment = kind === '预约申请';
  const token = String(result.editToken || '');
  openModal(`
    <div class="form-modal">
      <div class="form-modal-header">
        <div><h2 id="modalTitle">${isAppointment ? '预约已登记' : '申请已提交'}</h2><p>${isAppointment ? `已登记对${escapeHtml(pet.name)}的预约关注。小院开放领养时会优先与你联系。` : `已收到你对${escapeHtml(pet.name)}的领养申请。我们会认真阅读，并在合适时和你沟通。`}</p></div>
        <button class="modal-close" data-close-modal aria-label="关闭"><svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
      ${token ? `<div class="edit-token-box">
        <p class="edit-token-title">资料修改凭证</p>
        <p class="edit-token-value" id="editTokenValue">${escapeHtml(token)}</p>
        <div class="edit-token-actions">
          <button class="button button-primary" type="button" data-copy-edit-token>复制凭证</button>
          <button class="button button-ghost" type="button" data-edit-with-token>现在修改资料</button>
        </div>
        <p class="form-hint">如果刚才有填错的地方，可以用这串凭证在 24 小时内自行修改（意向宠物和申请类型不能改）。凭证只在这里显示一次，这一台浏览器已经帮你记住；换设备时请自己存好，丢失后请联系管理员。</p>
      </div>` : ''}
    </div>`);
}
function openEditTokenModal(prefill = '') {
  openModal(`
    <div class="form-modal">
      <div class="form-modal-header">
        <div><h2 id="modalTitle">修改我的申请</h2><p>请输入提交申请时拿到的资料修改凭证。</p></div>
        <button class="modal-close" data-close-modal aria-label="关闭"><svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
      <form id="editTokenForm">
        <div class="field"><label for="editTokenInput">资料修改凭证</label><input id="editTokenInput" name="token" value="${escapeHtml(prefill)}" autocomplete="off" required /></div>
        <p class="form-hint">凭证在申请提交成功后显示，24 小时内有效。为保护隐私，不能只凭手机号或姓名找回。</p>
        <button class="button button-primary form-submit" type="submit">查看并修改</button>
      </form>
    </div>`);
}
function openApplicationEditForm(application, token) {
  const pet = petById(application.petId);
  openModal(`
    <div class="form-modal">
      <div class="form-modal-header">
        <div><h2 id="modalTitle">修改申请资料</h2><p>意向宠物「${escapeHtml(pet?.name || '未知')}」和申请类型「${escapeHtml(application.applicationType || '')}」不能自行修改；如需变更请联系管理员。</p></div>
        <button class="modal-close" data-close-modal aria-label="关闭"><svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
      <form id="applicationEditForm" data-token="${escapeHtml(token)}">
        <div class="form-grid">
          <div class="field"><label for="editName">姓名</label><input id="editName" name="name" value="${escapeHtml(application.name || '')}" required autocomplete="name" /></div>
          <div class="field"><label for="editAge">年龄</label><input id="editAge" name="age" value="${escapeHtml(String(application.age ?? ''))}" inputmode="numeric" required /></div>
          <div class="field"><label for="editGender">性别</label><select id="editGender" name="gender" required><option value="">请选择</option>${selectOptions(['女', '男', '不方便说明'], application.gender)}</select></div>
          <div class="field"><label for="editContact">联系方式</label><input id="editContact" name="contact" value="${escapeHtml(application.contact || '')}" required placeholder="微信或手机号码" /></div>
          <div class="field"><label for="editHome">是否在成都及周边有住所</label><select id="editHome" name="home" required><option value="">请选择</option>${selectOptions(['是', '否'], application.hasChengduHome ? '是' : '否')}</select></div>
          <div class="field"><label for="editExperience">是否有养宠经验</label><select id="editExperience" name="experience" required><option value="">请选择</option>${selectOptions(['有', '没有', '正在了解'], application.experience)}</select></div>
          <div class="field"><label for="editFamily">家庭成员是否同意</label><select id="editFamily" name="family" required><option value="">请选择</option>${selectOptions(['全部同意', '部分同意', '尚未沟通'], application.familyAgreement)}</select></div>
          <div class="field"><label for="editOtherPets">是否有其他宠物</label><select id="editOtherPets" name="otherPets" required><option value="">请选择</option>${selectOptions(['没有', '有猫', '有狗', '有其他宠物'], application.otherPets)}</select></div>
          <div class="field full"><label for="editNote">补充说明（可选）</label><textarea id="editNote" name="note">${escapeHtml(application.note || '')}</textarea></div>
        </div>
        <p class="form-hint">这些资料仅供成都猫狗小院管理员沟通领养或预约使用，不会在网站公开。</p>
        <button class="button button-primary form-submit" type="submit">保存修改</button>
      </form>
    </div>`);
}
async function copyEditToken() {
  const value = $('#editTokenValue')?.textContent || '';
  if (!value) return;
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); toast('凭证已复制到剪贴板。'); return; }
  } catch { /* 剪贴板不可用时退回手动选择 */ }
  const range = document.createRange();
  range.selectNodeContents($('#editTokenValue'));
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  toast('已选中凭证，请手动复制。');
}
document.addEventListener('submit', async event => {
  if (event.target.id !== 'applicationForm') return;
  event.preventDefault();
  const form = event.target;
  const pet = petById(form.dataset.petId);
  if (!pet) return;
  const data = Object.fromEntries(new FormData(form));
  const kind = form.dataset.kind;
  const button = $('button[type="submit"]', form);
  const previousLabel = button?.textContent;
  if (button?.disabled) return;
  if (button) { button.disabled = true; button.textContent = '正在提交...'; }
  try {
    const result = await submitApplicationThroughFunction(form, pet, data, kind);
    applications.unshift({
      id: result.applicationId, petId: pet.id, petName: pet.name, kind,
      status: kind === '预约申请' ? '已登记' : '未处理', ...data,
      createdAt: new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date())
    });
    saveApplications(); renderStats();
    rememberEditToken(result.applicationId, result.editToken);
    store.set(EDIT_NOTICE_DISMISSED_KEY, false);
    renderApplicantEditBanner();
    openApplicationSuccessModal(pet, kind, result);
  } catch (error) {
    toast(error.message || '申请提交失败，请稍后重试。');
  } finally {
    if (button) { button.disabled = false; button.textContent = previousLabel || `提交${kind === '预约申请' ? '预约' : '申请'}`; }
  }
});
document.addEventListener('submit', async event => {
  if (event.target.id !== 'editTokenForm') return;
  event.preventDefault();
  const form = event.target;
  const token = String(new FormData(form).get('token') || '').trim();
  const button = $('button[type="submit"]', form);
  const previousLabel = button?.textContent;
  if (button) { button.disabled = true; button.textContent = '正在核对...'; }
  try {
    const result = await callYardApi({ action: 'application.lookup', token });
    if (!result.ok) throw new Error(result.message || '修改凭证无效。');
    openApplicationEditForm(result, token);
  } catch (error) {
    toast(error.message || '修改凭证校验失败，请稍后重试。');
  } finally {
    if (button) { button.disabled = false; button.textContent = previousLabel || '查看并修改'; }
  }
});
document.addEventListener('submit', async event => {
  if (event.target.id !== 'applicationEditForm') return;
  event.preventDefault();
  const form = event.target;
  const token = form.dataset.token || '';
  const data = Object.fromEntries(new FormData(form));
  const button = $('button[type="submit"]', form);
  const previousLabel = button?.textContent;
  if (button?.disabled) return;
  if (button) { button.disabled = true; button.textContent = '正在保存...'; }
  try {
    const result = await callYardApi({
      action: 'application.edit',
      token,
      name: data.name,
      age: data.age,
      gender: data.gender,
      contact: data.contact,
      hasChengduHome: data.home === '是',
      experience: data.experience,
      familyAgreement: data.family,
      otherPets: data.otherPets,
      note: data.note
    });
    if (!result.ok) throw new Error(result.message || '申请修改失败，请稍后重试。');
    const index = applications.findIndex(item => item.id === result.applicationId);
    if (index >= 0) { applications[index] = { ...applications[index], ...data }; saveApplications(); }
    closeModal();
    toast('申请资料已更新，管理员看到的就是最新内容。');
  } catch (error) {
    toast(error.message || '申请修改失败，请稍后重试。');
  } finally {
    if (button) { button.disabled = false; button.textContent = previousLabel || '保存修改'; }
  }
});

function closeNavigation(restoreFocus = false) {
  const nav = $('#siteNav');
  const button = $('#menuToggle');
  const wasOpen = nav?.classList.contains('open');
  nav?.classList.remove('open');
  button?.setAttribute('aria-expanded', 'false');
  button?.setAttribute('aria-label', '打开导航');
  if (restoreFocus && wasOpen) button?.focus();
}

$('#menuToggle')?.addEventListener('click', () => {
  const nav = $('#siteNav');
  if (!nav) return;
  const expanded = nav.classList.toggle('open');
  $('#menuToggle')?.setAttribute('aria-expanded', String(expanded));
  $('#menuToggle')?.setAttribute('aria-label', expanded ? '关闭导航' : '打开导航');
});
$$('#siteNav a').forEach(link => link.addEventListener('click', () => closeNavigation()));
window.addEventListener('scroll', () => $('.site-header')?.classList.toggle('scrolled', window.scrollY > 10), { passive: true });
window.addEventListener('popstate', () => {
  if (SITE_PAGE === 'admin') changeAdminTab(adminTabFromUrl(), false);
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const modalBackdrop = $('#modalBackdrop');
  const adminBackdrop = $('#adminBackdrop');
  if (modalBackdrop && !modalBackdrop.classList.contains('hidden')) {
    if (cropState) cancelPhotoCrop();
    else closeModal();
  } else if ($('#siteNav')?.classList.contains('open')) {
    closeNavigation(true);
  } else if (SITE_PAGE !== 'admin' && adminBackdrop && !adminBackdrop.classList.contains('hidden')) {
    closeAdmin();
  }
});

/* ── AI 领养匹配助手 ──────────────────────────────────────────
   对接云函数 ai-stream（HTTP 云函数，SSE 流式）。
   设计要点：
     1. 密钥不经过前端 —— 前端只调用我们自己的云函数，大模型 Key 存在服务端；
     2. 流式渲染 —— 用 ReadableStream 逐块解析 SSE，边生成边显示；
     3. 可中断 —— 用 AbortController，用户点「重新开始」立刻停止；
     4. 失败不白屏 —— 任何异常都落到一条可读的错误气泡，不影响页面其他功能。 */
const AI_MATCH_ENDPOINT = 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.ap-shanghai.app.tcloudbase.com/ai-stream/chat';
const MATCH_MAX_TURNS = 8;
const MATCH_EXAMPLES = [
  ['和家人同住，白天有人', '我和家人一起住，白天有人在家，有养猫经验，想找一只性格温和的狗狗。'],
  ['租房，第一次养', '我租房住，房东同意养宠物。平时上班八小时，周末基本在家，之前没养过猫。'],
  ['家里已有一只猫', '家里已经有一只三岁的猫咪，想再领养一只性格温和、能和人相处的狗狗。']
];
const matchState = { messages: [], streaming: false, controller: null };

function matchWelcomeHtml() {
  const chips = MATCH_EXAMPLES.map(([label, example]) =>
    `<button type="button" class="match-chip" data-match-example="${escapeHtml(example)}">${escapeHtml(label)}</button>`
  ).join('');
  return `<div class="match-welcome" id="matchWelcome">
      <p>你好，我是小院的 AI 匹配助手。直接说说你的情况就行，也可以先点下面的例子：</p>
      <div class="match-chips">${chips}</div>
    </div>`;
}

function matchElements() {
  return {
    thread: $('#matchThread'),
    form: $('#matchForm'),
    input: $('#matchInput'),
    submit: $('#matchSubmit'),
    reset: $('#matchReset')
  };
}

/** 追加一条气泡并滚到底部；返回该元素以便流式更新。 */
function matchAppend(role, text) {
  const { thread } = matchElements();
  if (!thread) return null;
  $('#matchWelcome')?.remove();
  const bubble = document.createElement('div');
  bubble.className = `match-bubble is-${role}`;
  bubble.textContent = text;
  thread.appendChild(bubble);
  thread.scrollTop = thread.scrollHeight;
  return bubble;
}

function matchSetBusy(busy) {
  const { submit, input, reset } = matchElements();
  if (submit) {
    submit.disabled = busy;
    submit.textContent = busy ? '正在思考…' : (matchState.messages.length ? '继续提问' : '开始匹配');
  }
  if (input) input.disabled = busy;
  if (reset && matchState.messages.length) reset.hidden = false;
}

/**
 * 显示/隐藏「演示模式」提示。
 *
 * 云函数在未配置模型 Key 时会回一条 meta 事件（mock: true），
 * 此时回复由内置示例生成。必须如实告知访客，不能让人误以为是真实模型回答。
 */
function matchSetModeHint(mock) {
  const hint = $('#matchModeHint');
  if (!hint) return;
  hint.hidden = !mock;
  hint.textContent = mock
    ? '演示模式：小院尚未配置模型 API Key，以下回复由内置示例生成，未调用真实模型。'
    : '';
}

/**
 * 显示 AI 正在查询什么。
 *
 * AI 会自己调用工具查数据，每次查询一到两秒。这段时间如果页面毫无反应，
 * 访客会以为卡住了；把「正在查找宠物档案」显示出来，等待就不再是黑箱。
 * 这也是评分细则里「AI 思考状态可视化」的落点。
 */
const MATCH_TOOL_LABELS = {
  search_knowledge: '正在按语义检索小院资料',
  search_pets: '正在查找宠物档案',
  get_pet_profile: '正在读取宠物档案',
  get_adoption_policy: '正在查领养政策',
  get_follow_up_history: '正在查回访记录',
  check_requirement_gaps: '正在比对领养要求'
};

function matchSetToolStatus(text) {
  const { thread } = matchElements();
  if (!thread) return;
  const existing = $('#matchToolStatus');
  if (!text) { existing?.remove(); return; }
  const node = existing || document.createElement('div');
  if (!existing) {
    node.id = 'matchToolStatus';
    node.className = 'match-tool-status';
    thread.appendChild(node);
  }
  node.textContent = text;
  thread.scrollTop = thread.scrollHeight;
}

/**
 * 在回答下方列出 AI 检索到的资料出处。
 *
 * 用途有两层：访客能自己核对 AI 说的对不对；管理员也能看出
 * "回答不准"是因为资料缺失还是检索没命中。
 */
function matchAppendSources(items) {
  const { thread } = matchElements();
  const labels = (items || []).map(item => String(item || '').trim()).filter(Boolean).slice(0, 6);
  if (!thread || !labels.length) return;
  const node = document.createElement('div');
  node.className = 'match-sources';
  node.innerHTML = `<span class="match-sources-label">依据</span>${labels
    .map(label => `<span class="match-source-item">${escapeHtml(label)}</span>`)
    .join('')}`;
  thread.appendChild(node);
  thread.scrollTop = thread.scrollHeight;
}

/**
 * 语音输入（浏览器原生 Web Speech API）。
 *
 * 为什么值得做：小院会遇到不擅长打字的申请人——代码里早就有一句注释
 * 写着「上了年纪的申请人自己改不动网站」。让他们用说的，比逼他们打字现实得多。
 *
 * 几点取舍：
 *   - 用浏览器提供的识别接口，无需站点额外密钥；浏览器自身可能连接语音服务，
 *     因此本地审核模式不启动识别；
 *   - 识别结果直接追加到输入框，申请人可以在发送前自己修改——
 *     语音识别会出错，不能识别完就替他发出去；
 *   - 本地审核和不支持的浏览器仍展示入口，但说明为何不可用。
 */
const matchVoiceState = { recognition: null, listening: false, baseText: '' };

function matchVoiceSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function matchVoiceSetLabel(listening) {
  const button = $('#matchVoice');
  const label = $('#matchVoiceText');
  if (button) {
    button.classList.toggle('is-listening', listening);
    button.setAttribute('aria-pressed', listening ? 'true' : 'false');
  }
  if (label) label.textContent = listening ? '正在听…' : '语音输入';
}

function matchVoiceStop() {
  matchVoiceState.recognition?.stop();
  matchVoiceSetLabel(false);
}

function initMatchVoice() {
  const button = $('#matchVoice');
  if (!button) return;
  const hint = $('#matchVoiceHint');
  // Browser speech recognition may use a remote service; keep local review isolated.
  const unavailableReason = LOCAL_REVIEW
    ? '本地审核不会调用浏览器语音识别服务；正式使用时可在受支持的浏览器中启用。'
    : (!matchVoiceSupported() ? '当前浏览器不支持语音输入，可以直接打字。' : '');
  button.disabled = Boolean(unavailableReason);
  if (hint) {
    hint.hidden = !unavailableReason;
    hint.textContent = unavailableReason;
  }
  if (unavailableReason) return;
  button.addEventListener('click', () => {
    if (matchVoiceState.listening) { matchVoiceStop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;
    const input = $('#matchInput');
    matchVoiceState.baseText = String(input?.value || '').trim();
    matchVoiceState.recognition = recognition;
    matchVoiceState.listening = true;
    matchVoiceSetLabel(true);

    recognition.onresult = event => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      if (input) {
        input.value = [matchVoiceState.baseText, transcript.trim()].filter(Boolean).join(' ').slice(0, 600);
      }
    };
    recognition.onerror = event => {
      matchVoiceState.listening = false;
      matchVoiceSetLabel(false);
      const reason = event?.error === 'not-allowed'
        ? '浏览器没有麦克风权限，请在地址栏允许后重试。'
        : '语音识别没能启动，可以直接打字。';
      toast(reason);
    };
    recognition.onend = () => {
      matchVoiceState.listening = false;
      matchVoiceSetLabel(false);
    };
    try {
      recognition.start();
    } catch {
      matchVoiceState.listening = false;
      matchVoiceSetLabel(false);
      toast('语音识别没能启动，可以直接打字。');
    }
  });
}

/**
 * 给回答加一个「朗读」入口。
 *
 * 手机上看长回答费眼，读出来更省事；对视力不好的申请人也友好。
 * 同样用浏览器原生能力，不依赖任何外部服务。
 */
function matchAppendSpeak(text) {
  const { thread } = matchElements();
  if (!thread || !text || !window.speechSynthesis) return;
  const row = document.createElement('div');
  row.className = 'match-sources';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'match-speak';
  button.textContent = '朗读这段回答';
  button.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    button.textContent = '朗读中…';
    utterance.onend = () => { button.textContent = '朗读这段回答'; };
    utterance.onerror = () => { button.textContent = '朗读这段回答'; };
    window.speechSynthesis.speak(utterance);
  });
  row.appendChild(button);
  thread.appendChild(row);
  thread.scrollTop = thread.scrollHeight;
}

/**
 * 以图搜宠。
 *
 * 为什么值得做：很多人说不清自己想要什么，但能指着一张照片说「就这种」。
 * 描述性需求用文字表达门槛很高，用照片就简单得多。
 *
 * 隐私：访客的照片**只在本机压到 768px 后作为 data URL 发出**，
 * 不写入云存储、不落盘。宠物照片的签名地址由前端提供——
 * 服务端自己拼不出带签名的地址，而且这些地址会过期，
 * 所以每次查询都由前端带当前可用的地址，服务端只在缓存未命中时才用它取图。
 */
const MATCH_PHOTO_ENDPOINT = AI_MATCH_ENDPOINT.replace(/\/chat$/, '/match-photo');

/** 收集当前可用的宠物照片（含稳定的 storage_path 与当前有效的签名地址）。 */
function collectPetPhotos() {
  const list = [];
  for (const pet of pets || []) {
    for (const item of pet.media || []) {
      if (!item.cloudPath || !item.url || item.type !== 'image') continue;
      list.push({ path: item.cloudPath, url: item.url, petId: pet.id, petName: pet.name, isCover: Boolean(item.isCover) });
    }
  }
  return list.slice(0, 40);
}

function renderPhotoMatches(container, result) {
  if (!container) return;
  const hint = result?.hint || '';
  const matches = (result?.matches || []).filter(item => item.petId);
  if (!matches.length) {
    container.hidden = false;
    container.innerHTML = `<p class="match-photo-empty">${escapeHtml(hint || '没有找到画面接近的宠物。')}</p>`;
    return;
  }
  container.hidden = false;
  container.innerHTML = `
    <p class="match-photo-lead">画面最接近的 ${matches.length} 只：</p>
    ${matches.map(item => {
      const pet = petById(item.petId);
      const cover = pet ? mediaUrl(coverMedia(pet)) : '';
      return `<div class="match-photo-hit">
        ${cover ? `<img src="${escapeHtml(cover)}" alt="" />` : ''}
        <div>
          <strong>${escapeHtml(item.petName || pet?.name || '')}</strong>
          <p>画面相似度 ${(Number(item.similarity) * 100).toFixed(0)}%</p>
        </div>
        <button class="admin-edit" type="button" data-match-photo-ask="${escapeHtml(item.petName || pet?.name || '')}">问问它</button>
      </div>`;
    }).join('')}
    <p class="match-photo-hint">${escapeHtml(hint)}</p>`;
}

async function handlePhotoSearch(file) {
  const container = $('#matchPhotoResult');
  if (LOCAL_REVIEW) {
    if (container) {
      container.hidden = false;
      container.innerHTML = '<p class="match-photo-empty">本地审核版暂不调用照片比对服务。照片不会上传，审核通过后可恢复云端图搜。</p>';
    }
    return;
  }
  const label = $('#matchPhotoLabel');
  const previous = label?.textContent;
  if (label) label.textContent = '正在比对…';
  if (container) {
    container.hidden = false;
    container.innerHTML = '<p class="match-photo-empty">正在读照片并和站内宠物比对，第一次会稍慢…</p>';
  }
  try {
    const image = await downscaleImageToDataUrl(file);
    const response = await fetch(MATCH_PHOTO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, photos: collectPetPhotos(), topK: 3 })
    });
    const result = await response.json().catch(() => null);
    if (!result) throw new Error(`服务返回无法解析的内容（${response.status}）。`);
    if (result.ok !== true) throw new Error(result.message || '比对失败。');
    // 建索引时单张失败不影响整体，但要让用户知道有几张没成功，
    // 否则"结果少了"会被当成模型不准
    const failed = Array.isArray(result.failures) ? result.failures : [];
    renderPhotoMatches(container, result);
    if (failed.length) {
      const note = document.createElement('p');
      note.className = 'match-photo-hint';
      note.textContent = `有 ${failed.length} 张宠物照片没能建立索引，本次比对未包含它们：${failed.slice(0, 2).join('；')}`;
      container.appendChild(note);
    }
  } catch (error) {
    if (container) {
      container.hidden = false;
      container.innerHTML = `<p class="match-photo-empty">${escapeHtml(error.message || '比对失败，请稍后重试。')}</p>`;
    }
  } finally {
    if (label) label.textContent = previous || '选择一张照片';
  }
}

function initPhotoSearch() {
  const input = $('#matchPhotoFile');
  if (!input) return;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) handlePhotoSearch(file);
    input.value = '';
  });
}

async function matchAsk(preset) {
  const { thread, input } = matchElements();
  if (!thread || matchState.streaming) return;

  const question = String(preset ?? input?.value ?? '').trim();
  if (!question) { input?.focus(); return; }
  if (LOCAL_REVIEW) {
    matchAppend('ai', '本地审核版暂不调用 AI 匹配服务。你可以先查看宠物档案和领养流程，审核通过后再使用云端匹配。');
    input?.focus();
    return;
  }

  matchState.streaming = true;
  if (input) input.value = '';
  matchAppend('user', question);
  matchState.messages.push({ role: 'user', content: question.slice(0, 600) });
  matchSetBusy(true);

  const bubble = matchAppend('ai', '');
  bubble.classList.add('is-pending');
  let answer = '';
  let failure = '';
  const sources = [];

  matchState.controller = new AbortController();
  try {
    const response = await fetch(AI_MATCH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: matchState.messages.slice(-MATCH_MAX_TURNS) }),
      signal: matchState.controller.signal
    });
    if (!response.ok || !response.body) throw new Error(`AI 服务暂时不可用（${response.status}）`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.split('\n').find(item => item.startsWith('data:'));
        if (!line) continue;
        let payload;
        try { payload = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (payload.type === 'delta' && payload.text) {
          matchSetToolStatus(''); // 正文开始输出，撤掉查询提示
          bubble.classList.remove('is-pending');
          answer += payload.text;
          bubble.textContent = answer;
          thread.scrollTop = thread.scrollHeight;
        } else if (payload.type === 'tool') {
          const label = MATCH_TOOL_LABELS[payload.name] || '正在查询';
          matchSetToolStatus(payload.status === 'running' ? `${label}…` : `${label}：${payload.summary || '完成'}`);
        } else if (payload.type === 'sources') {
          for (const item of payload.items || []) {
            const label = String(item || '').trim();
            if (label && !sources.includes(label)) sources.push(label);
          }
        } else if (payload.type === 'meta') {
          matchSetModeHint(Boolean(payload.mock));
        } else if (payload.type === 'error') {
          failure = payload.message || 'AI 服务暂时不可用。';
        }
      }
    }

    bubble.classList.remove('is-pending');
    if (answer) {
      matchState.messages.push({ role: 'assistant', content: answer });
      // 依据放在回答下方：AI 检索到了哪些资料，访客可以自己核对。
      // 不依赖模型在正文里引用——它可能忘了说，而"依据可查"不能靠它自觉。
      matchAppendSources(sources);
      matchAppendSpeak(answer);
    } else {
      bubble.classList.add('is-error');
      bubble.textContent = failure || 'AI 这次没有给出回复，请再试一次。';
    }
  } catch (error) {
    bubble.classList.remove('is-pending');
    bubble.classList.add('is-error');
    bubble.textContent = error?.name === 'AbortError'
      ? '已停止这次回答。'
      : (error?.message || 'AI 服务暂时不可用，请稍后再试。');
  } finally {
    matchSetToolStatus(''); // 收尾时务必清掉查询提示，否则会一直挂在对话里
    matchState.streaming = false;
    matchState.controller = null;
    matchSetBusy(false);
    input?.focus();
  }
}

function resetMatchAssistant() {
  const { thread, reset } = matchElements();
  if (!thread) return;
  matchState.controller?.abort();
  matchState.messages = [];
  thread.innerHTML = matchWelcomeHtml();
  if (reset) reset.hidden = true;
  matchSetBusy(false);
}

function initMatchAssistant() {
  const { thread, form, input, reset } = matchElements();
  if (!thread || !form) return;
  thread.innerHTML = matchWelcomeHtml();
  if (LOCAL_REVIEW) {
    const hint = $('#matchModeHint');
    if (hint) {
      hint.hidden = false;
      hint.textContent = '本地审核：对话和照片不会发送到云端，AI 匹配与照片比对暂不可用。';
    }
  }
  initMatchVoice();
  initPhotoSearch();

  form.addEventListener('submit', event => {
    event.preventDefault();
    matchAsk();
  });

  // 例子按钮用事件委托，避免每次重建欢迎语都要重新绑定
  thread.addEventListener('click', event => {
    const chip = event.target.closest('[data-match-example]');
    if (chip) matchAsk(chip.dataset.matchExample);
  });

  // 回车发送，Shift+回车换行 —— 聊天框的常规预期
  input?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      matchAsk();
    }
  });

  reset?.addEventListener('click', resetMatchAssistant);
}

function redirectLegacyHomeHash() {
  if (SITE_PAGE !== 'home') return false;
  const routes = { '#pets': 'pets.html', '#match': 'match.html', '#how': 'adoption.html', '#stories': 'stories.html', '#about': 'about.html' };
  const route = routes[window.location.hash];
  if (!route) return false;
  window.location.replace(`${route}${window.location.search}`);
  return true;
}

async function initializeSite() {
  if (redirectLegacyHomeHash()) return;
  if (SITE_PAGE === 'admin') {
    adminTab = adminTabFromUrl();
    const url = new URL(window.location.href);
    if (url.searchParams.has('tab') && !ADMIN_TABS.includes(url.searchParams.get('tab'))) {
      url.searchParams.delete('tab');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    renderAdminAccessGate();
  }
  renderAll();
  renderAdminSyncNotice();
  renderApplicantEditBanner();
  initMatchAssistant();
  await window.YARD_CLOUD_READY;
  await loadCloudPublicData();
  startFeaturedPetRotation();
  if (SITE_PAGE === 'admin') await openAdmin();
  const petId = new URL(window.location.href).searchParams.get('pet');
  if (petId && SITE_PAGE !== 'admin') {
    if (petById(petId)) openPetDetail(petId);
    else toast('这份宠物档案暂时不可用，可以在寻找伙伴页面查看当前档案。');
  }
}
initializeSite();
