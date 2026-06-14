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
