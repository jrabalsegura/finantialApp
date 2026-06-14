Quiero desarrollar una webapp personal de finanzas que sustituya dos herramientas que uso actualmente:

1. Una app de control diario de ingresos y gastos.
2. Una hoja Excel donde cierro el mes, reviso saldos reales de cuentas y reparto mis ahorros entre distintas partidas.

La aplicación debe ser una webapp responsive, con especial cuidado en la versión móvil, porque desde el móvil registraré rápidamente gastos, ingresos y transferencias.

Stack deseada:

* Next.js con App Router
* TypeScript
* Tailwind CSS
* Prisma ORM
* SQLite para el MVP
* Componentes simples, limpios y mantenibles
* Sin autenticación compleja de momento; puede ser una app local/personal
* Código bien estructurado y fácil de ampliar

Objetivo general:
Crear una aplicación de contabilidad personal simplificada que permita registrar movimientos diarios, gestionar cuentas reales, asignar ahorro a botes/partidas, cerrar meses con saldos reales y diferenciar correctamente entre gasto real, ahorro, patrimonio e inversiones.

## Conceptos principales

La aplicación debe distinguir claramente estos mundos:

1. Caja diaria:

   * Gastos
   * Ingresos
   * Transferencias entre cuentas
   * Registro rápido desde móvil

2. Ahorro y planificación:

   * Partidas o botes de ahorro
   * Asignación de ahorro mensual
   * Dinero reservado para objetivos concretos
   * Dinero libre real

3. Patrimonio:

   * Cuentas corrientes
   * Cuentas de ahorro
   * Inversiones
   * Plan de pensiones
   * Tesoro/Raisin/HeyTrade u otros activos
   * Revalorizaciones y pérdidas que afectan al patrimonio, pero no al ahorro mensual

La regla central de la aplicación es:

La aplicación debe diferenciar entre movimientos que afectan al saldo real de las cuentas, movimientos que afectan al gasto/ingreso personal, movimientos que afectan al ahorro mensual y movimientos que solo afectan al patrimonio total.

## MVP que hay que construir

El MVP debe incluir:

1. Gestión de cuentas
2. Registro de movimientos
3. Categorías de gasto/ingreso
4. Partidas de ahorro
5. Cierre mensual
6. Dashboard principal
7. Histórico mensual
8. Movimientos especiales: reembolsables, ajustes, revalorizaciones y cobros de reembolso

## Entidades principales

### Account

Representa una cuenta real o activo financiero.

Campos sugeridos:

* id
* name
* type: checking, savings, cash, investment, pension, treasury, other
* currentBalance
* includeInAvailableMoney: boolean
* includeInNetWorth: boolean
* includeInMonthlySavings: boolean
* isDefault: boolean
* notes
* createdAt
* updatedAt

Ejemplos:

* Openbank principal
* Openbank ahorro
* Santander
* Efectivo
* Raisin
* Tesoro
* HeyTrade
* Plan de pensiones

Debe existir una cuenta por defecto para registrar gastos e ingresos. Inicialmente será “Openbank principal”.

### Category

Categoría para ingresos o gastos.

Campos:

* id
* name
* type: expense, income, both
* icon opcional
* color opcional
* createdAt
* updatedAt

Ejemplos:

* Nómina
* Supermercado
* Restaurantes
* Transporte
* Casa
* Ocio
* Salud
* Viajes
* Suscripciones
* Otros

### SavingsBucket

Representa una partida o bote de ahorro mental. No tiene por qué coincidir con una cuenta bancaria real.

Campos:

* id
* name
* currentAmount
* targetAmount opcional
* targetDate opcional
* priority opcional
* isLongTerm: boolean
* notes
* createdAt
* updatedAt

Ejemplos:

* Fondo de reserva
* Largo plazo
* Hipoteca / coche
* Incidencias piso
* Vacaciones
* IRPF y gastos
* Seguros
* Dentista
* Ahorro efectivo del mes

### Transaction

Movimiento principal de la app.

Campos sugeridos:

* id
* date
* amount
* type:

  * expense
  * income
  * transfer
  * balance_adjustment
  * reimbursable_expense
  * reimbursement_income
  * investment_gain
  * investment_loss
  * savings_allocation
  * savings_withdrawal
* description
* accountId
* destinationAccountId opcional, para transferencias
* categoryId opcional
* savingsBucketId opcional
* affectsRealBalance: boolean
* affectsPersonalExpense: boolean
* affectsPersonalIncome: boolean
* affectsMonthlySavings: boolean
* affectsNetWorth: boolean
* reimbursementId opcional
* createdAt
* updatedAt

