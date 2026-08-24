# Despliegue con Podman y Quadlet

Esta guía separa dos fases:

1. validar en el Mac la misma imagen OCI, con Docker Compose y una copia
   aislada de SQLite;
2. hacer la transición en Ubuntu/Debian a Podman rootful, Quadlet, nginx y
   systemd.

La plantilla de nginx usa el nombre confirmado
`finanzas.joserabalsegura.com`.

```text
Mac:
navegador -> 127.0.0.1:3080 -> contenedor Next.js
                                      |
                            ./.container-data/financial.db

Producción:
Internet -> nginx :80/:443 -> 127.0.0.1:3088 -> contenedor Next.js
                                                       |
                                      /var/lib/financial-app/data/financial.db
```

La imagen no contiene `.env` ni ninguna base de datos. Al arrancar, valida las
variables, ejecuta `prisma migrate deploy` y solo después inicia Next.js.
Compose desactiva la marca `Secure` de la cookie únicamente para la prueba HTTP
local; producción no define esa excepción y mantiene cookies seguras bajo
HTTPS.

## 1. Validación local sin tocar la base original

Requisitos:

- Docker Desktop iniciado;
- `node`, `npm`, `curl` y `sqlite3`;
- el puerto `127.0.0.1:3080` libre.

Comprobar primero el proyecto fuera de contenedores:

```bash
cd /Users/jraba/Desktop/finantialApp
make check
```

Para probar una base vacía:

```bash
make container-up
make container-status
make container-check
```

Para ensayar la transición con los datos actuales, conviene hacerlo antes del
primer `container-up`. El objetivo usa el comando `.backup` de SQLite y crea
`./.container-data/financial.db`; nunca monta ni modifica `prisma/dev.db`:

```bash
make container-import-db
make container-up
make container-check
```

Si ya existe la copia aislada, `container-import-db` se niega a sobrescribirla.
Muévela con otro nombre si quieres conservarla y repetir el ensayo:

```bash
make container-down
mv .container-data ".container-data.saved-$(date +%Y%m%dT%H%M%S)"
make container-import-db
```

Abrir la aplicación:

```text
http://127.0.0.1:3080
```

El smoke test comprueba el endpoint público `/api/health`, una consulta real a
SQLite y el HTML de login. Para revisar la migración y el arranque:

```bash
make container-logs
```

`Ctrl-C` abandona los logs, no detiene el servicio. Para detenerlo sin borrar
la copia de datos:

```bash
make container-down
```

Se puede cambiar el puerto en todos los objetivos:

```bash
make container-up FINANCIAL_APP_HTTP_PORT=3081
make container-check FINANCIAL_APP_HTTP_PORT=3081
```

## 2. Preparar el cambio en el Mac

Cuando la validación local sea correcta:

```bash
cd /Users/jraba/Desktop/finantialApp

make check
make container-build
make container-up
make container-check
make container-down

git status --short
git diff --check
```

Revisa y publica estos cambios en la rama que se vaya a desplegar. No añadas
`.env`, `.container-data` ni ningún `*.db` al commit.

## 3. Inventario verificado del despliegue anterior

Inventario obtenido mediante `ssh remote` el 24 de agosto de 2026, sin detener
ni modificar servicios:

- host: `ubuntu-4gb-hel1-1`, Ubuntu con cgroups v2;
- servicio: `finantialApp.service`, activo y habilitado;
- definición: `/etc/systemd/system/finantialApp.service`;
- ejecución: usuario `jrabal`, `WorkingDirectory=/var/www/finantialApp` y
  `ExecStart=/usr/bin/npm run start`;
- checkout anterior: `/var/www/finantialApp`, rama `main`, limpio, commit
  `81cfd3b2aa454b0bc6adef1baa0481b04fc356aa`;
- SQLite efectiva: `/var/www/finantialApp/prisma/prod.db`, con
  `PRAGMA integrity_check=ok` y 15 migraciones aplicadas;
- entorno anterior: `/var/www/finantialApp/.env`; no se imprimió su contenido;
- nginx anterior: `/etc/nginx/sites-available/finantialApp`;
- dominio anterior: `finantial.joserabalsegura.com` y
  `www.finantial.joserabalsegura.com`;
- upstream anterior: `http://127.0.0.1:3001`; el proceso Next escucha realmente
  en `*:3001`;
- runtime anterior: Node.js 18.19.1, npm 9.2.0 y Next.js 15.5.19;
- Podman 4.9.3 y el generador Quadlet están presentes;
- la CLI `sqlite3` aún no está instalada; se añade en el paso siguiente y la
  comprobación de inventario se hizo con Python en modo `immutable`;
