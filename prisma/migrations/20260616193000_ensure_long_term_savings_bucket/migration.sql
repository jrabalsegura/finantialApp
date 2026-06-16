INSERT OR IGNORE INTO "SavingsBucket" (
  "id",
  "name",
  "currentAmount",
  "priority",
  "isLongTerm",
  "createdAt",
  "updatedAt"
) VALUES (
  'long-term',
  'Largo plazo',
  0,
  2,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

UPDATE "SavingsBucket"
SET
  "isLongTerm" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" <> 'Largo plazo';

UPDATE "SavingsBucket"
SET
  "isLongTerm" = true,
  "priority" = COALESCE("priority", 2),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Largo plazo';
