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
