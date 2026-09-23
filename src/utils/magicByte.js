import { fileTypeFromBuffer } from 'file-type';

// Only these are accepted as upload input; everything is converted to WebP on ingestion.
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

/**
 * Validates the real file type via magic bytes, ignoring any client-provided
 * filename/extension/content-type.
 * @param {Buffer} buffer
 * @returns {Promise<{mime: string, ext: string}>}
 */
export async function assertValidImage(buffer) {
    const type = await fileTypeFromBuffer(buffer);

    if (!type || !ALLOWED_MIME_TYPES.has(type.mime)) {
        const err = new Error('Uploaded file is not a valid JPEG or PNG image');
        err.statusCode = 400;
        throw err;
    }

    return type;
}
