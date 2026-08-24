# Artefactos de despliegue

- `containers/`: imagen OCI, entrada con migraciones Prisma y healthcheck.
- `quadlet/`: unidad Podman administrada por systemd.
- `nginx/`: plantilla HTTP inicial del proxy inverso.
- `scripts/`: smoke test y backup consistente de SQLite.
- `systemd/`: servicio y timer del backup diario.

La transición completa está en [`docs/DEPLOY.md`](../docs/DEPLOY.md) y las
operaciones habituales en [`docs/OPERATIONS.md`](../docs/OPERATIONS.md).
