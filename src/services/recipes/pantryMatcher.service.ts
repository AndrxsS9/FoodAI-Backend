import type {
  GeneratedRecipe,
} from '../../schemas/recipe.schema';

import type {
  Ingredient,
} from '../../schemas/ingredient.schema';

import { prepareIngredientName } from '../../utils/ingredientIdentity';

function tokenize(name: string): string[] {
  if (!name) {
    return [];
  }

  return name
    .split(' ')
    .filter((token) => token.length > 0);
}

function containsContiguousPhrase(
  haystack: string[],
  needle: string[],
): boolean {
  if (
    needle.length === 0 ||
    needle.length > haystack.length
  ) {
    return false;
  }

  return haystack.some((_, startIndex) => {
    if (startIndex + needle.length > haystack.length) {
      return false;
    }

    return needle.every(
      (needleToken, offset) =>
        haystack[startIndex + offset] === needleToken,
    );
  });
}

function ingredientNamesMatch(
  recipeIngredient: string,
  pantryIngredient: string,
): boolean {
  const recipeName =
    prepareIngredientName(recipeIngredient);

  const pantryName =
    prepareIngredientName(pantryIngredient);

  if (!recipeName || !pantryName) {
    return false;
  }

  if (recipeName === pantryName) {
    return true;
  }

  const recipeTokens = tokenize(recipeName);
  const pantryTokens = tokenize(pantryName);

  /*
   * Coincidencia parcial por secuencias contiguas de palabras completas:
   * "tomate" ↔ "tomate rojo"
   * "pechuga de pollo" ↔ "pollo"
   * "carne de res" ↔ "carne de res magra"
   *
   * Evita falsos positivos como:
   * "sal" ↔ "salsa"
   * "pan" ↔ "panela"
   * "ajo" ↔ "bajo"
   */
  return (
    containsContiguousPhrase(
      recipeTokens,
      pantryTokens,
    ) ||
    containsContiguousPhrase(
      pantryTokens,
      recipeTokens,
    )
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