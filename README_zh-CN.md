# Easy Watermark Web

一个纯 Web 的本地图片水印工具，所有处理都在浏览器内完成。

## 功能

- 本地处理，不上传图片
- 支持文字与 Logo 水印
- 支持单个 / 平铺模式
- 支持批量导出（文件夹 / 逐张 / ZIP）
- 中英文界面切换
- 支持 Gemini 可见水印去除模式（可选）

## 本地运行

```bash
cd /Users/ray/1-Projects/VibeCodingSpace/tools/easy-watermark-web
python3 -m http.server 8080
```

访问：`http://127.0.0.1:8080`

## UI 回归测试（agent-browser）

```bash
# 终端 1
python3 -m http.server 8080

# 终端 2
./tests/agent-browser/run-all.sh http://127.0.0.1:8080
```

## 部署

仓库通过 `vercel.json` 按静态站点部署到 Vercel。
