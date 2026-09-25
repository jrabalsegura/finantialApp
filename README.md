# Finanzas personales

Webapp personal de finanzas con Next.js, TypeScript, Tailwind CSS, Prisma y SQLite.

## Funcionalidades

- Dashboard con dinero disponible, patrimonio, ingresos, gastos, ahorro mensual
  y captura rápida de movimientos (gasto, ingreso, transferencia, reembolsable,
  cobro y asignación a ahorro), con accesos rápidos configurables.
- Cuentas, categorías y partidas de ahorro (incluida la partida derivada de
  largo plazo) con edición segura.
- Gastos reembolsables con cobros parciales y conversión a gasto real.
- Movimientos fijos mensuales y semanales, pendientes o automáticos.
- Objetivo de gasto semanal configurable.
- Cierre mensual con saldos reales, ajustes, reparto de ahorro y cobertura de
  déficit; histórico y reapertura del último cierre.
- Copias de seguridad JSON versionadas (exportar/restaurar).
- Acceso con usuario y contraseña (scrypt), sesión firmada de 1 hora o 30 días
  y revocación al cambiar la contraseña.

## Requisitos

- Node.js 22.13 o superior (el contenedor usa 22.23.2).
- npm o un gestor compatible.

## Puesta en marcha

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Revisa la variable de entorno:

   ```bash
   cp .env.example .env
   ```

   El valor por defecto usa SQLite local:

   ```bash
   DATABASE_URL="file:./dev.db"
   AUTH_SECRET="replace-with-at-least-32-random-bytes"
   ```

   Cambia `AUTH_SECRET` por un secreto aleatorio de al menos 32 caracteres antes de arrancar, también en desarrollo. Puedes generarlo con `openssl rand -hex 32`.

3. Aplica la migración y genera Prisma Client:

   ```bash
   npm run db:migrate
   ```

4. Carga los datos iniciales:

   ```bash
   npm run db:seed
   ```

5. Arranca la app:

   ```bash
   npm run dev
   ```

   Abre `http://localhost:3000`.

## Rutas principales

- `/`: dashboard y captura rápida.
- `/accounts`: gestión de cuentas.
- `/savings`: gestión de partidas de ahorro.
- `/reimbursements`: pendientes de cobrar.
- `/quick-templates`: gestión de plantillas y accesos rápidos.
- `/monthly-close`: asistente de cierre mensual.
- `/history`: histórico mensual y acceso al detalle de cada cierre.
- `/settings/security`: usuarios, contraseña y sesión.

## Scripts útiles

- `npm run dev`: arranca Next.js en desarrollo y el proceso de recurrentes.
- `npm run build`: compila la app.
- `npm test`: ejecuta las pruebas de dominio y de integración con una base SQLite temporal. No utiliza los datos configurados en `.env`.
- `npm run typecheck`: comprueba TypeScript.
- `npm run prisma:generate`: genera Prisma Client.
- `npm run db:migrate`: aplica migraciones en desarrollo.
- `npm run db:seed`: ejecuta el seed inicial.
- `npm run db:studio`: abre Prisma Studio.

## Contenedores y producción

La app incluye una imagen OCI, una prueba local aislada y un despliegue de
producción con Podman, Quadlet, nginx y backups de SQLite:

- [`docs/DEPLOY.md`](docs/DEPLOY.md): validación local y transición completa.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md): operación, backup y restauración.

La prueba local nunca monta `prisma/dev.db` directamente. `make
container-import-db` genera una copia bajo `.container-data/` y el contenedor
trabaja exclusivamente sobre ella.

Flujo habitual: `make check`, `make container-up`, `make container-check`,
merge a `main` y `make deploy`.

## Estructura interna

- `src/domain`: reglas financieras puras, cálculos y opciones tipadas del dominio.
- `src/lib`: acceso a Prisma, servicios de aplicación y formateadores compartidos.
- `app/components`: formularios y componentes reutilizados por las rutas.
- `app/components/dashboard`: paneles visuales específicos del dashboard.
- `app/**/actions.ts`: acciones de servidor y validación de entradas.

Las etiquetas y valores permitidos de cuentas, movimientos rápidos, recurrentes
y reembolsos se centralizan en `src/domain/domain-options.ts`. El formato de
euros y fechas se centraliza en `src/lib/formatters.ts`. La carga y preparación
del dashboard se concentra en `src/lib/dashboard.ts`, con sus agregaciones puras
en `src/domain/dashboard.ts`.

## Datos iniciales

El seed crea estas cuentas:

- Openbank principal
- Openbank ahorro
- Santander
- Efectivo
- Raisin
- Tesoro
- HeyTrade
- Plan de pensiones

También crea categorías básicas de ingresos/gastos y las partidas de ahorro indicadas en `docs/SPEC.md`.

## Notas

Las reglas financieras confirmadas están en
[docs/FIXES-2026-09-06.md](docs/FIXES-2026-09-06.md) y la especificación en
[docs/SPEC.md](docs/SPEC.md). Las pautas para trabajar con Claude Code están en
[CLAUDE.md](CLAUDE.md).

`npm start`, `npm run dev` y el contenedor arrancan también un proceso que
revisa los recurrentes cada minuto: solo confirma los automáticos cuya fecha
local ha llegado y recupera meses pendientes después de una parada. Usa
`TZ=Europe/Madrid` para mantener la fecha de negocio.
