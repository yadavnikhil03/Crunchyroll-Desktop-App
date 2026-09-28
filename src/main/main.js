const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  shell,
  screen,
  components,
} = require("electron");
const path = require("path");
const { config, isDomainAllowed } = require("./config");
const settings = require("./settings");
const discord = require("./discord");

const BOUNDS_SAVE_DELAY = 400;
const BLOCKED_PERMISSIONS = new Set([
  "geolocation",
  "notifications",
  "midi",
  "midiSysex",
  "hid",
  "serial",
  "usb",
  "idle-detection",
  "display-capture",
  "window-management",
]);

let mainWindow = null;
let webContentsView = null;
let appWebContents = null;
let boundsTimer = null;
let isQuitting = false;
let settingsOpen = false;
let isLoading = true;

app.disableHardwareAcceleration();

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function send(channel, ...args) {
  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    !mainWindow.webContents.isDestroyed()
  ) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function updateViewBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || !webContentsView) return;

  if (isLoading) {
    webContentsView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    return;
  }

  const bounds = mainWindow.getContentBounds();
  const isFullScreen = mainWindow.isFullScreen();
  const y = isFullScreen ? 0 : 48;
  const height = bounds.height - y;
  const width = bounds.width - (settingsOpen ? 380 : 0);

  webContentsView.setBounds({ x: 0, y, width, height });
}

function restoreBounds() {
  const { width, height, minWidth, minHeight } = config.window;
  const saved = settings.get("windowBounds", null);

  if (
    !saved ||
    !Number.isFinite(saved.width) ||
    !Number.isFinite(saved.height)
  ) {
    return { width, height };
  }

  const bounds = {
    width: Math.max(saved.width, minWidth),
    height: Math.max(saved.height, minHeight),
  };

  if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    const area = screen.getDisplayMatching({
      x: saved.x,
      y: saved.y,
      width: bounds.width,
      height: bounds.height,
    }).workArea;
    const visible =
      saved.x < area.x + area.width &&
      saved.x + bounds.width > area.x &&
      saved.y < area.y + area.height &&
      saved.y + bounds.height > area.y;
    if (visible) {
      bounds.x = saved.x;
      bounds.y = saved.y;
    }
  }

  return bounds;
}

