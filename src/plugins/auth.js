import fp from 'fastify-plugin';
import { pool } from '../db/pool.js';

/**
 * Decorates fastify with an `authenticate` preHandler that enforces
 * per-tenant API key auth and attaches `request.tenant` on success.
 */
export default fp(async function authPlugin(fastify) {
    fastify.decorate('authenticate', async (request, reply) => {
        const apiKey = request.headers['x-api-key'];

        if (!apiKey || typeof apiKey !== 'string') {
            return reply.code(401).send({ error: 'Missing X-API-Key header' });
        }

        const { rows } = await pool.query(
            'SELECT id, name, active FROM tenants WHERE api_key = $1',
            [apiKey]
        );
        const tenant = rows[0];

        if (!tenant || !tenant.active) {
            return reply.code(401).send({ error: 'Invalid or revoked API key' });
        }

        request.tenant = tenant;
    });
});
