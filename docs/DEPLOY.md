# Guía de despliegue — VPS (Oracle Cloud) + Vercel

Sistema de Reservas de Canchas. Arquitectura:

```
Frontend (Vercel)  →  Gateway (VPS)  →  api-usuarios / api-canchas / api-turnos / api-pagos (VPS)
                                                          ↓
                                              PostgreSQL (contenedor propio, mismo VPS)
```

> Gateway, los 4 microservicios y PostgreSQL corren **todos en el mismo VPS**, con el
> `docker-compose.yml` de la raíz del repo (un único `git clone` + `docker compose up -d --build`).
> El VPS es **compartido por el equipo** (no uno por integrante); solo el frontend va aparte, a Vercel.

---

## 1. Desarrollo local

El `docker-compose.yml` incluye un servicio `postgres` propio (con volumen persistente), así que no
hace falta ninguna base de datos externa para levantar la stack completa:

```bash
cp .env.template .env      # completar JWT_SECRET / INTERNAL_SECRET; DATABASE_URL ya apunta a "postgres"
docker compose up -d --build
```

> `GEMINI_API_KEY` en ese mismo `.env` es opcional: sin ella, el recomendador de canchas
> (`GET /canchas/recomendadas`) y el resumen de tendencia de reservas (`GET /reservas/insights`)
> siguen funcionando, solo sin la parte generada por IA. Se genera gratis en
> [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

En el primer arranque, el contenedor `postgres` carga automáticamente `database/schema.sql` +
`database/seed.sql` (incluye el usuario admin de prueba `admin@canchas.com` / `Admin123`). Los
microservicios esperan a que `postgres` esté `healthy` antes de arrancar.

- Frontend: http://localhost:5173
- Gateway: http://localhost:3000
- Health check de cada microservicio: `GET /health` en su puerto (3001–3005)

Si preferís correr los servicios sin contenedor (`npm run start:dev`), levantá igual el contenedor
`postgres` del compose (`docker compose up -d postgres`) y copiá el `.env.template` de cada servicio
apuntando a `postgresql://canchas_user:canchas_pass@localhost:5432/canchas_db`.

---

## 2. VPS — Oracle Cloud (Always Free, Ampere A1)

> Uno del equipo provisiona el VPS una sola vez; todos comparten sus credenciales de acceso (o cada
> quien con su propia clave SSH agregada a la instancia).

1. Crear la instancia en OCI eligiendo el shape **Ampere A1 (Always Free)** — no el AMD micro — para
   tener margen de RAM/CPU corriendo los 5 servicios + Postgres en simultáneo.
2. Imagen: **Ubuntu 24.04 LTS**.
3. Asignarle una **Reserved Public IP** (no la efímera por defecto), para que la IP no cambie si se
   reinicia la instancia. Esa IP es la que va a usar el frontend para hablarle al gateway.
4. Abrir en la lista de seguridad / *Security List* de la VCN los puertos necesarios: `22` (SSH) y
   `3000` (gateway). Los puertos `3001`–`3005` y `5432` **no** deberían quedar expuestos a internet
   (el docker-compose ya los publica solo dentro de la red del host; si se quiere restringir más,
   sacarles el mapeo de puertos en el compose y dejar que se comuniquen solo por `canchas_net`).
5. En la instancia:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
   sudo usermod -aG docker $USER   # relogear para que tome efecto
   git clone <url-del-repo>
   cd pp2-workspace
   cp .env.template .env           # completar JWT_SECRET / INTERNAL_SECRET (compartidos por el equipo)
   docker compose up -d --build
   ```
6. Verificar: `curl http://<ip-reservada>:3000/auth/login ...` o los `/health` de cada servicio.

### HTTPS / dominio
El VPS tiene un **proxy Caddy compartido** (carpeta `~/edge`, también lo usa otra app del VPS) que
escucha en 80/443, saca el certificado de Let's Encrypt solo y publica el gateway en
`https://api-canchas.<dominio>`. El proxy llega al contenedor `canchas_gateway` por la red docker `edge`.

1. DNS: registro **A** `api-canchas.<dominio>` → IP reservada. Abrir `80` y `443` en la Security List
   y en iptables (igual que el `3000` del paso 4).
2. En el `.env` del VPS descomentar:
   ```
   COMPOSE_FILE=docker-compose.yml:docker-compose.vps.yml
   ```
   y aplicar con `docker compose up -d gateway`. `docker compose` y `scripts/deploy.sh` toman el
   override solos; en las máquinas del equipo no cambia nada.
3. Verificar: `curl https://api-canchas.<dominio>/canchas` (ruta pública).
4. En **Vercel** cambiar `VITE_API_URL` a `https://api-canchas.<dominio>` y redeployar.
5. Cuando el front ya use HTTPS, se puede cerrar el `3000` en la Security List (el puerto sigue
   publicado en el compose para desarrollo local).

#### Todo en un dominio: `https://reservacanchas.allcloud.com.ar` (frontend del VPS, sin Vercel)
El proxy sirve el contenedor `canchas_frontend` en `/` y manda `/api/*` al gateway quitando el prefijo
(bloque `{$CANCHAS_DOMAIN}` del Caddyfile en `cuentasClaras/deploy/edge`). Mismo origen: sin CORS ni
mixed content.

1. DNS: registro **A** `reservacanchas.allcloud.com.ar` → IP del VPS.
2. En `~/edge/.env` agregar `CANCHAS_DOMAIN=reservacanchas.allcloud.com.ar`, copiar el Caddyfile nuevo
   (`cp ~/cuentasClaras/deploy/edge/Caddyfile ~/edge/`) y recargar:
   `docker compose -f ~/edge/docker-compose.yml exec caddy caddy reload --config /etc/caddy/Caddyfile`
   (con la variable vacía Caddy no arranca).
3. En `~/reservaCanchas/.env`: `COMPOSE_FILE=docker-compose.yml:docker-compose.vps.yml`,
   `VITE_API_URL=https://reservacanchas.allcloud.com.ar/api` y
   `FRONTEND_URL=https://reservacanchas.allcloud.com.ar`.
4. Reconstruir el front (la URL se embebe en el bundle) y recrear el gateway/notificaciones/pagos:
   `docker compose up -d --build frontend gateway api-pagos api-notificaciones`.
5. Verificar: `https://reservacanchas.allcloud.com.ar` carga la app y
   `curl https://reservacanchas.allcloud.com.ar/api/canchas` responde. Por IP (`:5173`, `:3000`) sigue
   andando mientras los puertos estén abiertos.

---

## 3. Frontend — Vercel

1. En https://vercel.com → **Add New → Project** → importar el repo del frontend. Framework: **Vite**
   (lo detecta solo).
2. **Environment Variables** → `VITE_API_URL` = URL pública del gateway en el VPS (la IP reservada +
   `:3000`, o el dominio con HTTPS una vez configurado el punto anterior).
   > Se embebe en el bundle en build; si cambia la URL del gateway, hay que **redeploy**.
3. **Deploy**. Probar la URL de Vercel.

---

## 4. Prueba end-to-end

1. Abrir el front (Vercel) → **registrarse** o **login** (admin de prueba:
   `admin@canchas.com` / `Admin123`).
2. Crear una **reserva** (ejercita api-turnos → api-usuarios + api-canchas).
3. Registrar un **pago** que cubra la seña → la reserva pasa a `confirmada` (api-pagos → api-turnos).

---

## 5. CI/CD (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`): en cada push/PR a `master` compila cada servicio y el frontend y
  valida el compose. No toca el VPS.
- **Deploy** (`.github/workflows/deploy.yml`): cuando el CI de `master` termina en verde, entra al VPS por
  SSH y ejecuta `scripts/deploy.sh` con ese commit: árbol limpio → `git merge --ff-only` → migraciones →
  `docker compose up -d --build` (todos los servicios menos `frontend`) → healthcheck → **rollback
  automático** al commit anterior si algo no responde. El frontend lo despliega Vercel por su cuenta.
- Viene **apagado**: no corre hasta definir la variable `DEPLOY_ENABLED=true`.

### Activarlo (una sola vez)

1. **Clave SSH exclusiva para el despliegue** (no tu clave personal), en tu máquina:
   ```bash
   ssh-keygen -t ed25519 -f deploy_key -C "github-actions-deploy" -N ""
   ```
   Pegá el contenido de `deploy_key.pub` en `~/.ssh/authorized_keys` del usuario del VPS, y **después borrá
   ambos archivos locales** una vez cargada la privada en GitHub.
2. **Huella del servidor** (para no aceptar cualquier host): `ssh-keyscan -t ed25519 <IP-del-VPS>`.
   Comprobá que coincida con la del VPS: `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`.
3. En GitHub → *Settings → Secrets and variables → Actions*:

   | Tipo | Nombre | Valor |
   |------|--------|-------|
   | Secret | `VPS_HOST` | IP pública reservada |
   | Secret | `VPS_USER` | `ubuntu` |
   | Secret | `VPS_SSH_KEY` | contenido de `deploy_key` (la **privada**, completa) |
   | Secret | `VPS_KNOWN_HOSTS` | salida del `ssh-keyscan` |
   | Variable | `DEPLOY_ENABLED` | `true` |
   | Variable (opcional) | `VPS_APP_DIR` | carpeta del repo en el VPS (default `~/reservaCanchas`) |
   | Variable (opcional) | `DEPLOY_SERVICES` | servicios a desplegar (default: todos menos `frontend`). Si el VPS sirve el frontend: `api-usuarios api-canchas api-turnos api-pagos api-notificaciones gateway frontend` (exige `VITE_API_URL` en el `.env`; si falta, el despliegue se cancela antes de construir) |

4. Opcional: *Settings → Environments → production → Required reviewers* para aprobar cada despliegue a mano.
5. Probarlo: pestaña *Actions → Deploy → Run workflow*.

### Reglas para que no se rompa
- **No edites archivos a mano en el VPS** (ej. `docker-compose.yml`): el script se niega a desplegar si hay
  cambios sin commitear, para no pisarlos. Hacé los cambios por git.
- **El `.env` del VPS no está en git** y el despliegue no lo toca: variables nuevas se agregan a mano.
- **Si en el VPS se usa el contenedor `frontend`**, el `.env` debe tener `VITE_API_URL=http://<ip-o-dominio>:3000`.
  Se incrusta en el bundle al construir: sin ella queda `http://localhost:3000` y el navegador del usuario le
  pega a su propia máquina (error de CORS "loopback"). Cambiarla requiere `docker compose up -d --build frontend`.
- **Migraciones** (`database/migrations/NNN_*.sql`): se aplican una vez cada una (registro en la tabla
  `schema_migrations`), y deben ser **idempotentes y aditivas** (ver el encabezado de la 001). Un cambio de
  esquema = migración nueva **y** actualizar `database/schema.sql`. Si la BD no es el contenedor `postgres`
  del compose (ej. Supabase), el script lo avisa y hay que aplicarlas a mano.
- El rollback revierte el código, **no** las migraciones (por eso deben ser aditivas).

## 6. Notas

- `synchronize: false` en todos los servicios: el esquema **no** se crea solo, lo define
  `database/schema.sql`. Si cambian entidades, actualizar también ese script (y, si el VPS ya tiene
  datos cargados, aplicar el cambio a mano con `psql` en vez de recrear el volumen).
- El volumen `canchas_pgdata` persiste los datos de Postgres entre `docker compose up`/`down`; solo se
  pierde con `docker compose down -v` o borrando el volumen a mano.
- Para actualizar el VPS con cambios nuevos: `git pull && docker compose up -d --build`.
- **Migración de columnas nuevas en una BD ya creada** (`canchas.zona` y `canchas.email_contacto`; el
  volumen no recarga `schema.sql`): `docker compose exec postgres psql -U canchas_user -d canchas_db -c
  "ALTER TABLE canchas ADD COLUMN IF NOT EXISTS zona VARCHAR(60); ALTER TABLE canchas ADD COLUMN IF NOT EXISTS email_contacto VARCHAR(120);"`
  (y los `UPDATE ... SET zona` del final de `database/seed.sql`).
- **Mails (api-notificaciones):** completar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `MAIL_FROM`
  en el `.env` raíz con un SMTP gratuito (Gmail con contraseña de aplicación, o Brevo; ver `.env.template`)
  y poner `FRONTEND_URL` con la URL pública de Vercel. Sin `SMTP_HOST` el servicio no envía nada (solo loguea).
  Cada cancha necesita su *Email de contacto* (panel admin → Canchas) para recibir el aviso.
