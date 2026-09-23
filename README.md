# hagumedia_cdn
A centralized, self-hosted image management API and delivery network designed to serve multiple web properties hosted by the same administrator. It replaces external services like Cloudinary by handling image ingestion, optimization, and high-speed delivery from a single VPS.

See [hagumedia_cdn_v1.md](hagumedia_cdn_v1.md) for the full V1 product spec.

## Stack
Fastify (API) + sharp (image processing) + PostgreSQL (metadata) + Caddy (TLS, static delivery, rate limiting), all behind Docker Compose.

## Local development
```bash
cp .env.example .env        # edit POSTGRES_PASSWORD / DATABASE_URL
npm install
npm run migrate             # requires a reachable Postgres (see docker-compose below)
npm run seed:tenant -- "My Site"   # prints a tenant id + API key, save it now
npm run dev
```

## Running the full stack with Docker
This project's `caddy` container does **not** publish 80/443 itself — it's meant to sit
behind an existing edge reverse proxy on the VPS (another Caddy/nginx already handling
your other sites). It joins that proxy's Docker network (`EDGE_NETWORK` in `.env`) so it
can be reached by container name.

```bash
cp .env.example .env        # edit POSTGRES_PASSWORD; EDGE_NETWORK must match the edge
                             # Caddy's external network name (e.g. caddy_network)
docker compose up --build -d
docker compose run --rm api node scripts/seed-tenant.js "My Site"
```
Then add a site block to the *existing* edge Caddy's Caddyfile:
```
cdn.yourdomain.com {
    reverse_proxy hagumedia_cdn_caddy:80
}
```

Uploaded derivatives are served statically from `/storage/{tenant_id}/{image_id}/{variant}.webp`.

## API

### `POST /api/upload`
Headers: `X-API-Key: <tenant api key>`
Body: `multipart/form-data` with a single file field (JPEG or PNG, ≤10MB).

Returns:
```json
{
  "id": "…",
  "dimensions": "1920x1080",
  "variants": {
    "thumbnail": "/storage/{tenant_id}/{id}/thumbnail.webp",
    "medium": "/storage/{tenant_id}/{id}/medium.webp",
    "large": "/storage/{tenant_id}/{id}/large.webp"
  }
}
```

### `DELETE /api/images/:id`
Headers: `X-API-Key: <tenant api key>`
Deletes the master file and all derivatives from disk, then the DB row. Returns `204`.

## Revoking a tenant
```sql
UPDATE tenants SET active = false WHERE id = '...';
```
