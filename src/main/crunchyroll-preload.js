const { webFrame } = require("electron");

const chrome = process.versions.chrome || "144.0.0.0";
const major = chrome.split(".")[0];
const platform =
  process.platform === "win32"
    ? "Windows"
    : process.platform === "darwin"
      ? "macOS"
      : "Linux";

const script = `(() => {
  const brands = [
    { brand: "Not/A)Brand", version: "8" },
    { brand: "Chromium", version: "${major}" },
    { brand: "Google Chrome", version: "${major}" },
  ];
  const fullVersionList = [
    { brand: "Not/A)Brand", version: "10.0.0.0" },
    { brand: "Chromium", version: "${chrome}" },
    { brand: "Google Chrome", version: "${chrome}" },
  ];
  const uaData = {
    brands,
    mobile: false,
    platform: "${platform}",
    getHighEntropyValues: async () => ({
      brands,
      fullVersionList,
      mobile: false,
      platform: "${platform}",
      platformVersion: "15.0.0",
      architecture: "x86",
      bitness: "64",
      model: "",
      uaFullVersion: "${chrome}",
      wow64: false,
    }),
    toJSON() {
      return { brands, mobile: false, platform: "${platform}" };
    },
  };
  try {
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      get: () => uaData,
    });
  } catch {}
})();`;

webFrame.executeJavaScript(script).catch(() => {});
