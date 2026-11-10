import { normalizeIngredientName } from './ingredientName';

interface IngredientAliasGroup {
  canonical: string;
  aliases: string[];
}

const ingredientAliasGroups: IngredientAliasGroup[] = [
  {
    canonical: 'leche de almendras',
    aliases: [
      'leche de almendras',
      'leche de almendra',
      'almond milk',
    ],
  },
  {
    canonical: 'leche',
    aliases: [
      'leche',
      'leche entera',
      'leche deslactosada',
      'leche de vaca',
      'milk',
      'whole milk',
    ],
  },
  {
    canonical: 'batata',
    aliases: [
      'batata',
      'camote',
      'boniato',
      'papa dulce',
      'sweet potato',
    ],
  },
  {
    canonical: 'papa',
    aliases: [
      'papa',
      'patata',
      'papa pastusa',
      'papa sabanera',
      'potato',
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
    canonical: 'arroz',
    aliases: [
      'arroz',
      'arroz blanco',
      'rice',
      'white rice',
    ],
  },
  {
    canonical: 'pollo',
    aliases: [
      'pollo',
      'pechuga de pollo',
      'muslo de pollo',
      'presa de pollo',
      'chicken',
      'chicken breast',
      'chicken thigh',
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
  {
    canonical: 'manzana',
    aliases: [
      'manzana',
      'apple',
    ],
  },
  {
    canonical: 'pina',
    aliases: [
      'pina',
      'piña',
      'anana',
      'pineapple',
    ],
  },
  {
    canonical: 'salsa de soya',
    aliases: [
      'salsa de soya',
      'salsa de soja',
      'soy sauce',
      'soya sauce',
    ],
  },
  {
    canonical: 'salsa de tomate',
    aliases: [
      'salsa de tomate',
      'tomato sauce',
    ],
  },
  // Pasta y puré de tomate son productos distintos de la salsa de tomate
  // (y entre sí): mantienen identidad canónica propia.
  {
    canonical: 'pasta de tomate',
    aliases: [
      'pasta de tomate',
      'tomato paste',
    ],
  },
  {
    canonical: 'pure de tomate',
    aliases: [
      'pure de tomate',
      'tomato puree',
    ],
  },
];

function containsTokenPhrase(
  haystack: string[],
  needle: string[],
): boolean {
  if (needle.length === 0 || needle.length > haystack.length) {
    return false;
  }

  for (let start = 0; start + needle.length <= haystack.length; start++) {
    if (needle.every((token, offset) => haystack[start + offset] === token)) {
      return true;
    }
  }

  return false;
}

type ProcessedTomatoKind = 'paste' | 'puree' | null;

function getProcessedTomatoKind(
  tokens: string[],
): ProcessedTomatoKind {
  if (
    containsTokenPhrase(tokens, ['pasta', 'de', 'tomate']) ||
    containsTokenPhrase(tokens, ['tomato', 'paste'])
  ) {
    return 'paste';
  }

  if (
    containsTokenPhrase(tokens, ['pure', 'de', 'tomate']) ||
    containsTokenPhrase(tokens, ['tomato', 'puree'])
  ) {
    return 'puree';
  }

  return null;
}

const aliasToCanonicalMap = new Map<string, string>();
const canonicalNamesSet = new Set<string>();

for (const group of ingredientAliasGroups) {
  const normalizedCanonical =
    normalizeIngredientName(group.canonical);

  canonicalNamesSet.add(normalizedCanonical);

  for (const alias of group.aliases) {
    const normalizedAlias =
      normalizeIngredientName(alias);

    if (!aliasToCanonicalMap.has(normalizedAlias)) {
      aliasToCanonicalMap.set(
        normalizedAlias,
        normalizedCanonical,
      );
    }
  }
}

export function isCanonicalIngredient(
  name: string,
): boolean {
  const normalized = normalizeIngredientName(name);
  return canonicalNamesSet.has(normalized);
}

export function areDistinctFoodCollisions(
  tokensA: string[],
  tokensB: string[],
): boolean {
  const hasA = (token: string) => tokensA.includes(token);
  const hasB = (token: string) => tokensB.includes(token);
  const oneHas = (predicate: (has: (t: string) => boolean) => boolean) =>
    (predicate(hasA) && !predicate(hasB)) || (predicate(hasB) && !predicate(hasA));

  // 1. Leche animal vs Leche de almendras / vegetal
  const isAlmond = (has: (t: string) => boolean) =>
    has('almendra') || has('almendras') || has('almond');
  if (
    oneHas(isAlmond) &&
    (hasA('leche') || hasA('milk')) &&
    (hasB('leche') || hasB('milk'))
  ) {
    return true;
  }

  // 2. Papa / potato vs Batata / sweet potato / camote
  const isSweetPotato = (has: (t: string) => boolean) =>
    has('batata') || has('camote') || has('boniato') || has('sweet');
  const isPotato = (has: (t: string) => boolean) =>
    has('papa') || has('patata') || has('potato');
  if (
    oneHas(isSweetPotato) &&
    (isPotato(hasA) || isSweetPotato(hasA)) &&
    (isPotato(hasB) || isSweetPotato(hasB))
  ) {
    return true;
  }

  // 3. Manzana / apple vs Piña / pineapple
  const isPineapple = (has: (t: string) => boolean) =>
    has('pina') || has('pineapple') || has('anana');
  const isApple = (has: (t: string) => boolean) =>
    has('manzana') || has('apple');
  if (oneHas(isPineapple) && (isApple(hasA) || isApple(hasB))) {
    return true;
  }

  // 4. Salsa de soya / soy sauce vs Salsa de tomate / tomato sauce (o salsa simple)
  const isSoy = (has: (t: string) => boolean) =>
    has('soya') || has('soja') || has('soy');
  const isTomato = (has: (t: string) => boolean) =>
    has('tomate') || has('tomato');
  if (oneHas(isSoy) && oneHas(isTomato)) {
    return true;
  }
  if (
    oneHas(isSoy) &&
    (hasA('salsa') || hasA('sauce')) &&
    (hasB('salsa') || hasB('sauce'))
  ) {
    return true;
  }

  // 5. Papa criolla vs Papa común
  const isCriolla = (has: (t: string) => boolean) =>
    has('criolla') || has('amarilla');
  if (oneHas(isCriolla) && isPotato(hasA) && isPotato(hasB)) {
    return true;
  }

  // 6. Cebolla larga vs Cebolla cabezona
  const isLarga = (has: (t: string) => boolean) =>
    has('larga') || has('rama') || has('junca');
  const isCebolla = (has: (t: string) => boolean) =>
    has('cebolla') || has('onion');
  if (oneHas(isLarga) && isCebolla(hasA) && isCebolla(hasB)) {
    return true;
  }

  // 7. Pasta de tomate / puré de tomate vs cualquier otro alimento
  //    (tomate fresco, salsa de tomate, ketchup, pasta alimenticia, puré genérico)
  const processedTomatoA = getProcessedTomatoKind(tokensA);
  const processedTomatoB = getProcessedTomatoKind(tokensB);
  if (
    (processedTomatoA !== null || processedTomatoB !== null) &&
    processedTomatoA !== processedTomatoB
  ) {
    return true;
  }

  return false;
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