- `127.0.0.1:3088` está libre;
- `finanzas.joserabalsegura.com` ya resuelve por IPv4 a `157.180.32.241` y no
  publica un registro AAAA.

El checkout nuevo se instalará aparte, en `/var/www/financial-app`. El servicio,
checkout, nginx, dominio y SQLite anteriores se conservan durante todo el
ensayo. Los permisos heredados de `.env` (`0664`) y `prod.db` (`0644`) permiten
lectura a otros usuarios del host; no se cambiaron durante el inventario. El
nuevo despliegue corrige esto usando `0600` para secreto y base persistente.

## 4. Preparar Podman en el servidor

En Ubuntu/Debian:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y \
  ca-certificates \
  certbot \
  curl \
  dnsutils \
  git \
  nginx \
  podman \
  python3-certbot-nginx \
  sqlite3
```

Validar Podman, cgroups v2 y Quadlet:

```bash
podman --version
podman info --format '{{.Host.CgroupsVersion}}'
test -x /usr/lib/systemd/system-generators/podman-system-generator
```

El segundo comando debe mostrar `v2`. Si falta el generador, instala una
versión actual de Podman; no conviertas el `.container` en un servicio escrito
a mano.

Node.js, npm y Prisma viven dentro de la imagen y ya no son requisitos del
host.

## 5. Checkout, datos y secreto

La guía usa `/var/www/financial-app` para el checkout y separa de él los datos,
la configuración y los backups:

```bash
sudo install -d -m 0755 /var/www
sudo install -d -m 0755 -o "$USER" -g "$USER" /var/www/financial-app

git clone https://github.com/jrabalsegura/finantialApp.git \
  /var/www/financial-app
cd /var/www/financial-app
```

Si el checkout ya existe en esa ruta, usa `git status --short` y
`git pull --ff-only`; no lo reemplaces ni uses `reset --hard`.

Crear estado persistente. El proceso del contenedor usa `10001:10001`:

```bash
sudo install -d -m 0700 -o 10001 -g 10001 \
  /var/lib/financial-app/data
sudo install -d -m 0700 /etc/financial-app
sudo install -d -m 0700 /var/backups/financial-app
```

Crear el entorno fuera del repositorio:

```bash
sudo install -m 0600 -o root -g root /dev/null \
  /etc/financial-app/app.env
sudoedit /etc/financial-app/app.env
```

Contenido:

```dotenv
DATABASE_URL=file:/data/financial.db
AUTH_SECRET=PEGA_AQUI_UN_SECRETO_ALEATORIO_DE_64_O_MAS_CARACTERES
```

Genera el secreto con `openssl rand -hex 32`, pégalo mediante `sudoedit` y no
lo guardes en el historial, en el repositorio ni como argumento de build.
Verifica únicamente los permisos:

```bash
sudo stat -c '%a %U:%G %n' /etc/financial-app/app.env
```

Debe mostrar `600 root:root`.

## 6. Construir una imagen versionada

Construir antes de interrumpir el despliegue anterior:

```bash
cd /var/www/financial-app
release=$(git rev-parse --short=12 HEAD)

sudo podman build --pull=always \
  --file deploy/containers/app.Containerfile \
  --tag "localhost/financial-app:$release" \
  .

sudo podman tag \
  "localhost/financial-app:$release" \
  localhost/financial-app:current

sudo podman image inspect localhost/financial-app:current \
  --format '{{.Id}} {{.Config.User}}'
```

El usuario declarado debe ser `10001:10001`. La build no recibe la base ni
`AUTH_SECRET` porque `.dockerignore` los excluye y el Containerfile copia solo
los archivos requeridos.

## 7. Instalar Quadlet sin arrancarlo todavía

```bash
cd /var/www/financial-app

sudo install -m 0644 \
  deploy/quadlet/financial-app.container \
  /etc/containers/systemd/financial-app.container

sudo env QUADLET_UNIT_DIRS=/etc/containers/systemd \
  /usr/lib/systemd/system-generators/podman-system-generator --dryrun
