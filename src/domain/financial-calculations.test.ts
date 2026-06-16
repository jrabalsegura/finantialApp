import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAvailableMoney,
  calculateAssignedSavings,
  calculateLongTermBucketAdjustment,
  calculateLongTermBucketBalance,
  calculateNetWorth,
  calculateNetWorthVariation,
  calculatePendingReimbursements,
  calculateRealMonthlyExpense,
  calculateRealMonthlyIncome,
  calculateRealMonthlySavings,
  calculateUnassignedAvailableMoney,
  accountFeedsLongTermBucket,
  applyBucketAllocations,
  applyBucketReductions,
  createMonthlyBucketSnapshots,
  getDefaultTransactionImpact,
  getMonthlyCloseResult,
  isTransactionInMonth,
  transactionAffectsMonthlySavings,
  transactionAffectsNetWorth,
  validateNegativeBucketReductions,
  validatePositiveBucketAllocations,
  type AccountForCalculations,
  type ReimbursementForCalculations,
  type SavingsBucketForCalculations,
  type TransactionForCalculations,
  type TransactionType
} from "./financial-calculations";

const accounts: AccountForCalculations[] = [
  {
    currentBalance: 1000,
    includeInAvailableMoney: true,
    includeInNetWorth: true
  },
  {
    currentBalance: "500.50",
    includeInAvailableMoney: true,
    includeInNetWorth: true
  },
  {
    currentBalance: 10000,
    includeInAvailableMoney: false,
    includeInNetWorth: true
  },
  {
    currentBalance: 750,
    includeInAvailableMoney: false,
    includeInNetWorth: false
  }
];

const transactions: TransactionForCalculations[] = [
  transaction("income", 3000, "2026-06-01", {
    affectsPersonalIncome: true,
    affectsMonthlySavings: true,
    affectsNetWorth: true
  }),
  transaction("expense", 100, "2026-06-02", {
    affectsPersonalExpense: true,
    affectsMonthlySavings: true,
    affectsNetWorth: true
  }),
  transaction("transfer", 250, "2026-06-03"),
  transaction("reimbursable_expense", 120, "2026-06-04"),
  transaction("reimbursement_income", 40, "2026-06-05"),
  transaction("investment_gain", 200, "2026-06-06", {
    affectsNetWorth: true
  }),
  transaction("investment_loss", 50, "2026-06-07", {
    affectsNetWorth: true
  }),
  transaction("balance_adjustment", 30, "2026-06-08", {
    affectsPersonalExpense: true,
    affectsMonthlySavings: true,
    affectsNetWorth: true
  }),
  transaction("income", 999, "2026-05-31", {
    affectsPersonalIncome: true,
    affectsMonthlySavings: true,
    affectsNetWorth: true
  })
];

const reimbursements: ReimbursementForCalculations[] = [
  reimbursement("r1", 120, 40, "pending"),
  reimbursement("r2", 50, 20, "partially_paid"),
  reimbursement("r3", 30, 30, "paid"),
  reimbursement("r4", 100, 0, "cancelled"),
  reimbursement("r5", 100, 0, "uncollectible")
];

const savingsBuckets: SavingsBucketForCalculations[] = [
  { currentAmount: 400 },
  { currentAmount: "250.50" },
  { currentAmount: 100 }
];

test("calcula dinero disponible usando solo cuentas marcadas como disponibles", () => {
  assert.equal(calculateAvailableMoney(accounts), 1500.5);
});

test("calcula patrimonio total con cuentas patrimoniales y pendientes de cobrar vivos", () => {
  assert.equal(calculateNetWorth(accounts, reimbursements), 11610.5);
});

test("calcula la variacion patrimonial entre cierres", () => {
  assert.equal(calculateNetWorthVariation("1200.25", 1000), 200.25);
  assert.equal(calculateNetWorthVariation(1200, null), null);
});

test("calcula dinero asignado y dinero disponible no asignado", () => {
  assert.equal(calculateAssignedSavings(savingsBuckets), 750.5);
  assert.equal(calculateUnassignedAvailableMoney(accounts, savingsBuckets), 750);
});

