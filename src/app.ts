import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import healthRoutes from './routes/health.routes';
import ingredientsRoutes from './routes/ingredients.routes';
import recipesRoutes from './routes/recipes.routes';
import mealPlansRoutes from './routes/mealPlans.routes';

import { aiRateLimit } from './middlewares/aiRateLimit.middleware';
import { notFoundMiddleware } from './middlewares/notFound.middleware';
import { errorMiddleware } from './middlewares/error.middleware';

const app = express();

app.use(helmet());
app.use(cors());

app.use(
  express.json({
    limit: '10mb',
  }),
);

app.use(
  express.urlencoded({
    extended: true,
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