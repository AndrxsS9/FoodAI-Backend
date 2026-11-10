import {
  DEFAULT_LOCALE,
  type SupportedLocale,
} from '../schemas/locale.schema';

export const detectIngredientsPromptEs = `
Analiza exclusivamente los alimentos visibles en la imagen para construir el inventario de una despensa doméstica.

REGLAS:

1. Identifica únicamente alimentos e ingredientes que sean claramente visibles.
2. Utiliza nombres comunes en español (preferiblemente vocabulario culinario común en Colombia y Latinoamérica, ej.: tomate, huevo, arroz, cebolla, papa, aguacate).
3. No inventes alimentos que no aparezcan en la imagen. No asumas la presencia de ingredientes no visibles.
4. No confundas el empaque o envoltorio con el alimento real. Si un empaque es opaco o su contenido exacto es incierto, no inventes el alimento a menos que sea claramente identificable.
5. Estima la cantidad únicamente si existe evidencia visual suficiente:
   - Si puedes contar unidades individuales con claridad, usa la unidad "unidad" (ej.: 3 huevos -> quantity: 3, unit: "unidad", needsReview: false).
   - Si puedes inferir razonablemente peso o volumen a partir de marcas legibles o empaques estándar reconocibles, usa "g", "kg", "ml" o "l".
6. Si la cantidad no puede determinarse con fiabilidad (por ejemplo, granos en un recipiente o bolsa sin gramaje visible, alimentos a granel):
   - quantity DEBE ser null.
   - unit DEBE ser "desconocida".
   - needsReview DEBE ser true.
7. Si el alimento es visible pero existe cualquier incertidumbre en su identificación o cantidad, marca needsReview: true.
8. Unidades permitidas exclusivamente: "unidad", "g", "kg", "ml", "l", "desconocida".
9. No incluyas objetos, platos, utensilios ni empaques vacíos que no sean alimentos.
10. No generes recetas, no describas la escena ni incluyas explicaciones en texto. Retorna exclusivamente los datos estructurados.

Ejemplos:

Tres huevos enteros visibles:
{
  "name": "Huevo",
  "quantity": 3,
  "unit": "unidad",
  "needsReview": false
}

Un tazón con arroz blanco crudo sin peso determinable:
{
  "name": "Arroz",
  "quantity": null,
  "unit": "desconocida",
  "needsReview": true
}
`;

export const detectIngredientsPromptEn = `
Analyze exclusively the visible food items in the image to build a home pantry inventory.

RULES:

1. Identify only food items and ingredients that are clearly visible.
2. Use common food names in English (e.g., tomato, egg, rice, onion, potato, avocado).
3. Do not invent foods that do not appear in the image. Do not assume the presence of invisible ingredients.
4. Do not confuse packaging or wrappers with the actual food. If packaging is opaque or its exact contents are uncertain, do not invent the food unless clearly identifiable.
5. Estimate quantity only when sufficient visual evidence exists:
   - If you can clearly count individual units, use the canonical unit "unidad" (e.g., 3 eggs -> quantity: 3, unit: "unidad", needsReview: false).
   - If you can reasonably infer weight or volume from legible labels or recognizable standard packages, use "g", "kg", "ml", or "l".
6. If quantity cannot be reliably determined (for example, grains in a container or bag without visible weight, bulk food):
   - quantity MUST be null.
   - unit MUST be "desconocida".
   - needsReview MUST be true.
7. If the food item is visible but there is any uncertainty in identification or quantity, mark needsReview: true.
8. Allowed canonical units exclusively: "unidad", "g", "kg", "ml", "l", "desconocida". Never translate these unit identifiers.
9. Do not include objects, plates, utensils, or empty packaging that are not food items.
10. Do not generate recipes, describe the scene, or include explanatory text. Return exclusively the structured data.

Examples:

Three visible whole eggs:
{
  "name": "Egg",
  "quantity": 3,
  "unit": "unidad",
  "needsReview": false
}

A bowl with uncooked white rice without determinable weight:
{
  "name": "Rice",
  "quantity": null,
  "unit": "desconocida",
  "needsReview": true
}
`;

export function buildDetectIngredientsPrompt(
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  if (locale === 'en') {
    return detectIngredientsPromptEn;
  }

  return detectIngredientsPromptEs;
}

export const detectIngredientsPrompt = detectIngredientsPromptEs;
