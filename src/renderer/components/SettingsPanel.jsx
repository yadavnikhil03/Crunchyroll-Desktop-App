import { useState, useEffect, useRef, useCallback } from "react";
import iconUrl from "../../../assets/icon-128.png";

const ANIMATION_MS = 200;

const styles = {
  overlay: (hidden) => ({
    position: "absolute",
    inset: 0,
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    transition: `opacity ${ANIMATION_MS}ms`,
    opacity: hidden ? 0 : 1,
  }),
  panel: (hidden) => ({
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 30,
    width: 380,
    display: "flex",
    flexDirection: "column",
    background: "linear-gradient(180deg, #161616 0%, #0a0a0a 100%)",
    borderLeft: "1px solid var(--color-hairline)",
    boxShadow: "var(--shadow-panel)",
    transition: `transform ${ANIMATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
    transform: hidden ? "translateX(100%)" : "translateX(0)",
    willChange: "transform",
    fontFamily: "var(--font-sans)",
  }),
  header: {
    display: "flex",
    alignItems: "center",
    padding: "32px 28px 24px",
    borderBottom: "1px solid var(--color-hairline)",
  },
  headerIcon: {
    width: 44,
    height: 44,
    marginRight: 16,
    flexShrink: 0,
    borderRadius: "var(--radius-control)",
    border: "1px solid var(--color-hairline)",
    background: "var(--color-fill)",
    padding: 8,
    boxSizing: "border-box",
  },
  headerIconImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  headerTitle: {
    fontFamily: "var(--font-sans)",
    fontSize: 20,
    fontWeight: 600,
    color: "var(--color-label)",
    letterSpacing: "var(--cr-track-tight)",
  },
  headerSubtitle: {
    fontFamily: "var(--font-sans)",
    fontSize: 11,
    fontWeight: 600,
    color: "#F47521",
    letterSpacing: "var(--cr-track-caps)",
    textTransform: "uppercase",
    marginTop: 4,
  },
  closeBtn: {
    marginLeft: "auto",
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "transparent",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "var(--color-secondary)",
    transition: "background 200ms ease, color 200ms ease",
  },
  body: {
    flex: 1,
    overflowY: "auto",
    scrollbarGutter: "stable",
  },
  section: {
    padding: "28px 28px 8px",
  },
  sectionLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--color-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "var(--cr-track-caps)",
    marginBottom: 16,
  },
  row: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    gap: 14,
    padding: "16px 20px",
    background: "var(--color-fill)",
    border: "1px solid var(--color-hairline)",
    borderRadius: "var(--radius-row)",
    cursor: "pointer",
    transition:
      "background 250ms cubic-bezier(0.16, 1, 0.3, 1), border-color 250ms cubic-bezier(0.16, 1, 0.3, 1), transform 250ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 250ms cubic-bezier(0.16, 1, 0.3, 1)",
    textAlign: "left",
    color: "var(--color-label)",
    fontSize: 14,
    fontWeight: 500,
  },
  toggleTrack: (on) => ({
    position: "relative",
    width: 48,
    height: 26,
    borderRadius: 13,
    background: on ? "#F47521" : "rgba(255, 255, 255, 0.12)",
    cursor: "pointer",
    transition: "background 300ms cubic-bezier(0.16, 1, 0.3, 1)",
    flexShrink: 0,
    border: "none",
    padding: 0,
  }),
  toggleThumb: (on) => ({
    position: "absolute",
    top: 2,
    left: on ? 24 : 2,
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: on ? "0 2px 6px rgba(244, 117, 33, 0.4)" : "0 2px 4px rgba(0,0,0,0.3)",
    transition: "left 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms",
  }),
  footer: {
    padding: "24px 28px",
    borderTop: "1px solid var(--color-hairline)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#F47521",
    marginRight: 8,
    display: "inline-block",
    boxShadow: "0 0 8px rgba(244, 117, 33, 0.6)",
  },
  footerText: {
    fontFamily: "var(--font-sans)",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "var(--cr-track-caps)",
    color: "var(--color-tertiary)",
    textTransform: "uppercase",
    fontVariantNumeric: "tabular-nums",
  },
};

function hoverHandlers(enter, leave) {
  return {
    onMouseEnter: (e) => Object.assign(e.currentTarget.style, enter),
    onMouseLeave: (e) => Object.assign(e.currentTarget.style, leave),
  };
}

const iconHover = hoverHandlers(
  { background: "var(--color-fill-hover)", color: "#fff" },
  { background: "transparent", color: "var(--color-secondary)" },
);

const rowHover = hoverHandlers(
  {
    background: "var(--color-fill-hover)",
    borderColor: "rgba(244, 117, 33, 0.4)",
    transform: "translateY(-1px)",
    boxShadow: "var(--shadow-raised)",
  },
  {
    background: "var(--color-fill)",
    borderColor: "var(--color-hairline)",
    transform: "translateY(0)",
    boxShadow: "none",
  },
);

function GpuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ flexShrink: 0 }}
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      style={{ opacity: 0.5 }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

export default function SettingsPanel({ open, onClose }) {
  const [hardwareAccel, setHardwareAccel] = useState(true);
  const [version, setVersion] = useState("");
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(true);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    setMounted(true);
    clearTimeout(closeTimerRef.current);

    window.electronAPI.settings.getHardwareAccel().then(setHardwareAccel);
    window.electronAPI.app.getConfig().then((cfg) => setVersion(cfg.version));

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setHidden(false));
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (open || !mounted) return undefined;

    setHidden(true);
    closeTimerRef.current = setTimeout(() => setMounted(false), ANIMATION_MS);

    return () => clearTimeout(closeTimerRef.current);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleToggle = useCallback(async (enabled) => {
    setHardwareAccel(enabled);
    await window.electronAPI.settings.setHardwareAccel(enabled);
    await window.electronAPI.app.restart();
  }, []);

  const openRepo = useCallback(() => {
    window.electronAPI.shell.openExternal(
      "https://github.com/yadavnikhil03/Crunchyroll-Desktop-App",
    );
  }, []);

  if (!mounted) return null;

  return (
    <>
      <div style={styles.overlay(hidden)} onClick={onClose} />

      <div style={styles.panel(hidden)}>
        <div style={styles.header}>
          <div style={styles.headerIcon}>
            <img src={iconUrl} alt="" style={styles.headerIconImg} />
          </div>
          <div>
            <div style={styles.headerTitle}>Settings</div>
            <div style={styles.headerSubtitle}>Crunchyroll-Desktop-App</div>
          </div>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            title="Close"
            {...iconHover}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Performance</div>

            <div style={styles.row} {...rowHover}>
              <div
                style={{
                  color: hardwareAccel ? "#F47521" : "var(--color-secondary)",
                  flexShrink: 0,
                }}
              >
                <GpuIcon />
              </div>
              <span
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-label)",
                }}
              >
                Hardware Acceleration
              </span>
              <button
                style={styles.toggleTrack(hardwareAccel)}
                onClick={() => handleToggle(!hardwareAccel)}
                title="Changing this restarts the app"
              >
                <div style={styles.toggleThumb(hardwareAccel)} />
              </button>
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionLabel}>Links</div>

            <button style={styles.row} onClick={openRepo} {...rowHover}>
              <GitHubIcon />
              <span style={{ flex: 1 }}>GitHub Repository</span>
              <ChevronIcon />
            </button>
          </div>
        </div>

        <div style={styles.footer}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={styles.footerDot} />
            <span style={styles.footerText}>
              {version ? `v${version}` : ""}
            </span>
          </div>
          <span style={styles.footerText}>By Nikhil Yadav</span>
        </div>
      </div>
    </>
  );
}
