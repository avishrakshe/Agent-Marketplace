const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");

function bin(name, workspace) {
  const candidate = path.join(ROOT, workspace || "", "node_modules", ".bin", name + (process.platform === "win32" ? ".cmd" : ""));
  if (fs.existsSync(candidate)) return candidate;
  const rootCandidate = path.join(ROOT, "node_modules", ".bin", name + (process.platform === "win32" ? ".cmd" : ""));
  if (fs.existsSync(rootCandidate)) return rootCandidate;
  return candidate;
}

const procs = [];

function quoteArg(arg) {
  return arg.includes(" ") ? `"${arg}"` : arg;
}

function start(label, cmd, args, cwd, env = {}) {
  const command = process.platform === "win32"
    ? `cmd.exe /c ${[cmd, ...args].map(quoteArg).join(" ")}`
    : [cmd, ...args].map(quoteArg).join(" ");
  console.log(`[dev-all] Starting ${label}: ${command}`);
  const child = spawn(command, { cwd, env: { ...process.env, ...env }, stdio: "inherit", shell: true });
  child.on("exit", (code) => console.log(`[dev-all] ${label} exited (${code})`));
  procs.push({ label, child });
  return child;
}

async function waitForRpc(url, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
      });
      if (resp.ok) { console.log("[dev-all] RPC ready at", url); return; }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("RPC not ready: " + url);
}

async function main() {
  require("dotenv").config({ path: path.join(ROOT, ".env") });
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:9650";

  start("devnet", bin("hardhat", "contracts"), ["node", "--port", "9650", "--hostname", "127.0.0.1"], path.join(ROOT, "contracts"));
  await waitForRpc(rpcUrl);

  const deployCmd = `cmd.exe /c ${[bin("hardhat", "contracts"), "run", "scripts/deploy.js", "--network", "agentmarket"].map(quoteArg).join(" ")}`;
  const deploy = spawn(deployCmd, { cwd: path.join(ROOT, "contracts"), stdio: "inherit", shell: true });
  await new Promise((res, rej) => deploy.on("exit", (c) => (c === 0 ? res() : rej(new Error("deploy failed")))));

  const fundCmd = `cmd.exe /c ${[bin("hardhat", "contracts"), "run", "../scripts/fund-orchestrator.js", "--network", "agentmarket"].map(quoteArg).join(" ")}`;
  const fund = spawn(fundCmd, { cwd: path.join(ROOT, "contracts"), stdio: "inherit", shell: true });
  await new Promise((res) => fund.on("exit", (c) => {
    if (c !== 0) console.warn("[dev-all] fund orchestrator exited", c, "— continuing if balance already OK");
    res();
  }));

  start("auditor", "node", ["server.js"], path.join(ROOT, "services", "specialist-auditor"));
  start("risk-scorer", "node", ["server.js"], path.join(ROOT, "services", "specialist-risk-scorer"));
  start("gas-timing", "node", ["server.js"], path.join(ROOT, "services", "specialist-gas-timing"));
  start("orchestrator", "python", ["main.py"], path.join(ROOT, "services", "orchestrator"));
  start("frontend", bin("next", "frontend"), ["dev", "-p", "3000"], path.join(ROOT, "frontend"));

  process.on("SIGINT", () => { procs.forEach(({ child }) => child.kill()); process.exit(0); });
}

main().catch((e) => { console.error(e); process.exit(1); });
