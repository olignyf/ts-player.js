const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const tests = [
    'avc1.42e01e',
    'avc1.4d401f',
    'avc1.4d4020',
    'avc1.4d0020',
    'avc1.4d001f',
    'avc1.64001f',
    'avc1.4d401e',
  ];
  const audioCandidates = [
    'mp4a.40.2', // AAC LC
    'mp4a.40.5', // HE-AAC (SBR) common
    'mp4a.40.29', // HE-AAC v2 (SBR/PS)
    'mp4a.40.34', // special-cased in hls.js
  ];

  for (const v of tests) {
    const videoOnly = `video/mp4; codecs="${v}"`;
    const okVideoOnly = await page.evaluate(
      (m) => MediaSource.isTypeSupported(m),
      videoOnly,
    );
    console.log(videoOnly, okVideoOnly);

    for (const a of audioCandidates) {
      const mime = `video/mp4; codecs="${v},${a}"`;
      const ok = await page.evaluate((m) => MediaSource.isTypeSupported(m), mime);
      console.log(mime, ok);
    }
  }

  for (const a of audioCandidates) {
    const audioMime = `audio/mp4; codecs="${a}"`;
    console.log(
      audioMime,
      await page.evaluate((m) => MediaSource.isTypeSupported(m), audioMime),
    );
  }

  await browser.close();
})();

