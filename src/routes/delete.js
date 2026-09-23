import { pool } from '../db/pool.js';
import { deleteImageFiles } from '../services/storage.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function deleteRoutes(fastify) {
    fastify.delete('/api/images/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
        const { id } = request.params;

        if (!UUID_RE.test(id)) {
            return reply.code(400).send({ error: 'Invalid image id' });
        }

        const { rows } = await pool.query(
            'SELECT id, tenant_id FROM images WHERE id = $1 AND tenant_id = $2',
            [id, request.tenant.id]
        );
        const image = rows[0];

        if (!image) {
            return reply.code(404).send({ error: 'Image not found' });
        }

        // Disk first, then DB row, per the atomic deletion requirement.
        await deleteImageFiles(image.tenant_id, image.id);
        await pool.query('DELETE FROM images WHERE id = $1', [image.id]);

        return reply.code(204).send();
    });
}
