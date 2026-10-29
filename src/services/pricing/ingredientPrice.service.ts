import type {
  RecipeIngredient,
} from '../../schemas/recipe.schema';

import { prepareIngredientName } from '../../utils/ingredientIdentity';

/**
 * ============================================================================
 * POLÍTICA DE ESTIMACIÓN DE PRECIOS PARA INGREDIENTES EN COLOMBIA (FoodAI MVP)
 * ============================================================================
 *
 * 1. ÁMBITO Y MONEDA:
 *    - Todos los precios están expresados en Pesos Colombianos (COP).
 *    - Reflejan el costo minorista representativo para el consumidor habitual en
 *      ciudades principales de Colombia (canasta básica en tiendas D1, Ara,
 *      Éxito y plazas mayoristas de abastecimiento como Corabastos).
 *
 * 2. DISTINCIÓN ENTRE COSTO DE COMPRA Y COSTO DE CONSUMO:
 *    - estimatedPurchasePrice:
 *      Costo de adquirir la unidad comercial mínima común en el mercado colombiano
 *      (paquete de 500g/1kg, botella de aceite, sobre de especias, atado de verduras).
 *      Este es el costo predeterminado para planificar compras y evaluar presupuesto.
 *    - estimatedConsumptionPrice:
 *      Costo prorrateado del uso real del ingrediente en una preparación típica casera
 *      de 2 a 4 porciones (ej. 2 cucharadas de aceite, 1 pizca de sal, 2 dientes de ajo).
 *
 * 3. POLÍTICA PARA EL AGUA DE COCINA:
 *    - El agua corriente potable (de la llave / grifo) para cocción, hervor o dilución
 *      se valora en $0 COP en el contexto de recetas caseras. No se considera una
 *      compra faltante onerosa.
 *
 * 4. BÁSICOS DE DESPENSA (Sal, Aceite, Especias, Azúcar):
 *    - No se asume tácitamente que el usuario posee sal, aceite u otros básicos.
 *      Si no están en la despensa del usuario, el sistema los reporta en
 *      `missingIngredients`.
 *    - Sus costos de compra corresponden a formatos comerciales económicos accesibles
 *      en Colombia (sobres individuales de especias a $1.000-$1.200 COP, bolsa de sal
 *      a $1.500 COP, botella de aceite a $7.000 COP).
 *    - Sus costos de consumo son fraccionales ($100 a $500 COP).
 *
 * 5. FUENTES DE PRECIOS (Transparencia):
 *    - market_verified: Referenciado y cotejado con precios públicos de cadenas de
 *      descuento duro y supermercados de cadena en Colombia.
 *    - reference_estimate: Estimación representativa calculada para insumos con alta
 *      variabilidad estacional o de plaza local (hojas verdes, tubérculos regionales).
 *
 * 6. FALLBACK PARA INGREDIENTES DESCONOCIDOS:
 *    - Si un ingrediente no figura en el catálogo ni en los alias culinarios,
 *      se aplica un valor conservador de $5.000 COP en compra y $2.000 COP en consumo.
 * ============================================================================
 */

export type IngredientCategory =
  | 'produce'
  | 'protein'
  | 'dairy'
  | 'grain_pasta'
  | 'pantry_staple'
  | 'legume'
  | 'spice_seasoning'
  | 'condiment'
  | 'fruit';

export type PriceSource = 'market_verified' | 'reference_estimate';

export interface PriceRule {
  id: string;
  canonicalName: string;
  aliases: string[];
  category: IngredientCategory;
  estimatedPurchasePrice: number;
  estimatedConsumptionPrice: number;
  priceSource: PriceSource;
  unitDescription: string;
  notes?: string;
}

export type PricingEstimationMode = 'purchase' | 'consumption';

export interface PriceEstimationOptions {
  mode?: PricingEstimationMode;
}

export const UNKNOWN_INGREDIENT_ESTIMATED_COST = 5000;
export const UNKNOWN_INGREDIENT_CONSUMPTION_COST = 2000;

