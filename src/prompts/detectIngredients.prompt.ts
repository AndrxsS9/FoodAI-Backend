export const detectIngredientsPrompt = `
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