# Finanzas personales

App personal de finanzas en producción (un único usuario real). Next.js 15 (App
Router, server actions) + React 19 + Prisma 6 + SQLite + Tailwind 3. Interfaz y
mensajes en español; identificadores de código en inglés.

## Comandos

```bash
npm run dev          # Next dev + worker de recurrentes (scripts/start.mjs), http://localhost:3000
npm run typecheck
npm test             # unit (src/domain/*.test.ts) + integración (tests/*.test.cjs) en SQLite temporal
make check           # typecheck + test + build: ejecútalo antes de dar algo por terminado
npm run db:migrate   # prisma migrate dev (crea migración nueva)
make container-up    # imagen de producción en Docker Desktop -> http://127.0.0.1:3081
make container-check # smoke test del contenedor
make deploy          # despliega origin/main en el servidor (ver docs/DEPLOY.md §12)
```

Un test concreto: `node --import tsx --test --test-name-pattern "reembolso" tests/*.test.cjs`.

## Arquitectura

- `src/domain/`: reglas financieras puras y sus tests. Sin Prisma ni Next.
- `src/lib/`: servicios con Prisma (`transactions.ts`, `recurring-transactions.ts`,
  `backup.ts`, `weekly-budget.ts`, `dashboard.ts`…), sesión y utilidades.
- `app/**/actions.ts`: server actions. Parsean el `FormData` con
  `src/lib/form-data.ts` y delegan en `src/lib`.
- `app/**/page.tsx`: server components `force-dynamic` que leen de Prisma.
- `middleware.ts` (runtime Node): valida la cookie firmada y `sessionVersion`
  contra la BD en cada petición y la renueva.
- `scripts/recurring-worker.ts`: proceso aparte que confirma recurrentes
  automáticos cada minuto. Lo arranca `scripts/start.mjs` junto a Next.

## Convenciones que hay que respetar

- **Errores de acciones**: las acciones de `<form action>` se exportan envueltas
  en `withErrorFeedback` (`src/lib/action-feedback.ts`). Lanza `Error` con un
  mensaje para el usuario; el wrapper lo guarda en una cookie flash que muestra
  el layout. Sin el wrapper, en producción Next oculta el mensaje y muestra una
  página de error. Las acciones con `useActionState` devuelven
  `getActionErrorMessage(error)`.
- Toda acción empieza con `await requireCurrentUser()`.
- **Dinero**: `Decimal` en BD; en JS usa `toMoneyNumber`, `normalizeMoney` y
  `parseMoneyInput`. Nunca compares importes calculados sin normalizar.
- **Saldos**: nunca cambies `currentBalance`/`currentAmount` sin crear el
  `Transaction` correspondiente y dentro de `prisma.$transaction`. Usa
  `adjustAccountBalance`/`adjustBucketBalance` (`src/lib/balances.ts`).
- **Periodos cerrados**: cualquier escritura con fecha llama a
  `assertPeriodOpen(tx, date)`. Un mes cerrado (o con cierres posteriores) no se
  modifica; hay que reabrir los cierres del más reciente al más antiguo.
- **Fechas de negocio**: `YYYY-MM-DD` se guarda a las 12:00 locales
  (`parseDate`), con `TZ=Europe/Madrid`.
- Los movimientos ligados (reembolsos, transferencias entre partidas con
  `savingsTransferId`, ocurrencias recurrentes, ajustes de cierre) se gestionan
  desde su pantalla, no desde "recientes".
- Las reglas de negocio confirmadas por el usuario están en
  `docs/FIXES-2026-09-06.md` y la especificación en `docs/SPEC.md`.

## Base de datos y migraciones

- Nunca edites migraciones ya aplicadas; crea una nueva con
  `npx prisma migrate dev --name <nombre>`. El contenedor aplica
  `prisma migrate deploy` al arrancar.
- Si cambias el esquema, revisa `src/domain/backup.ts` (formato de copias
  versionado) y sus tests.
- `prisma/dev.db` y `.container-data/` contienen datos reales copiados de
  producción: no los borres ni los sobrescribas. Nunca subas `.env` ni `*.db`.

## Tests

- Integración (`tests/financial-integrity.test.cjs`): crea una SQLite temporal
  con las migraciones y simula `next/*`. Los errores de acciones de formulario
  se comprueban con `assertFlash(...)`.
- Añade un test de regresión por cada bug financiero que corrijas.

## Producción

Servidor Ubuntu accesible como `ssh remote`: Podman + Quadlet
(`financial-app.service`), nginx, `https://finanzas.joserabalsegura.com`,
datos en `/var/lib/financial-app/data/financial.db`. `sudo` pide contraseña: no
ejecutes comandos de producción sin que el usuario lo pida. Guía completa en
`docs/DEPLOY.md` y `docs/OPERATIONS.md`.
