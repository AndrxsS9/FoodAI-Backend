import app from './app';
import { env } from './config/env';
import { formatSafeErrorForLog } from './utils/safeLogger';

export const SERVER_HOST = '0.0.0.0';
const SHUTDOWN_TIMEOUT_MS = 15_000;

const server = app.listen(env.PORT, SERVER_HOST, () => {
  console.log(`
🚀 FoodAI Backend iniciado
📡 Host: ${SERVER_HOST} | Puerto: ${env.PORT}
🌎 Entorno: ${env.NODE_ENV}
🔗 Health check: /api/health
  `);
});

/*
 * Ajustes de timeouts HTTP compatibles con proxies inversos (Render) y Gemini:
 * - keepAliveTimeout > 60s para evitar cierres prematuros frente al load balancer
 * - headersTimeout ligeramente superior a keepAliveTimeout
 * - requestTimeout acotado para mitigar conexiones lentas o colgadas
 */
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 90_000;

let isShuttingDown = false;

function handleGracefulShutdown(reason: string, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`\n🛑 Señal/evento ${reason} recibido. Cerrando FoodAI Backend de forma segura...`);

  const forceExitTimer = setTimeout(() => {
    console.error('⚠️ Tiempo de cierre agotado. Forzando salida del proceso.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  forceExitTimer.unref();

  server.close((error) => {
    if (error) {
      console.error(
        '❌ Error al cerrar el servidor HTTP:',
        formatSafeErrorForLog(error),
      );
      process.exit(1);
    }

    console.log('✅ Servidor HTTP cerrado correctamente.');
    process.exit(exitCode);
  });
}

server.on('error', (error) => {
  console.error(
    '❌ Error crítico en el servidor HTTP:',
    formatSafeErrorForLog(error, {
      includeStack: env.NODE_ENV !== 'production',
    }),
  );
  process.exit(1);
});

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM', 0));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT', 0));

process.on('unhandledRejection', (reason) => {
  console.error(
    '❌ Promesa rechazada no controlada:',
    formatSafeErrorForLog(reason, {
      includeStack: env.NODE_ENV !== 'production',
    }),
  );
  handleGracefulShutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  console.error(
    '❌ Excepción no controlada:',
    formatSafeErrorForLog(error, {
      includeStack: env.NODE_ENV !== 'production',
    }),
  );
  handleGracefulShutdown('uncaughtException', 1);
});
