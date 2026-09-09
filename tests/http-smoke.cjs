const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const databaseUrl = process.env.DATABASE_URL ?? "";
if (!/^file:\/(?:private\/)?tmp\/financial-/.test(databaseUrl))
  throw new Error(
    "Este ensayo solo puede usar una base de datos temporal financial-* explícita."
  );
const { prisma } = require("../src/lib/prisma.ts");
const { createSessionToken } = require("../src/lib/session.ts");
const { hashPassword } = require("../src/lib/password.ts");
const suffix = Date.now();
const base = process.argv[2] ?? "http://127.0.0.1:3188";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))
  throw new Error("El ensayo HTTP solo admite localhost.");
const form = (values) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, String(v));
  return f;
};
async function main() {
  const health = await fetch(base + "/api/health");
  assert.equal(health.status, 200);
  assert.equal(
    (await fetch(base + "/api/backup", { redirect: "manual" })).status,
    401
  );
  assert.equal((await fetch(base + "/", { redirect: "manual" })).status, 307);
  const removed = await prisma.appUser.create({
    data: { username: "http-removed-" + suffix, passwordHash: "unused" }
  });
  const removedToken = await createSessionToken(removed.id);
  await prisma.appUser.delete({ where: { id: removed.id } });
  assert.equal(
    (
      await fetch(base + "/api/backup", {
        headers: { cookie: "financial_app_session=" + removedToken }
      })
    ).status,
    401
  );
  const user = await prisma.appUser.create({
    data: {
      username: "http-user-" + suffix,
      passwordHash: await hashPassword("OriginalPassword123")
    }
  });
  const token = await createSessionToken(user.id);
  const headers = { cookie: "financial_app_session=" + token };
  const a = await prisma.account.create({
    data: {
      name: "HTTP account " + suffix,
      type: "checking",
      currentBalance: 1000,
      isDefault: true
    }
  });
  const now = new Date();
  await prisma.recurringTransaction.create({
    data: {
      name: "HTTP due automatic",
      type: "expense",
      amount: 10,
      accountId: a.id,
      dayOfMonth: now.getDate(),
      startDate: new Date(now.getFullYear(), now.getMonth(), 1, 12),
      autoCreateMode: "automatic"
    }
  });
  const deadline = Date.now() + 65000;
  // No page requests during this wait: only the independent worker can apply the charge.
  while (
    (await prisma.transaction.count({ where: { accountId: a.id } })) === 0 &&
    Date.now() < deadline
  )
    await new Promise((resolve) => setTimeout(resolve, 1000));
  assert.equal(
    +(await prisma.account.findUnique({ where: { id: a.id } })).currentBalance,
    990
  );
  console.log("Worker: cargo vencido procesado sin abrir ninguna página.");
  for (const path of [
    "/",
    "/accounts",
    "/savings",
    "/categories",
    "/reimbursements",
    "/recurring?period=2026-06",
    "/monthly-close?period=2026-06",
    "/weekly-budget",
    "/settings/budget",
    "/settings/security",
    "/api/backup"
  ]) {
    const response = await fetch(base + path, { headers, redirect: "manual" });
    assert.equal(response.status, 200, path);
    await response.text();
  }
  const manifest = JSON.parse(
    readFileSync(resolve(".next/server/server-reference-manifest.json"), "utf8")
  );
  const passwordId = Object.keys(manifest.node).find(
    (id) => manifest.node[id].exportedName === "changePassword"
  );
  const body = new FormData();
  body.set("_1_currentPassword", "OriginalPassword123");
  body.set("_1_newPassword", "NewPassword123");
  body.set("_1_confirmPassword", "NewPassword123");
  body.set("0", '[{},"$K1"]');
  const changed = await fetch(base + "/settings/security", {
    method: "POST",
    body,
    headers: {
      ...headers,
      "Next-Action": passwordId,
      Accept: "text/x-component"
    },
    redirect: "manual"
  });
  const text = await changed.text();
  assert.equal(changed.status, 200, text.slice(0, 200));
  assert.equal(
    (await prisma.appUser.findUnique({ where: { id: user.id } }))
      .sessionVersion,
    1
  );
  assert.equal((await fetch(base + "/api/backup", { headers })).status, 401);
  const cookies = changed.headers.getSetCookie();
  const newCookie = cookies
    .filter((c) => c.startsWith("financial_app_session="))
    .at(-1)
    ?.split(";")[0];
  assert.ok(newCookie, "El cambio debe emitir una sesión nueva");
  assert.equal(
    (await fetch(base + "/api/backup", { headers: { cookie: newCookie } }))
      .status,
    200
  );
  const categoryId = Object.keys(manifest.node).find(
    (id) => manifest.node[id].exportedName === "createCategory"
  );
  const unauthorized = form({
    ["$ACTION_ID_" + categoryId]: "",
    name: "Unauthorized HTTP category",
    type: "expense"
  });
  const result = await fetch(base + "/login", {
    method: "POST",
    body: unauthorized,
    redirect: "manual"
  });
  await result.text();
  assert.equal(
    await prisma.category.count({
      where: { name: "Unauthorized HTTP category" }
    }),
    0
  );
  console.log(
    "HTTP: rutas, backup, usuario eliminado, revocación de sesiones y acciones sin autorización correctos."
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
