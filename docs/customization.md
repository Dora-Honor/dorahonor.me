# 个性化配置

## 关键文件

- 首页结构与文案：`index.html`
- 动效与背景逻辑：`assets/js/main.js`
- 主题与周报弹窗：`assets/js/theme-loader.js`
- Bing 壁纸列表生成脚本：`assets/js/bing.js`
- 自动生成的数据文件：
  - `assets/json/images.js`（Bing 壁纸 URL 列表）
  - `assets/json/config.js`（当天主题/时长）
  - `assets/json/weekly.js`（本周统计 + AI 点评）

## 1) 重要：UNPKG 资源引用

当前 `index.html` 默认引用了上游的 NPM 资源, 使用 UNPKG 代理：

- `https://unpkg.com/dmego-home-page@latest/assets/...`

如果你 fork 后希望完全使用自己仓库内的 `assets/`：

- 将上述 `unpkg.com/dmego-home-page@latest/` 替换为相对路径（例如 `./` 或直接 `assets/...`）
- 或者：发布你自己的 NPM 包，并把包名改成你的包名

否则你的页面会“看起来改了仓库，但实际仍加载上游资源”。

## 2) 修改头像、标题、链接

在 `index.html` 中可直接修改：

- 头像图片地址（`.js-avatar`）
- 标题/副标题（如 `Dmego`、`Code Create Life`）
- 导航链接（博客/简历/关于等）

## 3) Email 显示

`index.html` 使用了 `decryptEmail()` 方式做简单混淆：

- 你可以把 Base64 字符串替换为你自己的邮箱
- 或改成明文邮箱链接（文件里已有注释示例）

## 4) 主题调试（无需等 Actions）

`assets/js/theme-loader.js` 支持 URL 参数调试：

- 示例：`/?theme=focused&hours=6`

可用主题名：`rest` / `relaxed` / `productive` / `focused` / `intense` / `legendary`

## 5) 关闭/替换功能（可选）

- 不想要 Bing 背景：删除或注释 `assets/js/main.js` 中加载 `assets/json/images.js` 的逻辑
- 不想要 WakaTime/周报弹窗：不加载 `assets/js/theme-loader.js` 或移除相关 CSS

> 建议先通过文档理解数据流（Actions 生成 → assets/json → 页面加载），再做裁剪。
