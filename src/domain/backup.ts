export const BACKUP_SCHEMA_VERSION = 2;
export const BACKUP_APP_NAME = "Finanzas personales";

const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "cash",
  "investment",
  "pension",
  "treasury",
  "other"
] as const;
const CATEGORY_TYPES = ["expense", "income", "both"] as const;
const TRANSACTION_TYPES = [
  "expense",
  "income",
  "transfer",
  "balance_adjustment",
  "reimbursable_expense",
  "reimbursement_income",
  "investment_gain",
  "investment_loss",
  "savings_allocation",
  "savings_withdrawal"
] as const;
const REIMBURSEMENT_STATUSES = [
  "pending",
  "partially_paid",
  "paid",
  "cancelled",
  "uncollectible"
] as const;
const RECURRING_TRANSACTION_TYPES = [
  "expense",
  "income",
  "transfer",
  "savings_allocation"
] as const;
const RECURRING_AUTO_CREATE_MODES = ["pending", "automatic"] as const;
const RECURRING_OCCURRENCE_STATUSES = [
  "pending",
  "confirmed",
  "skipped"
] as const;
const QUICK_TRANSACTION_TEMPLATE_TYPES = [
  "expense",
  "income",
  "transfer",
  "reimbursable_expense",
  "reimbursement_income",
  "savings_allocation"
] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number];
type CategoryType = (typeof CATEGORY_TYPES)[number];
type TransactionType = (typeof TRANSACTION_TYPES)[number];
type ReimbursementStatus = (typeof REIMBURSEMENT_STATUSES)[number];
type RecurringTransactionType =
  (typeof RECURRING_TRANSACTION_TYPES)[number];
type RecurringAutoCreateMode =
  (typeof RECURRING_AUTO_CREATE_MODES)[number];
type RecurringOccurrenceStatus =
  (typeof RECURRING_OCCURRENCE_STATUSES)[number];
type QuickTransactionTemplateType =
  (typeof QUICK_TRANSACTION_TEMPLATE_TYPES)[number];

type TimestampedRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type BackupAccount = TimestampedRecord & {
  name: string;
  type: AccountType;
  currentBalance: string;
  includeInAvailableMoney: boolean;
  includeInNetWorth: boolean;
  includeInMonthlySavings: boolean;
  isDefault: boolean;
  notes: string | null;
};

export type BackupCategory = TimestampedRecord & {
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
};

export type BackupSavingsBucket = TimestampedRecord & {
  name: string;
  currentAmount: string;
  targetAmount: string | null;
  targetDate: string | null;
  priority: number | null;
  isLongTerm: boolean;
  notes: string | null;
};

export type BackupTransaction = TimestampedRecord & {
  date: string;
  amount: string;
  type: TransactionType;
  description: string | null;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  savingsBucketId: string | null;
  affectsRealBalance: boolean;
  affectsPersonalExpense: boolean;
  affectsPersonalIncome: boolean;
  affectsMonthlySavings: boolean;
  affectsNetWorth: boolean;
  reimbursementId: string | null;
};

export type BackupReimbursement = TimestampedRecord & {
  title: string;
  personName: string;
  originalTransactionId: string;
  expectedAmount: string;
  paidAmount: string;
  status: ReimbursementStatus;
  dueDate: string | null;
  notes: string | null;
};

export type BackupMonthlyClose = TimestampedRecord & {
  year: number;
  month: number;
  totalIncome: string;
  totalExpense: string;
  monthlySavings: string;
  availableMoney: string;
  netWorth: string;
  longTermAssets: string;
  notes: string | null;
  closedAt: string | null;
};

export type BackupMonthlyAccountSnapshot = {
  id: string;
  monthlyCloseId: string;
  accountId: string;
  calculatedBalance: string;
  realBalance: string;
  difference: string;
  adjustmentTransactionId: string | null;
};

export type BackupMonthlyBucketSnapshot = {
  id: string;
  monthlyCloseId: string;
  savingsBucketId: string;
  amount: string;
};