La aplicación debe usar estos flags para calcular correctamente los informes.

Ejemplos de lógica:

Gasto normal:

* Baja saldo real de cuenta.
* Cuenta como gasto personal.
* Reduce ahorro mensual.
* Afecta patrimonio.

Ingreso normal:

* Sube saldo real de cuenta.
* Cuenta como ingreso personal.
* Aumenta ahorro mensual.
* Afecta patrimonio.

Transferencia entre cuentas:

* Baja una cuenta y sube otra.
* No cuenta como gasto.
* No cuenta como ingreso.
* No altera ahorro mensual.
* No altera patrimonio total.

Gasto reembolsable:

* Baja saldo real de la cuenta.
* No cuenta como gasto personal.
* No reduce ahorro mensual.
* Crea un pendiente de cobrar.
* Afecta al patrimonio de forma neutra si se registra también el derecho de cobro.

Cobro de reembolso:

* Sube saldo real de la cuenta.
* No cuenta como ingreso personal.
* No aumenta ahorro mensual.
* Cierra o reduce un pendiente de cobrar.

Revalorización de inversión:

* Sube saldo de una cuenta de inversión.
* No cuenta como ingreso personal.
* No aumenta ahorro mensual.
* Sí aumenta patrimonio total.

Pérdida de inversión:

* Baja saldo de una cuenta de inversión.
* No cuenta como gasto personal.
* No reduce ahorro mensual.
* Sí reduce patrimonio total.

Asignación de ahorro a bote:

* No tiene por qué mover dinero entre cuentas reales.
* Aumenta el saldo de una partida de ahorro.
* Reduce dinero libre/no asignado.
* Sirve para distribuir el ahorro al cierre de mes.

### Reimbursement

Entidad para controlar gastos reembolsables o pendientes de cobrar.

Campos:

* id
* title
* personName
* originalTransactionId
* expectedAmount
* paidAmount
* status: pending, partially_paid, paid, cancelled, uncollectible
* dueDate opcional
* notes
* createdAt
* updatedAt

Caso de uso:
Tengo una casa alquilada. A veces me pasan una factura y me la cobran del banco, pero luego mi inquilino me la ingresa. Esto no debe afectar a mis cálculos de ahorro porque no es un gasto real.

Flujo:

1. Registro un “gasto reembolsable” de 120 € en Openbank principal.
2. Baja el saldo real de Openbank principal.
3. No cuenta como gasto personal.
4. No reduce el ahorro mensual.
5. Se crea un pendiente de cobrar al inquilino.
6. Cuando el inquilino me paga, registro un “cobro de reembolso”.
7. Sube el saldo real de Openbank principal.
8. No cuenta como ingreso personal.
9. No aumenta el ahorro mensual.
10. El pendiente queda cerrado.

También debe existir la opción de convertir un reembolsable en gasto real si finalmente no me lo devuelven.

### MonthlyClose

Representa el cierre mensual.

Campos:

* id
* year
* month
* totalIncome
* totalExpense
* monthlySavings
* availableMoney
* netWorth
* longTermAssets
* notes
* closedAt
* createdAt
* updatedAt

El cierre mensual debe permitir:

1. Revisar el saldo calculado de cada cuenta.
2. Introducir el saldo real observado.
3. Calcular diferencias.
4. Crear ajustes de saldo si procede.
5. Calcular el ahorro real del mes.
6. Repartir el ahorro entre partidas.
7. Guardar una foto fija del estado mensual.

### MonthlyAccountSnapshot

Foto del saldo de cada cuenta en un cierre mensual.

Campos:

* id
* monthlyCloseId
* accountId
* calculatedBalance
* realBalance
* difference
* adjustmentTransactionId opcional

### MonthlyBucketSnapshot

Foto del saldo de cada partida de ahorro en un cierre mensual.

Campos:

* id
* monthlyCloseId
* savingsBucketId
* amount

## Cálculos importantes

La app debe calcular:

### Dinero disponible

Suma de saldos de cuentas con includeInAvailableMoney = true.

Ejemplo:

* Openbank principal
* Openbank ahorro
* Efectivo

No debería incluir necesariamente:

* Plan de pensiones
* HeyTrade
* Tesoro a largo plazo
* Otros activos ilíquidos

### Patrimonio total

Suma de cuentas con includeInNetWorth = true.

Debe incluir:

* Cuentas corrientes
* Cuentas de ahorro
* Efectivo
* Inversiones
* Plan de pensiones
* Tesoro
* Raisin
* Pendientes de cobrar, si se modelan como activo

### Gasto personal mensual

Suma de movimientos con:

* affectsPersonalExpense = true
* fecha dentro del mes

No debe incluir:

