import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  calculateConvenience,
} from '../src/services/recipes/convenienceEngine.service';

describe('convenienceEngine.service - calculateConvenience', () => {
  it('1. Todos los ingredientes disponibles y sin compras necesarias: máxima conveniencia', () => {
    const input = {
      totalIngredients: 4,
      availableIngredients: 4,
      estimatedMissingCost: 0,
      budget: 20000,
    };

    const result = calculateConvenience(input);

    expect(result.convenience).toBe(95);
    expect(result.withinBudget).toBe(true);
    expect(result.budgetRemaining).toBe(20000);
    expect(result.reason).toBe(
      'Aprovecha casi por completo los ingredientes disponibles y no requiere compras estimadas.',
    );
  });

  it('2. Mayoría de ingredientes disponibles y costo dentro del presupuesto', () => {
    const input = {
      totalIngredients: 5,
      availableIngredients: 4,
      estimatedMissingCost: 2000,
      budget: 10000,
    };

    const result = calculateConvenience(input);

    expect(result.convenience).toBe(80);
    expect(result.withinBudget).toBe(true);
    expect(result.budgetRemaining).toBe(8000);
    expect(result.reason).toBe(
      'Aprovecha gran parte de tu despensa y requiere pocas compras adicionales.',
    );
  });

  it('3. Exactamente la mitad de los ingredientes disponibles y costo dentro del presupuesto', () => {
    const input = {
      totalIngredients: 6,
      availableIngredients: 3,
      estimatedMissingCost: 3000,
      budget: 10000,
    };

    const result = calculateConvenience(input);

    expect(result.convenience).toBe(56);
    expect(result.withinBudget).toBe(true);
    expect(result.budgetRemaining).toBe(7000);
    expect(result.reason).toBe(
      'Utiliza varios ingredientes disponibles y se mantiene dentro del presupuesto estimado.',
    );
  });

  it('4. Pocos ingredientes disponibles pero costo dentro del presupuesto', () => {
    const input = {
      totalIngredients: 5,
      availableIngredients: 1,
      estimatedMissingCost: 2000,
      budget: 10000,
    };

    const result = calculateConvenience(input);

    expect(result.convenience).toBe(38);
    expect(result.withinBudget).toBe(true);
    expect(result.budgetRemaining).toBe(8000);
    expect(result.reason).toBe(
      'Puede prepararse dentro del presupuesto, aunque requiere varios ingredientes adicionales.',
    );
  });

  it('5. Costo superior al presupuesto: anula componente de presupuesto y marca fuera de presupuesto', () => {
    const input = {
      totalIngredients: 4,
      availableIngredients: 2,
      estimatedMissingCost: 15000,
      budget: 10000,
    };

    const result = calculateConvenience(input);

    expect(result.withinBudget).toBe(false);
    expect(result.budgetRemaining).toBe(-5000);
    // pantryScore = 0.5 (0.5 * 0.7 = 0.35 -> 35). Componente de presupuesto es 0.
    expect(result.convenience).toBe(35);
    expect(result.reason).toBe(
      'Requiere compras adicionales que superan el presupuesto estimado.',
    );
  });

  it('6. Presupuesto igual a cero con compra necesaria: cálculo numérico seguro sin NaN ni Infinity', () => {
    const input = {
      totalIngredients: 4,
      availableIngredients: 2,
      estimatedMissingCost: 5000,
      budget: 0,
    };

    const result = calculateConvenience(input);

    expect(result.withinBudget).toBe(false);
    expect(result.budgetRemaining).toBe(-5000);
    expect(Number.isNaN(result.convenience)).toBe(false);
    expect(Number.isFinite(result.convenience)).toBe(true);
    expect(result.convenience).toBe(35);
    expect(result.reason).toBe(
      'Requiere compras adicionales que superan el presupuesto estimado.',
    );
  });

  it('7. Costo exactamente igual al presupuesto: presupuesto restante cero y withinBudget true', () => {
    const input = {
      totalIngredients: 4,
      availableIngredients: 2,
      estimatedMissingCost: 10000,
      budget: 10000,
    };

    const result = calculateConvenience(input);

    expect(result.withinBudget).toBe(true);
    expect(result.budgetRemaining).toBe(0);
    // pantryScore = 0.5, budgetScore = 0 (1 - 10000/10000 = 0), conveniencia = 35
    expect(result.convenience).toBe(35);
    expect(result.reason).toBe(
      'Utiliza varios ingredientes disponibles y se mantiene dentro del presupuesto estimado.',
    );
  });

  it('8. Costo igual a cero y presupuesto igual a cero: resultado estable', () => {
    const input = {
      totalIngredients: 3,
      availableIngredients: 3,
      estimatedMissingCost: 0,
      budget: 0,
    };

    const result = calculateConvenience(input);

    expect(result.withinBudget).toBe(true);
    expect(result.budgetRemaining).toBe(0);
    expect(result.convenience).toBe(95);
    expect(Number.isNaN(result.convenience)).toBe(false);
    expect(result.reason).toBe(
      'Aprovecha casi por completo los ingredientes disponibles y no requiere compras estimadas.',
    );
  });

  it('9. Confirmar que la conveniencia nunca supera el tope de 95', () => {
    const input = {
      totalIngredients: 10,
      availableIngredients: 10,
      estimatedMissingCost: 0,
      budget: 50000,
    };

    const result = calculateConvenience(input);

    expect(result.convenience).toBeLessThanOrEqual(95);
    expect(result.convenience).toBe(95);
  });

  it('10. availableIngredients mayor que totalIngredients: score de despensa limitado y tope 95', () => {
    const input = {
      totalIngredients: 4,
      availableIngredients: 8,
      estimatedMissingCost: 0,
      budget: 10000,
    };

    const result = calculateConvenience(input);

    expect(result.convenience).toBeLessThanOrEqual(95);
    expect(result.convenience).toBe(95);
  });

  it('11. totalIngredients = 0: no produce NaN ni Infinity y devuelve resultado consistente', () => {
    const input = {
      totalIngredients: 0,
      availableIngredients: 0,
      estimatedMissingCost: 0,
      budget: 1000,
    };

    const result = calculateConvenience(input);

    expect(Number.isNaN(result.convenience)).toBe(false);
    expect(Number.isFinite(result.convenience)).toBe(true);
    expect(result.convenience).toBe(30);
    expect(result.withinBudget).toBe(true);
    expect(result.budgetRemaining).toBe(1000);
  });

  it('12. Inmutabilidad del objeto de entrada: no modifica el input original', () => {
    const input = {
      totalIngredients: 5,
      availableIngredients: 3,
      estimatedMissingCost: 2000,
      budget: 10000,
    };

    const inputCopy = structuredClone(input);

    calculateConvenience(input);

    expect(input).toEqual(inputCopy);
  });
});
