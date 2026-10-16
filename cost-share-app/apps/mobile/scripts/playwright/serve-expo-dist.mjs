import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

/** Local static server for Expo web `dist/` (screenshot capture only). */
export function serveExpoDist(distDir, port) {
  const distRoot = path.resolve(distDir);
  const distPrefix = distRoot.endsWith(path.sep) ? distRoot : `${distRoot}${path.sep}`;

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url ?? '/', `http://127.0.0.1:${port}`).pathname);
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
      const file = path.resolve(distRoot, rel);
      if (!file.startsWith(distPrefix) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200);
      fs.createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}
