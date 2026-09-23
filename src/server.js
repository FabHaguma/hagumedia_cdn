import { buildApp } from './app.js';
import { config } from './config.js';

const app = buildApp();

app.listen({ host: config.host, port: config.port }).catch((err) => {
    app.log.error(err);
    process.exit(1);
});
