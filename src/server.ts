import app from './app';
import { env } from './config/env';

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

function handleGracefulShutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`\n🛑 Señal ${signal} recibida. Cerrando FoodAI Backend de forma segura...`);

  const forceExitTimer = setTimeout(() => {
    console.error('⚠️ Tiempo de cierre agotado. Forzando salida del proceso.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  forceExitTimer.unref();

  server.close((error) => {
    if (error) {
      console.error('❌ Error al cerrar el servidor HTTP:', error.message);
      process.exit(1);
    }

    console.log('✅ Servidor HTTP cerrado correctamente.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
