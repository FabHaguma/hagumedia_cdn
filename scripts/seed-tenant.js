import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { config } from '../src/config.js';

async function main() {
    const name = process.argv[2];
    if (!name) {
        console.error('Usage: npm run seed:tenant -- "Tenant Name"');
        process.exit(1);
    }

    const apiKey = randomBytes(32).toString('hex');
    const client = new pg.Client({ connectionString: config.databaseUrl });
    await client.connect();

    try {
        const { rows } = await client.query(
            `INSERT INTO tenants (name, api_key) VALUES ($1, $2)
             RETURNING id, name, created_at`,
            [name, apiKey]
        );

        console.log('Tenant created:');
        console.log(`  id:       ${rows[0].id}`);
        console.log(`  name:     ${rows[0].name}`);
        console.log(`  api_key:  ${apiKey}`);
        console.log('\nStore this API key now — it is not recoverable from the database.');
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
