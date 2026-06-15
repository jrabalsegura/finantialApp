import Link from "next/link";
import { ConfirmSubmitButton } from "../components/ConfirmSubmitButton";
import { QuickTemplateFields } from "../components/QuickTemplateFields";
import {
  createQuickTemplateAction,
  deleteQuickTemplate,
  moveQuickTemplate,
  toggleQuickTemplateActive,
  toggleQuickTemplateFavorite,
  updateQuickTemplateAction
} from "./actions";
import { toMoneyNumber } from "@/domain/financial-calculations";
import { getQuickTemplates } from "@/lib/quick-transaction-templates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR"
});

const typeLabels = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transferencia",
  reimbursable_expense: "Gasto reembolsable",
  reimbursement_income: "Cobro de reembolso",
  savings_allocation: "Asignación a ahorro"
};

export default async function QuickTemplatesPage() {
  const [accounts, categories, savingsBuckets, templates] = await Promise.all([
    prisma.account.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true }
    }),
    prisma.category.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true }
    }),
    prisma.savingsBucket.findMany({
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      select: { id: true, name: true }
    }),
    getQuickTemplates()
  ]);
  const fields = { accounts, categories, savingsBuckets };

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <header className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Accesos rápidos
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Plantillas rápidas
            </h1>
            <p className="text-sm text-muted">
              Solo rellenan el formulario. Los saldos cambian al confirmar el
              movimiento.
            </p>
          </div>
          <Link className="nav-link" href="/">
            Volver al dashboard
          </Link>
        </header>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">Plantillas</h2>
          </div>
          {templates.length ? (
            <ul className="divide-y divide-line">
              {templates.map((template, index) => (
                <li className="grid gap-4 px-4 py-5 sm:px-5" key={template.id}>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-ink">
                          {template.icon ? `${template.icon} ` : ""}
                          {template.name}
                        </h3>
                        <span className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-muted">
                          {typeLabels[template.type]}
                        </span>
                        {template.isFavorite ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                            Favorita
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            template.isActive
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-surface text-muted"
                          }`}
                        >
                          {template.isActive ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {template.account?.name ?? "Cuenta por defecto"}
                        {template.destinationAccount
                          ? ` → ${template.destinationAccount.name}`
                          : ""}
                        {template.category
                          ? ` · ${template.category.name}`
                          : ""}
                        {template.savingsBucket
                          ? ` · ${template.savingsBucket.name}`
                          : ""}
                        {" · "}
                        {template.defaultAmount
                          ? currencyFormatter.format(
                              toMoneyNumber(template.defaultAmount)
                            )
                          : "Importe manual"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form action={moveQuickTemplate}>
                        <input name="id" type="hidden" value={template.id} />
                        <input name="direction" type="hidden" value="up" />
                        <button
                          className="nav-link"
                          disabled={index === 0}
                          title="Subir"
                          type="submit"
                        >
                          Subir
                        </button>
                      </form>
                      <form action={moveQuickTemplate}>
                        <input name="id" type="hidden" value={template.id} />
                        <input name="direction" type="hidden" value="down" />
                        <button
                          className="nav-link"
                          disabled={index === templates.length - 1}
                          title="Bajar"
                          type="submit"
                        >
                          Bajar
                        </button>
                      </form>
                      <form action={toggleQuickTemplateFavorite}>
                        <input name="id" type="hidden" value={template.id} />
                        <input
                          name="isFavorite"
                          type="hidden"
                          value={String(!template.isFavorite)}
                        />
                        <button className="nav-link" type="submit">
                          {template.isFavorite
                            ? "Quitar favorita"
                            : "Marcar favorita"}
                        </button>
                      </form>
                      <form action={toggleQuickTemplateActive}>
                        <input name="id" type="hidden" value={template.id} />
                        <input
                          name="isActive"
                          type="hidden"
                          value={String(!template.isActive)}
                        />
                        <button className="nav-link" type="submit">
                          {template.isActive ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  </div>

                  <details className="rounded-lg border border-line bg-surface p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-ink">
                      Editar plantilla
                    </summary>
                    <form
                      action={updateQuickTemplateAction}
                      className="mt-4 grid gap-4"
                    >
                      <input name="id" type="hidden" value={template.id} />
                      <QuickTemplateFields
                        {...fields}
                        template={{
                          ...template,
                          defaultAmount: template.defaultAmount
                            ? toMoneyNumber(template.defaultAmount)
                            : null
                        }}
                      />
                      <button className="primary-button" type="submit">
                        Guardar cambios
                      </button>
                    </form>
                  </details>

                  <form action={deleteQuickTemplate}>
                    <input name="id" type="hidden" value={template.id} />
                    <ConfirmSubmitButton
                      className="danger-button"
                      confirmMessage={`¿Eliminar la plantilla "${template.name}"? Los movimientos ya creados no se modificarán.`}
                    >
                      Eliminar
                    </ConfirmSubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              Todavía no hay plantillas rápidas.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-ink">Crear plantilla</h2>
          {accounts.length ? (
            <form
              action={createQuickTemplateAction}
              className="mt-4 grid gap-4"
            >
              <QuickTemplateFields {...fields} />
              <button className="primary-button" type="submit">
                Guardar plantilla
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Crea una cuenta antes de configurar accesos rápidos.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
