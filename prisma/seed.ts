import { PrismaClient, type AccountType, type CategoryType } from "@prisma/client";

const prisma = new PrismaClient();

type AccountSeed = {
  name: string;
  type: AccountType;
  includeInAvailableMoney: boolean;
  includeInNetWorth: boolean;
  includeInMonthlySavings: boolean;
  isDefault?: boolean;
  notes?: string;
};

type CategorySeed = {
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
};

const accounts: AccountSeed[] = [
  {
    name: "Openbank principal",
    type: "checking",
    includeInAvailableMoney: true,
    includeInNetWorth: true,
    includeInMonthlySavings: true,
    isDefault: true,
    notes: "Cuenta por defecto para gastos e ingresos diarios."
  },
  {
    name: "Openbank ahorro",
    type: "savings",
    includeInAvailableMoney: true,
    includeInNetWorth: true,
    includeInMonthlySavings: true
  },
  {
    name: "Santander",
    type: "checking",
    includeInAvailableMoney: true,
    includeInNetWorth: true,
    includeInMonthlySavings: true
  },
  {
    name: "Efectivo",
    type: "cash",
    includeInAvailableMoney: true,
    includeInNetWorth: true,
    includeInMonthlySavings: true
  },
  {
    name: "Raisin",
    type: "savings",
    includeInAvailableMoney: false,
    includeInNetWorth: true,
    includeInMonthlySavings: true,
    notes: "Disponible desactivado por defecto; se puede cambiar si interesa."
  },
  {
    name: "Tesoro",
    type: "treasury",
    includeInAvailableMoney: false,
    includeInNetWorth: true,
    includeInMonthlySavings: false
  },
  {
    name: "HeyTrade",
    type: "investment",
    includeInAvailableMoney: false,
    includeInNetWorth: true,
    includeInMonthlySavings: false
  },
  {
    name: "Plan de pensiones",
    type: "pension",
    includeInAvailableMoney: false,
    includeInNetWorth: true,
    includeInMonthlySavings: false
  }
];

const categories: CategorySeed[] = [
  { name: "Nómina", type: "income", color: "#1f7a6b" },
  { name: "Alquiler recibido", type: "income", color: "#2f855a" },
  { name: "Reembolso", type: "income", color: "#4c6fff" },
  { name: "Otros ingresos", type: "income", color: "#64748b" },
  { name: "Supermercado", type: "expense", color: "#d97706" },
  { name: "Restaurantes", type: "expense", color: "#c2410c" },
  { name: "Transporte", type: "expense", color: "#2563eb" },
  { name: "Casa", type: "expense", color: "#7c3aed" },
  { name: "Suministros", type: "expense", color: "#0891b2" },
  { name: "Ocio", type: "expense", color: "#db2777" },
  { name: "Viajes", type: "expense", color: "#0f766e" },
  { name: "Salud", type: "expense", color: "#dc2626" },
  { name: "Suscripciones", type: "expense", color: "#475569" },
  { name: "Impuestos", type: "expense", color: "#9333ea" },
  { name: "Otros gastos", type: "expense", color: "#71717a" }
];

const savingsBuckets = [
  { name: "Fondo de reserva", priority: 1, isLongTerm: false },
  { name: "Largo plazo", priority: 2, isLongTerm: true },
  { name: "Hipoteca / coche", priority: 3, isLongTerm: false },
  { name: "Incidencias piso", priority: 4, isLongTerm: false },
  { name: "Vacaciones", priority: 5, isLongTerm: false },
  { name: "IRPF y gastos", priority: 6, isLongTerm: false },
  { name: "Seguros", priority: 7, isLongTerm: false },
  { name: "Dentista", priority: 8, isLongTerm: false },
  { name: "Ahorro efectivo del mes", priority: 9, isLongTerm: false }
];

