import { z } from 'zod';

export const SUPPORTED_LOCALES = ['es', 'en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'es';

export const localeSchema = z
  .enum(SUPPORTED_LOCALES)
  .default(DEFAULT_LOCALE);
