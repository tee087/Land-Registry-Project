import app from './app.js';
import env from './config/environment.js';
import { connectWithRetry, closeConnection } from './config/database.js';
import { cleanupExpiredRefreshTokens } from './modules/auth/auth.service.js';

async function start() {
  const connected = await connectWithRetry();

  if (!connected) {
    if (env.db.requireOnStartup) {
      console.error('[server] PostgreSQL is unreachable. Check DATABASE_URL or DB_* settings in .env. Exiting.');
      process.exit(1);
    }
    console.warn('[server] Starting WITHOUT database (DB_REQUIRE_ON_STARTUP=false). /api/health will report "degraded".');
  }

  const server = app.listen(env.port, () => {
    console.log(`[server] LandRegistryChain API listening on port ${env.port} (${env.nodeEnv})`);
  });

  // Lightweight background maintenance: purge expired refresh tokens once a day.
  if (!env.isTest) {
    const cleanupTimer = setInterval(async () => {
      try {
        const removed = await cleanupExpiredRefreshTokens();
        if (removed > 0) console.log(`[maintenance] Removed ${removed} expired refresh token(s)`);
      } catch (error) {
        console.error('[maintenance] Refresh-token cleanup failed:', error.message);
      }
    }, 24 * 60 * 60 * 1000);
    cleanupTimer.unref();
  }

  let shuttingDown = false;
  const shutdown = async (signal, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, shutting down gracefully...`);
    server.close(async () => {
      await closeConnection();
      process.exit(exitCode);
    });
    setTimeout(() => process.exit(1), 10000).unref(); // force-exit if connections hang
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => console.error('[server] Unhandled rejection:', reason));
  process.on('uncaughtException', (error) => {
    console.error('[server] Uncaught exception:', error);
    shutdown('uncaughtException', 1);
  });
}

start().catch((error) => {
  console.error('[server] Fatal startup error:', error);
  process.exit(1);
});
