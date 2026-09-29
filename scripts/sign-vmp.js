const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const target = path.resolve(
  process.argv[2] || path.join(__dirname, "..", "node_modules", "electron", "dist"),
);

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: "inherit" });
}

function sign(dir) {
  const moduleArgs = ["-m", "castlabs_evs.vmp", "sign-pkg", dir];
  const attempts = [
    ["python", moduleArgs],
    ["python3", moduleArgs],
    ["py", ["-3", ...moduleArgs]],
  ];

  let lastError;
  for (const [cmd, args] of attempts) {
    try {
      run(cmd, args);
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

if (!fs.existsSync(target)) {
  console.warn(`VMP sign skipped: ${target} does not exist`);
  process.exit(0);
}

try {
  sign(target);
} catch (err) {
  console.warn(
    "Widevine VMP signing was skipped. Crunchyroll playback needs a CastLabs EVS signature.",
  );
  console.warn(
    "Install and log in, then run: npm run sign-electron",
  );
  console.warn("https://github.com/castlabs/electron-releases/wiki/EVS");
  if (process.env.EVS_REQUIRED === "1") {
    process.exit(1);
  }
}
