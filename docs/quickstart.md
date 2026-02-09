# 快速开始（Fork 后跑起来）

## 1. Fork 并启用 Pages

1. Fork 本仓库到你的 GitHub 账号下。
2. 打开仓库 **Settings → Pages**。
3. 选择：
   - **Branch**：`gh-pages`
   - **Folder**：`/ (root)`
4. 保存后等待 GitHub Pages 部署完成。

> 本项目默认分支就是 `gh-pages`，属于“直接把静态站点放在 Pages 分支”的用法。

## 2. 本地预览

这是纯静态站点，不依赖构建。

- 方式 A（Python）：
  - `python3 -m http.server 8080`
  - 浏览器打开 `http://localhost:8080`

- 方式 B（Node）：
  - `npx serve .`

> 建议使用本地 HTTP 服务器预览，避免直接打开 HTML 文件导致的资源路径/缓存问题。

## 3. 自定义域名（可选）

- 修改根目录的 `CNAME` 为你的域名（例如 `example.com`）。
- 在 **Settings → Pages** 中设置 Custom domain。
- 按 GitHub 指引配置 DNS（A 记录或 CNAME）。

## 4. 下一步：个性化配置

- 站点内容与样式调整：见 [docs/customization.md](customization.md)
- 自动化（Bing/WakaTime/周报）：见 [docs/github-actions.md](github-actions.md)
