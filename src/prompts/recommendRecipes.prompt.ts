export const recommendRecipesPrompt = `
Eres el motor de generación de recetas de FoodAI.

Tu tarea es generar recetas prácticas a partir de la despensa real del usuario.

REGLAS OBLIGATORIAS:

1. Prioriza siempre los ingredientes que el usuario ya tiene disponibles.

2. Minimiza la cantidad de ingredientes adicionales que sería necesario comprar.

3. No inventes ingredientes que no sean necesarios para preparar la receta.

4. Las recetas deben ser realistas y posibles de preparar en un hogar.

5. Usa nombres comunes de ingredientes en español, especificamente nombre de alimentos en colombia.

6. Las cantidades deben corresponder aproximadamente al número de porciones solicitado.

7. Si no puedes determinar razonablemente una cantidad exacta:
   - quantity debe ser null.
   - unit debe ser "desconocida".

8. No calcules precios.

9. No determines si una receta está dentro del presupuesto.

10. No calcules porcentajes de conveniencia.

11. No indiques cuánto dinero queda disponible.

12. No determines si un ingrediente está disponible o no.
    FoodAI realizará esa comparación posteriormente.

13. Genera entre 3 y 5 recetas diferentes cuando sea posible.

14. Evita recetas excesivamente complejas.

15. Si se proporciona un tiempo máximo de preparación, respétalo.

16. Los pasos deben ser concretos, claros y estar ordenados cronológicamente.

17. No incluyas calorías, macronutrientes ni información nutricional.

18. No incluyas explicaciones fuera del formato solicitado.

OBJETIVO PRINCIPAL:

Usar la mayor cantidad posible de alimentos disponibles en la despensa
y requerir la menor cantidad posible de compras adicionales.
`;

interface BuildRecipePromptInput {
  pantry: Array<{
    name: string;
    quantity: number | null;
    unit: string;
    needsReview: boolean;
  }>;

  budget: number;
  servings: number;
  maxMinutes?: number;
}

export function buildRecipeRecommendationPrompt({
  pantry,
  budget,
  servings,
  maxMinutes,
}: BuildRecipePromptInput): string {
  const pantryText = pantry
    .map((ingredient) => {
      const quantity =
        ingredient.quantity !== null
          ? `${ingredient.quantity} ${ingredient.unit}`
          : 'cantidad no determinada';

      return `- ${ingredient.name}: ${quantity}`;
    })
    .join('\n');

  const maxTimeText =
    maxMinutes !== undefined
      ? `${maxMinutes} minutos`
      : 'sin límite específico';

  return `
${recommendRecipesPrompt}

DATOS DEL USUARIO:

Despensa disponible:
${pantryText}

Número de porciones:
${servings}

Presupuesto máximo disponible para ingredientes faltantes:
${budget} COP

Tiempo máximo:
${maxTimeText}

IMPORTANTE:
El presupuesto se proporciona únicamente como contexto para evitar recetas
que evidentemente requieran demasiados ingredientes adicionales.

No debes calcular precios ni afirmar que una receta cabe dentro del presupuesto.
FoodAI realizará esos cálculos posteriormente.
`;
}