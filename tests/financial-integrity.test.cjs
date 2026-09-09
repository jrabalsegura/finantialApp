const assert = require("node:assert/strict");
const { test, before, beforeEach, after } = require("node:test");
const { mkdtempSync, readdirSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const Module = require("node:module");
const directory = mkdtempSync(join(tmpdir(), "financial-integrity-"));
process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
process.env.AUTH_SECRET = "test-only-random-secret-at-least-32-characters";
process.env.TZ = "Europe/Madrid";
const db = new DatabaseSync(join(directory, "test.db"));
for (const migration of readdirSync(resolve("prisma/migrations")).sort()) {
  if (/^\d/.test(migration))
    db.exec(
      readFileSync(
        resolve("prisma/migrations", migration, "migration.sql"),
        "utf8"
      )
    );
}
db.close();
const jar = new Map();
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === "next/cache") return { revalidatePath() {} };
  if (name === "next/navigation")
    return {
      redirect(path) {
        throw new Error("REDIRECT:" + path);
      }
    };
  if (name === "next/headers")
    return {
      cookies: async () => ({
        get: (name) => (jar.has(name) ? { value: jar.get(name) } : undefined),
        set: (name, value) => jar.set(name, value),
        delete: (name) => jar.delete(name)
      })
    };
  return originalLoad.call(this, name, ...args);
};
const { prisma } = require("../src/lib/prisma.ts");
const actions = require("../app/actions.ts");
const categoryActions = require("../app/categories/actions.ts");
const recurringActions = require("../app/recurring/actions.ts");
const security = require("../app/settings/security/actions.ts");
const { createTransactionFromDraft } = require("../src/lib/transactions.ts");
const recurring = require("../src/lib/recurring-transactions.ts");
const { getWeeklyBudgetReport } = require("../src/lib/weekly-budget.ts");
const { exportBackup, importBackup } = require("../src/lib/backup.ts");
const { validateBackup } = require("../src/domain/backup.ts");
const { createUserSession, getCurrentUser } = require("../src/lib/auth.ts");
const { hashPassword } = require("../src/lib/password.ts");
const { getChangesAfter } = require("../src/lib/historical-balances.ts");
const cookieName = "financial_app_session";
const form = (values) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, String(v));
  return f;
};
const draft = (accountId, type, amount, date = "2026-06-10", extra = {}) => ({
  accountId,
  type,
  amount,
  date: new Date(date + "T12:00:00"),
  destinationAccountId: null,
  categoryId: null,
  savingsBucketId: null,
  description: null,
  weeklyBudgetImpactScope: "normal",
  ...extra
});
let empty, user;
before(async () => {
  empty = await exportBackup();
  user = await prisma.appUser.create({
    data: {
      username: "test-user",
      passwordHash: await hashPassword("InitialPassword123")
    }
  });
});
beforeEach(async () => {
  await importBackup(empty);
  await createUserSession(user.id);
});
after(async () => {
  Module._load = originalLoad;
  await prisma.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});
const account = (balance = 1000, extra = {}) =>
  prisma.account.create({
    data: {
      name: "Test account",
      type: "checking",
      currentBalance: balance,
      isDefault: true,
      ...extra
    }
  });
const bucket = (name = "Test bucket", amount = 0) =>
  prisma.savingsBucket.create({ data: { name, currentAmount: amount } });
const balance = async (id) =>
  +(await prisma.account.findUniqueOrThrow({ where: { id } })).currentBalance;
const amount = async (id) =>
  +(await prisma.savingsBucket.findUniqueOrThrow({ where: { id } }))
    .currentAmount;
const close = (a, b, real, allocation = 0, reduction = 0, month = 6) =>
  actions.closeMonth(
    { status: "idle", message: "" },
    form({
      year: 2026,
      month,
      [`realBalance_${a.id}`]: real,
      [`adjustmentKind_${a.id}`]: "technical",
      [`savingsAllocation_${b.id}`]: allocation,
      [`savingsReduction_${b.id}`]: reduction
    })
  );

