// AI provider plumbing for the Electron main process. Centralizes vendor
// endpoint/auth resolution and a generic chat call. OpenAI-compatible vendors
// use /chat/completions; Anthropic uses /v1/messages. Uses global fetch.
// Ported from the BudgetLion project's electron/ai/provider.ts.

const stripSlash = (u) => String(u).replace(/\/+$/, "");

// Resolve base URL + auth headers for an OpenAI-compatible vendor, or null.
function resolveEndpoint(vendors, vendor, keys) {
  const cfg = vendors[vendor];
  if (!cfg) return null;

  if (vendor === "ollama") {
    return {
      baseURL: cfg.baseURL || "http://localhost:11434/v1",
      headers: { "Content-Type": "application/json" },
    };
  }
  if (vendor.startsWith("generic")) {
    const key = keys[vendor + "ApiKey"];
    const endpoint = keys[vendor + "Endpoint"];
    if (!endpoint) return null;
    const headers = { "Content-Type": "application/json" };
    if (key) headers.Authorization = `Bearer ${key}`;
    return { baseURL: endpoint, headers };
  }
  const key = keys[vendor];
  if (!key) return null;
  return {
    baseURL: cfg.baseURL || "https://api.openai.com/v1",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  };
}

// The configured, usable AI vendor/model, or null when AI isn't available.
// Vendors whose auth we don't implement (microsoft/amazon/ibm) resolve to null.
function resolveConfig(settings) {
  const vendor = settings.vendor;
  const model = settings.model || (vendor ? (settings.defaultModels || {})[vendor] : undefined);
  if (!vendor || !model) return null;
  if (vendor === "microsoft" || vendor === "amazon" || vendor === "ibm") return null;
  return { vendor, model, keys: settings.apiKeys || {} };
}

async function withTimeout(url, init, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function chatAnthropic(apiKey, model, system, user, maxTokens, timeoutMs) {
  const res = await withTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model, max_tokens: maxTokens, system,
        messages: [{ role: "user", content: user }],
      }),
    },
    timeoutMs
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json.content || []).map((c) => c.text || "").join("");
}

async function chatOpenAICompatible(baseURL, headers, model, system, user, maxTokens, timeoutMs) {
  const res = await withTimeout(
    `${stripSlash(baseURL)}/chat/completions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model, max_tokens: maxTokens, temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    },
    timeoutMs
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || "";
}

// Send a system+user prompt to the configured AI and return the assistant text.
// Throws when AI isn't configured/usable or the request fails.
async function chat(vendors, settings, system, user, opts = {}) {
  const cfg = resolveConfig(settings);
  if (!cfg) throw new Error("AI not configured");
  const { vendor, model, keys } = cfg;
  const maxTokens = opts.maxTokens || 1024;
  const timeoutMs = opts.timeoutMs || 30000;

  if (vendor === "anthropic") {
    if (!keys.anthropic) throw new Error("Anthropic key missing");
    return chatAnthropic(keys.anthropic, model, system, user, maxTokens, timeoutMs);
  }
  const ep = resolveEndpoint(vendors, vendor, keys);
  if (!ep) throw new Error("No endpoint/key for vendor");
  return chatOpenAICompatible(ep.baseURL, ep.headers, model, system, user, maxTokens, timeoutMs);
}

module.exports = { resolveEndpoint, resolveConfig, chat };