export type BackupRecurringTransaction = TimestampedRecord & {
  name: string;
  type: RecurringTransactionType;
  amount: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  savingsBucketId: string | null;
  description: string | null;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  autoCreateMode: RecurringAutoCreateMode;
  lastGeneratedMonth: string | null;
};

export type BackupRecurringTransactionOccurrence = TimestampedRecord & {
  recurringTransactionId: string;
  year: number;
  month: number;
  scheduledDate: string;
  amount: string;
  status: RecurringOccurrenceStatus;
  generatedTransactionId: string | null;
};

export type BackupQuickTransactionTemplate = TimestampedRecord & {
  name: string;
  type: QuickTransactionTemplateType;
  defaultAmount: string | null;
  accountId: string | null;
  destinationAccountId: string | null;
  categoryId: string | null;
  savingsBucketId: string | null;
  defaultDescription: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isFavorite: boolean;
  isActive: boolean;
};

export type FinancialBackup = {
  metadata: {
    appName: string;
    appVersion?: string;
    exportedAt: string;
    schemaVersion: number;
  };
  data: {
    accounts: BackupAccount[];
    categories: BackupCategory[];
    savingsBuckets: BackupSavingsBucket[];
    transactions: BackupTransaction[];
    reimbursements: BackupReimbursement[];
    monthlyCloses: BackupMonthlyClose[];
    monthlyAccountSnapshots: BackupMonthlyAccountSnapshot[];
    monthlyBucketSnapshots: BackupMonthlyBucketSnapshot[];
    recurringTransactions: BackupRecurringTransaction[];
    recurringTransactionOccurrences: BackupRecurringTransactionOccurrence[];
    quickTransactionTemplates: BackupQuickTransactionTemplate[];
  };
};

export type BackupSummary = {
  accounts: number;
  transactions: number;
  categories: number;
  savingsBuckets: number;
  monthlyCloses: number;
};

export type BackupValidationResult =
  | {
      success: true;
      data: FinancialBackup;
      summary: BackupSummary;
      errors: [];
    }
  | {
      success: false;
      data: null;
      summary: null;
      errors: string[];
    };

type Validator = (value: unknown, path: string, errors: string[]) => void;

export function validateBackup(input: unknown): BackupValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return invalid("El backup debe ser un objeto JSON.");
  }

  if (!isRecord(input.metadata)) {
    errors.push("Falta el bloque metadata.");
  } else {
    validateRequiredString(input.metadata.appName, "metadata.appName", errors);
    validateOptionalString(
      input.metadata.appVersion,
      "metadata.appVersion",
      errors,
      true
    );
    validateDate(input.metadata.exportedAt, "metadata.exportedAt", errors);
    validateInteger(
      input.metadata.schemaVersion,
      "metadata.schemaVersion",
      errors
    );

    if (
      typeof input.metadata.appName === "string" &&
      input.metadata.appName !== BACKUP_APP_NAME
    ) {
      errors.push(
        `La copia pertenece a "${input.metadata.appName}", no a ${BACKUP_APP_NAME}.`
      );
    }

    if (
      typeof input.metadata.schemaVersion === "number" &&
      input.metadata.schemaVersion !== BACKUP_SCHEMA_VERSION
    ) {
      errors.push(
        `Versión de esquema incompatible: ${input.metadata.schemaVersion}. La aplicación admite la versión ${BACKUP_SCHEMA_VERSION}.`
      );
    }
  }

  if (!isRecord(input.data)) {
    errors.push("Falta el bloque data.");
    return invalid(errors);
  }

  validateArray(input.data.accounts, "data.accounts", errors, validateAccount);
  validateArray(
    input.data.categories,
    "data.categories",
    errors,
    validateCategory
  );
  validateArray(
    input.data.savingsBuckets,
    "data.savingsBuckets",
    errors,
    validateSavingsBucket
  );
  validateArray(
    input.data.transactions,
    "data.transactions",
    errors,
    validateTransaction
  );
  validateArray(
    input.data.reimbursements,
    "data.reimbursements",
    errors,
    validateReimbursement
  );
  validateArray(
    input.data.monthlyCloses,
    "data.monthlyCloses",
    errors,
    validateMonthlyClose
  );
  validateArray(
    input.data.monthlyAccountSnapshots,
    "data.monthlyAccountSnapshots",
    errors,
    validateMonthlyAccountSnapshot
  );
  validateArray(
    input.data.monthlyBucketSnapshots,
    "data.monthlyBucketSnapshots",
    errors,
    validateMonthlyBucketSnapshot
  );
  validateArray(
    input.data.recurringTransactions,
    "data.recurringTransactions",
    errors,
    validateRecurringTransaction
  );
  validateArray(
    input.data.recurringTransactionOccurrences,
    "data.recurringTransactionOccurrences",
    errors,
    validateRecurringTransactionOccurrence
  );
  validateArray(
    input.data.quickTransactionTemplates,
    "data.quickTransactionTemplates",
    errors,
    validateQuickTransactionTemplate
  );

  if (errors.length === 0) {
    validateUniquenessAndRelations(input as unknown as FinancialBackup, errors);
  }

  if (errors.length > 0) {
    return invalid(errors);
  }

  const backup = input as unknown as FinancialBackup;

  return {
    success: true,
    data: backup,
    summary: getBackupSummary(backup),
    errors: []
  };
}