export const ingredientPriceCatalog: PriceRule[] = [
  /* ---------------- PRODUCE & VEGETALES BÁSICOS (1-18) ---------------- */
  {
    id: 'tomate',
    canonicalName: 'tomate',
    aliases: ['tomate', 'tomates', 'tomate rojo', 'tomate chonto', 'tomate de alino', 'jitomate'],
    category: 'produce',
    estimatedPurchasePrice: 1500,
    estimatedConsumptionPrice: 750,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 500g o 3-4 unidades de tomate chonto',
  },
  {
    id: 'cebolla',
    canonicalName: 'cebolla',
    aliases: ['cebolla', 'cebolla cabezona', 'cebolla blanca', 'cebolla roja'],
    category: 'produce',
    estimatedPurchasePrice: 1500,
    estimatedConsumptionPrice: 750,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 500g o 2-3 unidades medianas',
  },
  {
    id: 'cebolla_larga',
    canonicalName: 'cebolla larga',
    aliases: ['cebolla larga', 'cebolla de rama', 'cebolla junca', 'cebollas de rama', 'cebollas largas'],
    category: 'produce',
    estimatedPurchasePrice: 2000,
    estimatedConsumptionPrice: 600,
    priceSource: 'market_verified',
    unitDescription: 'Atado de cebolla junca (aprox. 300g)',
  },
  {
    id: 'papa',
    canonicalName: 'papa',
    aliases: ['papa', 'papas', 'patata', 'patatas', 'papa pastusa', 'papa sabanera'],
    category: 'produce',
    estimatedPurchasePrice: 2500,
    estimatedConsumptionPrice: 1500,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 1 kg de papa común lavada',
  },
  {
    id: 'papa_criolla',
    canonicalName: 'papa criolla',
    aliases: ['papa criolla', 'papas criollas', 'papa amarilla'],
    category: 'produce',
    estimatedPurchasePrice: 3000,
    estimatedConsumptionPrice: 1800,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 500g de papa criolla seleccionada',
  },
  {
    id: 'zanahoria',
    canonicalName: 'zanahoria',
    aliases: ['zanahoria', 'zanahorias'],
    category: 'produce',
    estimatedPurchasePrice: 1500,
    estimatedConsumptionPrice: 750,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 500g de zanahoria lavada',
  },
  {
    id: 'ajo',
    canonicalName: 'ajo',
    aliases: ['ajo', 'diente de ajo', 'dientes de ajo', 'cabeza de ajo'],
    category: 'produce',
    estimatedPurchasePrice: 1000,
    estimatedConsumptionPrice: 300,
    priceSource: 'market_verified',
    unitDescription: 'Malla con 2-3 cabezas de ajo',
  },
  {
    id: 'platano',
    canonicalName: 'platano',
    aliases: ['platano', 'plátano', 'platano maduro', 'platano verde', 'platano harton', 'platanos'],
    category: 'produce',
    estimatedPurchasePrice: 2000,
    estimatedConsumptionPrice: 1000,
    priceSource: 'market_verified',
    unitDescription: '1 plátano hartón grande (verde o maduro)',
  },
  {
    id: 'yuca',
    canonicalName: 'yuca',
    aliases: ['yuca', 'mandioca'],
    category: 'produce',
    estimatedPurchasePrice: 2500,
    estimatedConsumptionPrice: 1500,
    priceSource: 'market_verified',
    unitDescription: 'Porción 500g de yuca parafinada o fresca',
  },
  {
    id: 'aguacate',
    canonicalName: 'aguacate',
    aliases: ['aguacate', 'palta', 'aguacate hass', 'aguacate criollo', 'aguacates', 'paltas'],
    category: 'produce',
    estimatedPurchasePrice: 3500,
    estimatedConsumptionPrice: 2000,
    priceSource: 'market_verified',
    unitDescription: '1 aguacate mediano para ensalada o acompañamiento',
  },
  {
    id: 'maiz',
    canonicalName: 'maiz',
    aliases: ['maiz', 'choclo', 'mazorca', 'maiz tierno', 'elote'],
    category: 'produce',
    estimatedPurchasePrice: 2500,
    estimatedConsumptionPrice: 1500,
    priceSource: 'market_verified',
    unitDescription: 'Bandeja con 2 mazorcas tiernas o lata de maíz tierno',
  },
  {
    id: 'pimenton',
    canonicalName: 'pimenton',
    aliases: ['pimenton', 'pimentón', 'pimiento', 'pimiento rojo', 'pimiento verde', 'pimientos'],
    category: 'produce',
    estimatedPurchasePrice: 2000,
    estimatedConsumptionPrice: 1000,
    priceSource: 'market_verified',
    unitDescription: '1 pimentón rojo o verde mediano',
  },
  {
    id: 'lechuga',
    canonicalName: 'lechuga',
    aliases: ['lechuga', 'lechuga crespa', 'lechuga batavia'],
    category: 'produce',
    estimatedPurchasePrice: 2000,
    estimatedConsumptionPrice: 1000,
    priceSource: 'reference_estimate',
    unitDescription: '1 cogollo de lechuga crespa o batavia',
  },
  {
    id: 'espinaca',
    canonicalName: 'espinaca',
    aliases: ['espinaca', 'espinacas'],
    category: 'produce',
    estimatedPurchasePrice: 2000,
    estimatedConsumptionPrice: 1000,
    priceSource: 'reference_estimate',
    unitDescription: 'Atado de espinaca fresca (aprox. 300g)',
  },
  {
    id: 'repollo',
    canonicalName: 'repollo',
    aliases: ['repollo', 'repollo blanco', 'repollo morado', 'col'],
    category: 'produce',
    estimatedPurchasePrice: 2500,
    estimatedConsumptionPrice: 1000,
    priceSource: 'reference_estimate',
    unitDescription: 'Medio repollo o unidad pequeña',
  },
  {
    id: 'apio',
    canonicalName: 'apio',
    aliases: ['apio', 'rama de apio', 'apio espana'],
    category: 'produce',
    estimatedPurchasePrice: 1500,
    estimatedConsumptionPrice: 700,
    priceSource: 'reference_estimate',
    unitDescription: 'Manojo de ramas de apio',
  },
  {
    id: 'pepino',
    canonicalName: 'pepino',
    aliases: ['pepino', 'pepino cohombro', 'pepinos'],
    category: 'produce',
    estimatedPurchasePrice: 1500,
    estimatedConsumptionPrice: 800,
    priceSource: 'market_verified',
    unitDescription: '1 pepino cohombro grande',
  },
  {
    id: 'calabacin',
    canonicalName: 'calabacin',
    aliases: ['calabacin', 'calabacín', 'zucchini', 'calabacines'],
    category: 'produce',
    estimatedPurchasePrice: 2000,
    estimatedConsumptionPrice: 1000,
    priceSource: 'reference_estimate',
    unitDescription: '1 calabacín verde mediano',
  },
  {
    id: 'auyama',
    canonicalName: 'auyama',
    aliases: ['auyama', 'ahuyama', 'calabaza'],
    category: 'produce',
    estimatedPurchasePrice: 2000,
    estimatedConsumptionPrice: 1000,
    priceSource: 'reference_estimate',
    unitDescription: 'Trozo de 500g de auyama para sopa o puré',
  },
  {
    id: 'champinon',
    canonicalName: 'champinon',
    aliases: ['champinon', 'champiñón', 'champinones', 'champiñones', 'setas'],
    category: 'produce',
    estimatedPurchasePrice: 4500,
    estimatedConsumptionPrice: 3000,
    priceSource: 'market_verified',
    unitDescription: 'Bandeja 200g de champiñón entero o tajado',
  },
  {
    id: 'habichuela',
    canonicalName: 'habichuela',
    aliases: ['habichuela', 'habichuelas'],
    category: 'produce',
    estimatedPurchasePrice: 2000,
    estimatedConsumptionPrice: 1000,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 500g de habichuela fresca',
  },
  {
    id: 'remolacha',
    canonicalName: 'remolacha',
    aliases: ['remolacha', 'remolachas', 'betabel'],
    category: 'produce',
    estimatedPurchasePrice: 2000,
    estimatedConsumptionPrice: 1000,
    priceSource: 'reference_estimate',
    unitDescription: 'Atado de 3 remolachas',
  },

  /* ---------------- PROTEÍNAS & HUEVOS (19-27) ---------------- */
  {
    id: 'huevo',
    canonicalName: 'huevo',
    aliases: ['huevo', 'huevos'],
    category: 'protein',
    estimatedPurchasePrice: 800,
    estimatedConsumptionPrice: 800,
    priceSource: 'market_verified',
    unitDescription: '1 huevo tipo AA o unidad individual de compra de barrio',
  },
  {
    id: 'pollo',
    canonicalName: 'pollo',
    aliases: ['pollo', 'pechuga de pollo', 'muslo de pollo', 'pollo entero', 'presa de pollo'],
    category: 'protein',
    estimatedPurchasePrice: 9000,
    estimatedConsumptionPrice: 6000,
    priceSource: 'market_verified',
    unitDescription: 'Bandeja pechuga o pierna pernil (aprox. 500g)',
  },
  {
    id: 'carne',
    canonicalName: 'carne',
    aliases: ['carne', 'carne de res', 'carne molida', 'lomo de res', 'bistec'],
    category: 'protein',
    estimatedPurchasePrice: 12000,
    estimatedConsumptionPrice: 8000,
    priceSource: 'market_verified',
    unitDescription: 'Libra (500g) de carne de res magra o molida',
  },
  {
    id: 'cerdo',
    canonicalName: 'cerdo',
    aliases: ['cerdo', 'carne de cerdo', 'pulpa de cerdo', 'chuleta de cerdo', 'costilla de cerdo'],
    category: 'protein',
    estimatedPurchasePrice: 11000,
    estimatedConsumptionPrice: 7500,
    priceSource: 'market_verified',
    unitDescription: 'Libra (500g) de pulpa o chuleta de cerdo',
  },
  {
    id: 'atun',
    canonicalName: 'atun',
    aliases: ['atun', 'atún', 'atun en lata', 'atun en agua', 'atun en aceite'],
    category: 'protein',
    estimatedPurchasePrice: 5500,
    estimatedConsumptionPrice: 5500,
    priceSource: 'market_verified',
    unitDescription: 'Lata de atún 140g o lomitos en agua/aceite',
  },
  {
    id: 'pescado',
    canonicalName: 'pescado',
    aliases: ['pescado', 'filete de pescado', 'mojarra', 'tilapia', 'bagre'],
    category: 'protein',
    estimatedPurchasePrice: 10000,
    estimatedConsumptionPrice: 7000,
    priceSource: 'market_verified',
    unitDescription: 'Bandeja 400g de filete de tilapia o pescado blanco',
  },
  {
    id: 'tocineta',
    canonicalName: 'tocineta',
    aliases: ['tocineta', 'tocino', 'panceta'],
    category: 'protein',
    estimatedPurchasePrice: 7000,
    estimatedConsumptionPrice: 3500,
    priceSource: 'market_verified',
    unitDescription: 'Paquete de tocineta ahumada 200g',
  },
  {
    id: 'salchicha',
    canonicalName: 'salchicha',
    aliases: ['salchicha', 'salchichas', 'salchicha manguera'],
    category: 'protein',
    estimatedPurchasePrice: 4500,
    estimatedConsumptionPrice: 2500,
    priceSource: 'market_verified',
    unitDescription: 'Paquete de 6-8 salchichas tradicionales',
  },
  {
    id: 'chorizo',
    canonicalName: 'chorizo',
    aliases: ['chorizo', 'chorizos', 'chorizo antioqueno', 'chorizo campesino'],
    category: 'protein',
    estimatedPurchasePrice: 6000,
    estimatedConsumptionPrice: 3000,
    priceSource: 'market_verified',
    unitDescription: 'Paquete de 3-4 chorizos campesinos',
  },

  /* ---------------- LÁCTEOS & DERIVADOS (28-33) ---------------- */
  {
    id: 'leche',
    canonicalName: 'leche',
    aliases: ['leche', 'leche entera', 'leche deslactosada'],
    category: 'dairy',
    estimatedPurchasePrice: 4500,
    estimatedConsumptionPrice: 1500,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa de leche 900ml / 1 litro',
  },
  {
    id: 'queso',
    canonicalName: 'queso',
    aliases: ['queso', 'queso campesino', 'queso mozzarella', 'queso costeno', 'quesito'],
    category: 'dairy',
    estimatedPurchasePrice: 6500,
    estimatedConsumptionPrice: 3000,
    priceSource: 'market_verified',
    unitDescription: 'Bloque 250g-300g de queso campesino o mozzarella',
  },
  {
    id: 'mantequilla',
    canonicalName: 'mantequilla',
    aliases: ['mantequilla', 'manteca'],
    category: 'dairy',
    estimatedPurchasePrice: 4500,
    estimatedConsumptionPrice: 1200,
    priceSource: 'market_verified',
    unitDescription: 'Barra de mantequilla 250g',
  },
  {
    id: 'margarina',
    canonicalName: 'margarina',
    aliases: ['margarina'],
    category: 'dairy',
    estimatedPurchasePrice: 3000,
    estimatedConsumptionPrice: 800,
    priceSource: 'market_verified',
    unitDescription: 'Tarrina 250g de margarina vegetal',
  },
  {
    id: 'crema_leche',
    canonicalName: 'crema de leche',
    aliases: ['crema de leche', 'nata'],
    category: 'dairy',
    estimatedPurchasePrice: 3500,
    estimatedConsumptionPrice: 2000,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 200g de crema de leche',
  },
  {
    id: 'suero_costeno',
    canonicalName: 'suero costeno',
    aliases: ['suero costeno', 'suero costeño', 'suero atollabuey', 'suero'],
    category: 'dairy',
    estimatedPurchasePrice: 4000,
    estimatedConsumptionPrice: 1500,
    priceSource: 'reference_estimate',
    unitDescription: 'Vaso o tarrina 200g de suero costeño',
  },

  /* ---------------- GRANOS, CEREALES & HARINAS (34-43) ---------------- */
  {
    id: 'arroz',
    canonicalName: 'arroz',
    aliases: ['arroz', 'arroz blanco'],
    category: 'grain_pasta',
    estimatedPurchasePrice: 3500,
    estimatedConsumptionPrice: 1200,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 1 kg de arroz blanco',
  },
  {
    id: 'pasta',
    canonicalName: 'pasta',
    aliases: ['pasta', 'espagueti', 'spaghetti', 'macarrones', 'fideos'],
    category: 'grain_pasta',
    estimatedPurchasePrice: 3500,
    estimatedConsumptionPrice: 1500,
    priceSource: 'market_verified',
    unitDescription: 'Paquete 500g de pasta o espaguetis',
  },
  {
    id: 'harina_trigo',
    canonicalName: 'harina',
    aliases: ['harina', 'harina de trigo'],
    category: 'grain_pasta',
    estimatedPurchasePrice: 3500,
    estimatedConsumptionPrice: 1000,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 1 kg de harina de trigo tradicional',
  },
  {
    id: 'harina_maiz',
    canonicalName: 'harina de maiz',
    aliases: ['harina de maiz', 'harina de maíz', 'harina pan', 'masarepa', 'harina promasa'],
    category: 'grain_pasta',
    estimatedPurchasePrice: 4000,
    estimatedConsumptionPrice: 1500,
    priceSource: 'market_verified',
    unitDescription: 'Paquete 1 kg de harina precocida de maíz para arepas',
  },
  {
    id: 'avena',
    canonicalName: 'avena',
    aliases: ['avena', 'avena en hojuelas', 'avena molida'],
    category: 'grain_pasta',
    estimatedPurchasePrice: 3000,
    estimatedConsumptionPrice: 1000,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 400g de avena en hojuelas',
  },
  {
    id: 'pan',
    canonicalName: 'pan',
    aliases: ['pan', 'pan tajado', 'pan de molde', 'pan frances'],
    category: 'grain_pasta',
    estimatedPurchasePrice: 3500,
    estimatedConsumptionPrice: 1200,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa de pan tajado 400g o 4 panes de panadería',
  },
  {
    id: 'arepa',
    canonicalName: 'arepa',
    aliases: ['arepa', 'arepas', 'arepa de maiz', 'arepas blancas'],
    category: 'grain_pasta',
    estimatedPurchasePrice: 3000,
    estimatedConsumptionPrice: 1500,
    priceSource: 'market_verified',
    unitDescription: 'Paquete de 5 arepas de tela o maíz',
  },
  {
    id: 'frijol',
    canonicalName: 'frijol',
    aliases: ['frijol', 'frijoles', 'fríjol', 'frijol cargamanto', 'frijol rojo', 'frijol negro'],
    category: 'legume',
    estimatedPurchasePrice: 5000,
    estimatedConsumptionPrice: 2500,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 500g de frijol seco cargamanto o rojo',
  },
  {
    id: 'lenteja',
    canonicalName: 'lenteja',
    aliases: ['lenteja', 'lentejas'],
    category: 'legume',
    estimatedPurchasePrice: 4000,
    estimatedConsumptionPrice: 2000,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 500g de lenteja importada',
  },
  {
    id: 'garbanzo',
    canonicalName: 'garbanzo',
    aliases: ['garbanzo', 'garbanzos'],
    category: 'legume',
    estimatedPurchasePrice: 4500,
    estimatedConsumptionPrice: 2200,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 500g de garbanzo seco',
  },
  {
    id: 'arveja',
    canonicalName: 'arveja',
    aliases: ['arveja', 'arvejas', 'guisantes', 'arveja verde', 'arveja seca'],
    category: 'legume',
    estimatedPurchasePrice: 2500,
    estimatedConsumptionPrice: 1200,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 500g de arveja seca o fresca',
  },

  /* ---------------- BÁSICOS DE DESPENSA, ACEITES & AGUA (44-51) ---------------- */
  {
    id: 'agua',
    canonicalName: 'agua',
    aliases: [
      'agua',
      'agua del grifo',
      'agua de la llave',
      'agua fria',
      'agua tibia',
      'agua caliente',
      'agua potable',
      'agua hervida',
      'agua corriente',
    ],
    category: 'pantry_staple',
    estimatedPurchasePrice: 0,
    estimatedConsumptionPrice: 0,
    priceSource: 'market_verified',
    unitDescription: 'Agua potable de red doméstica (consumo ordinario de cocina)',
    notes: 'Política de costo cero en cocina casera; no genera costo de compra adicional.',
  },
  {
    id: 'sal',
    canonicalName: 'sal',
    aliases: ['sal', 'sal marina', 'sal de cocina', 'sal fina', 'sal yodada'],
    category: 'pantry_staple',
    estimatedPurchasePrice: 1500,
    estimatedConsumptionPrice: 100,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 1 kg de sal refinada de cocina',
  },
  {
    id: 'aceite',
    canonicalName: 'aceite',
    aliases: ['aceite', 'aceite vegetal', 'aceite de cocina', 'aceite de girasol', 'aceite de soya', 'aceite de maiz'],
    category: 'pantry_staple',
    estimatedPurchasePrice: 7000,
    estimatedConsumptionPrice: 500,
    priceSource: 'market_verified',
    unitDescription: 'Botella de aceite vegetal 500ml-900ml',
  },
  {
    id: 'azucar',
    canonicalName: 'azucar',
    aliases: ['azucar', 'azúcar', 'azucar blanca', 'azucar morena'],
    category: 'pantry_staple',
    estimatedPurchasePrice: 3500,
    estimatedConsumptionPrice: 500,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 1 kg de azúcar blanca o morena',
  },
  {
    id: 'panela',
    canonicalName: 'panela',
    aliases: ['panela', 'papelon', 'piloncillo', 'panela raspada'],
    category: 'pantry_staple',
    estimatedPurchasePrice: 2500,
    estimatedConsumptionPrice: 800,
    priceSource: 'market_verified',
    unitDescription: 'Unidad de panela cuadrada o redonda (aprox. 500g)',
  },
  {
    id: 'cafe',
    canonicalName: 'cafe',
    aliases: ['cafe', 'café', 'cafe molido', 'cafe instantaneo'],
    category: 'pantry_staple',
    estimatedPurchasePrice: 6000,
    estimatedConsumptionPrice: 600,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa 250g de café molido tradicional',
  },
  {
    id: 'chocolate',
    canonicalName: 'chocolate',
    aliases: ['chocolate', 'chocolate de mesa', 'pastilla de chocolate'],
    category: 'pantry_staple',
    estimatedPurchasePrice: 4500,
    estimatedConsumptionPrice: 1500,
    priceSource: 'market_verified',
    unitDescription: 'Paquete de pastillas de chocolate para hervir (aprox. 250g)',
  },
  {
    id: 'hogao',
    canonicalName: 'hogao',
    aliases: ['hogao', 'guiso', 'guiso colombiano'],
    category: 'pantry_staple',
    estimatedPurchasePrice: 2500,
    estimatedConsumptionPrice: 1500,
    priceSource: 'reference_estimate',
    unitDescription: 'Porción preparada de sofrito tradicional (cebolla + tomate + aliños)',
  },

  /* ---------------- ESPECIAS & HIERBAS AROMÁTICAS (52-61) ---------------- */
  {
    id: 'pimienta',
    canonicalName: 'pimienta',
    aliases: ['pimienta', 'pimienta negra', 'pimienta molida', 'pimienta blanca'],
    category: 'spice_seasoning',
    estimatedPurchasePrice: 1200,
    estimatedConsumptionPrice: 150,
    priceSource: 'market_verified',
    unitDescription: 'Sobre comercial de pimienta molida (aprox. 20g-30g)',
  },
  {
    id: 'comino',
    canonicalName: 'comino',
    aliases: ['comino', 'comino molido', 'cominos'],
    category: 'spice_seasoning',
    estimatedPurchasePrice: 1200,
    estimatedConsumptionPrice: 150,
    priceSource: 'market_verified',
    unitDescription: 'Sobre comercial de comino molido (aprox. 25g)',
  },
  {
    id: 'color',
    canonicalName: 'color',
    aliases: ['color', 'achiote', 'triguisar', 'condimento color', 'color vegetal'],
    category: 'spice_seasoning',
    estimatedPurchasePrice: 1000,
    estimatedConsumptionPrice: 150,
    priceSource: 'market_verified',
    unitDescription: 'Sobre comercial de condimento con color o achiote',
  },
  {
    id: 'laurel',
    canonicalName: 'laurel',
    aliases: ['laurel', 'hojas de laurel', 'hoja de laurel'],
    category: 'spice_seasoning',
    estimatedPurchasePrice: 1000,
    estimatedConsumptionPrice: 150,
    priceSource: 'market_verified',
    unitDescription: 'Sobre con hojas secas de laurel',
  },
  {
    id: 'tomillo',
    canonicalName: 'tomillo',
    aliases: ['tomillo', 'tomillo seco', 'tomillo fresco'],
    category: 'spice_seasoning',
    estimatedPurchasePrice: 1000,
    estimatedConsumptionPrice: 150,
    priceSource: 'market_verified',
    unitDescription: 'Sobre con tomillo seco o manojito fresco',
  },
  {
    id: 'oregano',
    canonicalName: 'oregano',
    aliases: ['oregano', 'orégano', 'oregano seco', 'oregano molido'],
    category: 'spice_seasoning',
    estimatedPurchasePrice: 1200,
    estimatedConsumptionPrice: 150,
    priceSource: 'market_verified',
    unitDescription: 'Sobre con orégano seco seleccionado',
  },
  {
    id: 'cilantro',
    canonicalName: 'cilantro',
    aliases: ['cilantro', 'culantro', 'coriandro'],
    category: 'spice_seasoning',
    estimatedPurchasePrice: 1000,
    estimatedConsumptionPrice: 500,
    priceSource: 'market_verified',
    unitDescription: 'Manojo de cilantro fresco de tienda de barrio o plaza',
  },
  {
    id: 'perejil',
    canonicalName: 'perejil',
    aliases: ['perejil', 'perejil liso', 'perejil crespo'],
    category: 'spice_seasoning',
    estimatedPurchasePrice: 1000,
    estimatedConsumptionPrice: 500,
    priceSource: 'market_verified',
    unitDescription: 'Manojo de perejil fresco',
  },
  {
    id: 'canela',
    canonicalName: 'canela',
    aliases: ['canela', 'canela en astillas', 'canela en polvo'],
    category: 'spice_seasoning',
    estimatedPurchasePrice: 1500,
    estimatedConsumptionPrice: 300,
    priceSource: 'market_verified',
    unitDescription: 'Sobre con astillas o polvo de canela',
  },
  {
    id: 'clavo',
    canonicalName: 'clavo',
    aliases: ['clavo', 'clavos', 'clavos de olor', 'clavo de olor'],
    category: 'spice_seasoning',
    estimatedPurchasePrice: 1200,
    estimatedConsumptionPrice: 200,
    priceSource: 'market_verified',
    unitDescription: 'Sobre con clavos de olor aromáticos',
  },

  /* ---------------- CONDIMENTOS & SALSAS (62-66) ---------------- */
  {
    id: 'mayonesa',
    canonicalName: 'mayonesa',
    aliases: ['mayonesa'],
    category: 'condiment',
    estimatedPurchasePrice: 4500,
    estimatedConsumptionPrice: 800,
    priceSource: 'market_verified',
    unitDescription: 'Doypack 200g de mayonesa tradicional',
  },
  {
    id: 'salsa_tomate',
    canonicalName: 'salsa de tomate',
    aliases: ['salsa de tomate', 'ketchup', 'catsup'],
    category: 'condiment',
    estimatedPurchasePrice: 3500,
    estimatedConsumptionPrice: 800,
    priceSource: 'market_verified',
    unitDescription: 'Doypack 200g de salsa de tomate',
  },
  {
    id: 'mostaza',
    canonicalName: 'mostaza',
    aliases: ['mostaza'],
    category: 'condiment',
    estimatedPurchasePrice: 3000,
    estimatedConsumptionPrice: 600,
    priceSource: 'market_verified',
    unitDescription: 'Doypack 200g de mostaza',
  },
  {
    id: 'salsa_soya',
    canonicalName: 'salsa negra',
    aliases: ['salsa negra', 'salsa de soya', 'salsa de soja', 'salsa inglesa'],
    category: 'condiment',
    estimatedPurchasePrice: 3000,
    estimatedConsumptionPrice: 600,
    priceSource: 'market_verified',
    unitDescription: 'Frasco 150ml de salsa negra o de soya',
  },
  {
    id: 'vinagre',
    canonicalName: 'vinagre',
    aliases: ['vinagre', 'vinagre blanco', 'vinagre de manzana'],
    category: 'condiment',
    estimatedPurchasePrice: 2500,
    estimatedConsumptionPrice: 400,
    priceSource: 'market_verified',
    unitDescription: 'Botella 500ml de vinagre blanco de cocina',
  },

  /* ---------------- FRUTAS CULINARIAS COLOMBIANAS (67-73) ---------------- */
  {
    id: 'limon',
    canonicalName: 'limon',
    aliases: ['limon', 'limón', 'limon tahiti', 'limon mandarina', 'limones'],
    category: 'fruit',
    estimatedPurchasePrice: 1200,
    estimatedConsumptionPrice: 600,
    priceSource: 'market_verified',
    unitDescription: 'Bolsa pequeña o 2 limones tahití',
  },
  {
    id: 'guayaba',
    canonicalName: 'guayaba',
    aliases: ['guayaba', 'guayabas', 'pulpa de guayaba'],
    category: 'fruit',
    estimatedPurchasePrice: 2500,
    estimatedConsumptionPrice: 1200,
    priceSource: 'reference_estimate',
    unitDescription: 'Bolsa 500g de guayabas maduras',
  },
  {
    id: 'maracuya',
    canonicalName: 'maracuya',
    aliases: ['maracuya', 'maracuyá', 'parchita', 'fruta de la pasion'],
    category: 'fruit',
    estimatedPurchasePrice: 3000,
    estimatedConsumptionPrice: 1500,
    priceSource: 'reference_estimate',
    unitDescription: 'Bolsa con 2-3 maracuyás medianas',
  },
  {
    id: 'lulo',
    canonicalName: 'lulo',
    aliases: ['lulo', 'lulos', 'pulpa de lulo'],
    category: 'fruit',
    estimatedPurchasePrice: 3500,
    estimatedConsumptionPrice: 1800,
    priceSource: 'reference_estimate',
    unitDescription: 'Bolsa con 3 lulos grandes para jugo',
  },
  {
    id: 'mora',
    canonicalName: 'mora',
    aliases: ['mora', 'moras', 'pulpa de mora'],
    category: 'fruit',
    estimatedPurchasePrice: 3000,
    estimatedConsumptionPrice: 1500,
    priceSource: 'reference_estimate',
    unitDescription: 'Bandeja o bolsa 300g de mora de castilla',
  },
  {
    id: 'banano',
    canonicalName: 'banano',
    aliases: ['banano', 'bananos', 'banana', 'guineo'],
    category: 'fruit',
    estimatedPurchasePrice: 2000,
    estimatedConsumptionPrice: 1000,
    priceSource: 'market_verified',
    unitDescription: 'Gajo de 3-4 bananos criollos',
  },
  {
    id: 'manzana',
    canonicalName: 'manzana',
    aliases: ['manzana', 'manzanas', 'manzana roja', 'manzana verde'],
    category: 'fruit',
    estimatedPurchasePrice: 3000,
    estimatedConsumptionPrice: 1500,
    priceSource: 'market_verified',
    unitDescription: '2 unidades de manzana para ensaladas o postres',
  },
];

