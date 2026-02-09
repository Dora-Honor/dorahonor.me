const fs = require('fs');
const https = require('https');
const path = require('path');

const WAKATIME_TOKEN = process.env.WAKATIME_TOKEN;
const TIME_ZONE = process.env.TZ || 'Asia/Shanghai';
const GH_TOKEN = process.env.GH_TOKEN;
const MODEL_ENDPOINT = 'https://models.github.ai/inference/chat/completions';
const MODEL_NAME = process.env.MODEL_NAME || 'openai/gpt-4.1';
const MODEL_DEBUG = process.env.MODEL_DEBUG === '1';
const MANUAL_HOURS = process.env.MANUAL_HOURS;
const MANUAL_THEME = process.env.MANUAL_THEME;
const WAKATIME_RAW_JSON = process.env.WAKATIME_RAW_JSON;

const THEME_RULES = [
  { max: 1, name: 'rest', display: '休息日' },
  { max: 3, name: 'relaxed', display: '轻松日' },
  { max: 5, name: 'productive', display: '充实日' },
  { max: 7, name: 'focused', display: '专注日' },
  { max: 9, name: 'intense', display: '极限日' },
  { max: Infinity, name: 'legendary', display: '超神日' }
];

function formatYmd(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function addDays(date, delta) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + delta);
  return d;
}

function writeGithubOutput(hours, themeName) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `hours=${hours}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `theme_name=${themeName}\n`);
}

function httpRequestJson(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method, headers },
      (res) => {
        res.setEncoding('utf8');
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 400)}`));
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function fetchWeeklyRaw(startDate, endDate) {
  if (WAKATIME_RAW_JSON) {
    return JSON.parse(WAKATIME_RAW_JSON);
  }
  if (!WAKATIME_TOKEN) {
    throw new Error('WAKATIME_TOKEN is required.');
  }
  const url = `https://wakatime.com/api/v1/users/current/summaries?start=${startDate}&end=${endDate}`;
  const token = String(WAKATIME_TOKEN).trim();
  let authHeader = '';
  if (/^bearer\s+/i.test(token)) {
    authHeader = token;
  } else if (/^waka_/i.test(token)) {
    const basic = Buffer.from(`${token}:`, 'utf8').toString('base64');
    authHeader = `Basic ${basic}`;
  } else {
    authHeader = `Bearer ${token}`;
  }
  return httpRequestJson(
    url,
    'GET',
    { Authorization: authHeader },
    null
  );
}

function parseDaysFromRaw(raw) {
  if (!raw || !Array.isArray(raw.data)) {
    throw new Error('Invalid WakaTime data structure');
  }
  return raw.data.map((day) => ({
    date: day.range.date,
    hours: parseFloat((day.grand_total.total_seconds / 3600).toFixed(2)),
    text: day.grand_total.text
  }));
}

function computeStats(days) {
  const totalHours = days.reduce((sum, day) => sum + day.hours, 0);
  const avgHours = totalHours / days.length;
  const maxDay = days.reduce((prev, current) => (prev.hours > current.hours ? prev : current));
  const firstHalf = days.slice(0, 3).reduce((sum, d) => sum + d.hours, 0) / 3;
  const secondHalf = days.slice(3).reduce((sum, d) => sum + d.hours, 0) / (days.length - 3);
  const trend = secondHalf > firstHalf ? '上升' : '下降';
  return { totalHours, avgHours, maxDay, trend };
}

function pickTheme(hours, manualTheme) {
  if (manualTheme) {
    const match = THEME_RULES.find((r) => r.name === manualTheme);
    return {
      theme_name: manualTheme,
      theme_display: match ? match.display : manualTheme
    };
  }
  const rule = THEME_RULES.find((r) => hours < r.max) || THEME_RULES[THEME_RULES.length - 1];
  return { theme_name: rule.name, theme_display: rule.display };
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function truncateByCodePoints(input, maxLen) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  // 移除替代符号和无效字符，只保留有效的 UTF-8 字符
  const cleaned = trimmed.replace(/[\ufffd]/g, '').trim();
  const chars = Array.from(cleaned);
  return chars.length > maxLen ? chars.slice(0, maxLen).join('') : chars.join('');
}

function normalizeAiResult(candidate, fallback) {
  const raw = candidate && typeof candidate === 'object' ? candidate : {};
  const cleanString = (str) => {
    if (typeof str !== 'string') return '';
    // 确保字符串是有效 UTF-8，移除替代符号
    return str.replace(/[\ufffd]/g, '');
  };
  const title = truncateByCodePoints(cleanString(raw.title) || fallback.title, 6);
  const quote = truncateByCodePoints(cleanString(raw.quote) || fallback.quote, 30);
  const tarot = truncateByCodePoints(cleanString(raw.tarot) || fallback.tarot, 48);
  const theme_color = isHexColor(raw.theme_color) ? raw.theme_color.trim() : fallback.theme_color;
  return { title, quote, tarot, theme_color };
}

