import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function required(name, value) {
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export const config = {
    host: process.env.HOST || '0.0.0.0',
    port: Number(process.env.PORT) || 3000,
    databaseUrl: required('DATABASE_URL', process.env.DATABASE_URL),
    storageRoot: path.resolve(process.env.STORAGE_ROOT || path.join(__dirname, '..', 'storage')),
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 10 * 1024 * 1024,
    variants: {
        thumbnail: { width: 200 },
        medium: { width: 800 },
        large: { width: 1600 }
    }
};