test("el reembolso de 0,30 admite cobrar 0,10 y luego 0,20 exactamente", async () => {
  const a = await account();
  await createTransactionFromDraft(
    draft(a.id, "reimbursable_expense", 0.3, undefined, {
      personName: "Test",
      description: "Test"
    })
  );
  const r = await prisma.reimbursement.findFirst();
  for (const n of [0.1, 0.2])
    await createTransactionFromDraft(
      draft(a.id, "reimbursement_income", n, undefined, {
        reimbursementId: r.id
      })
    );
  assert.equal(
    (await prisma.reimbursement.findUnique({ where: { id: r.id } })).status,
    "paid"
  );
  assert.equal(await balance(a.id), 1000);
});

test("convertir un reembolso no permite recuperar dinero borrando el gasto", async () => {
  const a = await account();
  await createTransactionFromDraft(
    draft(a.id, "reimbursable_expense", 120, undefined, {
      personName: "Test",
      description: "Factura"
    })
  );
  const r = await prisma.reimbursement.findFirst();
  await actions.convertReimbursementToRealExpense(
    form({ reimbursementId: r.id })
  );
  const t = await prisma.transaction.findFirst({ where: { type: "expense" } });
  assert.equal(t.reimbursementId, r.id);
  await assert.rejects(
    actions.deleteRecentTransaction(form({ id: t.id })),
    /convertido|reembolsos/
  );
  assert.equal(await balance(a.id), 880);
  await prisma.transaction.update({
    where: { id: t.id },
    data: { reimbursementId: null }
  }); // legacy orphan
  await assert.rejects(
    actions.deleteRecentTransaction(form({ id: t.id })),
    /convertido/
  );
  assert.equal(await balance(a.id), 880);
});

test("cerrar junio conserva los gastos de julio y bloquea cambios de junio", async () => {
  const a = await account(0),
    b = await bucket();
  const income = await createTransactionFromDraft(draft(a.id, "income", 1000));
  await createTransactionFromDraft(draft(a.id, "expense", 100, "2026-07-10"));
  assert.equal((await close(a, b, 1000, 1000)).status, "success");
  assert.equal(await balance(a.id), 900);
  const snapshot = await prisma.monthlyAccountSnapshot.findFirst();
  assert.equal(+snapshot.calculatedBalance, 1000);
  assert.equal(+snapshot.difference, 0);
  await assert.rejects(
    actions.deleteRecentTransaction(form({ id: income.id })),
    /Reabre/
  );
  await assert.rejects(
    createTransactionFromDraft(draft(a.id, "expense", 10)),
    /Reabre/
  );
  const july = await prisma.transaction.findFirst({
    where: { type: "expense" }
  });
  await assert.rejects(
    actions.updateRecentTransaction(
      form({
        id: july.id,
        type: "expense",
        amount: 100,
        date: "2026-06-10",
        accountId: a.id
      })
    ),
    /Reabre/
  );
  assert.equal(await balance(a.id), 900);
});

test("el cierre reconstruye las partidas y reembolsos en su fecha", async () => {
  const a = await account(1000),
    b = await bucket("Reserva", 200);
  await createTransactionFromDraft(
    draft(a.id, "reimbursable_expense", 120, undefined, {
      personName: "Test",
      description: "Factura"
    })
  );
  const r = await prisma.reimbursement.findFirst();
  await createTransactionFromDraft(
    draft(a.id, "reimbursement_income", 120, "2026-07-02", {
      reimbursementId: r.id
    })
  );
  await createTransactionFromDraft(
    draft(a.id, "savings_allocation", 50, "2026-07-03", {
      savingsBucketId: b.id
    })
  );
  assert.equal((await close(a, b, 880)).status, "success");
  const c = await prisma.monthlyClose.findFirst();
  assert.equal(+c.netWorth, 1000);
  assert.equal(
    +(
      await prisma.monthlyBucketSnapshot.findFirst({
        where: { savingsBucketId: b.id }
      })
    ).amount,
    200
  );
  assert.equal(await amount(b.id), 250);
});

