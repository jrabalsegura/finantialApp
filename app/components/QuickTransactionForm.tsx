"use client";

import {
  useActionState,
  useMemo,
  useRef,
  useState
} from "react";
import type { QuickTransactionTemplateType } from "@prisma/client";
import type {
  TransactionFormState,
  createQuickTransaction
} from "../actions";
import { QUICK_TRANSACTION_TYPE_LABELS } from "@/domain/domain-options";
import { formatCurrencyEUR } from "@/lib/formatters";
import { formatPlainAmount } from "@/domain/money";
import type { QuickTransactionDraft } from "@/domain/quick-transaction-templates";

type AccountOption = { id: string; name: string };
type CategoryOption = {
  id: string;
  name: string;
  type: "expense" | "income" | "both";
};
type SavingsBucketOption = { id: string; name: string };
type ReimbursementOption = {
  id: string;
  title: string;
  personName: string;
  pendingAmount: number;
};
type QuickTemplateOption = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  draft: QuickTransactionDraft;
};

type QuickTransactionFormProps = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  savingsBuckets: SavingsBucketOption[];
  reimbursements: ReimbursementOption[];
  templates: QuickTemplateOption[];
  defaultAccountId: string;
  today: string;
  action: typeof createQuickTransaction;
};

const initialState: TransactionFormState = {
  status: "idle",
  message: ""
};

const transactionModes: Array<{
  type: QuickTransactionTemplateType;
  label: string;
  tone: string;
}> = [
  {
    type: "expense",
    label: "Añadir gasto",
    tone: "border-rose-200 bg-rose-50 text-rose-900"
  },
  {
    type: "income",
    label: "Añadir ingreso",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900"
  },
  {
    type: "transfer",
    label: "Añadir transferencia",
    tone: "border-sky-200 bg-sky-50 text-sky-900"
  }
];

const submitLabels: Record<QuickTransactionTemplateType, string> = {
  expense: "Guardar gasto",
  income: "Guardar ingreso",
  transfer: "Guardar transferencia",
  reimbursable_expense: "Guardar gasto reembolsable",
  reimbursement_income: "Guardar cobro de reembolso",
  savings_allocation: "Guardar asignación"
};

