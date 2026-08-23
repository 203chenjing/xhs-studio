/**
 * DeepSeek API 连通性测试（仅本地开发）。
 * 用法：
 *   DEEPSEEK_API_KEY=sk-... node scripts/test-api.mjs
 *   或在 job-tracker-extension/.local-settings.json 中配置 apiKey
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const localPath = path.join(root, ".local-settings.json");

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function loadKey() {
  if (process.env.DEEPSEEK_API_KEY?.trim()) return process.env.DEEPSEEK_API_KEY.trim();
  if (fs.existsSync(localPath)) {
    const j = readJsonFile(localPath);
    if (j.apiKey?.trim()) return j.apiKey.trim();
  }
  console.error("未找到 API Key：设置 DEEPSEEK_API_KEY 或创建 .local-settings.json");
  process.exit(1);
}

function sanitizeApiKey(raw) {
  let s = String(raw ?? "").trim();
  s = s.replace(/[\u200B-\u200D\uFEFF\u00A0\u2028\u2029\u2060\u180E\uFFF9-\uFFFB]/g, "");
  s = s.replace(/^[\s"'`''""「」【】]+|[\s"'`''""「」【】]+$/g, "");
  s = s.replace(/[\u3000-\u303F\uFF00-\uFFEF\u2010-\u201F\u00AB\u00BB，。；：、！？（）【】《》「」]/g, "");
  s = s.replace(/\s+/g, "");
  s = s.replace(/[^\x21-\x7E]/g, "");
  return s;
}

const apiKey = sanitizeApiKey(loadKey());
const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const res = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "回复 OK" }],
    max_tokens: 8,
    temperature: 0
  })
});

const text = await res.text();
if (!res.ok) {
  console.error(`FAIL HTTP ${res.status}: ${text.slice(0, 300)}`);
  process.exit(1);
}
const json = JSON.parse(text);
const content = json?.choices?.[0]?.message?.content ?? "";
console.log(`OK HTTP ${res.status} model=${json.model} reply=${content.trim().slice(0, 80)}`);