function tokenize(text: string): string[] {
  if (!text) {
    return [];
  }
  return text.split(' ').filter((token) => token.length > 0);
}

function containsContiguousPhrase(
  haystack: string[],
  needle: string[],
): boolean {
  if (needle.length === 0 || needle.length > haystack.length) {
    return false;
  }

  return haystack.some((_, startIndex) => {
    if (startIndex + needle.length > haystack.length) {
      return false;
    }

    return needle.every(
      (needleToken, offset) => haystack[startIndex + offset] === needleToken,
    );
  });
}

export function findPriceRule(
  ingredientName: string,
): PriceRule | undefined {
  const preparedName = prepareIngredientName(ingredientName);

  if (!preparedName) {
    return undefined;
  }

  // 1. Coincidencia exacta directa con canonicalName o aliases
  const exactMatch = ingredientPriceCatalog.find(
    (rule) =>
      prepareIngredientName(rule.canonicalName) === preparedName ||
      rule.aliases.some(
        (alias) => prepareIngredientName(alias) === preparedName,
      ),
  );

  if (exactMatch) {
    return exactMatch;
  }

  // 2. Coincidencia por frase contigua de palabras completas
  //    Prioriza coincidencias de alias más largos para evitar falsos positivos
  //    (ej. "salsa de tomate" antes de "tomate", "cebolla larga" antes de "cebolla").
  const inputTokens = tokenize(preparedName);

  if (inputTokens.length === 0) {
    return undefined;
  }

  type Candidate = {
    rule: PriceRule;
    matchTokensCount: number;
  };

  const candidates: Candidate[] = [];

  for (const rule of ingredientPriceCatalog) {
    for (const alias of rule.aliases) {
      const aliasPrepared = prepareIngredientName(alias);
      const aliasTokens = tokenize(aliasPrepared);

      if (aliasTokens.length === 0) {
        continue;
      }

      const inputContainsAlias = containsContiguousPhrase(
        inputTokens,
        aliasTokens,
      );

      const aliasContainsInput = containsContiguousPhrase(
        aliasTokens,
        inputTokens,
      );

      if (inputContainsAlias || aliasContainsInput) {
        candidates.push({
          rule,
          matchTokensCount: aliasTokens.length,
        });
      }
    }
  }

  if (candidates.length === 0) {
    return undefined;
  }

  // Ordenar candidatos por longitud de coincidencia descendente
  candidates.sort((a, b) => b.matchTokensCount - a.matchTokensCount);

  return candidates[0].rule;
}

export function getIngredientPriceDetails(
  ingredientName: string,
): PriceRule | undefined {
  return findPriceRule(ingredientName);
}

export function estimateIngredientCost(
  ingredient: RecipeIngredient,
  options?: PriceEstimationOptions,
): number {
  const mode = options?.mode ?? 'purchase';
  const rule = findPriceRule(ingredient.name);

  if (!rule) {
    return mode === 'consumption'
      ? UNKNOWN_INGREDIENT_CONSUMPTION_COST
      : UNKNOWN_INGREDIENT_ESTIMATED_COST;
  }

  return mode === 'consumption'
    ? rule.estimatedConsumptionPrice
    : rule.estimatedPurchasePrice;
}

export function estimateMissingIngredientsCost(
  ingredients: RecipeIngredient[],
  options?: PriceEstimationOptions,
): number {
  return ingredients.reduce(
    (total, ingredient) =>
      total + estimateIngredientCost(ingredient, options),
    0,
  );
}
