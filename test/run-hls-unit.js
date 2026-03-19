// E2E "unit" test: runs the full browser flow in test mode and asserts buffering.
//
// Usage (after server is running):
//   npm run test:hls -- --testFile="Gop 12000 IP-2017-05-16-16h24m43s.ts" --localHls=0
//
// Prereq:
//   npm i -D playwright
//
const path = require('path');
const https = require('https');

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  if (!found) return fallback;
  return found.slice(prefix.length);
}

const testFile =
  getArg('testFile', 'Gop 12000 IP-2017-05-16-16h24m43s.ts');
const localHls = getArg('localHls', '0'); // 1 => try ./hls.js/dist/*
const noWorker = getArg('noWorker', '1');
const testTimeoutMs = Number(getArg('testTimeoutMs', '20000'));
const headfulFlag = getArg('headful', '0');
const headfulEnabled =
  headfulFlag === '1' || String(headfulFlag).toLowerCase() === 'true';
const keepOpenMs = Number(getArg('keepOpenMs', headfulEnabled ? '15000' : '0'));
const channel = getArg('channel', '');

const PORT = Number(getArg('port', '8443'));
const HOST = getArg('host', 'localhost');

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpsStatus(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        rejectUnauthorized: false,
      },
      (res) => resolve(res.statusCode || 0),
    );
    req.on('error', reject);
    req.end();
  });
}

async function ensureServer() {
  const url = `https://${HOST}:${PORT}/hls-example.html`;
  for (let i = 0; i < 20; i++) {
    try {
      const code = await httpsStatus(url);
      if (code >= 200 && code < 300) return;
    } catch (_) {
      // ignore
    }
    await delay(250);
  }
  throw new Error(
    `HTTPS server not reachable at ${url}. Run ".\\start-https.ps1" first.`,
  );
}

async function main() {
  // eslint-disable-next-line import/no-extraneous-dependencies
  let playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    console.error('Missing dependency: playwright');
    console.error('Run: npm i -D playwright');
    process.exit(2);
  }

  const { chromium } = playwright;

  await ensureServer();

  const base =
    `https://${HOST}:${PORT}/hls-example.html` +
    `?testFile=${encodeURIComponent(testFile)}` +
    `&testTimeoutMs=${encodeURIComponent(String(testTimeoutMs))}` +
    `&noWorker=${encodeURIComponent(noWorker)}` +
    `&localHls=${encodeURIComponent(localHls)}`;

  const browser = await chromium.launch({
    headless: !headfulEnabled,
    ...(channel ? { channel } : null),
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  let state = null;
  let debug = null;
  let statusText = null;
  try {
    page.on('console', (msg) => {
      const txt = msg.text();
      if (
        msg.type() === 'error' ||
        msg.type() === 'warning' ||
        txt.includes('[debug]') ||
        txt.includes('hls-debug') ||
        txt.includes('virtual-loader') ||
        txt.includes('BUFFER_RESET') ||
        txt.includes('BUFFER_CODECS') ||
        txt.includes('BUFFER_APPENDED') ||
        txt.includes('stopLoad') ||
        txt.includes('detachMedia') ||
        txt.includes('media source detaching') ||
        txt.includes('abort') ||
        txt.includes('loadSource') ||
        txt.includes('startLoad') ||
        txt.includes('was dropped during download') ||
        txt.includes('manifest loaded') ||
        txt.includes('FRAG_LOADING') ||
        txt.includes('FRAG_LOADED') ||
        txt.includes('FRAG_BUFFERED') ||
        txt.includes('FRAG_LOAD') ||
        txt.includes('transmux') ||
        txt.includes('demux')
      ) {
        console.log(`[browser:${msg.type()}] ${txt}`);
      }
    });

    await page.goto(base, { waitUntil: 'load' });

    const done = await page.waitForFunction(
      () => window.__hlsTestState && window.__hlsTestState.done === true,
      null,
      { timeout: testTimeoutMs + 10000 },
    );
    if (!done) throw new Error('Test did not complete');

    state = await page.evaluate(() => window.__hlsTestState);
    debug = await page.evaluate(() => {
      try {
        return typeof window.getHlsDebug === 'function'
          ? window.getHlsDebug()
          : null;
      } catch (e) {
        return { debugError: e.message || String(e) };
      }
    });
    statusText = await page.evaluate(() => {
      const el = document.getElementById('status');
      return el ? el.innerText : null;
    });
  } finally {
    if (keepOpenMs > 0) {
      await delay(keepOpenMs);
    }
    await browser.close();
  }

  console.log('HLS TEST RESULT:');
  console.log(JSON.stringify(state, null, 2));
  console.log('HLS DEBUG SNAPSHOT:');
  console.log(JSON.stringify(debug, null, 2));
  console.log('STATUS TEXT:');
  console.log(statusText);

  if (state && state.success === true) {
    process.exit(0);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

