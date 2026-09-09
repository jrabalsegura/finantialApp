import { processDueRecurringTransactions } from "../src/lib/recurring-transactions";
import { prisma } from "../src/lib/prisma";

let stopping = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let wake: (() => void) | undefined;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    stopping = true;
    if (timer) clearTimeout(timer);
    wake?.();
  });

async function run() {
  try {
    while (!stopping) {
      try {
        await processDueRecurringTransactions();
      } catch (error) {
        console.error(
          "No se pudieron procesar los recurrentes automáticos.",
          error
        );
      }
      if (!stopping)
        await new Promise<void>((resolve) => {
          wake = resolve;
          timer = setTimeout(resolve, 60_000);
        });
    }
  } finally {
    await prisma.$disconnect();
  }
}
void run();
