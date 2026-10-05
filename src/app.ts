import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import ingredientsRoutes from './routes/ingredients.routes';

import healthRoutes from './routes/health.routes';

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

// Routes
app.use('/api/health', healthRoutes);

app.use(
  '/api/ingredients',
  ingredientsRoutes,
);

// 404
app.use(notFoundMiddleware);

// Global error handler
app.use(errorMiddleware);

export default app;