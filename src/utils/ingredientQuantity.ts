import type { Ingredient } from '../schemas/ingredient.schema';
import type { RecipeIngredient } from '../schemas/recipe.schema';

export type NormalizedIngredientUnit = 'unidad' | 'g' | 'ml';

export interface NormalizedIngredientQuantity {
  quantity: number;
  unit: NormalizedIngredientUnit;
}

export type IngredientUnit =
  | Ingredient['unit']
  | RecipeIngredient['unit'];

export function normalizeIngredientQuantity(
  quantity: number | null | undefined,
  unit: IngredientUnit | string | null | undefined,
): NormalizedIngredientQuantity | null {
  if (
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  if (typeof unit !== 'string') {
    return null;
  }

  switch (unit) {
    case 'g':
      return {
        quantity,
        unit: 'g',
      };

    case 'kg':
      return {
        quantity: quantity * 1000,
        unit: 'g',
      };

    case 'ml':
      return {
        quantity,
        unit: 'ml',
      };

    case 'l':
      return {
        quantity: quantity * 1000,
        unit: 'ml',
      };

    case 'unidad':
      return {
        quantity,
        unit: 'unidad',
      };

    default:
      return null;
  }
}
