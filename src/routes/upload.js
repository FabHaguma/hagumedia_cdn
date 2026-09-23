import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { assertValidImage } from '../utils/magicByte.js';
import { processImage } from '../services/imageProcessor.js';
import { writeImageFiles, publicPath } from '../services/storage.js';
import { config } from '../config.js';

export default async function uploadRoutes(fastify) {
    fastify.post('/api/upload', { preHandler: fastify.authenticate }, async (request, reply) => {
        const file = await request.file({
            limits: { fileSize: config.maxUploadBytes }
        });

        if (!file) {
            return reply.code(400).send({ error: 'No file provided (expected multipart/form-data field)' });
        }

        const buffer = await file.toBuffer();

        await assertValidImage(buffer);

        const imageId = randomUUID();
        const tenantId = request.tenant.id;

        const processed = await processImage(buffer);
        await writeImageFiles(tenantId, imageId, processed);

        const variantPaths = Object.fromEntries(
            Object.keys(processed.variants).map((name) => [
                name,
                publicPath(tenantId, imageId, `${name}.webp`)
            ])
        );

        const { rows } = await pool.query(
            `INSERT INTO images (id, tenant_id, original_filename, disk_path, bytes, dimensions, variants)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, created_at`,
            [
                imageId,
                tenantId,
                file.filename,
                `${tenantId}/${imageId}`,
                buffer.length,
                `${processed.width}x${processed.height}`,
                variantPaths
            ]
        );

        return reply.code(201).send({
            id: rows[0].id,
            created_at: rows[0].created_at,
            dimensions: `${processed.width}x${processed.height}`,
            variants: variantPaths
        });
    });
}
