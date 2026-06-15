"use client";

import { useMemo, useState } from "react";
import type { QuickTransactionTemplateType } from "@prisma/client";

type TemplateValue = {
  name: string;
  type: QuickTransactionTemplateType;
  defaultAmount: number | null;
  accountId: string | null;
  destinationAccountId: string | null;
  categoryId: string | null;
  savingsBucketId: string | null;
  defaultDescription: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isFavorite: boolean;
  isActive: boolean;
};

type Props = {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{
    id: string;
    name: string;
    type: "expense" | "income" | "both";
  }>;
  savingsBuckets: Array<{ id: string; name: string }>;
  template?: TemplateValue;
};

const typeOptions: Array<{
  value: QuickTransactionTemplateType;
  label: string;
}> = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
  { value: "transfer", label: "Transferencia" },
  { value: "reimbursable_expense", label: "Gasto reembolsable" },
  { value: "reimbursement_income", label: "Cobro de reembolso" },
  { value: "savings_allocation", label: "Asignación a ahorro" }
];

export function QuickTemplateFields({
  accounts,
  categories,
  savingsBuckets,
  template
}: Props) {
  const [type, setType] = useState<QuickTransactionTemplateType>(
    template?.type ?? "expense"
  );
  const [accountId, setAccountId] = useState(template?.accountId ?? "");
  const categoryType = type === "reimbursable_expense" ? "expense" : type;
  const availableCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.type === "both" || category.type === categoryType
      ),
    [categories, categoryType]
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field-label sm:col-span-2">
          Nombre
          <input
            className="field-input"
            defaultValue={template?.name}
            name="name"
            placeholder="Café, supermercado..."
            required
          />
        </label>
        <label className="field-label">
          Tipo
          <select
            className="field-input"
            name="type"
            onChange={(event) =>
              setType(event.target.value as QuickTransactionTemplateType)
            }
            value={type}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Importe por defecto
          <input
            className="field-input"
            defaultValue={template?.defaultAmount ?? ""}
            min="0.01"
            name="defaultAmount"
            placeholder="Opcional"
            step="0.01"
            type="number"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field-label">
          Cuenta
          <select
            className="field-input"
            name="accountId"
            onChange={(event) => setAccountId(event.target.value)}
            value={accountId}
          >
            <option value="">Cuenta global por defecto</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        {type === "transfer" ? (
          <label className="field-label">
            Cuenta destino
            <select
              className="field-input"
              defaultValue={template?.destinationAccountId ?? ""}
              name="destinationAccountId"
              required
            >
              <option disabled value="">
                Selecciona destino
              </option>
              {accounts
                .filter((account) => account.id !== accountId)
                .map((account) => (
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
              defaultValue={template?.categoryId ?? ""}
              name="categoryId"
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

        {type === "savings_allocation" ? (
          <label className="field-label">
            Partida
            <select
              className="field-input"
              defaultValue={template?.savingsBucketId ?? ""}
              name="savingsBucketId"
              required
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

        <label className="field-label">
          Orden
          <input
            className="field-input"
            defaultValue={template?.sortOrder ?? 0}
            name="sortOrder"
            type="number"
          />
        </label>
      </div>

      <label className="field-label">
        Descripción por defecto
        <input
          className="field-input"
          defaultValue={template?.defaultDescription ?? ""}
          name="defaultDescription"
          placeholder="Si se deja vacía se usará el nombre"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field-label">
          Icono
          <input
            className="field-input"
            defaultValue={template?.icon ?? ""}
            maxLength={8}
            name="icon"
            placeholder="Opcional"
          />
        </label>
        <label className="field-label">
          Color
          <input
            className="field-input"
            defaultValue={template?.color ?? ""}
            name="color"
            placeholder="#1f7a6b"
            type="text"
          />
        </label>
        <label className="check-row self-end">
          <input
            defaultChecked={template?.isFavorite ?? true}
            name="isFavorite"
            type="checkbox"
          />
          Favorita
        </label>
        <label className="check-row self-end">
          <input
            defaultChecked={template?.isActive ?? true}
            name="isActive"
            type="checkbox"
          />
          Activa
        </label>
      </div>
    </>
  );
}
