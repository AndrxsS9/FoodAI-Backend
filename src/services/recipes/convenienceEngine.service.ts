interface ConvenienceInput {
  totalIngredients: number;
  availableIngredients: number;
  estimatedMissingCost: number;
  budget: number;
}

interface ConvenienceResult {
  convenience: number;
  withinBudget: boolean;
  budgetRemaining: number;
  reason: string;
}

function calculatePantryScore(
  totalIngredients: number,
  availableIngredients: number,
): number {
  if (totalIngredients <= 0) {
    return 0;
  }

  return Math.min(
    availableIngredients / totalIngredients,
    1,
  );
}

function calculateBudgetScore(
  estimatedMissingCost: number,
  budget: number,
): number {
  if (estimatedMissingCost === 0) {
    return 1;
  }

  if (budget <= 0) {
    return 0;
  }

  if (estimatedMissingCost > budget) {
    return 0;
  }

  return Math.max(
    1 - estimatedMissingCost / budget,
    0,
  );
}

function buildReason(
  pantryScore: number,
  estimatedMissingCost: number,
  withinBudget: boolean,
): string {
  if (
    pantryScore >= 0.8 &&
    estimatedMissingCost === 0
  ) {
    return 'Aprovecha casi por completo los ingredientes disponibles y no requiere compras estimadas.';
  }

  if (pantryScore >= 0.8 && withinBudget) {
    return 'Aprovecha gran parte de tu despensa y requiere pocas compras adicionales.';
  }

  if (pantryScore >= 0.5 && withinBudget) {
    return 'Utiliza varios ingredientes disponibles y se mantiene dentro del presupuesto estimado.';
  }

  if (withinBudget) {
    return 'Puede prepararse dentro del presupuesto, aunque requiere varios ingredientes adicionales.';
  }

  return 'Requiere compras adicionales que superan el presupuesto estimado.';
}

export function calculateConvenience({
  totalIngredients,
  availableIngredients,
  estimatedMissingCost,
  budget,
}: ConvenienceInput): ConvenienceResult {
  const pantryScore =
    calculatePantryScore(
      totalIngredients,
      availableIngredients,
    );

  const budgetScore =
    calculateBudgetScore(
      estimatedMissingCost,
      budget,
    );

  /*
   * La despensa pesa más que el presupuesto:
   *
   * 70 % aprovechamiento de ingredientes
   * 30 % costo frente al presupuesto
   */
  const rawConvenience =
    pantryScore * 0.7 +
    budgetScore * 0.3;

  /*
   * Evitamos presentar un 100 % absoluto
   * porque sigue siendo una estimación.
   */
  const convenience = Math.min(
    Math.round(rawConvenience * 100),
    95,
  );

  const withinBudget =
    estimatedMissingCost <= budget;

  const budgetRemaining =
    budget - estimatedMissingCost;

  const reason = buildReason(
    pantryScore,
    estimatedMissingCost,
    withinBudget,
  );

  return {
    convenience,
    withinBudget,
    budgetRemaining,
    reason,
  };
}