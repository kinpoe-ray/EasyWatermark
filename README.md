# Easy Watermark Web

A pure web app for adding watermarks to local images in the browser.

## Features

- Fully client-side processing (no image upload)
- Text and logo watermark modes
- Single or tiled watermark layouts
- Batch export (folder / individual / ZIP)
- Chinese and English UI
- Optional visible Gemini watermark removal mode

## Local run

```bash
cd /Users/ray/1-Projects/VibeCodingSpace/tools/easy-watermark-web
python3 -m http.server 8080
```

Open: `http://127.0.0.1:8080`

## UI regression (agent-browser)

```bash
# terminal 1
python3 -m http.server 8080

# terminal 2
./tests/agent-browser/run-all.sh http://127.0.0.1:8080
```

## Deployment

This repo is configured as a static site for Vercel via `vercel.json`.