* Transferencias
* Gastos reembolsables
* Ajustes técnicos, salvo que se marque expresamente como gasto real
* Pérdidas de inversión

### Ingreso personal mensual

Suma de movimientos con:

* affectsPersonalIncome = true
* fecha dentro del mes

No debe incluir:

* Transferencias
* Cobros de reembolsos
* Revalorizaciones de inversión

### Ahorro mensual

Ingresos personales reales menos gastos personales reales, excluyendo:

* Transferencias internas
* Reembolsables
* Cobros de reembolso
* Revalorizaciones
* Pérdidas de inversión
* Ajustes patrimoniales de cuentas a largo plazo

### Variación patrimonial

Diferencia de patrimonio total entre cierres mensuales. Puede incluir ahorro real, aportaciones, revalorizaciones y pérdidas.

La app debe mostrar ahorro mensual y variación patrimonial como métricas separadas.

## Pantallas necesarias

### 1. Dashboard

Debe mostrar:

* Dinero disponible
* Patrimonio total
* Ahorro mensual actual
* Ingresos del mes
* Gastos del mes
* Dinero asignado a partidas de ahorro
* Dinero libre/no asignado
* Pendientes de cobrar
* Evolución respecto al mes anterior
* Distribución por cuentas
* Distribución por partidas de ahorro

### 2. Pantalla móvil inicial

En móvil, la pantalla principal debe priorizar la captura rápida.

Debe tener tres botones grandes:

* Añadir gasto
* Añadir ingreso
* Añadir transferencia

También puede tener accesos rápidos para:

* Gasto reembolsable
* Cobro de reembolso
* Ajuste de saldo

El formulario rápido debe pedir:

* Importe
* Cuenta, por defecto Openbank principal
* Categoría
* Fecha, por defecto hoy
* Descripción opcional
* Etiquetas opcionales
* Para reembolsables: persona que debe devolver el dinero

La experiencia móvil debe ser muy rápida: pocos campos, buenos defaults y botones grandes.

### 3. Movimientos

Listado filtrable por:

* Fecha
* Cuenta
* Categoría
* Tipo de movimiento
* Si afecta o no a ahorro
* Si es reembolsable
* Texto de descripción

Debe permitir crear, editar y eliminar movimientos.

### 4. Cuentas

Debe permitir:

* Crear cuenta
* Editar cuenta
* Ver saldo actual
* Marcar si cuenta para dinero disponible
* Marcar si cuenta para patrimonio total
* Marcar cuenta por defecto
* Ver movimientos de esa cuenta

### 5. Partidas de ahorro

Debe permitir:

* Crear bote
* Editar bote
* Ver saldo asignado
* Definir objetivo opcional
* Definir fecha objetivo opcional
* Ver progreso
* Asignar dinero a una partida
* Retirar dinero de una partida
* Ver histórico

### 6. Cierre mensual

Debe ser una pantalla tipo asistente paso a paso:

Paso 1: Seleccionar mes a cerrar.

Paso 2: Revisar saldos calculados por cuenta.

Paso 3: Introducir saldos reales por cuenta.

Paso 4: Mostrar diferencias.

Paso 5: Crear ajustes automáticos si se confirma.

Paso 6: Calcular ahorro mensual real.

Paso 7: Repartir ahorro entre partidas.

Paso 8: Guardar snapshot del mes.

La aplicación debe permitir que un ajuste de saldo se trate de varias formas:

* Como gasto real.
* Como ingreso real.
* Como ajuste técnico que no afecta a informes.
* Como reducción/aumento de ahorro no asignado.
* Como ajuste asociado a una cuenta concreta.

### 7. Pendientes de cobrar

Pantalla para gastos reembolsables.

Debe mostrar:

* Persona
* Concepto
* Importe original
* Importe cobrado
* Pendiente
* Estado
* Fecha
* Acciones:

  * Registrar cobro total
  * Registrar cobro parcial
  * Convertir en gasto real
  * Cancelar

### 8. Histórico mensual

Tabla por meses con:

* Mes
* Ingresos
* Gastos
* Ahorro mensual
* Dinero disponible
* Patrimonio total
* Largo plazo / inversiones
* Variación patrimonial
* Pendientes de cobrar
* Notas

Debe poder entrar en el detalle de cada mes.

## Datos iniciales de ejemplo

Crear seed con estas cuentas iniciales:

