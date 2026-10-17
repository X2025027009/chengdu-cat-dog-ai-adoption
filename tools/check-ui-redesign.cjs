/**
 * Offline structure checks for the cream-yellow UI refresh.
 * Reads local source files and the approved original dog photo only.
 * Run: node tools/check-ui-redesign.cjs
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pageNames = ['index.html', 'pets.html', 'match.html', 'adoption.html', 'stories.html', 'about.html', 'admin.html'];
const originalPhoto = 'assets/dogs-group-original.jpg';
const originalPhotoSha256 = '67f2f004cfb47b2b3251205132612c5179d55e48fd7deb19d076415e64a4f557';
const requiredIds = {
  'index.html': ['stats', 'homeGroupPhoto', 'homePetsGrid', 'homePetsEmpty', 'heroFeatureImage', 'heroFeatureName', 'heroFeatureDescription', 'heroFeatureButton'],
  'pets.html': ['petGrid', 'emptyState'],
  'match.html': [
    'matchThread',
    'matchForm',
    'matchInput',
    'matchSubmit',
    'matchReset',
    'matchVoice',
    'matchVoiceText',
    'matchVoiceHint',
    'matchPhotoFile',
    'matchPhotoLabel',
    'matchPhotoResult',
    'matchModeHint'
  ],
  'adoption.html': ['how'],
  'stories.html': ['storyFeatureImage', 'storyFeatureLabel', 'storyFeatureHeading', 'storyFeatureDescription', 'storyFeatureButton', 'storiesGrid', 'storiesEmpty'],
  'about.html': ['contactList', 'contactButton', 'contactCard'],
  'admin.html': ['adminBackdrop', 'adminTitle', 'adminContent']
};
const files = Object.fromEntries(pageNames.map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')]));
let passed = 0;
const failures = [];

function check(label, condition) {
  if (condition) passed += 1;
  else failures.push(label);
}

function attributes(source) {
  const result = {};
  const expression = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(expression)) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return result;
}

function tags(source) {
  return [...source.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<([a-z][a-z\d:-]*)\b([^>]*?)>/gi)].map(match => ({
    name: match[1].toLowerCase(),
    attrs: attributes(match[2])
  }));
}

function byId(elements, id) {
  return elements.find(tag => tag.attrs.id === id);
}

function navLinks(html) {
  const nav = [...html.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi)].find(match => attributes(match[1]).id === 'siteNav');
  return nav ? tags(nav[2]).filter(tag => tag.name === 'a') : [];
}

function localPageHref(href) {
  return /^(?:\.\/)?[a-z-]+\.html$/.test(href || '') ? href.replace(/^\.\//, '') : null;
}

function checkSharedPage(name, html) {
  const elements = tags(html);
  const ids = new Set(elements.map(tag => tag.attrs.id).filter(Boolean));
  for (const id of ['main', 'menuToggle', 'siteNav', 'localReviewNotice', 'applicantNotice', 'footerEditApplication', 'modalBackdrop', 'modal', 'toast', ...requiredIds[name]]) {
    check(`${name}: #${id} remains available`, ids.has(id));
  }

  const links = navLinks(html);
  const destinations = links.map(link => localPageHref(link.attrs.href));
  check(`${name}: navigation links to exactly seven local pages`, links.length === pageNames.length && pageNames.every(page => destinations.filter(destination => destination === page).length === 1));
  check(
    `${name}: has a skip link to main`,
    elements.some(tag => tag.name === 'a' && tag.attrs.href === '#main')
  );
  const main = byId(elements, 'main');
  check(`${name}: main landmark is semantic`, main?.name === 'main');
  const dialog = byId(elements, 'modal');
  check(`${name}: shared modal retains dialog semantics`, dialog?.attrs.role === 'dialog' && dialog.attrs['aria-modal'] === 'true');
  return elements;
}

console.log('UI refresh structure checks (local files only)');
const parsed = Object.fromEntries(pageNames.map(name => [name, checkSharedPage(name, files[name])]));
const sectionPhotos = {
  'pets.html': 'assets/real/courtyard-cat.png',
  'match.html': 'assets/real/courtyard-brown-dog.png',
  'adoption.html': 'assets/real/courtyard-white-dog.png',
  'stories.html': 'assets/real/courtyard-black-dog.png',
  'about.html': 'assets/real/courtyard-people-dogs.jpg'
};
for (const [page, asset] of Object.entries(sectionPhotos)) {
  const photo = parsed[page].find(tag => tag.name === 'img' && tag.attrs.src === asset);
  check(`${page}: has its own real section photo with alt text`, Boolean(photo?.attrs.alt?.trim()));
  check(`${page}: section photo exists`, fs.existsSync(path.join(root, asset)));
}
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
for (let number = 1; number <= 8; number += 1) {
  const name = `S${number}-`;
  const asset = fs.readdirSync(path.join(root, 'assets/brand/decor')).find(file => file.startsWith(name));
  check(`decor: ${name} asset is used`, Boolean(asset && css.includes(`assets/brand/decor/${asset}`)));
}

const home = parsed['index.html'];
const groupPhoto = byId(home, 'homeGroupPhoto');
const featurePhoto = byId(home, 'heroFeatureImage');
check('home: fixed group photo uses its own image node', groupPhoto?.name === 'img' && groupPhoto !== featurePhoto);
check('home: group photo points to the approved production asset', groupPhoto?.attrs.src === originalPhoto);
check('home: group photo has descriptive alternative text', Boolean(groupPhoto?.attrs.alt?.trim()) && /狗/.test(groupPhoto.attrs.alt));
check('home: dynamic recommendation remains a separate image', featurePhoto?.name === 'img' && featurePhoto.attrs.src !== originalPhoto);
const photoPath = path.join(root, originalPhoto);
check('home: approved group photo exists in assets', fs.existsSync(photoPath));
if (fs.existsSync(photoPath)) {
  const photo = fs.readFileSync(photoPath);
  // A provenance-only JPEG comment may be prefixed; the original image bytes must remain intact.
  const hasProvenance = photo[2] === 0xff && photo[3] === 0xfe && photo.toString('utf8', 6, 23) === 'impeccable:prompt';
  const originalBytes = hasProvenance ? Buffer.concat([photo.subarray(0, 2), photo.subarray(4 + photo.readUInt16BE(4))]) : photo;
  const hash = crypto.createHash('sha256').update(originalBytes).digest('hex');
  check('home: group photo bytes match the user-provided original after metadata', hash === originalPhotoSha256);
}

const pets = parsed['pets.html'];
for (const [filter, values] of Object.entries({ status: ['待领养', '已领养', '暂不适合领养'], type: ['全部', '猫咪', '狗狗'] })) {
  const available = pets.filter(tag => tag.attrs['data-filter'] === filter).map(tag => tag.attrs['data-value']);
  check(
    `pets: ${filter} filter retains all data values`,
    values.every(value => available.includes(value))
  );
}
check('pets: dynamic grid announces updates', byId(pets, 'petGrid')?.attrs['aria-live'] === 'polite');

const match = parsed['match.html'];
check('match: conversation announces updates', byId(match, 'matchThread')?.attrs['aria-live'] === 'polite');
check(
  'match: input keeps an associated label',
  match.some(tag => tag.name === 'label' && tag.attrs.for === 'matchInput')
);
check('match: photo picker remains a file input', byId(match, 'matchPhotoFile')?.name === 'input' && byId(match, 'matchPhotoFile')?.attrs.type === 'file');
check('match: photo picker remains keyboard focusable', !Object.hasOwn(byId(match, 'matchPhotoFile')?.attrs ?? {}, 'hidden'));
check('match: photo handling copy does not promise unverified retention', !files['match.html'].includes('照片只用于本次比对，不会保存'));
check('match: voice entry is visible before scripting', !Object.hasOwn(byId(match, 'matchVoice')?.attrs ?? {}, 'hidden'));
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
check('match: local review disables rather than hides browser speech', app.includes('button.disabled = Boolean(unavailableReason)') && !app.includes('button.hidden = true'));

const adoption = parsed['adoption.html'];
check(
  'adoption: applicant can open the edit flow',
  adoption.some(tag => Object.hasOwn(tag.attrs, 'data-open-my-application'))
);

const stories = parsed['stories.html'];
check('stories: dynamic grid announces updates', byId(stories, 'storiesGrid')?.attrs['aria-live'] === 'polite');

const about = parsed['about.html'];
check(
  'about: uses the original team photograph',
  about.some(tag => tag.name === 'img' && tag.attrs.src === 'assets/team-photo.jpg' && Boolean(tag.attrs.alt?.trim()))
);

const admin = parsed['admin.html'];
const adminTabs = admin.filter(tag => tag.name === 'button' && Object.hasOwn(tag.attrs, 'data-admin-tab')).map(tag => tag.attrs['data-admin-tab']);
check(
  'admin: retains all four work areas',
  ['overview', 'pets', 'applications', 'settings'].every(tab => adminTabs.filter(value => value === tab).length === 1)
);
const adminArt = byId(admin, 'adminTabArt');
check('admin: tab illustration is present', adminArt?.name === 'img');
for (const asset of ['admin-play-and-stretch.png', 'admin-cushion-peek.png', 'admin-walk-together.png', 'companions.png']) {
  check(`admin: ${asset} is mapped to a tab`, app.includes(`assets/brand/${asset}`) && fs.existsSync(path.join(root, 'assets/brand', asset)));
}

console.log(`${passed} checks passed; ${failures.length} failed.`);
for (const failure of failures) console.error(`- ${failure}`);
if (failures.length) process.exitCode = 1;
