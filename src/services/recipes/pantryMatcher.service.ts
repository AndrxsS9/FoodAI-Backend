import type {
  GeneratedRecipe,
} from '../../schemas/recipe.schema';

import type {
  Ingredient,
} from '../../schemas/ingredient.schema';

function normalizeIngredientName(
  name: string,
): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ingredientNamesMatch(
  recipeIngredient: string,
  pantryIngredient: string,
): boolean {
  const recipeName =
    normalizeIngredientName(recipeIngredient);

  const pantryName =
    normalizeIngredientName(pantryIngredient);

  if (recipeName === pantryName) {
    return true;
  }

  /*
   * Ayuda con casos sencillos como:
   * "tomate" ↔ "tomate rojo"
   * "pechuga de pollo" ↔ "pollo"
   */
  return (
    recipeName.includes(pantryName) ||
    pantryName.includes(recipeName)
  );
}

export interface PantryMatchResult {
  availableIngredients: GeneratedRecipe['ingredients'];
  missingIngredients: GeneratedRecipe['ingredients'];
}

export function matchRecipeWithPantry(
  recipe: GeneratedRecipe,
  pantry: Ingredient[],
): PantryMatchResult {
  const availableIngredients: GeneratedRecipe['ingredients'] =
    [];

  const missingIngredients: GeneratedRecipe['ingredients'] =
    [];

  for (const recipeIngredient of recipe.ingredients) {
    const existsInPantry = pantry.some(
      (pantryIngredient) =>
        ingredientNamesMatch(
          recipeIngredient.name,
          pantryIngredient.name,
        ),
    );

    if (existsInPantry) {
      availableIngredients.push(recipeIngredient);
    } else {
      missingIngredients.push(recipeIngredient);
    }
  }

  return {
    availableIngredients,
    missingIngredients,
  };
}