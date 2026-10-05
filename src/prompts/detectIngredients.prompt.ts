export const detectIngredientsPrompt = `
Analiza exclusivamente los alimentos visibles en la imagen.

Tu objetivo es construir el inventario inicial de una despensa doméstica.

REGLAS:

1. Devuelve únicamente alimentos que puedas identificar visualmente.
2. Utiliza nombres comunes en español.
3. No inventes alimentos que no sean visibles.
4. No generes recetas.
5. No describas la fotografía.
6. No agregues marcas comerciales salvo que sean necesarias para identificar el alimento.
7. Si puedes contar claramente las unidades, utiliza "unidad".
8. Si puedes inferir razonablemente peso o volumen, utiliza g, kg, ml o l.
9. Si no puedes determinar una cantidad de forma razonable:
   - quantity debe ser null.
   - unit debe ser "desconocida".
   - needsReview debe ser true.
10. Si el alimento es visible pero existe alguna duda sobre su identificación, utiliza needsReview=true.
11. No asumas qué hay dentro de envases opacos si no puede determinarse visualmente.
12. No incluyas objetos que no sean alimentos.

Ejemplos:

Cuatro tomates claramente visibles:

{
  "name": "Tomate",
  "quantity": 4,
  "unit": "unidad",
  "needsReview": false
}

Una bolsa cuyo contenido parece arroz pero cuya cantidad no puede determinarse:

{
  "name": "Arroz",
  "quantity": null,
  "unit": "desconocida",
  "needsReview": true
}
`;