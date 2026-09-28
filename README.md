<h1 align="center">Crunchyroll Desktop App</h1>

<p align="center">
  A lightweight desktop client for Crunchyroll, built with Electron and the CastLabs Widevine runtime.
</p>

<p align="center">
  <img
    src="https://github.com/user-attachments/assets/7d9d4a12-8439-44d4-b7ef-f9bf0b6166de"
    alt="Crunchyroll Desktop App"
    width="100%"
  />
</p>

## Features

- **Widevine DRM playback** — Full catalogue support via the CastLabs Electron runtime with production VMP signing.
- **Discord Rich Presence** — Shows the series, season and episode you're watching, along with playback progress and pause status.
- **Hardware acceleration toggle** — Disable it for screen sharing or enable it for smoother playback. Requires a restart to apply.
- **Session restore** — Restores your last page and remembers window size, position and maximised state.
- **Custom title bar** — Frameless window with custom controls, hidden during fullscreen playback.
- **Settings sidebar** — Slide-in settings panel, closable with `Escape` or by clicking outside.
- **Navigation shortcuts** — `Alt + Left` / `Alt + Right` for history, mouse back/forward buttons, and `F5` / `Ctrl + R` to reload.
- **Error recovery** — Failed page loads and renderer crashes show a retry prompt instead of a blank window.
- **Domain allowlist** — Navigation and popups are restricted to Crunchyroll and its required sign-in providers.

## Tech Stack

- Electron (CastLabs fork, for Widevine)
- React
- Tailwind CSS
- Webpack

## Install

Download the latest installer from the [Releases](https://github.com/yadavnikhil03/Crunchyroll-Desktop-App/releases) page and run it.

## Build From Source

Requires Node.js, Python, and a free [CastLabs EVS account](https://github.com/castlabs/electron-releases/wiki/EVS).

```bash
npm install
npm run build
npx electron-builder --win
python -m castlabs_evs.vmp sign-pkg release\win-unpacked
npx electron-builder --win --prepackaged release\win-unpacked
