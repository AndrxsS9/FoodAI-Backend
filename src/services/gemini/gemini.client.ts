import { GoogleGenAI } from '@google/genai';

import { env } from '../../config/env';

export const geminiClient = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});