export function QuickTransactionForm({
  accounts,
  categories,
  savingsBuckets,
  reimbursements,
  templates,
  defaultAccountId,
  today,
  action
}: QuickTransactionFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [type, setType] =
    useState<QuickTransactionTemplateType>("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [savingsBucketId, setSavingsBucketId] = useState("");
  const [description, setDescription] = useState("");
  const [activeTemplateName, setActiveTemplateName] = useState<string | null>(
    null
  );
  const amountRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const categoryType = type === "reimbursable_expense" ? "expense" : type;
  const availableCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.type === "both" || category.type === categoryType
      ),
    [categories, categoryType]
  );
  const destinationAccounts = accounts.filter(
    (account) => account.id !== accountId
  );
  const visibleTemplates = templates.filter(
    (template) => template.draft.type === type
  );

  function selectBaseMode(nextType: QuickTransactionTemplateType) {
    setType(nextType);
    setActiveTemplateName(null);
    setDestinationAccountId("");
    setCategoryId("");
    setSavingsBucketId("");
  }

  function changeType(nextType: QuickTransactionTemplateType) {
    setType(nextType);
    setDestinationAccountId("");
    setCategoryId("");
    setSavingsBucketId("");
  }

  function applyTemplate(template: QuickTemplateOption) {
    const { draft } = template;
    setType(draft.type);
    setAmount(draft.amount === null ? "" : formatPlainAmount(draft.amount));
    setAccountId(draft.accountId);
    setDestinationAccountId(draft.destinationAccountId ?? "");
    setCategoryId(draft.categoryId ?? "");
    setSavingsBucketId(draft.savingsBucketId ?? "");
    setDescription(draft.description);
    setActiveTemplateName(template.name);

    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (draft.amount === null) amountRef.current?.focus();
    }, 0);
  }

  return (
    <section
      className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5"
      id="quick-transaction"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {transactionModes.map((item) => {
          const isSelected = item.type === type && !activeTemplateName;
          return (
            <button
              aria-pressed={isSelected}
              className={`min-h-20 min-w-0 whitespace-normal break-words rounded-lg border px-4 py-4 text-left text-base font-semibold leading-snug transition [overflow-wrap:anywhere] ${
                isSelected
                  ? `${item.tone} ring-2 ring-ink`
                  : "border-line bg-surface text-ink"
              }`}
              key={item.type}
              onClick={() => selectBaseMode(item.type)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Accesos rápidos</h2>
            <p className="mt-1 text-xs text-muted">
              Elige una plantilla y revisa los datos antes de guardar.
            </p>
          </div>
          <a className="text-sm font-semibold text-accent" href="/quick-templates">
            Gestionar
          </a>
        </div>
        {visibleTemplates.length ? (
          <div className="mt-3 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
            {visibleTemplates.map((template) => (
              <button
                className="min-w-0 rounded-lg border border-line bg-surface px-3 py-3 text-left font-semibold text-ink transition hover:border-accent"
                key={template.id}
                onClick={() => applyTemplate(template)}
                style={
                  template.color
                    ? { borderLeftColor: template.color, borderLeftWidth: 4 }
                    : undefined
                }
                type="button"
              >
                <span className="block break-words text-sm [overflow-wrap:anywhere]">
                  {template.icon ? `${template.icon} ` : ""}
                  {template.name}
                </span>
                <span className="mt-1 block break-words text-xs font-normal text-muted [overflow-wrap:anywhere]">
                  {template.draft.amount === null
                    ? "Introducir importe"
                    : formatCurrencyEUR(template.draft.amount)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-surface px-3 py-3 text-sm text-muted">
            No hay plantillas favoritas activas para este tipo de movimiento.
          </p>
        )}
      </div>

      <form action={formAction} className="mt-5 grid gap-4" ref={formRef}>
        <input name="type" type="hidden" value={type} />

        {activeTemplateName ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>Plantilla: {activeTemplateName}</span>
            <button
              className="font-semibold"
              onClick={() => setActiveTemplateName(null)}
              type="button"
            >
              Quitar
            </button>
          </div>
        ) : null}

        <label className="field-label">
          Tipo de movimiento
          <select
            className="field-input"
            onChange={(event) =>
              changeType(
                event.target.value as QuickTransactionTemplateType
              )
            }
            value={type}
          >
            {Object.entries(QUICK_TRANSACTION_TYPE_LABELS).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            Importe
            <input
              className="field-input"
              inputMode="decimal"
              min="0.01"
              name="amount"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0,00"
              ref={amountRef}
              required
              step="0.01"
              type="number"
              value={amount}
            />
          </label>
          <label className="field-label">
            Fecha
            <input
              className="field-input"
              defaultValue={today}
              name="date"
              required
              type="date"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            Cuenta
            <select
              className="field-input"
              name="accountId"
              onChange={(event) => {
                setAccountId(event.target.value);
                if (event.target.value === destinationAccountId) {
                  setDestinationAccountId("");
                }
              }}
              required
              value={accountId}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          {type === "transfer" ? (
            <label className="field-label">
              Destino
              <select
                className="field-input"
                name="destinationAccountId"
                onChange={(event) => setDestinationAccountId(event.target.value)}
                required
                value={destinationAccountId}
              >
                <option disabled value="">
                  Selecciona destino
                </option>
                {destinationAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {type === "expense" ||
          type === "income" ||
          type === "reimbursable_expense" ? (
            <label className="field-label">
              Categoría
              <select
                className="field-input"
                name="categoryId"
                onChange={(event) => setCategoryId(event.target.value)}
                value={categoryId}
              >
                <option value="">Sin categoría</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {type === "savings_allocation" ? (
          <label className="field-label">
            Partida de ahorro
            <select
              className="field-input"
              name="savingsBucketId"
              onChange={(event) => setSavingsBucketId(event.target.value)}
              required
              value={savingsBucketId}
            >
              <option disabled value="">
                Selecciona partida
              </option>
              {savingsBuckets.map((bucket) => (
                <option key={bucket.id} value={bucket.id}>
                  {bucket.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {type === "reimbursable_expense" ? (
          <label className="field-label">
            Persona que devolverá el dinero
            <input className="field-input" name="personName" required />
          </label>
        ) : null}

        {type === "reimbursement_income" ? (
          <label className="field-label">
            Pendiente cobrado
            <select className="field-input" name="reimbursementId" required>
              <option disabled value="">
                Selecciona pendiente
              </option>
              {reimbursements.map((reimbursement) => (
                <option key={reimbursement.id} value={reimbursement.id}>
                  {reimbursement.title} · {reimbursement.personName} ·{" "}
                  {formatCurrencyEUR(reimbursement.pendingAmount)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field-label">
          Descripción
          <input
            className="field-input"
            name="description"
            onChange={(event) => setDescription(event.target.value)}
            placeholder={type === "transfer" ? "Entre cuentas" : "Concepto"}
            required={type === "reimbursable_expense"}
            type="text"
            value={description}
          />
        </label>

        <button
          className="primary-button min-h-14"
          disabled={isPending || accounts.length === 0}
          type="submit"
        >
          {isPending ? "Guardando..." : submitLabels[type]}
        </button>

        {state.message ? (
          <p
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              state.status === "success"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-rose-50 text-rose-800"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
