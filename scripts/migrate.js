import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { config } from '../src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'migrations');

async function main() {
    const client = new pg.Client({ connectionString: config.databaseUrl });
    await client.connect();

    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);

        const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

        for (const file of files) {
            const { rows } = await client.query(
                'SELECT 1 FROM schema_migrations WHERE filename = $1',
                [file]
            );
            if (rows.length > 0) {
                console.log(`skip  ${file} (already applied)`);
                continue;
            }

            const sql = await readFile(path.join(migrationsDir, file), 'utf8');
            console.log(`apply ${file}`);
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        }

        console.log('Migrations complete.');
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