* Openbank principal, checking, cuenta por defecto, incluida en dinero disponible y patrimonio.
* Openbank ahorro, savings, incluida en dinero disponible y patrimonio.
* Santander, checking, incluida en dinero disponible y patrimonio.
* Efectivo, cash, incluida en dinero disponible y patrimonio.
* Raisin, savings, incluida en patrimonio; configurable si cuenta como disponible.
* Tesoro, treasury, incluida en patrimonio, no necesariamente disponible.
* HeyTrade, investment, incluida en patrimonio, no en ahorro mensual.
* Plan de pensiones, pension, incluida en patrimonio, no en dinero disponible ni en ahorro mensual.

Crear seed con estas partidas de ahorro:

* Fondo de reserva
* Largo plazo
* Hipoteca / coche
* Incidencias piso
* Vacaciones
* IRPF y gastos
* Seguros
* Dentista
* Ahorro efectivo del mes

Crear categorías básicas:

Ingresos:

* Nómina
* Alquiler recibido
* Reembolso
* Otros ingresos

Gastos:

* Supermercado
* Restaurantes
* Transporte
* Casa
* Suministros
* Ocio
* Viajes
* Salud
* Suscripciones
* Impuestos
* Otros gastos

## Requisitos de interfaz

* Diseño limpio, sobrio y rápido.
* Responsive mobile-first.
* En móvil, priorizar añadir movimientos.
* En escritorio, priorizar análisis, tablas y cierre mensual.
* Usar componentes reutilizables.
* Mostrar importes en euros.
* Fechas en formato español.
* Evitar pantallas sobrecargadas.
* Usar validaciones razonables en formularios.
* Confirmar antes de eliminar datos importantes.

## Requisitos técnicos

* Crear esquema Prisma completo.
* Crear migraciones.
* Crear seed inicial.
* Crear servicios o funciones de dominio para cálculos financieros.
* No meter la lógica de cálculo directamente en los componentes.
* Crear funciones separadas para:

  * calcular dinero disponible
  * calcular patrimonio total
  * calcular ingresos mensuales
  * calcular gastos mensuales
  * calcular ahorro mensual
  * calcular variación patrimonial
  * calcular pendientes de reembolso
* Usar TypeScript de forma estricta.
* Evitar duplicación de lógica.
* Crear componentes reutilizables para formularios, tarjetas métricas, tablas y selectores.
* Añadir manejo básico de errores.
* Añadir estados vacíos útiles.
* Añadir datos de prueba suficientes para ver la app funcionando.

## Entregable esperado

Quiero que construyas el MVP funcional completo.

Orden recomendado:

1. Inicializa el proyecto si no existe.
2. Configura Tailwind.
3. Configura Prisma y SQLite.
4. Define el modelo de datos.
5. Crea migraciones y seed.
6. Implementa funciones de dominio/cálculo.
7. Implementa layout general.
8. Implementa dashboard.
9. Implementa pantalla móvil de captura rápida.
10. Implementa CRUD de cuentas.
11. Implementa CRUD de categorías.
12. Implementa CRUD de movimientos.
13. Implementa partidas de ahorro.
14. Implementa pendientes de cobrar.
15. Implementa cierre mensual.
16. Implementa histórico mensual.
17. Revisa responsive.
18. Añade datos de prueba y deja instrucciones claras para ejecutar la app.

## Criterios de aceptación

La app se considera válida si permite:

* Crear y editar cuentas.
* Registrar gastos, ingresos y transferencias.
* Registrar un gasto reembolsable que no afecte al ahorro mensual.
* Registrar el cobro de ese reembolso y cerrar el pendiente.
* Registrar revalorizaciones o pérdidas de inversión sin que afecten al ahorro mensual.
* Ver correctamente dinero disponible, patrimonio total, ingresos, gastos y ahorro mensual.
* Crear partidas de ahorro y asignar dinero a ellas.
* Hacer un cierre mensual introduciendo saldos reales.
* Crear ajustes de saldo desde el cierre mensual.
* Guardar snapshots mensuales.
* Consultar histórico mensual.
* Usar cómodamente la app desde móvil para añadir movimientos rápidos.

## Importante

No simplifiques la lógica tratando todos los movimientos como gasto o ingreso. La parte más importante de esta app es distinguir correctamente el impacto de cada movimiento.

Especialmente:

* Una transferencia entre mis cuentas no es un gasto.
* Un gasto reembolsable no es un gasto personal.
* Un cobro de reembolso no es un ingreso personal.
* Una subida de HeyTrade o plan de pensiones no es ahorro mensual.
* Una bajada de HeyTrade o plan de pensiones no es gasto mensual.
* Una aportación a largo plazo puede ser ahorro asignado, pero no gasto.
* El patrimonio total y el ahorro mensual son métricas diferentes.

Antes de terminar, revisa que los cálculos sean coherentes con estos principios y añade comentarios donde la lógica pueda ser delicada.