export function getBackupSummary(backup: FinancialBackup): BackupSummary {
  return {
    accounts: backup.data.accounts.length,
    transactions: backup.data.transactions.length,
    categories: backup.data.categories.length,
    savingsBuckets: backup.data.savingsBuckets.length,
    monthlyCloses: backup.data.monthlyCloses.length
  };
}

function validateAccount(value: unknown, path: string, errors: string[]) {
  if (!validateTimestampedRecord(value, path, errors)) return;
  validateRequiredString(value.name, `${path}.name`, errors);
  validateEnum(value.type, ACCOUNT_TYPES, `${path}.type`, errors);
  validateDecimal(value.currentBalance, `${path}.currentBalance`, errors);
  validateBoolean(
    value.includeInAvailableMoney,
    `${path}.includeInAvailableMoney`,
    errors
  );
  validateBoolean(value.includeInNetWorth, `${path}.includeInNetWorth`, errors);
  validateBoolean(
    value.includeInMonthlySavings,
    `${path}.includeInMonthlySavings`,
    errors
  );
  validateBoolean(value.isDefault, `${path}.isDefault`, errors);
  validateOptionalString(value.notes, `${path}.notes`, errors);
}

function validateCategory(value: unknown, path: string, errors: string[]) {
  if (!validateTimestampedRecord(value, path, errors)) return;
  validateRequiredString(value.name, `${path}.name`, errors);
  validateEnum(value.type, CATEGORY_TYPES, `${path}.type`, errors);
  validateOptionalString(value.icon, `${path}.icon`, errors);
  validateOptionalString(value.color, `${path}.color`, errors);
}

function validateSavingsBucket(
  value: unknown,
  path: string,
  errors: string[]
) {
  if (!validateTimestampedRecord(value, path, errors)) return;
  validateRequiredString(value.name, `${path}.name`, errors);
  validateDecimal(value.currentAmount, `${path}.currentAmount`, errors);
  validateOptionalDecimal(value.targetAmount, `${path}.targetAmount`, errors);
  validateOptionalDate(value.targetDate, `${path}.targetDate`, errors);
  validateOptionalInteger(value.priority, `${path}.priority`, errors);
  validateBoolean(value.isLongTerm, `${path}.isLongTerm`, errors);
  validateOptionalString(value.notes, `${path}.notes`, errors);
}

