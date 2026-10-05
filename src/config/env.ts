import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),

  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  GEMINI_API_KEY: z
    .string()
    .min(1, 'GEMINI_API_KEY es obligatoria'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Variables de entorno inválidas');
  console.error(result.error.flatten().fieldErrors);

  process.exit(1);
}

export const env = result.data;