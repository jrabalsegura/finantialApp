import Link from "next/link";
import type { QuickTransactionTemplateType } from "@prisma/client";
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
import { QUICK_TRANSACTION_TYPE_LABELS } from "@/domain/domain-options";
import { currencyFormatter } from "@/lib/formatters";
import { getQuickTemplates } from "@/lib/quick-transaction-templates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type QuickTemplate = Awaited<ReturnType<typeof getQuickTemplates>>[number];
type QuickTemplateGroupKey = "income" | "expense" | "transfer";
type QuickTemplateFieldsValue = {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{
    id: string;
    name: string;
    type: "expense" | "income" | "both";
  }>;
  savingsBuckets: Array<{ id: string; name: string }>;
};

const quickTemplateGroups: Array<{
  key: QuickTemplateGroupKey;
  title: string;
  description: string;
}> = [
  {
    key: "income",
    title: "Ingresos",
    description: "Plantillas para entradas de dinero y cobros."
  },
  {
    key: "expense",
    title: "Gastos",
    description: "Plantillas para gastos rápidos y reembolsables."
  },
  {
    key: "transfer",
    title: "Transferencias y ahorro",
    description: "Plantillas para mover dinero o asignarlo a partidas."
  }
];

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
      where: { isLongTerm: false },
      select: { id: true, name: true }
    }),
    getQuickTemplates()
  ]);
  const fields = { accounts, categories, savingsBuckets };
  const templatesWithIndex = templates.map((template, index) => ({
    index,
    template
  }));
  const groupedTemplates = quickTemplateGroups.map((group) => ({
    ...group,
    items: templatesWithIndex.filter(({ template }) =>
      belongsToQuickTemplateGroup(template.type, group.key)
    )
  }));

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
            <div className="grid gap-4 p-4 sm:p-5">
              {groupedTemplates.map((group) =>
                group.items.length > 0 ? (
                  <section
                    className="overflow-hidden rounded-lg border border-line"
                    key={group.key}
                  >
                    <GroupedTemplateHeader
                      count={group.items.length}
                      description={group.description}
                      title={group.title}
                    />
                    <ul className="divide-y divide-line">
                      {group.items.map(({ index, template }) => (
                        <QuickTemplateListItem
                          fields={fields}
                          index={index}
                          key={template.id}
                          template={template}
                          templateCount={templates.length}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null
              )}
            </div>
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

function QuickTemplateListItem({
  fields,
  index,
  template,
  templateCount
}: {
  fields: QuickTemplateFieldsValue;
  index: number;
  template: QuickTemplate;
  templateCount: number;
}) {
  return (
    <li className="grid gap-4 px-4 py-5 sm:px-5">
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-semibold text-ink">
              {template.icon ? `${template.icon} ` : ""}
              {template.name}
            </h3>
            <span className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-muted">
              {QUICK_TRANSACTION_TYPE_LABELS[template.type]}
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
          <p className="amount-text mt-1 text-sm text-muted">
            {template.account?.name ?? "Cuenta por defecto"}
            {template.destinationAccount
              ? ` → ${template.destinationAccount.name}`
              : ""}
            {template.category ? ` · ${template.category.name}` : ""}
            {template.savingsBucket ? ` · ${template.savingsBucket.name}` : ""}
            {" · "}
            {template.defaultAmount
              ? currencyFormatter.format(toMoneyNumber(template.defaultAmount))
              : "Importe manual"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
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
              disabled={index === templateCount - 1}
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
              {template.isFavorite ? "Quitar favorita" : "Marcar favorita"}
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
        <form action={updateQuickTemplateAction} className="mt-4 grid gap-4">
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
  );
}

function GroupedTemplateHeader({
  count,
  description,
  title
}: {
  count: number;
  description: string;
  title: string;
}) {
  return (
    <div className="grid gap-2 border-b border-line bg-surface px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">
          {title}
        </h3>
        <p className="mt-1 text-xs text-muted">{description}</p>
      </div>
      <span className="w-fit rounded-full bg-white px-2 py-1 text-xs font-semibold text-muted">
        {count} {count === 1 ? "plantilla" : "plantillas"}
      </span>
    </div>
  );
}

function belongsToQuickTemplateGroup(
  type: QuickTransactionTemplateType,
  group: QuickTemplateGroupKey
): boolean {
  if (group === "income") {
    return type === "income" || type === "reimbursement_income";
  }

  if (group === "expense") {
    return type === "expense" || type === "reimbursable_expense";
  }

  return type === "transfer" || type === "savings_allocation";
}
