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
```bash
cp .env.example .env        # edit POSTGRES_PASSWORD
docker compose up --build -d
docker compose run --rm migrate   # first time only if you didn't rely on the migrate service
docker compose run --rm api node scripts/seed-tenant.js "My Site"
```
The API is proxied behind Caddy on port 80. Uploaded derivatives are served statically from `/storage/{tenant_id}/{image_id}/{variant}.webp`.

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