async function callModel(prompt, modelName) {
  if (MODEL_DEBUG) {
    console.log(`Calling GitHub Models: ${modelName}`);
  }
  const requestBody = JSON.stringify({
    messages: [
      { role: 'system', content: 'You are a helpful assistant that speaks JSON.' },
      { role: 'user', content: prompt }
    ],
    model: modelName,
    temperature: 0.8,
    max_tokens: 200
  });
  const response = await httpRequestJson(
    MODEL_ENDPOINT,
    'POST',
    {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${GH_TOKEN}`
    },
    requestBody
  );
  if (MODEL_DEBUG && response && response.error) {
    console.log(`Model error: ${JSON.stringify(response.error)}`);
  }
  return response;
}

async function generateAi(days, stats) {
  const FALLBACK_SCENARIOS = [
    {
      max: 1.5,
      data: {
        title: '休养生息',
        quote: '代码写得少，Bug 自然少。这是某种程度上的绝对胜利。',
        tarot: '🛌 The Hermit (隐士)',
        theme_color: '#a0c4ff'
      }
    },
    {
      max: 4.5,
      data: {
        title: '渐入佳境',
        quote: '保持节奏，每一行代码都是通往赛博朋克的砖瓦。',
        tarot: '🌱 The Empress (皇后)',
        theme_color: '#80ed99'
      }
    },
    {
      max: 8.0,
      data: {
        title: '火力全开',
        quote: '键盘都在喊累，但你的 Commit 还在飞。',
        tarot: '⚡ The Magician (魔术师)',
        theme_color: '#f5af19'
      }
    },
    {
      max: 12.0,
      data: {
        title: '代码永动机',
        quote: '这周的状态像刚喝了三杯浓缩，曲线比纳斯达克还漂亮。',
        tarot: '🔥 The Chariot (战车)',
        theme_color: '#8e2de2'
      }
    },
    {
      max: Infinity,
      data: {
        title: '赛博飞升',
        quote: '你已经不再是在写代码，你是在编织矩阵的底层逻辑。',
        tarot: '🌟 The World (世界)',
        theme_color: '#00c6ff'
      }
    }
  ];

  const fallbackData = FALLBACK_SCENARIOS.find((s) => stats.avgHours < s.max).data;
  let aiResult = { ...fallbackData };

  if (!GH_TOKEN) {
    if (MODEL_DEBUG) {
      console.log('GH_TOKEN is not set. Skipping model call.');
    }
    return normalizeAiResult(aiResult, fallbackData);
  }

  const prompt = `
你是一个赛博朋克风格的代码占卜师。根据程序员本周的编码数据生成周报点评。

[数据面板]
- 总时长: ${stats.totalHours.toFixed(1)}小时
- 日均: ${stats.avgHours.toFixed(1)}小时
- 趋势: ${stats.trend}
- 巅峰日: ${stats.maxDay.date} (${stats.maxDay.hours}小时)

 请返回严格的 JSON 格式（不要Markdown代码块），文本必须是有效 UTF-8 中文，避免出现乱码或替代符号(�)：
1. title: 4字短语，概括本周状态（如：代码飞升、系统过载、静默潜行）。
2. quote: 30字以内的毒舌点评或黑客哲理，幽默且赛博风。
3. tarot: 塔罗牌名称+Emoji（如：🔥 The Chariot）。
4. theme_color: 对应的 Hex 霓虹色值。
  `.trim();

  try {
    let parsedApi = await callModel(prompt, MODEL_NAME);
    if (parsedApi && parsedApi.error && MODEL_NAME !== 'openai/gpt-4o') {
      parsedApi = await callModel(prompt, 'openai/gpt-4o');
    }
    const content = parsedApi && parsedApi.choices && parsedApi.choices[0] && parsedApi.choices[0].message
      ? String(parsedApi.choices[0].message.content || '')
      : '';
    const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
      const candidate = JSON.parse(cleaned);
      aiResult = normalizeAiResult(candidate, fallbackData);
    } catch (_) {
      aiResult = normalizeAiResult(null, fallbackData);
    }
  } catch (err) {
    if (MODEL_DEBUG) {
      console.log(`Model call failed: ${err && err.message ? err.message : String(err)}`);
    }
    aiResult = normalizeAiResult(null, fallbackData);
  }

  return normalizeAiResult(aiResult, fallbackData);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJsVar(filePath, varName, value) {
  const jsContent = `window.${varName} = ${JSON.stringify(value, null, 2)};`;
  fs.writeFileSync(filePath, jsContent);
}

async function main() {
  const now = new Date();
  const endDate = formatYmd(now, TIME_ZONE);
  const startDate = formatYmd(addDays(now, -6), TIME_ZONE);
  const yesterday = formatYmd(addDays(now, -1), TIME_ZONE);

  const raw = await fetchWeeklyRaw(startDate, endDate);
  const days = parseDaysFromRaw(raw);
  const stats = computeStats(days);

  let dailyHours = 0;
  if (MANUAL_HOURS) {
    dailyHours = parseFloat(MANUAL_HOURS);
    if (!Number.isFinite(dailyHours)) dailyHours = 0;
  } else {
    const match = days.find((d) => d.date === yesterday);
    dailyHours = match ? match.hours : 0;
  }

  const theme = pickTheme(dailyHours, MANUAL_THEME);
  const config = {
    date: yesterday,
    hours: dailyHours,
    theme_name: theme.theme_name,
    theme_display: theme.theme_display,
    updated_at: new Date().toISOString()
  };

  const ai = await generateAi(days, stats);
  const weekly = {
    updated_at: new Date().toISOString(),
    stats: {
      total_hours: parseFloat(stats.totalHours.toFixed(2)),
      daily_avg: parseFloat(stats.avgHours.toFixed(2)),
      trend: stats.trend === '上升' ? 'rising' : 'falling',
      max_day: stats.maxDay
    },
    days,
    ai
  };

  const outDir = path.join(__dirname, '../../assets/json');
  ensureDir(outDir);
  writeJsVar(path.join(outDir, 'config.js'), 'WAKATIME_CONFIG', config);
  writeJsVar(path.join(outDir, 'weekly.js'), 'WAKATIME_WEEKLY', weekly);

  console.log('Generated assets/json/config.js and assets/json/weekly.js');
  writeGithubOutput(dailyHours, theme.theme_name);
}

main().catch((err) => {
  console.error('WakaTime update failed:', err);
  process.exit(1);
});
