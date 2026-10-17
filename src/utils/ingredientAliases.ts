import { normalizeIngredientName } from './ingredientName';

interface IngredientAliasGroup {
  canonical: string;
  aliases: string[];
}

const ingredientAliasGroups: IngredientAliasGroup[] = [
  {
    canonical: 'papa',
    aliases: ['papa', 'patata'],
  },
  {
    canonical: 'cebolla larga',
    aliases: ['cebolla larga', 'cebolla de rama'],
  },
  {
    canonical: 'espagueti',
    aliases: ['espagueti', 'spaghetti'],
  },
  {
    canonical: 'aguacate',
    aliases: ['aguacate', 'palta'],
  },
  {
    canonical: 'maiz',
    aliases: ['maiz', 'choclo'],
  },
];

const aliasToCanonicalMap = new Map<string, string>();

for (const group of ingredientAliasGroups) {
  const normalizedCanonical =
    normalizeIngredientName(group.canonical);

  for (const alias of group.aliases) {
    const normalizedAlias =
      normalizeIngredientName(alias);

    aliasToCanonicalMap.set(
      normalizedAlias,
      normalizedCanonical,
    );
  }
}

export function canonicalizeIngredientName(
  name: string,
): string {
  const normalized = normalizeIngredientName(name);

  if (!normalized) {
    return '';
  }

  const canonical =
    aliasToCanonicalMap.get(normalized);

  return canonical ?? normalized;
}