function saveBounds() {
  if (boundsTimer) clearTimeout(boundsTimer);
  boundsTimer = setTimeout(() => {
    boundsTimer = null;
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      mainWindow.isMinimized() ||
      mainWindow.isFullScreen()
    )
      return;
    settings.set("windowBounds", mainWindow.getNormalBounds());
    settings.set("windowMaximized", mainWindow.isMaximized());
  }, BOUNDS_SAVE_DELAY);
  boundsTimer.unref?.();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    center: true,
    minWidth: config.window.minWidth,
    minHeight: config.window.minHeight,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#0F0F0F",
    icon: path.join(__dirname, "..", "..", "assets", "icon.ico"),
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false,
      webviewTag: false,
    },
  });

  if (settings.get("windowMaximized", false)) {
    mainWindow.maximize();
  }

  mainWindow.loadFile(
    path.join(__dirname, "..", "..", "dist", "renderer", "index.html"),
  );

  webContentsView = new WebContentsView({
    webPreferences: {
      partition: "persist:crunchyroll",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      plugins: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  mainWindow.contentView.addChildView(webContentsView);
  appWebContents = webContentsView.webContents;

  appWebContents.setWindowOpenHandler(({ url }) => {
    if (isDomainAllowed(url)) {
      appWebContents.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  appWebContents.on("will-navigate", (event, url) => {
    if (!isDomainAllowed(url)) {
      event.preventDefault();
    }
  });

  appWebContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const history = appWebContents.navigationHistory;

    if (input.alt && input.key === "ArrowLeft") {
      if (history.canGoBack()) history.goBack();
      event.preventDefault();
    } else if (input.alt && input.key === "ArrowRight") {
      if (history.canGoForward()) history.goForward();
      event.preventDefault();
    } else if (
      input.key === "F5" ||
      (input.control && input.key.toLowerCase() === "r")
    ) {
      appWebContents.reload();
      event.preventDefault();
    }
  });

  appWebContents.session.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      callback(!BLOCKED_PERMISSIONS.has(permission));
    },
  );

  const relay = (eventStr, ...args) => send(`view:${eventStr}`, ...args);

  appWebContents.on("did-navigate", (e, url) => relay("did-navigate", { url }));
  appWebContents.on("did-navigate-in-page", (e, url, isMainFrame) => {
    relay("did-navigate-in-page", { url, isMainFrame });
  });
  appWebContents.on("media-started-playing", () =>
    relay("media-started-playing"),
  );
  appWebContents.on("media-paused", () => relay("media-paused"));
  appWebContents.on(
    "did-fail-load",
    (e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      relay("did-fail-load", { errorCode, errorDescription, isMainFrame });
    },
  );
  appWebContents.on("dom-ready", () => relay("dom-ready"));
  appWebContents.on("enter-html-full-screen", () =>
    relay("enter-html-full-screen"),
  );
  appWebContents.on("leave-html-full-screen", () =>
    relay("leave-html-full-screen"),
  );
  appWebContents.on("render-process-gone", () => relay("render-process-gone"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    updateViewBounds();
  });

  mainWindow.on("maximize", () => {
    send("window-state", "maximized");
    saveBounds();
    updateViewBounds();
  });

  mainWindow.on("unmaximize", () => {
    send("window-state", "normal");
    saveBounds();
    updateViewBounds();
  });

  mainWindow.on("enter-full-screen", () => {
    send("window-state", "fullscreen");
    updateViewBounds();
  });

  mainWindow.on("leave-full-screen", () => {
    send("window-state", mainWindow.isMaximized() ? "maximized" : "normal");
    updateViewBounds();
  });

  mainWindow.on("resize", () => {
    saveBounds();
    updateViewBounds();
  });

  mainWindow.on("move", saveBounds);

  mainWindow.on("app-command", (_, command) => {
    if (!appWebContents || appWebContents.isDestroyed()) return;
    const history = appWebContents.navigationHistory;

    if (command === "browser-backward" && history.canGoBack()) {
      history.goBack();
    } else if (command === "browser-forward" && history.canGoForward()) {
      history.goForward();
    }
  });

  mainWindow.on("close", () => {
    if (boundsTimer) {
      clearTimeout(boundsTimer);
      boundsTimer = null;
    }
    if (!mainWindow.isMinimized() && !mainWindow.isFullScreen()) {
      settings.set("windowBounds", mainWindow.getNormalBounds());
      settings.set("windowMaximized", mainWindow.isMaximized());
    }
    settings.flush();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    webContentsView = null;
    appWebContents = null;
  });

  if (config.discord.enabled) {
    discord.init(config.discord.appId);
  }
}

app.on("web-contents-created", (_, contents) => {
  if (contents === mainWindow?.webContents) {
    contents.setWindowOpenHandler(({ url }) => {
      if (isDomainAllowed(url)) shell.openExternal(url);
      return { action: "deny" };
    });
    contents.on("will-navigate", (event) => {
      event.preventDefault();
    });
  }
});

ipcMain.handle("view:scrape", async (_, script) => {
  if (appWebContents && !appWebContents.isDestroyed()) {
    try {
      return await appWebContents.executeJavaScript(script);
    } catch {}
  }
  return null;
});

ipcMain.handle("view:reload", () => {
  if (appWebContents && !appWebContents.isDestroyed()) {
    appWebContents.reload();
  }
});

ipcMain.handle("view:load-url", (_, url) => {
  if (appWebContents && !appWebContents.isDestroyed()) {
    appWebContents.loadURL(url);
  }
});

ipcMain.handle("view:insert-css", (_, css) => {
  if (appWebContents && !appWebContents.isDestroyed()) {
    return appWebContents.insertCSS(css);
  }
});

ipcMain.handle("view:set-settings-open", (_, isOpen) => {
  settingsOpen = isOpen;
  updateViewBounds();
});

ipcMain.handle("view:set-is-loading", (_, loading) => {
  isLoading = loading;
  updateViewBounds();
});

ipcMain.handle("window:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("window:maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle("window:close", () => {
  mainWindow?.close();
});

ipcMain.handle("window:is-maximized", () => mainWindow?.isMaximized() ?? false);

ipcMain.handle("settings:get", (_, key) => settings.get(key));

ipcMain.handle("settings:set", (_, key, value) => {
  settings.set(key, value);
});

ipcMain.handle("settings:get-hardware-accel", () =>
  settings.get("hardwareAcceleration", config.hardwareAcceleration),
);

ipcMain.handle("settings:set-hardware-accel", (_, enabled) => {
  settings.set("hardwareAcceleration", enabled === true);
  settings.flush();
});

ipcMain.handle("app:restart", () => {
  settings.flush();
  app.relaunch();
  app.exit(0);
});

ipcMain.handle("app:get-config", () => ({
  allowedDomains: config.allowedDomains,
  homeUrl: config.homeUrl,
  version: app.getVersion(),
  discordEnabled: config.discord.enabled,
}));

ipcMain.handle("app:get-start-url", () => {
  const saved = settings.get("lastUrl", null);
  return typeof saved === "string" && isDomainAllowed(saved)
    ? saved
    : config.homeUrl;
});

ipcMain.handle("app:set-last-url", (_, url) => {
  if (typeof url === "string" && isDomainAllowed(url)) {
    settings.set("lastUrl", url);
  }
});

ipcMain.handle("discord:update", (_, activity) => {
  discord.updatePresence(activity);
});

ipcMain.handle("shell:open-external", (_, url) => {
  if (typeof url !== "string") return;
  let protocol;
  try {
    ({ protocol } = new URL(url));
  } catch {
    return;
  }
  if (protocol === "https:" || protocol === "http:") {
    shell.openExternal(url);
  }
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  try {
    await components.whenReady();
  } catch {}
  createWindow();
});

app.on("before-quit", async (event) => {
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;

  settings.flush();
  await discord.shutdown();
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
