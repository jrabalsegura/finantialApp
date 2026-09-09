import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const development = args[0] === "--dev";
if (development) args.shift();
loadEnvConfig(process.cwd(), development);
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
if (
  !secret ||
  secret.length < 32 ||
  [
    "development-only-change-before-publishing",
    "replace-with-at-least-32-random-bytes",
    "change-me-before-publishing"
  ].includes(secret)
) {
  throw new Error(
    "Configura AUTH_SECRET con un secreto aleatorio de al menos 32 caracteres antes de arrancar."
  );
}
const children = [
  spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", development ? "dev" : "start", ...args],
    { stdio: "inherit" }
  ),
  spawn(process.execPath, ["--import", "tsx", "scripts/recurring-worker.ts"], {
    stdio: "inherit"
  })
];
let shuttingDown = false;
function shutdown(code, signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill(signal);
  const timeout = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 10_000);
  timeout.unref();
  Promise.all(
    children.map((child) =>
      child.exitCode !== null || child.signalCode
        ? Promise.resolve()
        : new Promise((resolve) => child.once("exit", resolve))
    )
  ).then(() => {
    clearTimeout(timeout);
    process.exit(code);
  });
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(error);
    shutdown(1);
  });
  child.on("exit", (code) => shutdown(code ?? 1));
}
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0, "SIGINT"));
