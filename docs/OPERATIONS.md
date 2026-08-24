# Operación de producción

## Estado y logs

```bash
sudo systemctl status financial-app.service
sudo journalctl -u financial-app.service -f
sudo podman ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
sudo podman healthcheck run financial-app
curl -fsS http://127.0.0.1:3088/api/health
```

## Reinicio

```bash
sudo systemctl restart financial-app.service
```

No ejecutes `podman run` manualmente para sustituir el contenedor administrado
por Quadlet.

## Convivencia y rollback al despliegue anterior

Durante el ensayo paralelo, el despliegue canónico anterior sigue siendo:

- servicio `finantialApp.service`;
- checkout `/var/www/finantialApp`;
- SQLite `/var/www/finantialApp/prisma/prod.db`;
- dominio `finantial.joserabalsegura.com`;
- puerto `3001`.

Antes de la sincronización final basta con detener `financial-app.service` para
abandonar el ensayo: la app anterior no se ha interrumpido. Después de la
sincronización final, un rollback sin pérdida solo es trivial mientras la app
nueva no haya recibido escrituras:

```bash
sudo systemctl stop financial-app.service
sudo systemctl enable --now finantialApp.service
```

La app anterior vuelve a estar disponible en su dominio antiguo. Si la base
nueva ya recibió escrituras, no arranques ambas aplicaciones: conserva primero
las dos bases y planifica una reconciliación o restauración explícita.

## Datos y secretos

- Base SQLite: `/var/lib/financial-app/data/financial.db`.
- Entorno: `/etc/financial-app/app.env`, modo `0600 root:root`.
- Checkout: `/var/www/financial-app`.
- Backups: `/var/backups/financial-app`.

No uses `cat` sobre `app.env` ni publiques `podman inspect` en incidencias: el
entorno del contenedor incluye el secreto de sesión.

## Backup manual

```bash
sudo systemctl start financial-app-backup.service
sudo systemctl status financial-app-backup.service
sudo ls -lh /var/backups/financial-app
```

## Comprobar un backup sin restaurarlo

```bash
backup=/var/backups/financial-app/financial-app-FECHA.tar.gz
temporary_dir=$(mktemp -d)
sudo tar -xzf "$backup" -C "$temporary_dir" \
  var/lib/financial-app/data/financial.db
sudo sqlite3 \
  "$temporary_dir/var/lib/financial-app/data/financial.db" \
  'PRAGMA integrity_check;'
sudo rm -rf "$temporary_dir"
```

El resultado debe ser `ok`. El último comando elimina únicamente el directorio
temporal recién creado; verifica su valor antes de ejecutarlo.

## Restaurar SQLite

La restauración reemplaza datos y requiere una ventana de mantenimiento:

1. selecciona y verifica el backup;
2. detén la aplicación;
3. mueve la base actual a un nombre de rescate;
4. extrae la base seleccionada;
5. instala dueño y permisos;
6. arranca y ejecuta el smoke test.

Ejemplo, sustituyendo `FECHA`:

```bash
sudo systemctl stop financial-app.service

sudo mv \
  /var/lib/financial-app/data/financial.db \
  /var/lib/financial-app/data/financial.db.before-restore

restore_dir=$(sudo mktemp -d /var/lib/financial-app/restore.XXXXXX)
sudo tar -xzf \
  /var/backups/financial-app/financial-app-FECHA.tar.gz \
  -C "$restore_dir" \
  var/lib/financial-app/data/financial.db
sudo install -m 0600 -o 10001 -g 10001 \
  "$restore_dir/var/lib/financial-app/data/financial.db" \
  /var/lib/financial-app/data/financial.db

sudo systemctl start financial-app.service
cd /var/www/financial-app
deploy/scripts/smoke-test.sh http://127.0.0.1:3088
```

Conserva `financial.db.before-restore` hasta validar funcionalmente los datos.
Retira el directorio temporal únicamente después de comprobar su ruta.

## Fallos de arranque

```bash
sudo journalctl -u financial-app.service -n 150 --no-pager
sudo stat -c '%a %U:%G %n' \
  /etc/financial-app/app.env \
  /var/lib/financial-app/data \
  /var/lib/financial-app/data/financial.db
sudo podman image inspect localhost/financial-app:current \
  --format '{{.Id}} {{.Config.User}}'
```

Errores habituales:

- `AUTH_SECRET` ausente, corto o con el valor de ejemplo;
- `DATABASE_URL` no apunta a `/data`;
- directorio o base sin dueño `10001:10001`;
- una migración Prisma fallida;
- el puerto `127.0.0.1:3088` ocupado.
- ocurrencias fijas repetidas tras una restauración: confirma que el contenedor
  resuelve `TZ=Europe/Madrid` y que el Quadlet instalado contiene
  `Environment=TZ=Europe/Madrid` antes de limpiar filas;
- `crun: write: No space left on device` con espacio libre en el host: el
  Quadlet instalado no contiene `notmpcopyup` para `/app/.next/cache` y Podman
  intenta copiar el cache de compilacion dentro del tmpfs de 64 MiB.
