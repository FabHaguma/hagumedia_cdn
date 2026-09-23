import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import authPlugin from './plugins/auth.js';
import uploadRoutes from './routes/upload.js';
import deleteRoutes from './routes/delete.js';

export function buildApp() {
    const app = Fastify({ logger: true });

    app.register(multipart, {
        limits: {
            fileSize: config.maxUploadBytes,
            files: 1
        }
    });

    app.register(authPlugin);
    app.register(uploadRoutes);
    app.register(deleteRoutes);

    app.get('/healthz', async () => ({ status: 'ok' }));

    app.setErrorHandler((err, request, reply) => {
        const statusCode = err.statusCode || 500;
        if (statusCode >= 500) {
            request.log.error(err);
        }
        reply.code(statusCode).send({ error: err.message || 'Internal Server Error' });
    });

    return app;
}
