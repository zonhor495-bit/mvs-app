const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'dist');
const port = process.env.PORT || 5173;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(root, decodeURIComponent(urlPath));

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(root, 'index.html');
      fs.readFile(indexPath, 'utf8', (indexErr, indexData) => {
        if (indexErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Server error');
          console.log('500', req.url, indexErr.message);
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(indexData);
        console.log('200', req.url, '(history fallback)');
      });
      return;
    }
    const ext = path.extname(filePath);
    const ct = mime[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    console.log('200', req.url);
  });
});

server.listen(port, () => {
  console.log(`Static server listening on http://127.0.0.1:${port}/ serving ${root}`);
});

module.exports = server;
