import { prisma } from "@/lib/prisma";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextPath = parseNextPath(params?.next);
  const userCount = await prisma.appUser.count();
  const hasUsers = userCount > 0;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="grid w-full max-w-md gap-6 rounded-lg border border-line bg-white p-5 shadow-sm sm:p-6">
        <header className="grid gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Finanzas
          </p>
          <h1 className="text-3xl font-semibold text-ink">
            {hasUsers ? "Iniciar sesión" : "Crear primer usuario"}
          </h1>
          <p className="text-sm leading-6 text-muted">
            {hasUsers
              ? "Introduce tus credenciales para abrir la app. La sesión caduca tras 60 minutos sin actividad."
              : "No hay usuarios configurados todavía. Crea el primero para proteger la app."}
          </p>
        </header>

        <LoginForm hasUsers={hasUsers} nextPath={nextPath} />
      </section>
    </main>
  );
}

function parseNextPath(value: string | string[] | undefined): string {
  const nextPath = Array.isArray(value) ? value[0] : value;

  if (
    typeof nextPath !== "string" ||
    !nextPath.startsWith("/") ||
    nextPath.startsWith("//") ||
    nextPath.startsWith("/login")
  ) {
    return "/";
  }

  return nextPath;
}
