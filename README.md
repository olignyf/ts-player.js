
# Unit Test

```bash
npm run test:hls -- --testFile="Gop 12000 IP-2017-05-16-16h24m43s.ts" --localHls=1 --noWorker=1 --headful=1 --keepOpenMs=20000 --testTimeoutMs=30000 --channel=chrome
```

# Start standalone mini server (that supports bytes-range requests)




## Note

Playwright cannot play some audio codec because it uses Chromium. We can workaround this by passing --channel=chrome to run Playwright on Chrome.

# Build

```bash
git submodule update --init --recursive
```

## Build local hls.js bundle

This repo includes a local checkout at `hls.js/`. 
This is the command I used to compile it (and generate `hls.js/dist/hls.js`):

```bash
nvm use 20 # or above
cd hls.js
npm ci
npx rollup --config
```

Notes:
- `npm run build` also works for generating `dist/`, but on Windows it fails later in `build:types` because it uses `cp`.
`npx rollup --config` builds the JS bundles without that step.
