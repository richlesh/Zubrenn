const { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const nodeCrypto = require("crypto");
const { load, save } = require("./settings");
const { LICENSE_SALT } = require("./license.js");
const { generateMap } = require("./generate_map.cjs");

// Project root (one level up from src/). package.json lives there.
const ROOT_DIR = path.join(__dirname, "..");
const pkg = require("../package.json");
const APP_ICON_PATH = path.join(__dirname, "resources", "app_icon.png");

// AI vendor catalog (labels, static model lists, API-key URLs).
let VENDORS = {};
try {
  VENDORS = JSON.parse(fs.readFileSync(path.join(__dirname, "ai-vendors.json"), "utf8")).vendors || {};
} catch {
  VENDORS = {};
}

function openExternal(url) {
  if (process.platform === "linux") {
    const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    child.unref();
  } else {
    shell.openExternal(url);
  }
}

function expectedLicenseKey(userName) {
  const hmac = nodeCrypto.createHmac("sha256", LICENSE_SALT);
  hmac.update(userName.toLowerCase().trim());
  return hmac.digest("hex").slice(0, 16).toUpperCase();
}

function isValidLicense(key, userName) {
  if (!key || !userName) return false;
  return key.toUpperCase() === expectedLicenseKey(userName);
}

const appIcon = nativeImage.createFromPath(APP_ICON_PATH);

app.name = "Zubrenn";

app.setAboutPanelOptions({
  applicationName: "Zubrenn",
  applicationVersion: pkg.version,
  credits: `by Richard Lesh\nBuilt with Electron v${process.versions.electron}`,
  website: "https://glowingcatsoftware.com/Zubrenn.html",
  iconImage: appIcon
});

let mainWin, settingsWin;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    icon: appIcon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });
  win.loadFile(path.join(__dirname, "index.html"));
  // Surface renderer crashes / load failures for diagnostics.
  win.webContents.on("render-process-gone", (_e, details) => {
    console.error("[renderer] process gone:", JSON.stringify(details));
  });
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(`[renderer] did-fail-load ${code} ${desc} ${url}`);
  });
  if (!mainWin) {
    mainWin = win;
    buildMenu();
  }
  return win;
}