function validateTransaction(value: unknown, path: string, errors: string[]) {
  if (!validateTimestampedRecord(value, path, errors)) return;
  validateDate(value.date, `${path}.date`, errors);
  validateDecimal(value.amount, `${path}.amount`, errors);
  validateEnum(value.type, TRANSACTION_TYPES, `${path}.type`, errors);
  validateOptionalString(value.description, `${path}.description`, errors);
  validateRequiredString(value.accountId, `${path}.accountId`, errors);
  validateOptionalString(
    value.destinationAccountId,
    `${path}.destinationAccountId`,
    errors
  );
  validateOptionalString(value.categoryId, `${path}.categoryId`, errors);
  validateOptionalString(
    value.savingsBucketId,
    `${path}.savingsBucketId`,
    errors
  );
  validateBoolean(
    value.affectsRealBalance,
    `${path}.affectsRealBalance`,
    errors
  );
  validateBoolean(
    value.affectsPersonalExpense,
    `${path}.affectsPersonalExpense`,
    errors
  );
  validateBoolean(
    value.affectsPersonalIncome,
    `${path}.affectsPersonalIncome`,
    errors
  );
  validateBoolean(
    value.affectsMonthlySavings,
    `${path}.affectsMonthlySavings`,
    errors
  );
  validateBoolean(value.affectsNetWorth, `${path}.affectsNetWorth`, errors);
  validateOptionalString(
    value.reimbursementId,
    `${path}.reimbursementId`,
    errors
  );
}

function validateReimbursement(
  value: unknown,
  path: string,
  errors: string[]
) {
  if (!validateTimestampedRecord(value, path, errors)) return;
  validateRequiredString(value.title, `${path}.title`, errors);
  validateRequiredString(value.personName, `${path}.personName`, errors);
  validateRequiredString(
    value.originalTransactionId,
    `${path}.originalTransactionId`,
    errors
  );
  validateDecimal(value.expectedAmount, `${path}.expectedAmount`, errors);
  validateDecimal(value.paidAmount, `${path}.paidAmount`, errors);
  validateEnum(
    value.status,
    REIMBURSEMENT_STATUSES,
    `${path}.status`,
    errors
  );
  validateOptionalDate(value.dueDate, `${path}.dueDate`, errors);
  validateOptionalString(value.notes, `${path}.notes`, errors);
}

function validateMonthlyClose(value: unknown, path: string, errors: string[]) {
  if (!validateTimestampedRecord(value, path, errors)) return;
  validateInteger(value.year, `${path}.year`, errors);
  validateMonth(value.month, `${path}.month`, errors);
  validateDecimal(value.totalIncome, `${path}.totalIncome`, errors);
  validateDecimal(value.totalExpense, `${path}.totalExpense`, errors);
  validateDecimal(value.monthlySavings, `${path}.monthlySavings`, errors);
  validateDecimal(value.availableMoney, `${path}.availableMoney`, errors);
  validateDecimal(value.netWorth, `${path}.netWorth`, errors);
  validateDecimal(value.longTermAssets, `${path}.longTermAssets`, errors);
  validateOptionalString(value.notes, `${path}.notes`, errors);
  validateOptionalDate(value.closedAt, `${path}.closedAt`, errors);
}

function validateMonthlyAccountSnapshot(
  value: unknown,
  path: string,
  errors: string[]
) {
  if (!validateRecordWithId(value, path, errors)) return;
  validateRequiredString(
    value.monthlyCloseId,
    `${path}.monthlyCloseId`,
    errors
  );
  validateRequiredString(value.accountId, `${path}.accountId`, errors);
  validateDecimal(
    value.calculatedBalance,
    `${path}.calculatedBalance`,
    errors
  );
  validateDecimal(value.realBalance, `${path}.realBalance`, errors);
  validateDecimal(value.difference, `${path}.difference`, errors);
  validateOptionalString(
    value.adjustmentTransactionId,
    `${path}.adjustmentTransactionId`,
    errors
  );
}

