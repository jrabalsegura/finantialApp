# Finanzas — Roadmap de mantenimiento

Fases de mantenimiento: versiones mayores que Dependabot no propone (ver
«Mantenimiento» en `docs/DEPLOY.md` §12). Cada fase va en su propia rama, con
`make check` y el CI en verde, prueba en el navegador y `make deploy`. No se
adelanta trabajo de la fase siguiente.

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| M1 | Node 24 | En PR, pendiente de desplegar |
| M2 | Next 16 | Pendiente |
| M3 | Tailwind 4 | Pendiente |

Orden recomendado: M1 primero por la fecha límite; M2 cierra las alertas altas
de Dependabot que quedan (`postcss` dentro de Next 15 y `deepmerge-ts`); M3
es la de más riesgo visual. M2 y M3 no dependen entre sí.

Prisma se queda en la 6: la 7 es una migración grande (adaptadores de base de
datos, `prisma.config.ts`) y no corrige nada, porque sigue usando el
`deepmerge-ts` vulnerable. Esa alerta se cierra en M2 con un `overrides`.

---

## Fase M1 — Node 24

### Objetivo

Pasar de Node 22 a Node 24 antes de que Node 22 deje de recibir parches de
seguridad (30-04-2027). Node 24 tiene soporte hasta abril de 2028 y es la
versión que ya usan meteocentro y la web de Julio.

### Alcance

- `deploy/containers/app.Containerfile`: las dos etapas a la última
  `node:24.x-bookworm-slim` (fija la versión exacta, como ahora).
- `.github/workflows/ci.yml`: `node-version: "24"`.
- `package.json`: `engines.node` a `>=24` y `@types/node` a `^24`;
  regenera `package-lock.json`.
- Revisa los avisos de deprecación al arrancar (`npm run dev`, el worker de
  recurrentes y el contenedor) y corrígelos si los hay.

### Fuera de alcance

- Next 16 (M2) y Tailwind 4 (M3).

### Criterios de aceptación

- [x] `make check` en verde con Node 24 (incluidos los tests de integración con
      `node:sqlite`) y el CI de GitHub en verde.
- [x] `make container-up && make container-check` correctos; `node -v` dentro
      del contenedor muestra v24.
- [x] El worker de recurrentes arranca y procesa en el contenedor.
- [ ] Desplegada con `make deploy` y smoke test público correcto.

---

## Fase M2 — Next 16

### Objetivo

Pasar de Next 15 a Next 16. Cierra las alertas altas de Dependabot que no se
pueden corregir en Next 15 (`postcss` 8.4.31 que Next 15 lleva dentro) y la de
`deepmerge-ts` que trae Prisma 6. calorias ya hizo esta migración: sirve de
guía su commit `f5c9688` («Actualiza a Next 16 y elimina las
vulnerabilidades de npm audit»).

### Alcance

- `next` a `^16`, y `react`, `react-dom`, `@types/react` y `@types/react-dom`
  a la última 19.x.
- `middleware.ts` pasa a `proxy.ts` con `export async function proxy` (la
  convención de Next 16); el `matcher` se mantiene. Actualiza la línea
  `COPY middleware.ts …` de `deploy/containers/app.Containerfile` y las
  referencias en `CLAUDE.md` y `docs/DEPLOY.md`.
- `package.json`: `"overrides": { "deepmerge-ts": "^8.0.2" }`, como en
  calorias.
- Los cambios de `tsconfig.json` y `next-env.d.ts` que pida `next build`
  (en calorias: `jsx: "react-jsx"` y los tipos de `.next/dev`).
- Página `app/not-found.tsx` propia si el build la pide.
- Revisa que `cookies()`, `headers()`, `params` y `searchParams` se usan con
  `await` (Next 16 quita el acceso síncrono).

### Fuera de alcance

- Prisma 7.
- Tailwind 4 (M3).

### Criterios de aceptación

- [ ] `make check` y el CI en verde; sin alertas abiertas de `postcss` ni de
      `deepmerge-ts` en Dependabot tras fusionar.
- [ ] Sin sesión, cualquier ruta privada redirige al login; con sesión, se
      puede navegar por todas las pantallas; cerrar sesión y cambiar la
      contraseña siguen revocando las sesiones.
- [ ] Una ruta inexistente muestra la página 404.
- [ ] `make container-up && make container-check` correctos.
- [ ] Desplegada con `make deploy` y smoke test público correcto.

---

## Fase M3 — Tailwind 4

### Objetivo

Pasar de Tailwind 3 a Tailwind 4 sin cambios visibles. Cierra la alerta de
`postcss-selector-parser` (solo afecta a la compilación del CSS, pero no se
puede corregir en Tailwind 3).

### Alcance

- Ejecuta `npx @tailwindcss/upgrade` en una rama limpia y revisa el diff a mano.
- PostCSS: `@tailwindcss/postcss` en `postcss.config.js` (sobra
  `autoprefixer`).
- Los colores de `tailwind.config.ts` (`ink`, `muted`, `surface`, `line`,
  `accent`) pasan a `@theme` en `app/globals.css`, y se borra el fichero de
  configuración si queda vacío.
- Revisa las clases que cambian de significado en Tailwind 4: color de borde
  por defecto, `ring` (de 3 px a 1 px), escalas renombradas (`shadow-sm` →
  `shadow-xs`, `rounded-sm` → `rounded-xs`…), `outline-none` → `outline-hidden`
  y el cursor de los botones. `app/globals.css` es grande (más de 300 líneas):
  revisa con cuidado las reglas que usan utilidades de Tailwind.

### Fuera de alcance

- Rediseños o cambios de estilo aprovechando la migración.

### Criterios de aceptación

- [ ] `make check` y el CI en verde; `npm ls postcss-selector-parser` vacío.
- [ ] Comparación visual antes y después, en escritorio y en móvil, de las
      pantallas (inicio, movimientos, cuentas, categorías, historial,
      plantillas rápidas, recurrentes, reembolsos, ahorro, presupuesto
      semanal, cierre mensual, ajustes y login): mismos colores, bordes,
      anillos de foco y espaciados.
- [ ] Desplegada con `make deploy` y smoke test público correcto.
