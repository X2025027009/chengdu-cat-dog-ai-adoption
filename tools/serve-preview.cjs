/**
 * Local-only review server. It serves the public site allowlist and never
 * deploys, connects to cloud services, or exposes repository directories.
 * Usage: node tools/serve-preview.cjs (PORT defaults to 4173).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = fs.realpathSync(path.resolve(__dirname, '..'));
const HOST = '127.0.0.1';
const PUBLIC_FILES = new Set(['index.html', 'pets.html', 'match.html', 'adoption.html', 'stories.html', 'about.html', 'admin.html', 'app.js', 'styles.css', 'site-config.js', 'page-transitions.js']);
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
};

function isAllowedRelativePath(relativePath) {
  if (!relativePath || relativePath.includes('\\') || relativePath.includes(':')) return false;
  if ([...relativePath].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return false;
  const parts = relativePath.split('/');
  if (parts.some(part => !part || part.startsWith('.') || part.endsWith('.') || part.endsWith(' '))) return false;
  return PUBLIC_FILES.has(relativePath) || (parts[0] === 'assets' && parts.length > 1);
}

function previewRelativePath(requestTarget) {
  if (typeof requestTarget !== 'string' || !requestTarget.startsWith('/') || requestTarget.startsWith('//')) return null;
  let pathname;
  try {
    // Decode before checking segments so encoded traversal is rejected too.
    // Do not normalize with URL first: normalization would erase "..".
    pathname = decodeURIComponent(requestTarget.split('?')[0]);
  } catch {
    return null;
  }
  if (pathname === '/') return 'index.html';
  const relativePath = pathname.slice(1);
  return isAllowedRelativePath(relativePath) ? relativePath : null;
}

function isLoopbackHost(hostHeader) {
  try {
    const hostname = new URL(`http://${hostHeader || ''}`).hostname;
    return ['127.0.0.1', 'localhost', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
}

function sendError(response, status, message, headOnly = false) {
  const body = `${message}\n`;
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(status === 405 ? { Allow: 'GET, HEAD' } : {})
  });
  response.end(headOnly ? undefined : body);
}

async function handlePreviewRequest(request, response) {
  const headOnly = request.method === 'HEAD';
  if (!['GET', 'HEAD'].includes(request.method)) {
    sendError(response, 405, 'Method not allowed');
    return;
  }
  if (!isLoopbackHost(request.headers.host)) {
    sendError(response, 403, 'Local preview only', headOnly);
    return;
  }
  const relativePath = previewRelativePath(request.url);
  if (!relativePath) {
    sendError(response, 404, 'Not found', headOnly);
    return;
  }
  try {
    const candidate = path.resolve(ROOT, relativePath);
    const realPath = fs.realpathSync(candidate);
    const realRelativePath = path.relative(ROOT, realPath).split(path.sep).join('/');
    // A symlink or Windows junction must not expose docs, secrets, or files
    // outside the public allowlist, even when its visible name is in assets/.
    if (!isAllowedRelativePath(realRelativePath)) {
      sendError(response, 404, 'Not found', headOnly);
      return;
    }
    const stat = await fs.promises.stat(realPath);
    if (!stat.isFile()) {
      sendError(response, 404, 'Not found', headOnly);
      return;
    }
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(realPath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    if (headOnly) {
      response.end();
      return;
    }
    const stream = fs.createReadStream(realPath);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  } catch (error) {
    const notFound = ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code);
    sendError(response, notFound ? 404 : 500, notFound ? 'Not found' : 'Preview unavailable', headOnly);
  }
}

function createPreviewServer() {
  return http.createServer(handlePreviewRequest);
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT 必须是 1–65535 之间的整数。');
    process.exitCode = 1;
  } else {
    const server = createPreviewServer();
    server.once('error', error => {
      console.error(error.code === 'EADDRINUSE' ? `本地端口 ${port} 已被占用，可通过 PORT 选择其他端口。` : `本地预览启动失败：${error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, HOST, () => {
      console.log(`本地审核预览：http://${HOST}:${port}/`);
      console.log('仅本机可访问；不会部署或同步到云端。按 Ctrl+C 停止。');
    });
  }
}

module.exports = { createPreviewServer, handlePreviewRequest, previewRelativePath, isLoopbackHost };
