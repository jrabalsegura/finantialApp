const phaseItems = [
  "Next.js App Router con TypeScript",
  "Tailwind CSS configurado",
  "Prisma preparado con SQLite",
  "Modelo de datos principal definido",
  "Seed inicial de cuentas, categorías y partidas"
];

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Fase 1
          </p>
          <h1 className="text-3xl font-semibold text-ink sm:text-5xl">
            Base técnica de la app financiera
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Proyecto inicializado para construir el MVP por fases. Esta entrega
            deja lista la infraestructura, el modelo de datos y los datos base.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {phaseItems.map((item) => (
            <div
              className="rounded-lg border border-line bg-white px-4 py-3 text-sm font-medium text-ink"
              key={item}
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
