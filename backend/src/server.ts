import { config } from './config/index.js';
import { migrate } from './db/migrate.js';
import { createApp } from './app.js';

const app = createApp();

async function start(): Promise<void> {
  await migrate();
  app.listen(config.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${config.PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
