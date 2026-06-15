import Link from "next/link";
import { BackupManager } from "./BackupManager";

export const dynamic = "force-dynamic";

export default function BackupSettingsPage() {
  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Configuración
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Backup y restauración
            </h1>
            <p className="text-sm text-muted">
              Protege tus datos financieros o muévelos a otra instalación.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link className="nav-link" href="/">
              Dashboard
            </Link>
            <Link className="nav-link" href="/accounts">
              Cuentas
            </Link>
            <Link className="nav-link" href="/settings/budget">
              Objetivo semanal
            </Link>
          </nav>
        </header>

        <BackupManager />
      </div>
    </main>
  );
}