async function main() {
  for (const account of accounts) {
    await prisma.account.upsert({
      where: { name: account.name },
      update: account,
      create: {
        currentBalance: 0,
        ...account
      }
    });
  }

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: category,
      create: category
    });
  }

  for (const bucket of savingsBuckets) {
    await prisma.savingsBucket.upsert({
      where: { name: bucket.name },
      update: bucket,
      create: {
        currentAmount: 0,
        ...bucket
      }
    });
  }

  const [defaultAccount, savingsAccount, salaryCategory, subscriptionCategory, longTermBucket] =
    await Promise.all([
      prisma.account.findUnique({ where: { name: "Openbank principal" } }),
      prisma.account.findUnique({ where: { name: "Openbank ahorro" } }),
      prisma.category.findUnique({ where: { name: "Nómina" } }),
      prisma.category.findUnique({ where: { name: "Suscripciones" } }),
      prisma.savingsBucket.findUnique({ where: { name: "Largo plazo" } })
    ]);

  if (
    defaultAccount &&
    savingsAccount &&
    salaryCategory &&
    subscriptionCategory &&
    longTermBucket
  ) {
    const recurringExamples = [
      {
        name: "Nómina mensual",
        type: "income" as const,
        amount: 2500,
        accountId: defaultAccount.id,
        categoryId: salaryCategory.id,
        savingsBucketId: null,
        destinationAccountId: null,
        dayOfMonth: 1
      },
      {
        name: "Suscripción mensual",
        type: "expense" as const,
        amount: 15,
        accountId: defaultAccount.id,
        categoryId: subscriptionCategory.id,
        savingsBucketId: null,
        destinationAccountId: null,
        dayOfMonth: 5
      },
      {
        name: "Aportación mensual a largo plazo",
        type: "savings_allocation" as const,
        amount: 300,
        accountId: savingsAccount.id,
        categoryId: null,
        savingsBucketId: longTermBucket.id,
        destinationAccountId: null,
        dayOfMonth: 1
      }
    ];

    for (const recurring of recurringExamples) {
      const existing = await prisma.recurringTransaction.findFirst({
        where: { name: recurring.name },
        select: { id: true }
      });

      if (!existing) {
        await prisma.recurringTransaction.create({
          data: {
            ...recurring,
            startDate: new Date(2026, 0, 1, 12),
            isActive: true,
            autoCreateMode: "pending"
          }
        });
      }
    }
  }

  const [
    quickDefaultAccount,
    quickSavingsAccount,
    supermarketCategory,
    restaurantCategory,
    otherIncomeCategory,
    houseCategory
  ] = await Promise.all([
    prisma.account.findUnique({ where: { name: "Openbank principal" } }),
    prisma.account.findUnique({ where: { name: "Openbank ahorro" } }),
    prisma.category.findUnique({ where: { name: "Supermercado" } }),
    prisma.category.findUnique({ where: { name: "Restaurantes" } }),
    prisma.category.findUnique({ where: { name: "Otros ingresos" } }),
    prisma.category.findUnique({ where: { name: "Casa" } })
  ]);

  if (quickDefaultAccount) {
    const quickExamples = [
      {
        name: "Supermercado",
        type: "expense" as const,
        defaultAmount: null,
        accountId: quickDefaultAccount.id,
        destinationAccountId: null,
        categoryId: supermarketCategory?.id ?? null,
        savingsBucketId: null,
        defaultDescription: "Supermercado",
        sortOrder: 1,
        isFavorite: true
      },
      {
        name: "Café",
        type: "expense" as const,
        defaultAmount: 1.5,
        accountId: quickDefaultAccount.id,
        destinationAccountId: null,
        categoryId: restaurantCategory?.id ?? null,
        savingsBucketId: null,
        defaultDescription: "Café",
        sortOrder: 2,
        isFavorite: true
      },
      {
        name: "Comida fuera",
        type: "expense" as const,
        defaultAmount: null,
        accountId: quickDefaultAccount.id,
        destinationAccountId: null,
        categoryId: restaurantCategory?.id ?? null,
        savingsBucketId: null,
        defaultDescription: "Comida fuera",
        sortOrder: 3,
        isFavorite: true
      },
      {
        name: "Bizum recibido",
        type: "income" as const,
        defaultAmount: null,
        accountId: quickDefaultAccount.id,
        destinationAccountId: null,
        categoryId: otherIncomeCategory?.id ?? null,
        savingsBucketId: null,
        defaultDescription: "Bizum recibido",
        sortOrder: 4,
        isFavorite: true
      },
      {
        name: "Gasto piso alquilado reembolsable",
        type: "reimbursable_expense" as const,
        defaultAmount: null,
        accountId: quickDefaultAccount.id,
        destinationAccountId: null,
        categoryId: houseCategory?.id ?? null,
        savingsBucketId: null,
        defaultDescription: "Factura piso alquilado",
        sortOrder: 5,
        isFavorite: true
      },
      ...(quickSavingsAccount
        ? [
            {
              name: "Transferencia a ahorro",
              type: "transfer" as const,
              defaultAmount: null,
              accountId: quickDefaultAccount.id,
              destinationAccountId: quickSavingsAccount.id,
              categoryId: null,
              savingsBucketId: null,
              defaultDescription: "Transferencia a ahorro",
              sortOrder: 6,
              isFavorite: false
            }
          ]
        : [])
    ];

    for (const template of quickExamples) {
      const existing = await prisma.quickTransactionTemplate.findFirst({
        where: { name: template.name },
        select: { id: true }
      });
      if (!existing) {
        await prisma.quickTransactionTemplate.create({
          data: {
            ...template,
            icon: null,
            color: null,
            isActive: true
          }
        });
      }
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
