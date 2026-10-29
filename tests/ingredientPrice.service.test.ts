import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  estimateIngredientCost,
  estimateMissingIngredientsCost,
  getIngredientPriceDetails,
  ingredientPriceCatalog,
  UNKNOWN_INGREDIENT_CONSUMPTION_COST,
  UNKNOWN_INGREDIENT_ESTIMATED_COST,
} from '../src/services/pricing/ingredientPrice.service';

import type {
  RecipeIngredient,
} from '../src/schemas/recipe.schema';

function buildIngredient(
  name: string,
  quantity: number | null = 1,
  unit: RecipeIngredient['unit'] = 'unidad',
): RecipeIngredient {
  return {
    name,
    quantity,
    unit,
  };
}

describe('ingredientPrice.service', () => {
  describe('Catálogo y estructura de datos de precios colombianos', () => {
    it('debe contener al menos 65 ingredientes colombianos comúnmente utilizados', () => {
      expect(ingredientPriceCatalog.length).toBeGreaterThanOrEqual(65);
    });

    it('cada ingrediente del catálogo debe tener estructura válida y documentada', () => {
      for (const item of ingredientPriceCatalog) {
        expect(typeof item.id).toBe('string');
        expect(item.id.length).toBeGreaterThan(0);
        expect(typeof item.canonicalName).toBe('string');
        expect(Array.isArray(item.aliases)).toBe(true);
        expect(item.aliases.length).toBeGreaterThan(0);
        expect(typeof item.estimatedPurchasePrice).toBe('number');
        expect(item.estimatedPurchasePrice).toBeGreaterThanOrEqual(0);
        expect(typeof item.estimatedConsumptionPrice).toBe('number');
        expect(item.estimatedConsumptionPrice).toBeGreaterThanOrEqual(0);
        expect(['market_verified', 'reference_estimate']).toContain(item.priceSource);
        expect(typeof item.unitDescription).toBe('string');
      }
    });

    it('distingue ingredientes con precio de mercado verificado frente a estimaciones de referencia', () => {
      const arroz = getIngredientPriceDetails('arroz');
      const lechuga = getIngredientPriceDetails('lechuga');

      expect(arroz?.priceSource).toBe('market_verified');
      expect(lechuga?.priceSource).toBe('reference_estimate');
    });

    it('el catálogo contiene exactamente 78 ingredientes con fuentes documentadas y transparentes', () => {
      expect(ingredientPriceCatalog).toHaveLength(78);

      const verified = ingredientPriceCatalog.filter(
        (item) => item.priceSource === 'market_verified',
      );
      const reference = ingredientPriceCatalog.filter(
        (item) => item.priceSource === 'reference_estimate',
      );

      expect(verified).toHaveLength(19);
      expect(reference).toHaveLength(59);

      const verifiedIds = verified.map((i) => i.id);
      expect(verifiedIds).toContain('arroz');
      expect(verifiedIds).toContain('huevo');
      expect(verifiedIds).toContain('leche');
      expect(verifiedIds).toContain('aceite');
      expect(verifiedIds).toContain('sal');
      expect(verifiedIds).toContain('agua');

      const referenceIds = reference.map((i) => i.id);
      expect(referenceIds).toContain('lechuga');
      expect(referenceIds).toContain('cilantro');
      expect(referenceIds).toContain('auyama');
      expect(referenceIds).toContain('oregano');
    });

    it('documenta que el precio de compra representa paquetes comerciales de referencia y no siempre es proporcional a la porción', () => {
      const sal = getIngredientPriceDetails('sal');
      expect(sal?.estimatedPurchasePrice).toBe(1500);
      expect(sal?.estimatedConsumptionPrice).toBe(100);
      expect(sal?.estimatedPurchasePrice).toBeGreaterThan(sal?.estimatedConsumptionPrice!);

      const aceite = getIngredientPriceDetails('aceite');
      expect(aceite?.estimatedPurchasePrice).toBe(7000);
      expect(aceite?.estimatedConsumptionPrice).toBe(500);
      expect(aceite?.estimatedPurchasePrice).toBeGreaterThan(aceite?.estimatedConsumptionPrice!);

      const agua = getIngredientPriceDetails('agua');
      expect(agua?.estimatedPurchasePrice).toBe(0);
      expect(agua?.estimatedConsumptionPrice).toBe(0);
    });
  });

  describe('estimateIngredientCost', () => {
    it('1. Precio de ingrediente conocido por nombre principal: tomate → 1500', () => {
      const ingredient = buildIngredient('tomate');

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(1500);
    });

    it('2. Precio de otro ingrediente conocido con costo diferente: pollo → 9000', () => {
      const ingredient = buildIngredient('pollo');

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(9000);
    });

    it('3. Alias de ingrediente: pechuga de pollo → 9000', () => {
      const ingredient = buildIngredient('pechuga de pollo');

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(9000);
    });

    it('4. Otro alias del catálogo: espagueti y spaghetti → 3500', () => {
      const espagueti = buildIngredient('espagueti');
      const spaghetti = buildIngredient('spaghetti');

      expect(estimateIngredientCost(espagueti)).toBe(3500);
      expect(estimateIngredientCost(spaghetti)).toBe(3500);
    });

    it('5. Mayúsculas y minúsculas: Tomate → 1500', () => {
      const ingredient = buildIngredient('Tomate');

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(1500);
    });

    it('6. Normalización de tildes: azúcar y azucar producen el mismo precio (3500)', () => {
      const conTilde = buildIngredient('azúcar');
      const sinTilde = buildIngredient('azucar');

      expect(estimateIngredientCost(conTilde)).toBe(3500);
      expect(estimateIngredientCost(sinTilde)).toBe(3500);
    });

    it('7. Espacios iniciales, finales o múltiples: normaliza correctamente a su precio', () => {
      const ingredient = buildIngredient('   tomate    rojo   ');

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(1500);
    });

    it('8. Puntuación y signos eliminados por normalización: encuentra alias correspondiente', () => {
      const conSignos = buildIngredient('cebolla (blanca)!');

      const cost = estimateIngredientCost(conSignos);

      expect(cost).toBe(1500);
    });

    it('9. Ingrediente desconocido: utiliza fallback actual de 5000', () => {
      const ingredient = buildIngredient('trufa negra');

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(5000);
    });

    it('14. Quantity y unit no alteran el precio actual (MVP por ingrediente de compra)', () => {
      const ing1 = buildIngredient('tomate', 1, 'unidad');
      const ing2 = buildIngredient('tomate', 100, 'kg');
      const ing3 = buildIngredient('tomate', null, 'desconocida');

      expect(estimateIngredientCost(ing1)).toBe(1500);
      expect(estimateIngredientCost(ing2)).toBe(1500);
      expect(estimateIngredientCost(ing3)).toBe(1500);
    });

    it('15a. Inmutabilidad en estimateIngredientCost: no modifica el objeto recibido', () => {
      const ingredient = buildIngredient('tomate', 2, 'unidad');
      const copy = structuredClone(ingredient);

      estimateIngredientCost(ingredient);

      expect(ingredient).toEqual(copy);
    });

    it('16. Formas equivalentes de papa: papa, papas, patata y patatas usan el precio existente de 2500', () => {
      expect(estimateIngredientCost(buildIngredient('papa'))).toBe(2500);
      expect(estimateIngredientCost(buildIngredient('papas'))).toBe(2500);
      expect(estimateIngredientCost(buildIngredient('patata'))).toBe(2500);
      expect(estimateIngredientCost(buildIngredient('patatas'))).toBe(2500);
    });

    it('17. Alias con frase plural compatible: cebollas de rama → 2000 (cebolla larga)', () => {
      expect(
        estimateIngredientCost(buildIngredient('cebollas de rama')),
      ).toBe(2000);
      expect(
        estimateIngredientCost(buildIngredient('cebolla de rama')),
      ).toBe(2000);
      expect(
        estimateIngredientCost(buildIngredient('cebolla larga')),
      ).toBe(2000);
    });

    it('18. Ingredientes sin regla de precio en catálogo usan fallback 5000 sin inventar valores', () => {
      expect(estimateIngredientCost(buildIngredient('trufa negra'))).toBe(UNKNOWN_INGREDIENT_ESTIMATED_COST);
      expect(estimateIngredientCost(buildIngredient('caviar'))).toBe(UNKNOWN_INGREDIENT_ESTIMATED_COST);
      expect(estimateIngredientCost(buildIngredient('wasabi fresco'))).toBe(UNKNOWN_INGREDIENT_ESTIMATED_COST);
      expect(estimateIngredientCost(buildIngredient('azafran espanol'))).toBe(UNKNOWN_INGREDIENT_ESTIMATED_COST);
      expect(estimateIngredientCost(buildIngredient('dragonfruit'))).toBe(UNKNOWN_INGREDIENT_ESTIMATED_COST);
    });

    it('19. Inmutabilidad en estimateIngredientCost con plurales y aliases', () => {
      const ingredient = buildIngredient('  Patatas  ', 3, 'unidad');
      const copy = structuredClone(ingredient);

      const cost = estimateIngredientCost(ingredient);

      expect(cost).toBe(2500);
      expect(ingredient).toEqual(copy);
    });

    it('21. Agua doméstica para cocinar tiene costo 0 COP y no sobrecarga compras faltantes', () => {
      expect(estimateIngredientCost(buildIngredient('agua'))).toBe(0);
      expect(estimateIngredientCost(buildIngredient('agua de la llave'))).toBe(0);
      expect(estimateIngredientCost(buildIngredient('agua del grifo'))).toBe(0);
      expect(estimateIngredientCost(buildIngredient('agua tibia'))).toBe(0);
      expect(estimateIngredientCost(buildIngredient('agua caliente'))).toBe(0);
      expect(estimateIngredientCost(buildIngredient('agua hervida'))).toBe(0);
    });

    it('22. Precios colombianos de aguacate, maíz y sus sinónimos regionales', () => {
      expect(estimateIngredientCost(buildIngredient('aguacate'))).toBe(3500);
      expect(estimateIngredientCost(buildIngredient('palta'))).toBe(3500);
      expect(estimateIngredientCost(buildIngredient('paltas'))).toBe(3500);
      expect(estimateIngredientCost(buildIngredient('aguacates'))).toBe(3500);
      expect(estimateIngredientCost(buildIngredient('aguacate hass'))).toBe(3500);

      expect(estimateIngredientCost(buildIngredient('maiz'))).toBe(2500);
      expect(estimateIngredientCost(buildIngredient('choclo'))).toBe(2500);
      expect(estimateIngredientCost(buildIngredient('mazorca'))).toBe(2500);
      expect(estimateIngredientCost(buildIngredient('maiz tierno'))).toBe(2500);
    });

    it('23. Ingredientes básicos de despensa y especias con precios razonables', () => {
      expect(estimateIngredientCost(buildIngredient('sal'))).toBe(1500);
      expect(estimateIngredientCost(buildIngredient('sal marina'))).toBe(1500);
      expect(estimateIngredientCost(buildIngredient('aceite'))).toBe(7000);
      expect(estimateIngredientCost(buildIngredient('aceite vegetal'))).toBe(7000);
      expect(estimateIngredientCost(buildIngredient('pimienta'))).toBe(1200);
      expect(estimateIngredientCost(buildIngredient('pimienta negra'))).toBe(1200);
      expect(estimateIngredientCost(buildIngredient('comino'))).toBe(1200);
      expect(estimateIngredientCost(buildIngredient('color'))).toBe(1000);
      expect(estimateIngredientCost(buildIngredient('achiote'))).toBe(1000);
      expect(estimateIngredientCost(buildIngredient('laurel'))).toBe(1000);
      expect(estimateIngredientCost(buildIngredient('tomillo'))).toBe(1000);
      expect(estimateIngredientCost(buildIngredient('oregano'))).toBe(1200);
      expect(estimateIngredientCost(buildIngredient('cilantro'))).toBe(1000);
    });

    it('24. Distinción entre costo de compra (paquete completo) y costo de consumo (porción estimada)', () => {
      const sal = buildIngredient('sal');
      const aceite = buildIngredient('aceite');
      const pimienta = buildIngredient('pimienta');

      // Modo compra por defecto
      expect(estimateIngredientCost(sal)).toBe(1500);
      expect(estimateIngredientCost(sal, { mode: 'purchase' })).toBe(1500);
      expect(estimateIngredientCost(aceite)).toBe(7000);
      expect(estimateIngredientCost(pimienta)).toBe(1200);

      // Modo consumo / porción
      expect(estimateIngredientCost(sal, { mode: 'consumption' })).toBe(100);
      expect(estimateIngredientCost(aceite, { mode: 'consumption' })).toBe(500);
      expect(estimateIngredientCost(pimienta, { mode: 'consumption' })).toBe(150);

      // Desconocido en modo consumo usa fallback menor
      const desconocido = buildIngredient('caviar');
      expect(estimateIngredientCost(desconocido, { mode: 'consumption' })).toBe(UNKNOWN_INGREDIENT_CONSUMPTION_COST);
    });
  });

  describe('estimateMissingIngredientsCost', () => {
    it('10. Varios ingredientes conocidos: calcula la suma exacta (tomate + huevo + arroz = 5800)', () => {
      const ingredients = [
        buildIngredient('tomate'),
        buildIngredient('huevo'),
        buildIngredient('arroz'),
      ];

      const total = estimateMissingIngredientsCost(ingredients);

      // 1500 + 800 + 3500 = 5800
      expect(total).toBe(5800);
    });

    it('11. Mezcla de conocidos y desconocidos: desconocido aporta el fallback de 5000', () => {
      const ingredients = [
        buildIngredient('pollo'),
        buildIngredient('trufa negra'),
      ];

      const total = estimateMissingIngredientsCost(ingredients);

      // 9000 + 5000 = 14000
      expect(total).toBe(14000);
    });

    it('12. Lista vacía de ingredientes: retorna 0', () => {
      const total = estimateMissingIngredientsCost([]);

      expect(total).toBe(0);
    });

    it('13. Ingredientes repetidos: suma cada elemento recibido según el comportamiento actual', () => {
      const ingredients = [
        buildIngredient('tomate'),
        buildIngredient('tomate'),
      ];

      const total = estimateMissingIngredientsCost(ingredients);

      // 1500 + 1500 = 3000
      expect(total).toBe(3000);
    });

    it('15b. Inmutabilidad en estimateMissingIngredientsCost: no modifica el arreglo ni los objetos', () => {
      const ingredients = [
        buildIngredient('tomate', 2, 'unidad'),
        buildIngredient('pollo', 500, 'g'),
      ];
      const copy = structuredClone(ingredients);

      estimateMissingIngredientsCost(ingredients);

      expect(ingredients).toEqual(copy);
    });

    it('20. Plurales y aliases en estimateMissingIngredientsCost calculan correctamente e inmutables', () => {
      const ingredients = [
        buildIngredient('patatas', 2, 'unidad'),
        buildIngredient('cebollas de rama', 1, 'unidad'),
      ];
      const copy = structuredClone(ingredients);

      const total = estimateMissingIngredientsCost(ingredients);

      // 2500 (patatas -> papa) + 2000 (cebollas de rama -> cebolla larga) = 4500
      expect(total).toBe(4500);
      expect(ingredients).toEqual(copy);
    });

    it('25. Receta con agua faltante no infla el costo total estimado de compras', () => {
      const ingredients = [
        buildIngredient('huevo'),
        buildIngredient('agua'),
        buildIngredient('sal'),
      ];

      const total = estimateMissingIngredientsCost(ingredients);

      // huevo (800) + agua (0) + sal (1500) = 2300
      expect(total).toBe(2300);
    });

    it('26. estimateMissingIngredientsCost soporta modo de consumo prorrateado', () => {
      const ingredients = [
        buildIngredient('sal'),
        buildIngredient('pimienta'),
        buildIngredient('agua'),
      ];

      const totalConsumption = estimateMissingIngredientsCost(ingredients, { mode: 'consumption' });

      // sal (100) + pimienta (150) + agua (0) = 250
      expect(totalConsumption).toBe(250);
    });
  });
});
