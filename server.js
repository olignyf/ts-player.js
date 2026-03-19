// Tiny HTTPS static server with byte-range support (for HLS-style requests).
// Run: `node server.js` or `npm start`
//
// Requirements: place a `cert.pfx` file in this folder.
//   - Create it using the PowerShell snippet in the assistant response.
//   - Provide password via CERT_PASSPHRASE env var (must match the export password).

const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8443);
const HOST = process.env.HOST || '0.0.0.0';

const CERT_PFX_PATH = path.join(ROOT, process.env.CERT_PFX_PATH || 'cert.pfx');
const CERT_PASSPHRASE = process.env.CERT_PASSPHRASE;

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.m3u8':
      return 'application/vnd.apple.mpegurl; charset=utf-8';
    case '.ts':
      return 'video/mp2t';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.wasm':
      return 'application/wasm';
    default:
      return 'application/octet-stream';
  }
}

function sendFile(req, res, filePath) {
  const stat = fs.statSync(filePath);
  const total = stat.size;
  const contentType = contentTypeFor(filePath);

  // HLS.js often uses Range requests. Support single range "bytes=start-end".
  const range = req.headers['range'];
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(range));
    if (!m) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${total}`);
      res.end();
      return;
    }

    const startStr = m[1];
    const endStr = m[2];
    let start;
    let end;

    if (startStr === '' && endStr === '') {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${total}`);
      res.end();
      return;
    }

    // "bytes=-N" => last N bytes
    if (startStr === '') {
      const suffixLen = Number(endStr);
      start = Math.max(total - suffixLen, 0);
      end = total - 1;
    } else {
      start = Number(startStr);
      // "bytes=start-" => until end
      end = endStr === '' ? total - 1 : Number(endStr);
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${total}`);
      res.end();
      return;
    }

    res.statusCode = 206;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', end - start + 1);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Cache-Control', 'no-store');

    const stream = fs.createReadStream(filePath, { start, end });
    stream.on('error', () => {
      res.statusCode = 500;
      res.end();
    });
    stream.pipe(res);
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Length', total);
  res.setHeader('Cache-Control', 'no-store');

  fs.createReadStream(filePath).pipe(res);
}

const certPfxExists = fs.existsSync(CERT_PFX_PATH);
if (!certPfxExists) {
  console.error(`Missing TLS cert: ${CERT_PFX_PATH}`);
  console.error('Create it first (see PowerShell snippet in your message).');
  process.exit(1);
}

const httpsOptions = { pfx: fs.readFileSync(CERT_PFX_PATH) };
if (CERT_PASSPHRASE !== undefined) {
  httpsOptions.passphrase = CERT_PASSPHRASE;
}

https
  .createServer(httpsOptions, (req, res) => {
    // Handle preflight quickly if you add CORS later.
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (!req.url) {
      res.statusCode = 400;
      res.end();
      return;
    }

    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(url.pathname || '/');
    if (pathname === '/') pathname = '/hls-example.html';

    // Prevent path traversal.
    pathname = pathname.replace(/\\/g, '/');
    pathname = pathname.replace(/^\/+/, '');
    const normalized = path.normalize(pathname);
    const filePath = path.join(ROOT, normalized);
    if (!filePath.startsWith(ROOT)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    sendFile(req, res, filePath);
  })
  .listen(PORT, HOST, () => {
    console.log(`HTTPS server running: https://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
    console.log('Serve your page at: https://localhost:' + PORT + '/hls-example.html');
  });

