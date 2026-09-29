const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function afterPack(context) {
  if (process.platform === "linux") return;

  const dir = context.appOutDir;
  const moduleArgs = ["-m", "castlabs_evs.vmp", "sign-pkg", dir];
  const attempts = [
    ["python", moduleArgs],
    ["python3", moduleArgs],
    ["py", ["-3", ...moduleArgs]],
  ];

  for (const [cmd, args] of attempts) {
    try {
      execFileSync(cmd, args, { stdio: "inherit" });
      return;
    } catch {
      // try the next interpreter
    }
  }

  console.warn(
    `Widevine VMP signing failed for ${path.basename(dir)}. Sign it with: python -m castlabs_evs.vmp sign-pkg "${dir}"`,
  );
};
