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

// ---------------------------------------------------------------------------
// Tool-calling (function-calling) chat. Unlike chat(), this takes a full
// message array and a list of tool schemas, and returns the assistant's reply
// MESSAGE (so the caller can read message.tool_calls), not just text. Used by
// the renderer's AI agent loop. OpenAI-compatible vendors (incl. Ollama) use
// the standard tools/tool_calls shape; Anthropic is mapped to tools/tool_use.
// ---------------------------------------------------------------------------

async function chatToolsOpenAICompatible(baseURL, headers, model, messages, tools, maxTokens, timeoutMs) {
  const body = { model, max_tokens: maxTokens, temperature: 0, messages };
  if (Array.isArray(tools) && tools.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  const res = await withTimeout(
    `${stripSlash(baseURL)}/chat/completions`,
    { method: "POST", headers, body: JSON.stringify(body) },
    timeoutMs
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const msg = (json.choices && json.choices[0] && json.choices[0].message) || null;
  if (!msg) throw new Error("no message in response");
  // Normalize to a plain object the renderer can consume uniformly.
  return {
    role: "assistant",
    content: msg.content || "",
    tool_calls: Array.isArray(msg.tool_calls) ? msg.tool_calls : [],
  };
}

// Map OpenAI-style tool schemas ({type:"function", function:{name,description,
// parameters}}) to Anthropic tools ({name,description,input_schema}); map the
// OpenAI message array to Anthropic messages; return a normalized message with
// tool_calls shaped like OpenAI's (id/function.name/function.arguments-string).
async function chatToolsAnthropic(apiKey, model, messages, tools, maxTokens, timeoutMs) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const aMsgs = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      aMsgs.push({ role: "user", content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: String(m.content) }] });
    } else if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const blocks = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls) {
        let input = {};
        try { input = JSON.parse(tc.function.arguments || "{}"); } catch { input = {}; }
        blocks.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
      }
      aMsgs.push({ role: "assistant", content: blocks });
    } else {
      aMsgs.push({ role: m.role, content: String(m.content || "") });
    }
  }
  const aTools = (tools || []).map((t) => ({
    name: t.function.name,
    description: t.function.description || "",
    input_schema: t.function.parameters || { type: "object", properties: {} },
  }));
  const payload = { model, max_tokens: maxTokens, system, messages: aMsgs };
  if (aTools.length) payload.tools = aTools;
  const res = await withTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
    },
    timeoutMs
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const blocks = json.content || [];
  let text = "";
  const toolCalls = [];
  for (const b of blocks) {
    if (b.type === "text") text += b.text || "";
    else if (b.type === "tool_use") {
      toolCalls.push({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input || {}) } });
    }
  }
  return { role: "assistant", content: text, tool_calls: toolCalls };
}

// Tool-calling entry point. messages: OpenAI-style array; tools: OpenAI-style
// tool schemas. Returns a normalized assistant message { role, content,
// tool_calls:[{id,type:"function",function:{name,arguments(JSON string)}}] }.
async function chatTools(vendors, settings, messages, tools, opts = {}) {
  const cfg = resolveConfig(settings);
  if (!cfg) throw new Error("AI not configured");
  const { vendor, model, keys } = cfg;
  const maxTokens = opts.maxTokens || 1024;
  const timeoutMs = opts.timeoutMs || 30000;

  if (vendor === "anthropic") {
    if (!keys.anthropic) throw new Error("Anthropic key missing");
    return chatToolsAnthropic(keys.anthropic, model, messages, tools, maxTokens, timeoutMs);
  }
  const ep = resolveEndpoint(vendors, vendor, keys);
  if (!ep) throw new Error("No endpoint/key for vendor");
  return chatToolsOpenAICompatible(ep.baseURL, ep.headers, model, messages, tools, maxTokens, timeoutMs);
}

module.exports = { resolveEndpoint, resolveConfig, chat, chatTools };
