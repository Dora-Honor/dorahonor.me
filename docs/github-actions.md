# GitHub Actions（自动化说明）

本仓库包含 2 个工作流：

## 1) 自动更新 Bing 壁纸列表

- 文件：`.github/workflows/auto-bing.yml`
- 频率：每天 `UTC 01:00`（北京时间 09:00）
- 作用：运行 `node assets/js/bing.js`，生成并提交：
  - `assets/json/images.js`（`window.BING_IMAGES = [...]`）

页面加载时会读取 `assets/json/images.js`，轮播使用 Bing 壁纸作为背景。

## 2) WakaTime 日主题 + 周报数据（含 GitHub Models 点评）

- 文件：`.github/workflows/daily-theme-update.yml`
- 频率：每天 `UTC 00:00`（北京时间 08:00）
- 作用：运行 `node .github/scripts/update-wakatime.js`，生成并提交：
  - `assets/json/config.js`（`window.WAKATIME_CONFIG = {...}`，用于日主题）
  - `assets/json/weekly.js`（`window.WAKATIME_WEEKLY = {...}`，用于周报弹窗）

### 工作流支持手动触发

在 GitHub Actions 页面选择 **WakaTime Daily Theme Update → Run workflow**：

- `hours`：手动指定当天编码小时（便于测试）
- `theme`：手动指定主题名（rest/relaxed/productive/focused/intense/legendary）

### GitHub Models

- 端点：`https://models.github.ai/inference/chat/completions`
- 默认模型：`openai/gpt-4.1`（可通过 `MODEL_NAME` 覆盖）
- 若调用失败，会自动回退到内置文案（不会阻塞周报文件生成）

## Secrets / 变量清单

在仓库 **Settings → Secrets and variables → Actions** 配置：

| 名称 | 类型 | 必需 | 用途 |
| --- | --- | ---: | --- |
| `GH_TOKEN` | Secret | 是 | Actions 提交文件 + GitHub Models 调用授权（需要 `repo` + `models` scope） |
| `WAKATIME_TOKEN` | Secret | 用于周报 | 拉取 WakaTime summaries 数据（支持 `waka_` API key 或 Bearer） |
| `MODEL_NAME` | Variable/Secret | 否 | 覆盖 GitHub Models 模型名（默认 `openai/gpt-4.1`） |
| `MODEL_DEBUG` | Variable/Secret | 否 | 设为 `1` 输出调试日志 |

## 配置 GH_TOKEN（图文步骤）

### 1. 生成 GitHub API 令牌

- 打开 [Create Tokens](https://github.com/settings/tokens)，点击 `Generate new token` 创建令牌。

![Create token entry](https://unpkg.com/dmego-home-page@latest/assets/img/action/action-1.png)

- `Note` 填写备注；`Expiration` 选择 `No expiration`；`Select scopes` 勾选 `repo`，并额外勾选 `models`（用于 GitHub Models 调用）；点击 `Generate Token`。

![Token scopes](https://unpkg.com/dmego-home-page@latest/assets/img/action/action-2.png)

### 2. 在仓库里创建 Actions Secrets

- 打开仓库 **Settings → Secrets and variables → Actions**。

![Secrets entry](https://unpkg.com/dmego-home-page@latest/assets/img/action/action-3.png)

- 点击 `New repository secret`：
  - `Name` 填 `GH_TOKEN`
  - `Secret` 填上一步生成的 Token

![Add secret](https://unpkg.com/dmego-home-page@latest/assets/img/action/action-4.png)

## 工作流权限

- `auto-bing.yml` / `daily-theme-update.yml` 需要 `contents: write` 用于提交生成文件。
- `daily-theme-update.yml` 额外声明 `models: read`。

## 常见问题

### WakaTime Token 应该填什么？

`WAKATIME_TOKEN` 支持三种形式：

- 以 `waka_` 开头的 API Key（会自动走 Basic Auth）
- 形如 `Bearer xxx` 的字符串
- 直接填 token 值（会按 Bearer 处理）

### 周报点评出现乱码/替代字符怎么办？

- 脚本会尽量清洗并截断 AI 文本，且在调用失败时回退到内置文案（不影响 `weekly.js` 生成）。
- 如需排查：在工作流里设置 `MODEL_DEBUG=1`，查看 Actions 日志里的模型返回内容。
