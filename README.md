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

## Requisitos

- Node.js 20 o superior.
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
   ```

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

## Scripts útiles

- `npm run dev`: arranca Next.js en desarrollo.
- `npm run build`: compila la app.
- `npm test`: ejecuta los tests de cálculos financieros.
- `npm run typecheck`: comprueba TypeScript.
- `npm run prisma:generate`: genera Prisma Client.
- `npm run db:migrate`: aplica migraciones en desarrollo.
- `npm run db:seed`: ejecuta el seed inicial.
- `npm run db:studio`: abre Prisma Studio.

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
Quedan fuera de este alcance el CRUD visual completo de categorías y la edición
o eliminación de movimientos ya registrados.