let aboutWin;
function showAbout() {
  if (aboutWin && !aboutWin.isDestroyed()) return aboutWin.focus();
  aboutWin = new BrowserWindow({
    width: 320,
    height: 420,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWin,
    modal: true,
    icon: appIcon,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  aboutWin.setMenuBarVisibility(false);
  aboutWin.loadFile(path.join(__dirname, "about.html"));
  aboutWin.once("ready-to-show", () => {
    if (mainWin && !mainWin.isDestroyed()) {
      const [px, py] = mainWin.getPosition();
      const [pw, ph] = mainWin.getSize();
      const [w, h] = aboutWin.getSize();
      aboutWin.setPosition(Math.round(px + (pw - w) / 2), Math.round(py + (ph - h) / 2));
    }
    aboutWin.show();
  });
  aboutWin.webContents.once("did-finish-load", () => {
    aboutWin.webContents.send("icon-path", APP_ICON_PATH);
    aboutWin.webContents.send("app-version", pkg.version);
    const { licenseKey, userName } = load();
    if (isValidLicense(licenseKey, userName)) aboutWin.webContents.send("licensed");
  });
  ipcMain.handleOnce("close-about", () => aboutWin?.close());
  aboutWin.on("closed", () => { aboutWin = null; });
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    {
      label: app.name,
      submenu: [
        { label: "About Zubrenn", click: showAbout },
        { type: "separator" },
        { label: "Settings…", accelerator: "CmdOrCtrl+,", click: openSettings },
        { label: "License Key…", click: openLicense },
        { type: "separator" },
        ...(isMac ? [
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
        ] : []),
        { role: "quit" }
      ]
    },
    {
      label: "File",
      submenu: [
        { label: "New Game…", accelerator: "CmdOrCtrl+N", click: openNewGame },
        { type: "separator" },
        { label: "Save Game…", accelerator: "CmdOrCtrl+S", click: saveGame },
        { label: "Load Game…", accelerator: "CmdOrCtrl+O", click: loadGame },
        { type: "separator" },
        { role: "close" }
      ]
    },
    { role: "editMenu" },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        ...(isMac ? [{ role: "zoom" }] : []),
        { type: "separator" },
        {
          label: "Toggle Developer Tools",
          accelerator: isMac ? "Cmd+Option+I" : "Ctrl+Shift+I",
          click: () => BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools()
        },
        ...(isMac ? [
          { type: "separator" },
          { role: "front" },
        ] : []),
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

let licenseWin;

function openLicense() {
  if (licenseWin) return licenseWin.focus();
  licenseWin = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    parent: mainWin,
    modal: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  licenseWin.setMenuBarVisibility(false);
  licenseWin.loadFile(path.join(__dirname, "license_dialog.html"));
  licenseWin.webContents.once("did-finish-load", () => {
    const { licenseKey, userName } = load();
    licenseWin.webContents.send("license-data", { key: licenseKey || "", userName: userName || "" });
  });
  licenseWin.on("closed", () => { licenseWin = null; });
}

ipcMain.handle("license-save", (_e, { key, userName }) => {
  if (!isValidLicense(key, userName)) return;
  const settings = load();
  settings.licenseKey = key.toUpperCase();
  settings.userName = userName;
  save(settings);
  licenseWin?.close();
});

ipcMain.handle("license-cancel", () => licenseWin?.close());

function openSettings() {
  if (settingsWin) return settingsWin.focus();
  settingsWin = new BrowserWindow({
    width: 460,
    height: 560,
    resizable: false,
    parent: mainWin,
    modal: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, "settings.html"));
  settingsWin.on("closed", () => { settingsWin = null; });
}

// Renderer helpers used by the dialogs.
ipcMain.handle("settings-get", () => load());
ipcMain.handle("settings-get-data", () => ({ settings: load(), VENDORS }));

// Minimal model resolver: return the bundled static list for a vendor.
// (A real integration would query the provider here.)
ipcMain.handle("get-models-for-vendor", (_e, vendor) => (VENDORS[vendor] && VENDORS[vendor].models) || []);
ipcMain.handle("fetch-models", (_e, { vendor }) => (VENDORS[vendor] && VENDORS[vendor].models) || []);

ipcMain.handle("settings-save", (_e, newSettings) => {
  const existing = load();
  save({ ...existing, ...newSettings });
  settingsWin?.close();
  mainWin?.webContents.send("settings-updated");
});

ipcMain.handle("settings-cancel", () => settingsWin?.close());
ipcMain.handle("settings-close", () => settingsWin?.close());

ipcMain.handle("open-external", (_e, url) => openExternal(url));

// --- New Game dialog + terrain generation --------------------------------
let newGameWin;

function openNewGame() {
  if (newGameWin) return newGameWin.focus();
  newGameWin = new BrowserWindow({
    width: 460,
    height: 1020,
    resizable: false,
    parent: mainWin,
    modal: true,
    icon: appIcon,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  newGameWin.setMenuBarVisibility(false);
  newGameWin.loadFile(path.join(__dirname, "newgame.html"));
  newGameWin.on("closed", () => { newGameWin = null; });
}

ipcMain.handle("newgame-create", (_e, options) => {
  let result;
  try {
    result = generateMap(options || {});
  } catch (err) {
    console.error("Map generation failed:", err);
    throw err; // propagate to the dialog's await so it can show the error
  }
  console.log(
    `New Game: generated ${result.meta.width}x${result.meta.height} ` +
    `(algo=${result.meta.algo}, seed=${result.meta.seed})`
  );

  // Ensure a main window exists and is the one we send to.
  if (!mainWin || mainWin.isDestroyed()) {
    mainWin = createWindow();
  }
  mainWin.show();
  mainWin.focus();

  const send = () => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send("new-map", result);
    }
  };
  // Send once the renderer DOM is ready so the "new-map" listener is attached.
  if (mainWin.webContents.isLoading()) {
    mainWin.webContents.once("did-finish-load", send);
  } else {
    send();
  }

  newGameWin?.close();
  return { ok: true, meta: result.meta };
});

ipcMain.handle("newgame-cancel", () => newGameWin?.close());

// --- Save / Load game -----------------------------------------------------
//
// Save file format (JSON). Versioned and intentionally extensible: today it
// stores only the map, but `improvements` and `pieces` are reserved for tile
// improvements and game pieces that will be added later. Loaders should treat
// missing/extra sections leniently so old and new saves stay compatible.
//
//   {
//     "format": "zubrenn-save",
//     "version": 1,
//     "savedAt": "<ISO timestamp>",
//     "app": "<app version>",
//     "map": { "meta": {...}, "terrain": [[...], ...] },
//     "improvements": [],   // reserved for future use
//     "pieces": []          // reserved for future use
//   }
const SAVE_FORMAT = "zubrenn-save";
const SAVE_VERSION = 1;
const SAVE_EXT = "zub";

function buildSaveObject(gameState) {
  const map = gameState && gameState.map ? gameState.map : {};
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    app: pkg.version,
    map: {
      meta: map.meta || null,
      terrain: map.terrain || null,
      elevation: map.elevation || null,
      rivers: map.rivers || []
    },
    // Reserved for future features; pass through whatever the renderer sends.
    improvements: (gameState && gameState.improvements) || [],
    pieces: (gameState && gameState.pieces) || []
  };
}

// Serialize the save object as pretty-printed JSON, but keep 2D grids readable:
// each terrain ROW and each elevation ROW is emitted on a single line (all
// horizontal values together), and each river path is emitted on a single
// line. We stringify with those arrays swapped for placeholders, then
// substitute compact one-line arrays back in. Still valid, round-trippable JSON.
function serializeSave(saveObj) {
  const map = saveObj.map || {};
  const terrain = map.terrain;
  const elevation = map.elevation;
  const rivers = map.rivers;
  if (!Array.isArray(terrain)) {
    return JSON.stringify(saveObj, null, 2);
  }

  const clone = { ...saveObj, map: { ...map } };
  const restores = []; // [{ token, compact }]
  let uid = 0;
  const stash = (arr, mapFn) => {
    const token = `@@TOK${uid++}@@`;
    restores.push({ token, compact: mapFn(arr) });
    return token;
  };

  // Terrain rows -> one line each.
  clone.map.terrain = terrain.map((row) =>
    stash(row, (r) => "[" + r.join(",") + "]"));

  // Elevation rows -> one line each (round floats to keep files compact).
  if (Array.isArray(elevation)) {
    clone.map.elevation = elevation.map((row) =>
      stash(row, (r) => "[" + r.map((v) => Number(v.toFixed(4))).join(",") + "]"));
  }

  // River paths -> one line each.
  if (Array.isArray(rivers)) {
    clone.map.rivers = rivers.map((path) =>
      stash(path, (p) => "[" + p.map((c) => `{"x":${c.x},"y":${c.y}}`).join(",") + "]"));
  }

  let out = JSON.stringify(clone, null, 2);
  for (const { token, compact } of restores) {
    out = out.replace(`"${token}"`, compact);
  }
  return out;
}

async function saveGame() {
  if (!mainWin || mainWin.isDestroyed()) return;

  // Ask the renderer for the current game state.
  let gameState;
  try {
    gameState = await mainWin.webContents.executeJavaScript(
      "window.getGameState ? window.getGameState() : null", true
    );
  } catch (err) {
    console.error("Save: failed to read game state:", err);
    gameState = null;
  }

  if (!gameState || !gameState.map || !gameState.map.terrain) {
    await dialog.showMessageBox(mainWin, {
      type: "info",
      message: "No game to save",
      detail: "Start a new game (File › New Game…) before saving.",
      buttons: ["OK"]
    });
    return;
  }

  const { canceled, filePath } = await dialog.showSaveDialog(mainWin, {
    title: "Save Game",
    defaultPath: `zubrenn-map.${SAVE_EXT}`,
    filters: [
      { name: "Zubrenn Save", extensions: [SAVE_EXT] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (canceled || !filePath) return;

  try {
    const data = serializeSave(buildSaveObject(gameState));
    fs.writeFileSync(filePath, data, "utf8");
  } catch (err) {
    console.error("Save failed:", err);
    await dialog.showMessageBox(mainWin, {
      type: "error",
      message: "Save failed",
      detail: String(err && err.message || err),
      buttons: ["OK"]
    });
  }
}

async function loadGame() {
  if (!mainWin || mainWin.isDestroyed()) {
    mainWin = createWindow();
  }

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWin, {
    title: "Load Game",
    properties: ["openFile"],
    filters: [
      { name: "Zubrenn Save", extensions: [SAVE_EXT] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (canceled || !filePaths || !filePaths.length) return;

  const filePath = filePaths[0];
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error("Load: read/parse failed:", err);
    await dialog.showMessageBox(mainWin, {
      type: "error",
      message: "Could not open save file",
      detail: "The file is not valid JSON or could not be read.",
      buttons: ["OK"]
    });
    return;
  }

  // Validate leniently.
  const map = parsed && parsed.map;
  const terrain = map && map.terrain;
  const validTerrain =
    Array.isArray(terrain) && terrain.length > 0 &&
    Array.isArray(terrain[0]) && terrain[0].length > 0;
  if (parsed.format !== SAVE_FORMAT || !validTerrain) {
    await dialog.showMessageBox(mainWin, {
      type: "error",
      message: "Unrecognized save file",
      detail: "This file does not look like a Zubrenn save with a valid map.",
      buttons: ["OK"]
    });
    return;
  }
  if (parsed.version > SAVE_VERSION) {
    const { response } = await dialog.showMessageBox(mainWin, {
      type: "warning",
      message: "Newer save version",
      detail: `This save was made by a newer version (v${parsed.version}). ` +
        `Some data may be ignored. Continue loading?`,
      buttons: ["Cancel", "Load Anyway"],
      defaultId: 1,
      cancelId: 0
    });
    if (response === 0) return;
  }

  mainWin.show();
  mainWin.focus();

  const payload = {
    meta: map.meta || null,
    terrain: map.terrain,
    elevation: map.elevation || null,
    rivers: map.rivers || [],
    improvements: parsed.improvements || [],
    pieces: parsed.pieces || []
  };
  const send = () => {
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send("load-game", payload);
  };
  if (mainWin.webContents.isLoading()) {
    mainWin.webContents.once("did-finish-load", send);
  } else {
    send();
  }
}

function showSplash(nagOnly) {
  const splash = new BrowserWindow({
    width: 320,
    height: 340,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    icon: appIcon,
    parent: nagOnly ? mainWin : undefined,
    modal: !!nagOnly,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  splash.loadFile(path.join(__dirname, "splash.html"));
  splash.webContents.once("did-finish-load", () => {
    splash.webContents.send("icon-path", APP_ICON_PATH);
    splash.webContents.send("app-version", pkg.version);
  });

  const handler = () => {
    if (!splash.isDestroyed()) splash.close();
    if (!nagOnly) createWindow();
  };
  ipcMain.once("splash-close", handler);
  splash.on("closed", () => ipcMain.removeListener("splash-close", handler));
}

app.whenReady().then(() => {
  const { licenseKey, userName } = load();
  if (isValidLicense(licenseKey, userName)) {
    createWindow();
  } else {
    showSplash();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
