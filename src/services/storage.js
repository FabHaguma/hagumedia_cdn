import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

// tenantId/imageId are always server-generated UUIDs (DB row / crypto.randomUUID),
// never client input, so this cannot be used for path traversal.
function imageDir(tenantId, imageId) {
    return path.join(config.storageRoot, tenantId, imageId);
}

export function publicPath(tenantId, imageId, filename) {
    return `/storage/${tenantId}/${imageId}/${filename}`;
}

/**
 * Writes the master file and all derivatives for one image to disk.
 * @returns {Promise<string>} the directory the files were written to
 */
export async function writeImageFiles(tenantId, imageId, { master, variants }) {
    const dir = imageDir(tenantId, imageId);
    await mkdir(dir, { recursive: true });

    await Promise.all([
        writeFile(path.join(dir, 'original.webp'), master),
        ...Object.entries(variants).map(([name, buffer]) =>
            writeFile(path.join(dir, `${name}.webp`), buffer)
        )
    ]);

    return dir;
}

/**
 * Permanently removes an image's directory (master + all derivatives).
 * Must be called before deleting the DB row (atomic deletion, disk first).
 */
export async function deleteImageFiles(tenantId, imageId) {
    const dir = imageDir(tenantId, imageId);
    await rm(dir, { recursive: true, force: true });
}
