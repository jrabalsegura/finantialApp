import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SecurityForms } from "./SecurityForms";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const currentUser = await requireCurrentUser();
  const users = await prisma.appUser.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      id: true,
      username: true
    }
  });

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="grid gap-3">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Configuración
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Seguridad
            </h1>
            <p className="text-sm text-muted">
              Gestiona las credenciales de acceso a la app. Tu sesión caduca
              aproximadamente cada hora.
            </p>
          </div>
        </header>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">Usuarios</h2>
            <p className="mt-1 text-sm text-muted">
              Sesión actual:{" "}
              <span className="font-semibold text-ink">
                {currentUser.username}
              </span>
            </p>
          </div>
          <ul className="divide-y divide-line">
            {users.map((user) => (
              <li
                className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
                key={user.id}
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {user.username}
                  </p>
                  <p className="text-xs text-muted">
                    Creado el {formatDate(user.createdAt)}
                  </p>
                </div>
                {user.id === currentUser.id ? (
                  <span className="w-fit rounded-md border border-line bg-surface px-2 py-1 text-xs font-semibold text-muted">
                    Actual
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <SecurityForms />
      </div>
    </main>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
