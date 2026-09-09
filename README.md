# Finanzas personales

Webapp personal de finanzas construida por fases con Next.js, TypeScript, Tailwind CSS, Prisma y SQLite.

## Fase actual

La Fase 1 cubre:

- Proyecto Next.js con App Router y TypeScript.
- Tailwind CSS configurado.
- Prisma configurado con SQLite.
- Modelo de datos principal en `prisma/schema.prisma`.
- Migración inicial en `prisma/migrations`.
- Seed inicial de cuentas, categorías y partidas de ahorro.

La Fase 2 añade funciones de dominio reutilizables para:

- Calcular dinero disponible y patrimonio total.
- Calcular ingresos, gastos y ahorro mensual real.
- Calcular pendientes de reembolso.
- Distinguir movimientos que afectan a ahorro mensual o patrimonio.

La Fase 3 añade registro básico de movimientos:

- Formulario rápido mobile-first para gasto, ingreso y transferencia.
- Openbank principal como cuenta por defecto cuando existe.
- Selección de cuenta, categoría, fecha, descripción e importe.
- Actualización de saldos de cuentas al registrar movimientos.
- Listado básico de movimientos recientes.

La Fase 4 añade gastos reembolsables y pendientes de cobrar:

- Pantalla `/reimbursements` para crear y revisar pendientes.
- Gasto reembolsable que baja saldo real sin contar como gasto personal.
- Cobro total o parcial que sube saldo real sin contar como ingreso personal.
- Conversión del importe pendiente en gasto real sin duplicar el movimiento bancario.

La Fase 5 añade gestión de cuentas y partidas de ahorro:

- Pantalla `/accounts` con creación, edición y eliminación segura de cuentas.
- Flags de dinero disponible, patrimonio, ahorro mensual y cuenta por defecto.
- Pantalla `/savings` con creación, edición y eliminación segura de partidas.
- Asignación y retirada de dinero en partidas de ahorro.
- Métricas de dinero disponible, dinero asignado y dinero no asignado.

La Fase 6 añade el dashboard principal en `/`:

- Métricas de dinero disponible, patrimonio total, ingresos, gastos y ahorro mensual.
- Pendientes de cobrar, dinero asignado y dinero libre/no asignado.
- Distribución por cuentas y por partidas de ahorro.
- Separación explícita entre ahorro mensual y variación patrimonial.
- En móvil se mantiene la captura rápida como primer bloque visible.

La Fase 7 añade el cierre mensual:

- Asistente para revisar saldos calculados y registrar saldos reales.
- Ajustes como gasto, ingreso, ajuste técnico o ahorro no asignado.
- Cálculo definitivo de ingresos, gastos y ahorro mensual.
- Reparto del ahorro y snapshots de cuentas y partidas.

La Fase 8 completa el histórico y la revisión general:

- Tabla mensual de ingresos, gastos, ahorro, disponible y patrimonio.
- Variación patrimonial calculada entre cierres consecutivos.
- Detalle de cada cierre con saldos, diferencias, ajustes y partidas.
- Vistas adaptadas a escritorio y móvil, con estados vacíos útiles.
- Tests y comentarios para las reglas financieras delicadas.

La Fase 12 añade plantillas de movimientos rápidos:

- Gestión en `/quick-templates`.
- Accesos favoritos en la captura móvil del dashboard.
- Borradores editables para gastos, ingresos, transferencias, reembolsables,
  cobros de reembolso y asignaciones a ahorro.
- Las plantillas no afectan a saldos ni informes hasta confirmar.

La app incluye autenticación básica para uso privado:

- Si no hay usuarios, el primer acceso a `/login` permite crear el primero.
- Las contraseñas se guardan hasheadas en la base de datos.
- La sesión se conserva durante aproximadamente 1 hora.
- `/settings/security` permite cambiar la contraseña y crear usuarios nuevos.

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

## Estado actual

Las fases 1 a 8 del alcance definido en `docs/SPEC.md` están implementadas.
Incluye CRUD de categorías y edición/eliminación de movimientos desde recientes, con protección de cierres y operaciones vinculadas.

Las reglas y las correcciones de la revisión de septiembre están documentadas en [docs/FIXES-2026-09-06.md](docs/FIXES-2026-09-06.md).


Los arranques con `npm start`, `npm run dev` y el contenedor incluyen un proceso que revisa los recurrentes cada minuto. Solo confirma los automáticos cuya fecha local ha llegado; recupera meses pendientes después de una parada y conserva las ocurrencias procesadas. Usa `TZ=Europe/Madrid` para mantener la fecha de negocio.

Al actualizar esta versión, aplica `npx prisma migrate deploy` y `npm run prisma:generate` antes de arrancar. El contenedor aplica las migraciones automáticamente. La actualización invalida las sesiones antiguas: vuelve a iniciar sesión. Las copias financieras v8 conservan los nuevos vínculos; se pueden importar v5, v6 y v7 si sus datos pasan la validación.
