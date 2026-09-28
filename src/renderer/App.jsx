import { useState, useEffect, useRef, useCallback } from "react";
import TitleBar from "./components/TitleBar";
import SettingsPanel from "./components/SettingsPanel";
import { PAGE_SCRAPE_JS, contextFromUrl, activityFromPage } from "./presence";

const SCRAPE_DELAY = 2000;
const WATCH_POLL_INTERVAL = 10000;
const URL_SAVE_DELAY = 1500;

const SCROLLBAR_CSS = `
  ::-webkit-scrollbar { width: 14px; height: 14px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; border: 4px solid transparent; background-clip: padding-box; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.4); border: 4px solid transparent; background-clip: padding-box; }
  ::-webkit-scrollbar-corner { background: transparent; }
`;

export default function App() {
  const [windowState, setWindowState] = useState("normal");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [startUrl, setStartUrl] = useState(null);

  const scrapeTimerRef = useRef(null);
  const pollTimerRef = useRef(null);
  const urlTimerRef = useRef(null);
  const trackedUrlRef = useRef(null);

  const scrapePresence = useCallback(async () => {
    try {
      const raw = await window.electronAPI.view.scrape(PAGE_SCRAPE_JS);
      if (!raw) return;
      const activity = activityFromPage(JSON.parse(raw));
      if (activity) window.electronAPI.discord.update(activity);
    } catch {}
  }, []);

  const trackPage = useCallback(
    (url) => {
      if (url === trackedUrlRef.current) return;
      trackedUrlRef.current = url;

      clearTimeout(scrapeTimerRef.current);
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;

      const { activity, track } = contextFromUrl(url);
      window.electronAPI.discord.update(activity);
      if (!track) return;

      scrapeTimerRef.current = setTimeout(() => {
        scrapePresence();
        if (track === "watch") {
          pollTimerRef.current = setInterval(
            scrapePresence,
            WATCH_POLL_INTERVAL,
          );
        }
      }, SCRAPE_DELAY);
    },
    [scrapePresence],
  );

  const rememberUrl = useCallback((url) => {
    clearTimeout(urlTimerRef.current);
    urlTimerRef.current = setTimeout(() => {
      window.electronAPI.app.setLastUrl(url);
    }, URL_SAVE_DELAY);
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI.window.onStateChange(setWindowState);

    window.electronAPI.window.isMaximized().then((maximized) => {
      setWindowState(maximized ? "maximized" : "normal");
    });

    window.electronAPI.app.getStartUrl().then(setStartUrl);

    return () => {
      unsubscribe?.();
      clearTimeout(scrapeTimerRef.current);
      clearTimeout(urlTimerRef.current);
      clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const on = window.electronAPI.view.on;

    const unsubs = [
      on("dom-ready", () => {
        setLoading(false);
        setLoadError(null);
        window.electronAPI.view.insertCSS(SCROLLBAR_CSS).catch(() => {});
      }),
      on("did-navigate", ({ url }) => {
        setLoadError(null);
        trackPage(url);
        rememberUrl(url);
      }),
      on("did-navigate-in-page", ({ url, isMainFrame }) => {
        if (!isMainFrame) return;
        trackPage(url);
        rememberUrl(url);
      }),
      on("media-started-playing", scrapePresence),
      on("media-paused", scrapePresence),
      on("did-fail-load", ({ errorCode, errorDescription, isMainFrame }) => {
        if (!isMainFrame || errorCode === -3) return;
        setLoading(false);
        setLoadError(errorDescription || "Failed to load Crunchyroll");
      }),
      on("enter-html-full-screen", () => setWindowState("fullscreen")),
      on("leave-html-full-screen", () => {
        window.electronAPI.window.isMaximized().then((maximized) => {
          setWindowState(maximized ? "maximized" : "normal");
        });
      }),
      on("render-process-gone", () =>
        setLoadError("The page crashed. Try reloading."),
      ),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [trackPage, rememberUrl, scrapePresence]);

  useEffect(() => {
    if (startUrl) {
      window.electronAPI.view.loadUrl(startUrl);
    }
  }, [startUrl]);

  useEffect(() => {
    if (settingsOpen) {
      window.electronAPI.view.setSettingsOpen(true);
    } else {
      const timer = setTimeout(() => {
        window.electronAPI.view.setSettingsOpen(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [settingsOpen]);

  useEffect(() => {
    window.electronAPI.view.setIsLoading(loading || !!loadError);
  }, [loading, loadError]);

  const retry = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    window.electronAPI.view.reload();
  }, []);

  const isFullscreen = windowState === "fullscreen";

  return (
    <div className="flex flex-col h-screen w-screen bg-cr-dark">
      {!isFullscreen && (
        <TitleBar
          windowState={windowState}
          onSettingsToggle={() => setSettingsOpen((open) => !open)}
        />
      )}

      <div className="relative flex-1 overflow-hidden">
        {loading && !loadError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-b from-[#0f0f13] to-[#16161a] transition-opacity duration-500">
            <div className="flex flex-col items-center gap-8">
              <div className="relative flex items-center justify-center w-16 h-16">
                <div className="absolute w-full h-full border-[3px] border-white/5 rounded-full" />
                <div className="absolute w-full h-full border-[3px] border-cr-orange border-t-transparent border-l-transparent rounded-full animate-spin" style={{ animationDuration: '1.2s' }} />
                <div className="absolute w-10 h-10 bg-cr-orange rounded-full opacity-10 animate-pulse" style={{ filter: 'blur(8px)' }} />
              </div>
              <span className="text-[#a0a0a0] text-xs font-semibold tracking-[0.25em] uppercase">
                Loading Crunchyroll
              </span>
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-b from-[#0f0f13] to-[#16161a]">
            <div className="flex flex-col items-center gap-5 px-10 py-10 text-center bg-[#1a1a1e]/60 backdrop-blur-2xl border border-white/5 rounded-2xl shadow-2xl transform transition-all">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-1">
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-gray-100 text-lg font-semibold tracking-tight">
                  Connection Lost
                </h3>
                <p className="text-[#888] text-sm max-w-[260px] leading-relaxed">
                  {loadError}
                </p>
              </div>
              <button
                onClick={retry}
                className="mt-4 px-8 py-2.5 rounded-full bg-cr-orange hover:bg-[#ff8c3a] text-white text-sm font-semibold tracking-wide transition-all duration-300 hover:shadow-[0_4px_20px_rgba(244,117,33,0.3)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </div>
  );
}