test("las asignaciones de ahorro previo no reducen el reparto del mes", async () => {
  const a = await account(1000),
    b = await bucket();
  await createTransactionFromDraft(draft(a.id, "income", 100));
  await createTransactionFromDraft(
    draft(a.id, "savings_allocation", 50, undefined, { savingsBucketId: b.id })
  );
  assert.equal((await close(a, b, 1100, 100)).status, "success");
  assert.equal(await amount(b.id), 150);
});

test("el déficit usa ahorro libre y solo exige reducir la parte no cubierta", async () => {
  const a = await account(550),
    b = await bucket("Reserva", 500);
  await createTransactionFromDraft(draft(a.id, "expense", 100));
  assert.equal((await close(a, b, 450, 0, 50)).status, "success");
  assert.equal(await amount(b.id), 450);
  assert.equal(await balance(a.id), 450);
  assert.equal(
    +(await prisma.monthlyClose.findFirst()).deficitFromFreeSavings,
    50
  );
});

test("renombrar una cuenta desde un formulario antiguo conserva el saldo nuevo", async () => {
  const a = await account();
  await createTransactionFromDraft(draft(a.id, "expense", 100));
  const fields = {
    id: a.id,
    name: "Renombrada",
    type: "checking",
    originalBalance: 1000,
    currentBalance: 1000,
    includeInAvailableMoney: "on",
    includeInNetWorth: "on",
    includeInMonthlySavings: "on",
    isDefault: "on"
  };
  await actions.updateAccount(form(fields));
  assert.equal(await balance(a.id), 900);
  await assert.rejects(
    actions.updateAccount(form({ ...fields, currentBalance: 950 })),
    /saldo ha cambiado/
  );
  await actions.updateAccount(
    form({ ...fields, originalBalance: 900, currentBalance: 950 })
  );
  const correction = await prisma.transaction.findFirst({
    where: { type: "balance_adjustment" }
  });
  assert.equal(+correction.balanceDelta, 50);
  assert.equal(
    (
      await getChangesAfter(prisma, new Date("2026-07-01T00:00:00"))
    ).accounts.get(a.id),
    50
  );
});

test("un automático espera a su día, procesa pendientes existentes y no duplica", async () => {
  const a = await account();
  await prisma.recurringTransaction.create({
    data: {
      name: "Automático",
      type: "expense",
      amount: 100,
      accountId: a.id,
      dayOfMonth: 20,
      startDate: new Date("2026-06-01T12:00:00"),
      autoCreateMode: "automatic"
    }
  });
  await recurring.generateRecurringOccurrencesForMonth(
    2026,
    6,
    new Date("2026-06-10T12:00:00")
  );
  assert.equal(await balance(a.id), 1000);
  assert.equal(
    (await prisma.recurringTransactionOccurrence.findFirst()).status,
    "pending"
  );
  await recurring.generateRecurringOccurrencesForMonth(
    2026,
    6,
    new Date("2026-06-20T00:01:00")
  );
  await recurring.generateRecurringOccurrencesForMonth(
    2026,
    6,
    new Date("2026-06-20T14:00:00")
  );
  assert.equal(await balance(a.id), 900);
  assert.equal(await prisma.transaction.count(), 1);
});

test("cambiar el día de un recurrente pendiente deja una única ocurrencia", async () => {
  const a = await account();
  const t = await prisma.recurringTransaction.create({
    data: {
      name: "Factura",
      type: "expense",
      amount: 100,
      accountId: a.id,
      dayOfMonth: 20,
      startDate: new Date("2026-06-01T12:00:00")
    }
  });
  await recurring.generateRecurringOccurrencesForMonth(2026, 6);
  await prisma.$transaction(async (tx) => {
    await tx.recurringTransaction.update({
      where: { id: t.id },
      data: { dayOfMonth: 25, amount: 120 }
    });
    await recurring.reconcilePendingOccurrences(tx, t.id);
  });
  await recurring.generateRecurringOccurrencesForMonth(2026, 6);
  const items = await prisma.recurringTransactionOccurrence.findMany();
  assert.equal(items.length, 1);
  assert.equal(items[0].scheduledDate.getDate(), 25);
  assert.equal(+items[0].amount, 120);
});

