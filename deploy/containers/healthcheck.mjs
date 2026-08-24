const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 4000);

try {
  const response = await fetch("http://127.0.0.1:3000/api/health", {
    cache: "no-store",
    signal: controller.signal
  });
  const payload = await response.json();

  if (!response.ok || payload.status !== "ok" || payload.database !== "ok") {
    process.exitCode = 1;
  }
} catch {
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
