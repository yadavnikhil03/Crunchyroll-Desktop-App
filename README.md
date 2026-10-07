<h1 align="center">Crunchyroll Desktop App for Windows</h1>

<p align="center">
  <strong>The Ultimate Unofficial Crunchyroll Desktop Client for Windows PC</strong><br>
  A lightweight, feature-rich desktop client built with Electron, featuring Widevine DRM support, Discord Rich Presence, and a modern frameless UI.
</p>

<p align="center">
  <a href="https://github.com/yadavnikhil03/Crunchyroll-Desktop-App/releases/latest"><img src="https://img.shields.io/github/v/release/yadavnikhil03/Crunchyroll-Desktop-App?style=for-the-badge&color=F47521&label=Latest%20Release" alt="Latest Release"></a>
  <a href="https://github.com/yadavnikhil03/Crunchyroll-Desktop-App/releases"><img src="https://img.shields.io/github/downloads/yadavnikhil03/Crunchyroll-Desktop-App/total?style=for-the-badge&color=34d399" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Platform">
</p>

<p align="center">
  <img
    src="https://github.com/user-attachments/assets/7d9d4a12-8439-44d4-b7ef-f9bf0b6166de"
    alt="Crunchyroll Desktop App Interface"
    width="100%"
  />
</p>

## Overview
Are you looking for a dedicated **Crunchyroll desktop app** for Windows? This open-source client provides a native, seamless anime streaming experience without the bloat of a web browser. Built for performance, it offers features that anime fans and gamers need, such as hardware acceleration control and Discord integration.

## Key Features
- **Native Widevine DRM Playback:** Watch high-definition anime securely on your PC without DRM errors.
- **Discord Rich Presence (RPC):** Show your friends exactly which anime and episode you are watching.
- **Hardware Acceleration Control:** Optimize performance or disable acceleration for black-screen-free Discord screen sharing.
- **Cinematic Frameless UI:** A custom, distraction-free interface built specifically for desktop streaming.
- **Smart Session Restore:** Never lose your place. The app restores your last visited page and remembers your exact window size, position, and maximized state.
- **Auto-Updates & Security:** Built-in seamless auto-updater and strict domain allowlisting ensures a secure, private experience.

## Installation

Getting started with the Crunchyroll Desktop App is easy:

1. Go to the [Releases](https://github.com/yadavnikhil03/Crunchyroll-Desktop-App/releases/latest) page.
2. Download the latest `.exe` installer (e.g., `Crunchyroll-Desktop-App Setup 1.1.0.exe`).
3. Run the installer. 
4. Log in to your Crunchyroll account and start watching!

*(Note: Because this is an open-source project, Windows SmartScreen might show a warning. Click **More info -> Run anyway** to install).*

## Tech Stack

This project is built using modern web and desktop technologies:
- **[Electron](https://www.electronjs.org/)** (CastLabs fork for Widevine DRM support)
- **[React](https://reactjs.org/)** 
- **[Tailwind CSS](https://tailwindcss.com/)**
- **Webpack**

## Build From Source

If you are a developer and want to build the app locally, you will need Node.js, Python, and a free [CastLabs EVS account](https://github.com/castlabs/electron-releases/wiki/EVS).

```bash
# Clone the repository
git clone https://github.com/yadavnikhil03/Crunchyroll-Desktop-App.git
cd Crunchyroll-Desktop-App

# Install dependencies
npm install

# Build the React frontend
npm run build

# Package the app for Windows
npx electron-builder --win

# Sign the package (Requires CastLabs EVS)
python -m castlabs_evs.vmp sign-pkg release\win-unpacked

# Create the final installer executable
npx electron-builder --win --prepackaged release\win-unpacked
```


---
<p align="center">
  <i>Made for anime fans.</i>
</p>