function validateMonthlyBucketSnapshot(
  value: unknown,
  path: string,
  errors: string[]
) {
  if (!validateRecordWithId(value, path, errors)) return;
  validateRequiredString(
    value.monthlyCloseId,
    `${path}.monthlyCloseId`,
    errors
  );
  validateRequiredString(
    value.savingsBucketId,
    `${path}.savingsBucketId`,
    errors
  );
  validateDecimal(value.amount, `${path}.amount`, errors);
}

function validateRecurringTransaction(
  value: unknown,
  path: string,
  errors: string[]
) {
  if (!validateTimestampedRecord(value, path, errors)) return;
  validateRequiredString(value.name, `${path}.name`, errors);
  validateEnum(
    value.type,
    RECURRING_TRANSACTION_TYPES,
    `${path}.type`,
    errors
  );
  validateDecimal(value.amount, `${path}.amount`, errors);
  validateRequiredString(value.accountId, `${path}.accountId`, errors);
  validateOptionalString(
    value.destinationAccountId,
    `${path}.destinationAccountId`,
    errors
  );
  validateOptionalString(value.categoryId, `${path}.categoryId`, errors);
  validateOptionalString(
    value.savingsBucketId,
    `${path}.savingsBucketId`,
    errors
  );
  validateOptionalString(value.description, `${path}.description`, errors);
  validateInteger(value.dayOfMonth, `${path}.dayOfMonth`, errors);
  if (
    typeof value.dayOfMonth === "number" &&
    (value.dayOfMonth < 1 || value.dayOfMonth > 31)
  ) {
    errors.push(`${path}.dayOfMonth debe estar entre 1 y 31.`);
  }
  validateDate(value.startDate, `${path}.startDate`, errors);
  validateOptionalDate(value.endDate, `${path}.endDate`, errors);
  validateBoolean(value.isActive, `${path}.isActive`, errors);
  validateEnum(
    value.autoCreateMode,
    RECURRING_AUTO_CREATE_MODES,
    `${path}.autoCreateMode`,
    errors
  );
  validateOptionalString(
    value.lastGeneratedMonth,
    `${path}.lastGeneratedMonth`,
    errors
  );
}

function validateRecurringTransactionOccurrence(
  value: unknown,
  path: string,
  errors: string[]
) {
  if (!validateTimestampedRecord(value, path, errors)) return;
  validateRequiredString(
    value.recurringTransactionId,
    `${path}.recurringTransactionId`,
    errors
  );
  validateInteger(value.year, `${path}.year`, errors);
  validateMonth(value.month, `${path}.month`, errors);
  validateDate(value.scheduledDate, `${path}.scheduledDate`, errors);
  validateDecimal(value.amount, `${path}.amount`, errors);
  validateEnum(
    value.status,
    RECURRING_OCCURRENCE_STATUSES,
    `${path}.status`,
    errors
  );
  validateOptionalString(
    value.generatedTransactionId,
    `${path}.generatedTransactionId`,
    errors
  );
}

function validateQuickTransactionTemplate(
  value: unknown,
  path: string,
  errors: string[]
) {
  if (!validateTimestampedRecord(value, path, errors)) return;
  validateRequiredString(value.name, `${path}.name`, errors);
  validateEnum(
    value.type,
    QUICK_TRANSACTION_TEMPLATE_TYPES,
    `${path}.type`,
    errors
  );
  validateOptionalDecimal(
    value.defaultAmount,
    `${path}.defaultAmount`,
    errors
  );
  validateOptionalString(value.accountId, `${path}.accountId`, errors);
  validateOptionalString(
    value.destinationAccountId,
    `${path}.destinationAccountId`,
    errors
  );
  validateOptionalString(value.categoryId, `${path}.categoryId`, errors);
  validateOptionalString(
    value.savingsBucketId,
    `${path}.savingsBucketId`,
    errors
  );
  validateOptionalString(
    value.defaultDescription,
    `${path}.defaultDescription`,
    errors
  );
  validateOptionalString(value.icon, `${path}.icon`, errors);
  validateOptionalString(value.color, `${path}.color`, errors);
  validateInteger(value.sortOrder, `${path}.sortOrder`, errors);
  validateBoolean(value.isFavorite, `${path}.isFavorite`, errors);
  validateBoolean(value.isActive, `${path}.isActive`, errors);
}

