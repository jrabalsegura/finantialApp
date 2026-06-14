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

## Scripts útiles

- `npm run dev`: arranca Next.js en desarrollo.
- `npm run build`: compila la app.
- `npm test`: ejecuta los tests de cálculos financieros.
- `npm run typecheck`: comprueba TypeScript.
- `npm run prisma:generate`: genera Prisma Client.
- `npm run db:migrate`: aplica migraciones en desarrollo.
- `npm run db:seed`: ejecuta el seed inicial.
- `npm run db:studio`: abre Prisma Studio.

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

## Pendiente para Fase 4

- Layout de aplicacion y navegacion.
- Dashboard inicial.
- CRUD de cuentas, categorías y movimientos.
- Flujos de reembolsos, ahorro, cierre mensual e histórico.
