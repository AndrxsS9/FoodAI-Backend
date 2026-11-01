import express from 'express';
import helmet from 'helmet';

import { createCorsMiddleware } from './config/cors';
import { env } from './config/env';

import healthRoutes from './routes/health.routes';
import ingredientsRoutes from './routes/ingredients.routes';
import recipesRoutes from './routes/recipes.routes';
import mealPlansRoutes from './routes/mealPlans.routes';

import { aiRateLimit } from './middlewares/aiRateLimit.middleware';
import { notFoundMiddleware } from './middlewares/notFound.middleware';
import { errorMiddleware } from './middlewares/error.middleware';

export const JSON_BODY_LIMIT = '100kb';

const app = express();

app.disable('x-powered-by');

/*
 * Configuración acotada de proxies inversos confiables (ej. Render = 1 salto).
 * Nunca se establece trust proxy en true de forma incondicional.
 */
app.set(
  'trust proxy',
  env.TRUST_PROXY_HOPS > 0 ? env.TRUST_PROXY_HOPS : false,
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(createCorsMiddleware());

app.use(
  express.json({
    limit: JSON_BODY_LIMIT,
  }),
);

app.use(
  express.urlencoded({
    extended: false,
    limit: JSON_BODY_LIMIT,
    parameterLimit: 50,
  }),
);

/*
 * Rutas
 */
app.use(
  '/api/health',
  healthRoutes,
);

app.use(
  '/api/ingredients',
  aiRateLimit,
  ingredientsRoutes,
);

app.use(
  '/api/recipes',
  aiRateLimit,
  recipesRoutes,
);

app.use(
  '/api/meal-plans',
  aiRateLimit,
  mealPlansRoutes,
);

/*
 * Estos dos middlewares deben ir
 * DESPUÉS de todas las rutas.
 */
app.use(notFoundMiddleware);

app.use(errorMiddleware);

export default app;