test("calcula el ajuste automatico de largo plazo por cuentas fuera del ahorro mensual", () => {
  assert.equal(
    accountFeedsLongTermBucket({
      includeInMonthlySavings: false,
      includeInNetWorth: true,
      type: "investment"
    }),
    true
  );
  assert.equal(
    accountFeedsLongTermBucket({
      includeInMonthlySavings: true,
      includeInNetWorth: true,
      type: "investment"
    }),
    false
  );
  assert.equal(
    calculateLongTermBucketAdjustment([
      {
        currentBalance: 1000,
        difference: 120,
        includeInMonthlySavings: false,
        includeInNetWorth: true,
        type: "investment"
      },
      {
        currentBalance: 500,
        difference: -40,
        includeInMonthlySavings: false,
        includeInNetWorth: true,
        type: "pension"
      },
      {
        currentBalance: 200,
        difference: 500,
        includeInMonthlySavings: true,
        includeInNetWorth: true,
        type: "savings"
      },
      {
        currentBalance: 300,
        difference: 80,
        includeInMonthlySavings: false,
        includeInNetWorth: false,
        type: "investment"
      }
    ]),
    80
  );
  assert.equal(
    calculateLongTermBucketBalance([
      {
        currentBalance: 1000,
        includeInMonthlySavings: false,
        includeInNetWorth: true,
        type: "investment"
      },
      {
        currentBalance: 500,
        includeInMonthlySavings: false,
        includeInNetWorth: true,
        type: "pension"
      },
      {
        currentBalance: 200,
        includeInMonthlySavings: true,
        includeInNetWorth: true,
        type: "investment"
      }
    ]),
    1500
  );
});

test("calcula ingresos, gastos y ahorro mensual real por flags y mes", () => {
  assert.equal(calculateRealMonthlyIncome(transactions, 2026, 6), 3000);
  assert.equal(calculateRealMonthlyExpense(transactions, 2026, 6), 130);
  assert.equal(calculateRealMonthlySavings(transactions, 2026, 6), 2870);
});

test("clasifica el resultado del cierre mensual", () => {
  assert.deepEqual(getMonthlyCloseResult(400), {
    deficit: 0,
    kind: "positive",
    monthlySavings: 400,
    surplus: 400
  });
  assert.deepEqual(getMonthlyCloseResult(0), {
    deficit: 0,
    kind: "zero",
    monthlySavings: 0,
    surplus: 0
  });
  assert.deepEqual(getMonthlyCloseResult(-300), {
    deficit: 300,
    kind: "negative",
    monthlySavings: -300,
    surplus: 0
  });
});

test("valida asignaciones positivas exactas sin dejar dinero pendiente", () => {
  assert.deepEqual(
    validatePositiveBucketAllocations(
      [
        { amount: 150, bucketId: "vacaciones" },
        { amount: 50, bucketId: "reserva" }
      ],
      200
    ),
    {
      pendingAmount: 0,
      totalAmount: 200
    }
  );

  assert.throws(
    () =>
      validatePositiveBucketAllocations(
        [{ amount: 150, bucketId: "vacaciones" }],
        200
      ),
    /debe quedar asignado/
  );
  assert.throws(
    () =>
      validatePositiveBucketAllocations(
        [{ amount: 250, bucketId: "vacaciones" }],
        200
      ),
    /no puede superar/
  );
  assert.throws(
    () =>
      validatePositiveBucketAllocations(
        [{ amount: 1, bucketId: "vacaciones" }],
        -200
      ),
    /no es positivo/
  );
});

test("valida reducciones negativas exactas y sin saldos bajo cero", () => {
  const buckets = [
    { currentAmount: 1200, id: "vacaciones" },
    { currentAmount: 5000, id: "reserva" }
  ];

  assert.deepEqual(
    validateNegativeBucketReductions(
      [
        { amount: 100, bucketId: "vacaciones" },
        { amount: 200, bucketId: "reserva" }
      ],
      -300,
      buckets
    ),
    {
      pendingAmount: 0,
      totalAmount: 300
    }
  );

  assert.throws(
    () =>
      validateNegativeBucketReductions(
        [{ amount: 1300, bucketId: "vacaciones" }],
        -300,
        buckets
      ),
    /saldo actual/
  );
  assert.throws(
    () =>
      validateNegativeBucketReductions(
        [{ amount: 100, bucketId: "vacaciones" }],
        -300,
        buckets
      ),
    /totalmente cubierto/
  );
  assert.throws(
    () =>
      validateNegativeBucketReductions(
        [{ amount: 1, bucketId: "vacaciones" }],
        300,
        buckets
      ),
    /Solo se pueden reducir/
  );
});

