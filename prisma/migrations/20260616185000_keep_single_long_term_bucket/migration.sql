UPDATE "SavingsBucket"
SET "isLongTerm" = false
WHERE "name" <> 'Largo plazo';

UPDATE "SavingsBucket"
SET "isLongTerm" = true
WHERE "name" = 'Largo plazo';
