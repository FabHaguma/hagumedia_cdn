# Product Requirements Document (PRD): Self-Hosted Image CDN — V1

## 1. Product Overview
**Name:** Hagumedia CDN.
**Purpose:** A centralized, self-hosted image management API and delivery network designed to serve multiple web properties hosted by the same administrator. It replaces external services like Cloudinary by handling image ingestion, optimization, and high-speed delivery from a single VPS.
**Target Audience:** Internal client websites (CMS platforms, e-commerce backends, static site generators) requiring a unified asset pipeline.
**Scope note:** This is the V1 spec — built to be usable this week, with clear extension points for the roadmap in Section 7.

## 2. Technical Stack
*   **API Framework:** Node.js with Fastify (high throughput, native multipart streaming).
*   **Processing Engine:** `sharp` (libvips wrapper for low-memory, high-speed image manipulation).
*   **Database:** PostgreSQL (relational tenant data and JSONB variant mapping).
*   **Reverse Proxy & Cache:** Caddy (automatic HTTPS, request routing, static file serving, edge caching).
*   **Storage:** Local VPS persistent disk (Docker Volume).

## 3. Core Features & Requirements

### 3.1. Authentication & Tenant Isolation
*   **Tenants table:** Tenants (client websites) are rows in a `tenants` table, seeded manually via `psql` when a new site is added. No self-serve signup or key-generation UI in V1.
*   **API Keys:** Long-lived, cryptographically secure API keys, one per tenant.
*   **Strict Isolation:** A tenant may only upload, read, and delete assets associated with their own API key.
*   **Revocation:** Instant revocation is a single `UPDATE tenants SET active = false WHERE id = ...`. No admin tooling required to support this in V1.

### 3.2. Ingestion API (Uploads)
*   **Streaming Handoff:** Uploads use `multipart/form-data`, streamed directly to the processing engine without fully buffering in RAM.
*   **Validation:**
    *   Caddy rejects payloads exceeding a hard limit (e.g., 10MB) before they reach the API.
    *   The API performs "magic byte" validation to confirm the uploaded file is a legitimate image, ignoring the provided file extension.
*   **Sanitization:** The processing engine strips all EXIF metadata (GPS, camera info) on ingestion.

### 3.3. Processing & Optimization
*   **Format Conversion:** Convert uploaded JPEG/PNG into WebP only. (AVIF is deferred — see Section 7.)
*   **Derivatives:** Three fixed variant profiles, generated synchronously on upload:
    *   `thumbnail` — 200px wide
    *   `medium` — 800px wide
    *   `large` — 1600px wide
*   **Responsive Mapping:** Return a mapping of all generated derivatives to the client on successful upload, so the frontend can build responsive `<picture>` tags.

### 3.4. Storage Architecture
*   **Database Metadata:** Logical image data is stored separately from physical files.
*   **Disk Layout:** Flat per-tenant, per-image structure — `/storage/{tenant_id}/{image_id}/{variant}.{ext}`. (Hex sharding is deferred — see Section 7.)
*   **Atomic Deletion:** Deletion requests permanently erase the master file and all derivatives from disk *before* removing the database record.

### 3.5. Delivery & Caching
*   **Stateless Delivery:** The Fastify API is never used to serve routine image `GET` requests.
*   **Edge Caching:** Caddy sits in front of the storage directory, serving images directly and caching them aggressively for fast repeat requests.

## 4. Data Models

### 4.1. `tenants` Table (PostgreSQL)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Primary identifier for the tenant. |
| `name` | String | Human-readable label (e.g., site name), for your own reference. |
| `api_key` | String | Cryptographically secure key, unique. |
| `active` | Boolean | Set to `false` to instantly revoke access. |
| `created_at` | Timestamp | Standard creation timestamp. |

### 4.2. `images` Table (PostgreSQL)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Primary identifier for the image asset. |
| `tenant_id` | UUID (FK) | References `tenants.id`. |
| `original_filename` | String | The uploaded file name, retained for CMS UI searching. |
| `disk_path` | String | The root internal path on the VPS. |
| `bytes` | Integer | Master file size (for future quota calculations). |
| `dimensions` | String | Width and height (e.g., "1920x1080"). |
| `variants` | JSONB | Map of processed derivatives (e.g., `{"thumbnail": "/path.webp", "medium": "/path.webp", "large": "/path.webp"}`). |
| `created_at` | Timestamp | Standard creation timestamp. |

## 5. Security & Risk Mitigation
*   **Path Traversal Prevention:** Never use client-provided filenames or paths when saving to disk. Always use system-generated UUIDs.
*   **Key Revocation:** Instant, via direct DB update (see 3.1).
*   **DDoS Mitigation:** Basic rate-limiting applied at the Caddy proxy layer to prevent automated spam uploads.

## 6. Suggested Build Order
1.  Postgres schema (`tenants`, `images`) + manually seed one tenant row.
2.  Fastify upload endpoint: auth check → magic-byte validation → EXIF strip → generate 3 WebP variants → write to disk → insert DB row → return variant map.
3.  Caddy config: serve `/storage` statically with caching, proxy `/api` to Fastify, enforce upload size limit and rate limiting.
4.  Delete endpoint (disk first, then DB row).
5.  Point one real site at it and run it for a week before touching anything in Section 7.

## 7. Future Scope (V2+)
Each item below is designed to slot into the V1 architecture without requiring a rewrite:
*   **AVIF Support:** Add as a second output format alongside WebP once the pipeline is stable.
*   **Async Variant Processing:** Move derivative generation to a job queue (e.g., BullMQ/Redis) if synchronous upload latency becomes a problem at higher volume.
*   **Disk Sharding:** Migrate `/storage/{tenant_id}/{image_id}/...` to a hex-sharded structure (`/storage/{tenant_id}/{hex_1}/{hex_2}/{image_id}_{variant}.{ext}`) if inode/file-count issues appear. Mechanical migration, not an architecture change.
*   **Configurable Variant Profiles:** Allow per-tenant custom variant definitions instead of the fixed three.
*   **Admin UI:** Web dashboard for monitoring storage quotas, viewing assets across tenants, and revoking API keys without direct DB access.
*   **External Block Storage:** Migration path from local VPS disk to an S3-compatible object storage provider.
*   **On-the-Fly Processing:** URL-based dynamic resizing (e.g., `image.jpg?w=300`) backed by a caching layer.
*   **Self-Serve Tenant Management:** API-key generation and tenant onboarding without manual `psql` inserts.