test("detecta deficit mayor que el saldo disponible en partidas", () => {
  assert.throws(
    () =>
      validateNegativeBucketReductions(
        [{ amount: 2000, bucketId: "reserva" }],
        -3000,
        [{ currentAmount: 2000, id: "reserva" }]
      ),
    /No hay saldo suficiente/
  );
});

test("proyecta asignaciones, reducciones y snapshots de partidas", () => {
  const buckets = [
    { currentAmount: 1200, id: "vacaciones" },
    { currentAmount: 5000, id: "reserva" }
  ];

  assert.deepEqual(
    applyBucketAllocations(
      buckets,
      [{ amount: 100, bucketId: "vacaciones" }]
    ),
    [
      {
        adjustmentAmount: 100,
        bucketId: "vacaciones",
        currentAmount: 1200,
        finalAmount: 1300
      },
      {
        adjustmentAmount: 0,
        bucketId: "reserva",
        currentAmount: 5000,
        finalAmount: 5000
      }
    ]
  );
  assert.deepEqual(
    applyBucketReductions(
      buckets,
      [
        { amount: 100, bucketId: "vacaciones" },
        { amount: 200, bucketId: "reserva" }
      ]
    ).map((bucket) => [bucket.bucketId, bucket.finalAmount]),
    [
      ["vacaciones", 1100],
      ["reserva", 4800]
    ]
  );
  assert.deepEqual(
    createMonthlyBucketSnapshots([
      { amount: 1200, id: "vacaciones" },
      { amount: 5000, id: "reserva" }
    ]),
    [
      { amount: 1200, savingsBucketId: "vacaciones" },
      { amount: 5000, savingsBucketId: "reserva" }
    ]
  );
});

test("excluye transferencias, reembolsos e inversiones del ahorro mensual", () => {
  assert.equal(calculateRealMonthlyIncome(transactions, 2026, 5), 999);
  assert.equal(calculateRealMonthlyExpense(transactions, 2026, 5), 0);
  assert.equal(calculateRealMonthlySavings(transactions, 2026, 5), 999);
});

test("resume pendientes de reembolso cobrables", () => {
  const summary = calculatePendingReimbursements(reimbursements);

  assert.equal(summary.count, 2);
  assert.equal(summary.totalPending, 110);
  assert.deepEqual(
    summary.items.map((item) => [item.id, item.pendingAmount]),
    [
      ["r1", 80],
      ["r2", 30]
    ]
  );
});

test("distingue impacto por tipo de movimiento", () => {
  assert.equal(getDefaultTransactionImpact("expense").affectsMonthlySavings, true);
  assert.equal(
    getDefaultTransactionImpact("reimbursable_expense")
      .affectsMonthlySavings,
    false
  );
  assert.equal(getDefaultTransactionImpact("investment_gain").affectsNetWorth, true);
  assert.equal(getDefaultTransactionImpact("transfer").affectsNetWorth, false);
});

test("expone predicados explicitos para ahorro mensual y patrimonio", () => {
  const expense = transactions[1];
  const investmentGain = transactions[5];
  const transfer = transactions[2];

  assert.equal(transactionAffectsMonthlySavings(expense), true);
  assert.equal(transactionAffectsMonthlySavings(investmentGain), false);
  assert.equal(transactionAffectsNetWorth(investmentGain), true);
  assert.equal(transactionAffectsNetWorth(transfer), false);
});

test("usa meses naturales con limite superior exclusivo", () => {
  assert.equal(
    isTransactionInMonth(transaction("income", 1, "2026-06-30T23:59:59"), 2026, 6),
    true
  );
  assert.equal(
    isTransactionInMonth(transaction("income", 1, "2026-07-01T00:00:00"), 2026, 6),
    false
  );
});

function transaction(
  type: TransactionType,
  amount: number,
  date: string,
  impact: Partial<Omit<TransactionForCalculations, "type" | "amount" | "date">> = {}
): TransactionForCalculations {
  return {
    type,
    amount,
    date: new Date(date),
    affectsPersonalExpense: false,
    affectsPersonalIncome: false,
    affectsMonthlySavings: false,
    affectsNetWorth: false,
    ...impact
  };
}

function reimbursement(
  id: string,
  expectedAmount: number,
  paidAmount: number,
  status: ReimbursementForCalculations["status"]
): ReimbursementForCalculations {
  return {
    id,
    title: `Reembolso ${id}`,
    personName: "Inquilino",
    expectedAmount,
    paidAmount,
    status,
    dueDate: null
  };
}
