import app from './app';
import { env } from './config/env';

app.listen(env.PORT, () => {
  console.log(`
🚀 FoodAI Backend iniciado
📡 Puerto: ${env.PORT}
🌎 Entorno: ${env.NODE_ENV}
🔗 http://localhost:${env.PORT}/api/health
  `);
});