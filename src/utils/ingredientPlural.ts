import { normalizeIngredientName } from './ingredientName';

const pluralToSingularMap = new Map<string, string>([
  ['tomates', 'tomate'],
  ['papas', 'papa'],
  ['patatas', 'patata'],
  ['huevos', 'huevo'],
  ['zanahorias', 'zanahoria'],
  ['cebollas', 'cebolla'],
  ['aguacates', 'aguacate'],
  ['paltas', 'palta'],
  ['platanos', 'platano'],
  ['limones', 'limon'],
  ['dientes de ajo', 'diente de ajo'],
  ['cebollas de rama', 'cebolla de rama'],
  ['cebollas largas', 'cebolla larga'],
  ['frijoles', 'frijol'],
  ['lentejas', 'lenteja'],
  ['garbanzos', 'garbanzo'],
  ['arvejas', 'arveja'],
  ['salchichas', 'salchicha'],
  ['chorizos', 'chorizo'],
  ['arepas', 'arepa'],
  ['bananos', 'banano'],
  ['manzanas', 'manzana'],
  ['moras', 'mora'],
  ['lulos', 'lulo'],
  ['guayabas', 'guayaba'],
  ['pepinos', 'pepino'],
  ['calabacines', 'calabacin'],
  ['champinones', 'champinon'],
  ['champiñones', 'champinon'],
  ['espinacas', 'espinaca'],
  ['habichuelas', 'habichuela'],
  ['remolachas', 'remolacha'],
  ['papas criollas', 'papa criolla'],
  ['hojas de laurel', 'hoja de laurel'],
  ['clavos de olor', 'clavo de olor'],
  ['pimientos', 'pimiento'],
  ['batatas', 'batata'],
  ['piñas', 'piña'],
  ['pinas', 'pina'],
  ['apples', 'apple'],
  ['pineapples', 'pineapple'],
  ['potatoes', 'potato'],
  ['sweet potatoes', 'sweet potato'],
  ['chickens', 'chicken'],
  ['onions', 'onion'],
  ['white onions', 'white onion'],
  ['red onions', 'red onion'],
  ['yellow onions', 'yellow onion'],
  ['green onions', 'green onion'],
  ['scallions', 'scallion'],
  ['spring onions', 'spring onion'],
  ['tomatoes', 'tomato'],
  ['red tomatoes', 'red tomato'],
  ['roma tomatoes', 'roma tomato'],
  ['plum tomatoes', 'plum tomato'],
  ['eggs', 'egg'],
  ['large eggs', 'large egg'],
  ['garlic cloves', 'garlic clove'],
  ['carrots', 'carrot'],
  ['bell peppers', 'bell pepper'],
  ['red bell peppers', 'red bell pepper'],
  ['green bell peppers', 'green bell pepper'],
  ['avocados', 'avocado'],
  ['hass avocados', 'hass avocado'],
  ['plantains', 'plantain'],
  ['ripe plantains', 'ripe plantain'],
  ['green plantains', 'green plantain'],
  ['peas', 'pea'],
  ['green peas', 'green pea'],
  ['limes', 'lime'],
  ['beets', 'beet'],
  ['cucumbers', 'cucumber'],
  ['mushrooms', 'mushroom'],
  ['lentils', 'lentil'],
  ['chickpeas', 'chickpea'],
]);

const normalizedPluralToSingularMap = new Map<string, string>();

for (const [plural, singular] of pluralToSingularMap.entries()) {
  normalizedPluralToSingularMap.set(
    normalizeIngredientName(plural),
    normalizeIngredientName(singular),
  );
}

export function singularizeIngredientName(
  name: string,
): string {
  const normalized = normalizeIngredientName(name);

  if (!normalized) {
    return '';
  }

  const singular =
    normalizedPluralToSingularMap.get(normalized);

  return singular ?? normalized;
}
