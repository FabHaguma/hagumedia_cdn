import sharp from 'sharp';
import { config } from '../config.js';

/**
 * Generates the master (metadata-stripped) WebP plus the three fixed
 * responsive derivatives. Sharp drops all EXIF/metadata by default unless
 * `.withMetadata()` is called, which satisfies the sanitization requirement.
 * @param {Buffer} buffer original uploaded file bytes
 * @returns {Promise<{ width: number, height: number, master: Buffer, variants: Record<string, Buffer> }>}
 */
export async function processImage(buffer) {
    const image = sharp(buffer, { failOn: 'error' });
    const metadata = await image.metadata();

    const master = await sharp(buffer).webp({ quality: 90 }).toBuffer();

    const variantEntries = await Promise.all(
        Object.entries(config.variants).map(async ([name, { width }]) => {
            const output = await sharp(buffer)
                .resize({ width, withoutEnlargement: true })
                .webp({ quality: 82 })
                .toBuffer();
            return [name, output];
        })
    );

    return {
        width: metadata.width,
        height: metadata.height,
        master,
        variants: Object.fromEntries(variantEntries)
    };
}