function validateUniquenessAndRelations(
  backup: FinancialBackup,
  errors: string[]
) {
  const { data } = backup;
  const accountIds = validateUniqueIds(data.accounts, "cuentas", errors);
  const categoryIds = validateUniqueIds(data.categories, "categorías", errors);
  const bucketIds = validateUniqueIds(
    data.savingsBuckets,
    "partidas de ahorro",
    errors
  );
  const transactionIds = validateUniqueIds(
    data.transactions,
    "movimientos",
    errors
  );
  const reimbursementIds = validateUniqueIds(
    data.reimbursements,
    "reembolsos",
    errors
  );
  const closeIds = validateUniqueIds(data.monthlyCloses, "cierres", errors);
  const recurringIds = validateUniqueIds(
    data.recurringTransactions,
    "movimientos recurrentes",
    errors
  );
  validateUniqueIds(
    data.quickTransactionTemplates,
    "plantillas rápidas",
    errors
  );

  validateUniqueIds(
    data.monthlyAccountSnapshots,
    "snapshots de cuentas",
    errors
  );
  validateUniqueIds(
    data.monthlyBucketSnapshots,
    "snapshots de partidas",
    errors
  );
  validateUniqueIds(
    data.recurringTransactionOccurrences,
    "ocurrencias recurrentes",
    errors
  );
  validateUniqueValues(data.accounts, "name", "nombres de cuenta", errors);
  validateUniqueValues(data.categories, "name", "nombres de categoría", errors);
  validateUniqueValues(
    data.savingsBuckets,
    "name",
    "nombres de partida",
    errors
  );
  validateUniqueComposite(
    data.monthlyCloses,
    (record) => `${record.year}-${record.month}`,
    "meses cerrados",
    errors
  );
  validateUniqueValues(
    data.reimbursements,
    "originalTransactionId",
    "movimientos originales de reembolsos",
    errors
  );
  validateUniqueComposite(
    data.monthlyAccountSnapshots,
    (record) => `${record.monthlyCloseId}:${record.accountId}`,
    "snapshots de cuenta por cierre",
    errors
  );
  validateUniqueComposite(
    data.monthlyBucketSnapshots,
    (record) => `${record.monthlyCloseId}:${record.savingsBucketId}`,
    "snapshots de partida por cierre",
    errors
  );
  validateUniqueComposite(
    data.recurringTransactionOccurrences,
    (record) =>
      `${record.recurringTransactionId}:${record.year}:${record.month}`,
    "ocurrencias mensuales de recurrentes",
    errors
  );
  validateUniqueOptionalValues(
    data.recurringTransactionOccurrences,
    "generatedTransactionId",
    "movimientos generados por recurrentes",
    errors
  );

  for (const transaction of data.transactions) {
    requireReference(
      accountIds,
      transaction.accountId,
      `El movimiento ${transaction.id} referencia una cuenta inexistente.`,
      errors
    );
    requireOptionalReference(
      accountIds,
      transaction.destinationAccountId,
      `El movimiento ${transaction.id} referencia una cuenta de destino inexistente.`,
      errors
    );
    requireOptionalReference(
      categoryIds,
      transaction.categoryId,
      `El movimiento ${transaction.id} referencia una categoría inexistente.`,
      errors
    );
    requireOptionalReference(
      bucketIds,
      transaction.savingsBucketId,
      `El movimiento ${transaction.id} referencia una partida inexistente.`,
      errors
    );
    requireOptionalReference(
      reimbursementIds,
      transaction.reimbursementId,
      `El movimiento ${transaction.id} referencia un reembolso inexistente.`,
      errors
    );
  }

  for (const reimbursement of data.reimbursements) {
    requireReference(
      transactionIds,
      reimbursement.originalTransactionId,
      `El reembolso ${reimbursement.id} no tiene un movimiento original válido.`,
      errors
    );
  }

  for (const recurring of data.recurringTransactions) {
    requireReference(
      accountIds,
      recurring.accountId,
      `El recurrente ${recurring.id} referencia una cuenta inexistente.`,
      errors
    );
    requireOptionalReference(
      accountIds,
      recurring.destinationAccountId,
      `El recurrente ${recurring.id} referencia una cuenta de destino inexistente.`,
      errors
    );
    requireOptionalReference(
      categoryIds,
      recurring.categoryId,
      `El recurrente ${recurring.id} referencia una categoría inexistente.`,
      errors
    );
    requireOptionalReference(
      bucketIds,
      recurring.savingsBucketId,
      `El recurrente ${recurring.id} referencia una partida inexistente.`,
      errors
    );
  }

  for (const template of data.quickTransactionTemplates) {
    requireOptionalReference(
      accountIds,
      template.accountId,
      `La plantilla rápida ${template.id} referencia una cuenta inexistente.`,
      errors
    );
    requireOptionalReference(
      accountIds,
      template.destinationAccountId,
      `La plantilla rápida ${template.id} referencia una cuenta de destino inexistente.`,
      errors
    );
    requireOptionalReference(
      categoryIds,
      template.categoryId,
      `La plantilla rápida ${template.id} referencia una categoría inexistente.`,
      errors
    );
    requireOptionalReference(
      bucketIds,
      template.savingsBucketId,
      `La plantilla rápida ${template.id} referencia una partida inexistente.`,
      errors
    );
  }

  for (const occurrence of data.recurringTransactionOccurrences) {
    requireReference(
      recurringIds,
      occurrence.recurringTransactionId,
      `La ocurrencia ${occurrence.id} referencia un recurrente inexistente.`,
      errors
    );
    requireOptionalReference(
      transactionIds,
      occurrence.generatedTransactionId,
      `La ocurrencia ${occurrence.id} referencia un movimiento inexistente.`,
      errors
    );
  }

  for (const snapshot of data.monthlyAccountSnapshots) {
    requireReference(
      closeIds,
      snapshot.monthlyCloseId,
      `El snapshot de cuenta ${snapshot.id} referencia un cierre inexistente.`,
      errors
    );
    requireReference(
      accountIds,
      snapshot.accountId,
      `El snapshot de cuenta ${snapshot.id} referencia una cuenta inexistente.`,
      errors
    );
    requireOptionalReference(
      transactionIds,
      snapshot.adjustmentTransactionId,
      `El snapshot de cuenta ${snapshot.id} referencia un ajuste inexistente.`,
      errors
    );
  }

  for (const snapshot of data.monthlyBucketSnapshots) {
    requireReference(
      closeIds,
      snapshot.monthlyCloseId,
      `El snapshot de partida ${snapshot.id} referencia un cierre inexistente.`,
      errors
    );
    requireReference(
      bucketIds,
      snapshot.savingsBucketId,
      `El snapshot de partida ${snapshot.id} referencia una partida inexistente.`,
      errors
    );
  }
}

