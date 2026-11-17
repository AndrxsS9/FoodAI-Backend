import { singularizeIngredientName } from './ingredientPlural';
import { canonicalizeIngredientName } from './ingredientAliases';

export function prepareIngredientName(
  name: string,
): string {
  const singularized =
    singularizeIngredientName(name);

  return canonicalizeIngredientName(singularized);
}