test("el presupuesto conserva el importe confirmado al cambiar o desactivar la plantilla", async () => {
  const a = await account();
  const t = await prisma.recurringTransaction.create({
    data: {
      name: "Factura",
      type: "expense",
      amount: 100,
      accountId: a.id,
      dayOfMonth: 20,
      startDate: new Date("2026-06-01T12:00:00")
    }
  });
  await recurring.generateRecurringOccurrencesForMonth(2026, 6);
  const o = await prisma.recurringTransactionOccurrence.findFirst();
  await recurring.confirmRecurringOccurrence(o.id, { amount: 150 });
  await prisma.recurringTransaction.update({
    where: { id: t.id },
    data: { amount: 200, dayOfMonth: 25 }
  });
  await recurring.generateRecurringOccurrencesForMonth(2026, 6);
  assert.equal(
    (await getWeeklyBudgetReport(new Date("2026-06-25T12:00:00"))).status
      .fixedMonthlyExpenses,
    150
  );
  await recurringActions.toggleRecurringTransaction(
    form({ id: t.id, isActive: false })
  );
  assert.equal(
    (await getWeeklyBudgetReport(new Date("2026-06-25T12:00:00"))).status
      .fixedMonthlyExpenses,
    150
  );
  await assert.rejects(
    recurringActions.deleteRecurringTransaction(form({ id: t.id })),
    /historial/
  );
});

test("las transferencias entre partidas se revierten completas y no dejan reabrir con saldo negativo", async () => {
  const a = await account(0),
    b = await bucket(),
    dest = await bucket("Destino");
  await createTransactionFromDraft(draft(a.id, "income", 100));
  assert.equal((await close(a, b, 100, 100)).status, "success");
  const c = await prisma.monthlyClose.findFirst();
  await actions.transferBetweenSavingsBuckets(
    form({ sourceBucketId: b.id, destinationBucketId: dest.id, amount: 100 })
  );
  const leg = await prisma.transaction.findFirst({
    where: { savingsTransferId: { not: null }, type: "savings_allocation" }
  });
  await assert.rejects(
    actions.deleteRecentTransaction(form({ id: leg.id })),
    /operación completa/
  );
  await assert.rejects(
    actions.undoLatestMonthlyClose(form({ closeId: c.id })),
    /Devuelve primero/
  );
  assert.equal(await amount(b.id), 0);
  assert.equal(await amount(dest.id), 100);
  await actions.undoSavingsTransfer(
    form({ savingsTransferId: leg.savingsTransferId })
  );
  assert.equal(await amount(b.id), 100);
  assert.equal(await amount(dest.id), 0);
  await assert.rejects(
    actions.undoLatestMonthlyClose(form({ closeId: c.id })),
    /REDIRECT/
  );
  assert.equal(await amount(b.id), 0);
  assert.equal(await prisma.monthlyClose.count(), 0);
});

test("las copias conservan los nuevos campos y rechazan daños sin borrar datos", async () => {
  const a = await account();
  await createTransactionFromDraft(draft(a.id, "expense", 10));
  const data = await exportBackup();
  assert.equal(validateBackup(data).success, true);
  await importBackup(data);
  assert.equal(await balance(a.id), 990);
  const corrupted = structuredClone(data);
  corrupted.data.transactions[0].amount = "-10";
  await assert.rejects(importBackup(corrupted), /mayor que cero/);
  assert.equal(await balance(a.id), 990);
  assert.equal(await prisma.transaction.count(), 1);
});

