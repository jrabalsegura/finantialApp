import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_APP_NAME,
  BACKUP_SCHEMA_VERSION,
  type FinancialBackup,
  validateBackup
} from "./backup";

const timestamp = "2026-06-14T12:00:00.000Z";

function createValidBackup(): FinancialBackup {
  return {
    metadata: {
      appName: BACKUP_APP_NAME,
      appVersion: "0.1.0",
      exportedAt: timestamp,
      schemaVersion: BACKUP_SCHEMA_VERSION
    },
    data: {
      accounts: [
        {
          id: "account-1",
          name: "Cuenta principal",
          type: "checking",
          currentBalance: "975.5",
          includeInAvailableMoney: true,
          includeInNetWorth: true,
          includeInMonthlySavings: true,
          isDefault: true,
          notes: null,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      categories: [
        {
          id: "category-1",
          name: "Supermercado",
          type: "expense",
          icon: null,
          color: null,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      savingsBuckets: [
        {
          id: "bucket-1",
          name: "Reserva",
          currentAmount: "250",
          targetAmount: "1000",
          targetDate: null,
          priority: 1,
          isLongTerm: false,
          notes: null,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      transactions: [
        {
          id: "transaction-1",
          date: timestamp,
          amount: "24.5",
          type: "expense",
          description: "Compra",
          accountId: "account-1",
          destinationAccountId: null,
          categoryId: "category-1",
          savingsBucketId: null,
          affectsRealBalance: true,
          affectsPersonalExpense: true,
          affectsPersonalIncome: false,
          affectsMonthlySavings: true,
          affectsNetWorth: true,
          reimbursementId: null,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      reimbursements: [],
      monthlyCloses: [
        {
          id: "close-1",
          year: 2026,
          month: 5,
          totalIncome: "2000",
          totalExpense: "1000",
          monthlySavings: "1000",
          availableMoney: "1500",
          netWorth: "4000",
          longTermAssets: "2500",
          notes: null,
          closedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      monthlyAccountSnapshots: [
        {
          id: "account-snapshot-1",
          monthlyCloseId: "close-1",
          accountId: "account-1",
          calculatedBalance: "975.5",
          realBalance: "975.5",
          difference: "0",
          adjustmentTransactionId: null
        }
      ],
      monthlyBucketSnapshots: [
        {
          id: "bucket-snapshot-1",
          monthlyCloseId: "close-1",
          savingsBucketId: "bucket-1",
          amount: "250"
        }
      ],
      recurringTransactions: [
        {
          id: "recurring-1",
          name: "Compra mensual",
          type: "expense",
          amount: "24.5",
          accountId: "account-1",
          destinationAccountId: null,
          categoryId: "category-1",
          savingsBucketId: null,
          description: null,
          dayOfMonth: 14,
          startDate: timestamp,
          endDate: null,
          isActive: true,
          autoCreateMode: "pending",
          lastGeneratedMonth: "2026-06",
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      recurringTransactionOccurrences: [
        {
          id: "occurrence-1",
          recurringTransactionId: "recurring-1",
          year: 2026,
          month: 6,
          scheduledDate: timestamp,
          amount: "24.5",
          status: "confirmed",
          generatedTransactionId: "transaction-1",
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      quickTransactionTemplates: [
        {
          id: "quick-template-1",
          name: "Supermercado",
          type: "expense",
          defaultAmount: null,
          accountId: "account-1",
          destinationAccountId: null,
          categoryId: "category-1",
          savingsBucketId: null,
          defaultDescription: "Supermercado",
          icon: null,
          color: null,
          sortOrder: 1,
          isFavorite: true,
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ]
    }
  };
}

test("acepta un backup completo y calcula su resumen", () => {
  const result = validateBackup(createValidBackup());

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.summary, {
    accounts: 1,
    transactions: 1,
    categories: 1,
    savingsBuckets: 1,
    monthlyCloses: 1
  });
});

test("rechaza una versión de esquema incompatible", () => {
  const backup = createValidBackup();
  backup.metadata.schemaVersion = BACKUP_SCHEMA_VERSION + 1;

  const result = validateBackup(backup);

  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(result.errors.join(" "), /incompatible/);
});

test("rechaza backups a los que les faltan colecciones críticas", () => {
  const backup = createValidBackup() as unknown as {
    data: Record<string, unknown>;
  };
  delete backup.data.accounts;

  const result = validateBackup(backup);

  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(result.errors.join(" "), /data\.accounts/);
});

test("rechaza fechas e importes corruptos", () => {
  const backup = createValidBackup();
  backup.data.transactions[0].date = "fecha-imposible";
  backup.data.transactions[0].amount = "veinticuatro";

  const result = validateBackup(backup);

  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(result.errors.join(" "), /fecha válida/);
  assert.match(result.errors.join(" "), /importe numérico/);
});

test("rechaza relaciones rotas antes de importar", () => {
  const backup = createValidBackup();
  backup.data.transactions[0].accountId = "account-missing";

  const result = validateBackup(backup);

  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(result.errors.join(" "), /cuenta inexistente/);
});

test("rechaza claves únicas duplicadas que impedirían la restauración", () => {
  const backup = createValidBackup();
  backup.data.monthlyCloses.push({
    ...backup.data.monthlyCloses[0],
    id: "close-2"
  });

  const result = validateBackup(backup);

  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(result.errors.join(" "), /meses cerrados/);
});
