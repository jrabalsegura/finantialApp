import assert from "node:assert/strict";
import test from "node:test";
import { buildTransactionDraftFromTemplate } from "./quick-transaction-templates";

test("usa la cuenta global cuando la plantilla no define cuenta", () => {
  const draft = buildTransactionDraftFromTemplate(
    {
      id: "template-1",
      name: "Supermercado",
      type: "expense",
      defaultAmount: null,
      accountId: null,
      destinationAccountId: null,
      categoryId: "category-1",
      savingsBucketId: null,
      defaultDescription: null
    },
    "default-account"
  );

  assert.equal(draft.accountId, "default-account");
  assert.equal(draft.amount, null);
  assert.equal(draft.description, "Supermercado");
});

test("conserva importe y destino de una transferencia", () => {
  const draft = buildTransactionDraftFromTemplate(
    {
      id: "template-2",
      name: "Ahorro",
      type: "transfer",
      defaultAmount: "200",
      accountId: "checking",
      destinationAccountId: "savings",
      categoryId: "ignored",
      savingsBucketId: null,
      defaultDescription: "Transferencia a ahorro"
    },
    "default-account"
  );

  assert.equal(draft.amount, 200);
  assert.equal(draft.destinationAccountId, "savings");
  assert.equal(draft.categoryId, null);
});

test("un gasto reembolsable conserva la categoría y deja la persona para revisión", () => {
  const draft = buildTransactionDraftFromTemplate(
    {
      id: "template-3",
      name: "Piso",
      type: "reimbursable_expense",
      defaultAmount: null,
      accountId: "checking",
      destinationAccountId: null,
      categoryId: "house",
      savingsBucketId: null,
      defaultDescription: "Factura piso alquilado"
    },
    "default-account"
  );

  assert.equal(draft.categoryId, "house");
  assert.equal(draft.description, "Factura piso alquilado");
});
