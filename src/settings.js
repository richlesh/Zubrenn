const fs = require("fs");
const path = require("path");
const os = require("os");

const SETTINGS_PATH = path.join(os.homedir(), ".zubrenn-settings.json");

const DEFAULTS = {
  theme: "dark",
  vendor: "openai",
  model: "",
  apiKeys: {},
  defaultModels: {},
  useBuiltinAI: true,
  autoTurnEnd: true,
  musicEnabled: true,
  musicVolume: 50, // 0–100
  fontSize: "small", // "small" (1x) | "medium" (1.25x) | "large" (1.5x)
};

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
}

module.exports = { load, save };