```

La salida debe incluir `financial-app.service` y no contener `unsupported key`.
Después recarga systemd, pero no inicies aún el servicio:

```bash
sudo systemctl daemon-reload
```

El Quadlet publica solamente `127.0.0.1:3088`; no abras ese puerto en el
firewall. También fija `TZ=Europe/Madrid`: la aplicación calcula las fechas
recurrentes en la zona horaria de negocio y debe conservarla al migrar desde el
proceso anterior.

## 8. Crear un ensayo paralelo con una copia de SQLite

`finantialApp.service` continúa activo en el puerto 3001 y su base sigue siendo
la fuente canónica. SQLite permite obtener una copia coherente online mediante
`.backup`, por lo que este ensayo no requiere indisponibilidad:

```bash
sudo sqlite3 /var/www/finantialApp/prisma/prod.db \
  ".backup '/var/backups/financial-app/parallel-rehearsal.db'"
sudo sqlite3 /var/backups/financial-app/parallel-rehearsal.db \
  'PRAGMA integrity_check;'
```

El segundo comando debe responder `ok`. Instala esa copia para el contenedor:

```bash
sudo install -m 0600 -o 10001 -g 10001 \
  /var/backups/financial-app/parallel-rehearsal.db \
  /var/lib/financial-app/data/financial.db
```

Arranca el Quadlet. El entrypoint comprobará las migraciones y abortará si
fallan:

```bash
sudo systemctl start financial-app.service
sudo systemctl status financial-app.service
sudo journalctl -u financial-app.service -n 100 --no-pager

cd /var/www/financial-app
deploy/scripts/smoke-test.sh http://127.0.0.1:3088
sudo podman healthcheck run financial-app
```

Si `crun` responde `write: No space left on device` aunque `df` muestre
espacio libre, comprueba que el Quadlet instalado contiene
`notmpcopyup` en el `Tmpfs` de `/app/.next/cache`. Podman intenta copiar por
defecto el cache de compilacion de Next.js al tmpfs de 64 MiB antes de arrancar
el contenedor. Reinstala el Quadlet versionado y vuelve a intentarlo; no hace
falta reemplazar la copia SQLite ni detener `finantialApp.service`:

```bash
sudo systemctl stop financial-app.service
sudo install -m 0644 \
  deploy/quadlet/financial-app.container \
  /etc/containers/systemd/financial-app.container
sudo systemctl daemon-reload
sudo systemctl reset-failed financial-app.service
sudo systemctl start financial-app.service
```

En este punto ambas apps funcionan con bases independientes. El ensayo puede
usarse para comprobar login, pantallas y operaciones, pero sus escrituras no se
replican en la app antigua. En la sincronización final se descartará esta copia
de ensayo y se importará una copia nueva de la base canónica.

## 9. Publicar el dominio nuevo y hacer la prueba prolongada

Si aún no existe un site para este dominio, instala la plantilla:

```bash
cd /var/www/financial-app
sudo install -m 0644 \
  deploy/nginx/financial-app.conf \
  /etc/nginx/sites-available/financial-app
sudo ln -s \
  /etc/nginx/sites-available/financial-app \
  /etc/nginx/sites-enabled/financial-app
```

Si ya existe un site con Certbot, no lo sobrescribas. Haz primero una copia y
cambia solo su `proxy_pass` a `http://127.0.0.1:3088`.

Validar siempre antes de recargar:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Comprobar DNS antes del certificado:

```bash
dig +short A finanzas.joserabalsegura.com
dig +short AAAA finanzas.joserabalsegura.com
```

Si todavía no hay certificado:

```bash
sudo certbot --nginx \
  --redirect \
  -d finanzas.joserabalsegura.com
sudo certbot renew --dry-run
```

Validar por HTTPS manteniendo el servicio anterior activo:

```bash
cd /var/www/financial-app
deploy/scripts/smoke-test.sh https://finanzas.joserabalsegura.com
curl -I https://finanzas.joserabalsegura.com/login
sudo systemctl is-active finantialApp.service
```

El último comando debe mostrar `active`. Durante esta fase:

- `https://finantial.joserabalsegura.com` continúa usando la base canónica;
- `https://finanzas.joserabalsegura.com` usa la copia de ensayo;
- no se deben introducir en la copia de ensayo datos que haya que conservar;
- conviene probar reinicio de `financial-app.service`, login, backup y una
  restauración controlada antes del corte final.

## 10. Sincronización final de datos

Cuando la versión contenedorizada esté validada, realiza un corte breve. Detén
primero la app antigua para congelar la base canónica y después el contenedor:

```bash
sudo systemctl stop finantialApp.service
sudo systemctl stop financial-app.service
```

Crear y validar la copia definitiva:

