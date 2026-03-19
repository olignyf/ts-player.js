
# Unit Test

```bash
npm run test:hls -- --testFile="Gop 12000 IP-2017-05-16-16h24m43s.ts" --localHls=1 --noWorker=1 --headful=1 --keepOpenMs=20000 --testTimeoutMs=30000 --channel=chrome
```

## Note

Playwright cannot play some audio codec because it uses Chromium. We can workaround this by passing --channel=chrome to run Playwright on Chrome.