test("una categoría no puede invalidar una plantilla recurrente existente", async () => {
  const a = await account();
  const c = await prisma.category.create({
    data: { name: "Factura", type: "expense" }
  });
  await prisma.recurringTransaction.create({
    data: {
      name: "Factura",
      type: "expense",
      amount: 100,
      accountId: a.id,
      categoryId: c.id,
      startDate: new Date("2026-06-01T12:00:00")
    }
  });
  await assert.rejects(
    categoryActions.updateCategory(
      form({ id: c.id, name: c.name, type: "income" })
    ),
    /incompatibles/
  );
  assert.equal(
    (await prisma.category.findUnique({ where: { id: c.id } })).type,
    "expense"
  );
});

test("cambiar la contraseña invalida sesiones anteriores y conserva la actual", async () => {
  const old = jar.get(cookieName);
  const result = await security.changePassword(
    {},
    form({
      currentPassword: "InitialPassword123",
      newPassword: "NewPassword123",
      confirmPassword: "NewPassword123"
    })
  );
  assert.equal(result.status, "success");
  assert.ok(await getCurrentUser());
  jar.set(cookieName, old);
  assert.equal(await getCurrentUser(), null);
  const backupRoute = require("../app/api/backup/route.ts");
  assert.equal((await backupRoute.GET()).status, 401);
  await assert.rejects(
    actions.createSavingsBucket(form({ name: "Sin autorización" })),
    /REDIRECT/
  );
});

test("las copias conservan el límite configurable y la operación entre partidas", async () => {
  const a = await account(),
    source = await bucket("Origen", 150),
    destination = await bucket("Destino");
  await actions.transferBetweenSavingsBuckets(
    form({
      sourceBucketId: source.id,
      destinationBucketId: destination.id,
      amount: 50
    })
  );
  await prisma.budgetSetting.upsert({
    where: { id: "default" },
    update: { weeklySpendingCap: 375 },
    create: { weeklySpendingCap: 375 }
  });
  const backup = await exportBackup();
  assert.equal(validateBackup(backup).success, true);
  await importBackup(backup);
  assert.equal(
    +(await prisma.budgetSetting.findUnique({ where: { id: "default" } }))
      .weeklySpendingCap,
    375
  );
  const allocation = await prisma.transaction.findFirst({
    where: { type: "savings_allocation" }
  });
  await actions.undoSavingsTransfer(
    form({ savingsTransferId: allocation.savingsTransferId })
  );
  assert.equal(await amount(source.id), 150);
  assert.equal(await amount(destination.id), 0);
  assert.equal(await balance(a.id), 1000);
});

test("el proceso recupera meses automáticos pendientes después de una parada", async () => {
  const a = await account();
  await prisma.recurringTransaction.create({
    data: {
      name: "Recuperación",
      type: "expense",
      amount: 100,
      accountId: a.id,
      dayOfMonth: 20,
      startDate: new Date("2026-06-01T12:00:00"),
      createdAt: new Date("2026-06-01T12:00:00"),
      lastGeneratedMonth: "2026-05",
      autoCreateMode: "automatic"
    }
  });
  await recurring.processDueRecurringTransactions(
    new Date("2026-08-06T12:00:00")
  );
  assert.equal(await balance(a.id), 800);
  assert.equal(await prisma.transaction.count(), 2);
  assert.equal(
    await prisma.recurringTransactionOccurrence.count({
      where: { status: "pending", month: 8 }
    }),
    1
  );
});

test("las cuentas y partidas nuevas no adelantan su saldo inicial a meses anteriores", async () => {
  await actions.createAccount(
    form({
      name: "Cuenta nueva",
      type: "checking",
      currentBalance: 500,
      includeInAvailableMoney: "on",
      includeInNetWorth: "on",
      includeInMonthlySavings: "on",
      isDefault: "on"
    })
  );
  const a = await prisma.account.findFirst();
  await actions.createSavingsBucket(
    form({ name: "Partida nueva", currentAmount: 100 })
  );
  const b = await prisma.savingsBucket.findFirst({
    where: { isLongTerm: false }
  });
  const changes = await getChangesAfter(
    prisma,
    new Date("2026-07-01T00:00:00")
  );
  assert.equal((await balance(a.id)) - changes.accounts.get(a.id), 0);
  assert.equal((await amount(b.id)) - changes.buckets.get(b.id), 0);
});