function validateArray(
  value: unknown,
  path: string,
  errors: string[],
  validator: Validator
) {
  if (!Array.isArray(value)) {
    errors.push(`${path} debe ser una lista.`);
    return;
  }

  value.forEach((item, index) => validator(item, `${path}[${index}]`, errors));
}

function validateTimestampedRecord(
  value: unknown,
  path: string,
  errors: string[]
): value is Record<string, unknown> {
  if (!validateRecordWithId(value, path, errors)) return false;
  validateDate(value.createdAt, `${path}.createdAt`, errors);
  validateDate(value.updatedAt, `${path}.updatedAt`, errors);
  return true;
}

function validateRecordWithId(
  value: unknown,
  path: string,
  errors: string[]
): value is Record<string, unknown> {
  if (!isRecord(value)) {
    errors.push(`${path} debe ser un objeto.`);
    return false;
  }
  validateRequiredString(value.id, `${path}.id`, errors);
  return true;
}

function validateRequiredString(
  value: unknown,
  path: string,
  errors: string[]
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${path} debe ser un texto no vacío.`);
  }
}

function validateOptionalString(
  value: unknown,
  path: string,
  errors: string[],
  allowUndefined = false
) {
  if (value === null || (allowUndefined && value === undefined)) return;
  if (typeof value !== "string") {
    errors.push(`${path} debe ser texto o null.`);
  }
}

function validateBoolean(value: unknown, path: string, errors: string[]) {
  if (typeof value !== "boolean") {
    errors.push(`${path} debe ser booleano.`);
  }
}

function validateInteger(value: unknown, path: string, errors: string[]) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push(`${path} debe ser un número entero.`);
  }
}

function validateOptionalInteger(
  value: unknown,
  path: string,
  errors: string[]
) {
  if (value === null) return;
  validateInteger(value, path, errors);
}

function validateMonth(value: unknown, path: string, errors: string[]) {
  validateInteger(value, path, errors);
  if (typeof value === "number" && (value < 1 || value > 12)) {
    errors.push(`${path} debe estar entre 1 y 12.`);
  }
}

function validateDecimal(value: unknown, path: string, errors: string[]) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    !/^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) ||
    !Number.isFinite(Number(value))
  ) {
    errors.push(`${path} debe ser un importe numérico en formato texto.`);
  }
}

function validateOptionalDecimal(
  value: unknown,
  path: string,
  errors: string[]
) {
  if (value === null) return;
  validateDecimal(value, path, errors);
}

function validateDate(value: unknown, path: string, errors: string[]) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    Number.isNaN(Date.parse(value))
  ) {
    errors.push(`${path} debe ser una fecha válida.`);
  }
}

function validateOptionalDate(
  value: unknown,
  path: string,
  errors: string[]
) {
  if (value === null) return;
  validateDate(value, path, errors);
}

function validateEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
  errors: string[]
) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    errors.push(`${path} contiene un valor no admitido.`);
  }
}

function validateUniqueIds(
  records: Array<{ id: string }>,
  label: string,
  errors: string[]
): Set<string> {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) {
      errors.push(`Hay IDs duplicados en ${label}: ${record.id}.`);
    }
    ids.add(record.id);
  }
  return ids;
}

function validateUniqueValues<T extends Record<K, string>, K extends keyof T>(
  records: T[],
  key: K,
  label: string,
  errors: string[]
) {
  const values = new Set<string>();
  for (const record of records) {
    if (values.has(record[key])) {
      errors.push(`Hay valores duplicados en ${label}: ${record[key]}.`);
    }
    values.add(record[key]);
  }
}

function validateUniqueOptionalValues<
  T extends Record<K, string | null>,
  K extends keyof T
>(records: T[], key: K, label: string, errors: string[]) {
  const values = new Set<string>();
  for (const record of records) {
    const value = record[key];
    if (value === null) continue;
    if (values.has(value)) {
      errors.push(`Hay valores duplicados en ${label}: ${value}.`);
    }
    values.add(value);
  }
}

function validateUniqueComposite<T>(
  records: T[],
  getKey: (record: T) => string,
  label: string,
  errors: string[]
) {
  const values = new Set<string>();
  for (const record of records) {
    const value = getKey(record);
    if (values.has(value)) {
      errors.push(`Hay valores duplicados en ${label}: ${value}.`);
    }
    values.add(value);
  }
}

function requireReference(
  ids: Set<string>,
  id: string,
  message: string,
  errors: string[]
) {
  if (!ids.has(id)) errors.push(message);
}

function requireOptionalReference(
  ids: Set<string>,
  id: string | null,
  message: string,
  errors: string[]
) {
  if (id !== null && !ids.has(id)) errors.push(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(errors: string | string[]): BackupValidationResult {
  return {
    success: false,
    data: null,
    summary: null,
    errors: Array.isArray(errors) ? errors : [errors]
  };
}