```bash
sudo sqlite3 /var/www/finantialApp/prisma/prod.db \
  ".backup '/var/backups/financial-app/final-cutover.db'"
sudo sqlite3 /var/backups/financial-app/final-cutover.db \
  'PRAGMA integrity_check;'

sudo cp --preserve=mode,timestamps \
  /var/lib/financial-app/data/financial.db \
  /var/backups/financial-app/parallel-rehearsal-before-cutover.db
sudo install -m 0600 -o 10001 -g 10001 \
  /var/backups/financial-app/final-cutover.db \
  /var/lib/financial-app/data/financial.db
```

Arrancar únicamente el contenedor y validar ambos accesos:

```bash
sudo systemctl start financial-app.service

cd /var/www/financial-app
deploy/scripts/smoke-test.sh http://127.0.0.1:3088
deploy/scripts/smoke-test.sh https://finanzas.joserabalsegura.com
sudo systemctl is-active finantialApp.service
```

El último comando debe mostrar `inactive`. Después de una validación funcional,
deshabilita el arranque automático antiguo, pero conserva unidad, checkout,
nginx y base para rollback:

```bash
sudo systemctl disable finantialApp.service
```

No vuelvas a arrancar las dos apps para uso normal: desde este punto tendrían
bases distintas y aceptarían escrituras divergentes.

## 11. Instalar y probar backups

El backup detiene brevemente la app para obtener una copia coherente de SQLite,
crea un `tar.gz`, conserva 14 días y vuelve a arrancarla incluso si `tar` falla:

```bash
cd /var/www/financial-app

sudo install -m 0755 \
  deploy/scripts/financial-app-backup \
  /usr/local/sbin/financial-app-backup
sudo install -m 0644 \
  deploy/systemd/financial-app-backup.service \
  /etc/systemd/system/financial-app-backup.service
sudo install -m 0644 \
  deploy/systemd/financial-app-backup.timer \
  /etc/systemd/system/financial-app-backup.timer

sudo systemctl daemon-reload
sudo systemctl enable --now financial-app-backup.timer
sudo systemctl start financial-app-backup.service
sudo systemctl status financial-app-backup.service
sudo ls -lh /var/backups/financial-app
```

Comprueba periódicamente la restauración. Un backup en el mismo servidor no
sustituye a una copia externa cifrada.

## 12. Actualizaciones

Antes de cada actualización:

```bash
ssh remote
sudo systemctl start financial-app-backup.service

cd /var/www/financial-app
git status --short
git pull --ff-only origin main
release=$(git rev-parse --short=12 HEAD)
```

Un `git status --short` no vacío debe investigarse. Construye la nueva imagen
sin tocar el servicio actual:

```bash
sudo podman build --pull=always \
  --file deploy/containers/app.Containerfile \
  --tag "localhost/financial-app:$release" \
  .
```

Guardar la imagen actual y mover `current`:

```bash
if sudo podman image exists localhost/financial-app:current; then
  sudo podman tag \
    localhost/financial-app:current \
    localhost/financial-app:rollback
fi

sudo podman tag \
  "localhost/financial-app:$release" \
  localhost/financial-app:current
```

Reinstalar y validar el Quadlet versionado antes del reinicio:

```bash
sudo install -m 0644 \
  deploy/quadlet/financial-app.container \
  /etc/containers/systemd/financial-app.container
sudo env QUADLET_UNIT_DIRS=/etc/containers/systemd \
  /usr/lib/systemd/system-generators/podman-system-generator --dryrun
sudo systemctl daemon-reload
sudo systemctl restart financial-app.service

deploy/scripts/smoke-test.sh http://127.0.0.1:3088
deploy/scripts/smoke-test.sh https://finanzas.joserabalsegura.com
```

La plantilla nginx no se reinstala en actualizaciones normales porque Certbot
administra la copia operativa.

## 13. Rollback

Si la versión no añadió una migración incompatible, vuelve a la imagen previa:

```bash
sudo podman image exists localhost/financial-app:rollback
sudo podman tag \
  localhost/financial-app:rollback \
  localhost/financial-app:current
sudo systemctl restart financial-app.service

cd /var/www/financial-app
deploy/scripts/smoke-test.sh http://127.0.0.1:3088
```

Las migraciones Prisma son hacia delante. Si el release cambió el esquema de
forma incompatible, el rollback correcto es detener la app, conservar aparte
la base fallida y restaurar el backup anterior al despliegue; no basta con
cambiar la imagen. Consulta `docs/OPERATIONS.md`.

## Referencias

- [Quadlet y unidades systemd de Podman](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html)
- [Uso básico de Quadlet](https://docs.podman.io/en/latest/markdown/podman-quadlet-basic-usage.7.html)
