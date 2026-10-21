import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Error 404
          </p>
          <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
            Página no encontrada
          </h1>
        </header>
        <div>
          <Link className="primary-button" href="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
