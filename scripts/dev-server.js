import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = Number.parseInt(process.env.PORT ?? '4173', 10);

const rootDir = path.resolve(url.fileURLToPath(new URL('../', import.meta.url)));

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=UTF-8'],
  ['.css', 'text/css; charset=UTF-8'],
  ['.js', 'application/javascript; charset=UTF-8'],
  ['.json', 'application/json; charset=UTF-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml; charset=UTF-8'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=UTF-8'],
]);

function resolveRequestPath(requestUrl) {
  const request = new URL(requestUrl, 'http://localhost');
  let pathname = decodeURIComponent(request.pathname);

  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  }

  if (pathname.startsWith('/')) {
    pathname = pathname.slice(1);
  }

  return pathname || 'index.html';
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES.get(ext) ?? 'application/octet-stream';
}

async function serveFile(res, filePath) {
  const stream = createReadStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on('open', () => {
      res.writeHead(200, {
        'Content-Type': getContentType(filePath),
        'Cache-Control': 'no-store',
      });
      stream.pipe(res);
    });

    stream.on('error', (error) => {
      reject(error);
    });

    res.on('close', resolve);
    res.on('finish', resolve);
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const resolvedPath = resolveRequestPath(req.url);
  const absolutePath = path.resolve(rootDir, resolvedPath);

  if (!absolutePath.startsWith(rootDir + path.sep) && absolutePath !== rootDir) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const fileInfo = await stat(absolutePath);

    if (fileInfo.isDirectory()) {
      const indexPath = path.join(absolutePath, 'index.html');
      await serveFile(res, indexPath);
      return;
    }

    await serveFile(res, absolutePath);
  } catch (error) {
    const message = error.code === 'ENOENT' ? 'Not Found' : 'Internal Server Error';
    res.writeHead(error.code === 'ENOENT' ? 404 : 500);
    res.end(message);
    if (error.code !== 'ENOENT') {
      console.error(error);
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`id大作战开发服务器已启动：http://${HOST}:${PORT}`);
  console.log('按 Ctrl+C 停止服务。');
});
