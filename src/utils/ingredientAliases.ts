import { normalizeIngredientName } from './ingredientName';

interface IngredientAliasGroup {
  canonical: string;
  aliases: string[];
}

const ingredientAliasGroups: IngredientAliasGroup[] = [
  {
    canonical: 'papa',
    aliases: [
      'papa',
      'patata',
      'papa pastusa',
      'papa sabanera',
    ],
  },
  {
    canonical: 'cebolla larga',
    aliases: [
      'cebolla larga',
      'cebolla de rama',
      'cebolla junca',
    ],
  },
  {
    canonical: 'espagueti',
    aliases: [
      'espagueti',
      'spaghetti',
      'macarrones',
      'fideos',
    ],
  },
  {
    canonical: 'aguacate',
    aliases: [
      'aguacate',
      'palta',
      'aguacate hass',
      'aguacate criollo',
    ],
  },
  {
    canonical: 'maiz',
    aliases: [
      'maiz',
      'choclo',
      'mazorca',
      'elote',
      'maiz tierno',
    ],
  },
  {
    canonical: 'cebolla',
    aliases: [
      'cebolla',
      'cebolla cabezona',
      'cebolla blanca',
      'cebolla roja',
    ],
  },
  {
    canonical: 'tomate',
    aliases: [
      'tomate',
      'tomate rojo',
      'tomate chonto',
      'tomate de alino',
      'jitomate',
    ],
  },
  {
    canonical: 'platano',
    aliases: [
      'platano',
      'platano maduro',
      'platano verde',
      'platano harton',
    ],
  },
  {
    canonical: 'auyama',
    aliases: [
      'auyama',
      'ahuyama',
      'calabaza',
    ],
  },
  {
    canonical: 'agua',
    aliases: [
      'agua',
      'agua del grifo',
      'agua de la llave',
      'agua potable',
      'agua hervida',
      'agua corriente',
    ],
  },
  {
    canonical: 'pollo',
    aliases: [
      'pollo',
      'pechuga de pollo',
      'muslo de pollo',
      'presa de pollo',
    ],
  },
  {
    canonical: 'carne',
    aliases: [
      'carne',
      'carne de res',
      'carne molida',
      'lomo de res',
      'bistec',
    ],
  },
  {
    canonical: 'sal',
    aliases: [
      'sal',
      'sal marina',
      'sal de cocina',
      'sal fina',
      'sal yodada',
    ],
  },
  {
    canonical: 'aceite',
    aliases: [
      'aceite',
      'aceite vegetal',
      'aceite de cocina',
      'aceite de girasol',
    ],
  },
  {
    canonical: 'harina',
    aliases: [
      'harina',
      'harina de trigo',
    ],
  },
  {
    canonical: 'queso',
    aliases: [
      'queso',
      'queso campesino',
      'queso mozzarella',
      'queso costeno',
      'quesito',
    ],
  },
  {
    canonical: 'arveja',
    aliases: [
      'arveja',
      'guisante',
      'chicharo',
    ],
  },
  {
    canonical: 'panela',
    aliases: [
      'panela',
      'papelon',
      'piloncillo',
    ],
  },
  {
    canonical: 'hogao',
    aliases: [
      'hogao',
      'guiso',
      'guiso colombiano',
    ],
  },
  {
    canonical: 'suero costeno',
    aliases: [
      'suero costeno',
      'suero costeño',
      'suero atollabuey',
    ],
  },
  {
    canonical: 'frijol',
    aliases: [
      'frijol',
      'frejol',
    ],
  },
  {
    canonical: 'limon',
    aliases: [
      'limon',
      'limon tahiti',
      'limon mandarina',
    ],
  },
  {
    canonical: 'pimenton',
    aliases: [
      'pimenton',
      'pimiento',
      'pimiento rojo',
      'pimiento verde',
    ],
  },
  {
    canonical: 'papa criolla',
    aliases: [
      'papa criolla',
      'papa amarilla',
    ],
  },
  {
    canonical: 'cilantro',
    aliases: [
      'cilantro',
      'culantro',
      'coriandro',
    ],
  },
  {
    canonical: 'maracuya',
    aliases: [
      'maracuya',
      'parchita',
      'fruta de la pasion',
    ],
  },
  {
    canonical: 'banano',
    aliases: [
      'banano',
      'banana',
      'guineo',
    ],
  },
  {
    canonical: 'remolacha',
    aliases: [
      'remolacha',
      'betabel',
    ],
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
