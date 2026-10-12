# FoodAI Backend

FoodAI es una aplicación móvil orientada a aprovechar los alimentos disponibles en casa, reducir desperdicios y recomendar recetas según la despensa y el presupuesto. Este repositorio contiene el backend HTTP de la aplicación. El backend recibe ingredientes o una imagen, utiliza Gemini para proponer identificaciones y recetas, y aplica lógica propia para estimar costos y ordenar recomendaciones.

## Tecnologías

- Node.js
- TypeScript
- Express
- Zod para validar entradas y respuestas
- Multer para recibir imágenes
- `@google/genai` para integrar Gemini
- Vitest y Supertest para las pruebas

## Instalación y ejecución

Requisitos: Node.js y npm instalados.

```bash
git clone https://github.com/AndrxsS9/FoodAI-Backend.git
cd FoodAI-Backend
npm install
```

Copia `.env.example` a `.env` y configura la clave de Gemini:

```env
GEMINI_API_KEY=tu_clave_de_gemini
PORT=3000
NODE_ENV=development
```

`GEMINI_API_KEY` es obligatoria. `PORT` y `NODE_ENV` tienen valores predeterminados si no se configuran. No compartas ni publiques tu clave.

Inicia el servidor de desarrollo:

```bash
npm run dev
```

Por defecto, la API queda disponible en `http://localhost:3000`.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Ejecuta el servidor en modo desarrollo con recarga. |
| `npm run build` | Compila TypeScript en `dist/`. |
| `npm run start` | Inicia el servidor compilado. |
| `npm run typecheck` | Comprueba los tipos sin generar archivos. |
| `npm test` | Ejecuta las pruebas con Vitest. |
| `npm run test:watch` | Ejecuta Vitest en modo interactivo. |

Después de compilar, `npm run start` inicia el servidor generado.

## API

Las respuestas exitosas usan el formato `{ "success": true, "data": ... }`. Los errores usan `{ "success": false, "error": { "code": "...", "message": "..." } }`; los errores de validación también incluyen `details`.

### `GET /api/health`

Verifica el estado de la API:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "FoodAI Backend",
    "timestamp": "2026-01-01T12:00:00.000Z"
  }
}
```

El `timestamp` se genera en cada solicitud.

### `POST /api/ingredients/analyze`

Analiza una imagen y devuelve los ingredientes detectados. Envía el cuerpo como `multipart/form-data` con el archivo en el campo `image`.

- Formatos MIME aceptados: JPEG (`image/jpeg`), PNG (`image/png`) y WEBP (`image/webp`).
- Tamaño máximo: 8 MB.

Ejemplo:

```bash
curl -X POST http://localhost:3000/api/ingredients/analyze \
  -F "image=@despensa.jpg"
```

Respuesta de ejemplo:

```json
{
  "success": true,
  "data": {
    "ingredients": [
      {
        "name": "tomate",
        "quantity": 4,
        "unit": "unidad",
        "needsReview": false
      },
      {
        "name": "leche",
        "quantity": null,
        "unit": "desconocida",
        "needsReview": true
      }
    ]
  }
}
```

`needsReview` indica que la identificación o la cantidad requiere confirmación. `quantity` puede ser `null` cuando no se puede estimar y `unit` puede ser `"desconocida"`.

### `POST /api/recipes/recommend`

Genera y ordena recomendaciones de recetas. Envía JSON con:

- `pantry`: al menos un ingrediente disponible, cada uno con `name`, `quantity` (número positivo o `null`), `unit` y `needsReview`.
- `budget`: presupuesto no negativo.
- `servings`: número entero de porciones entre 1 y 12.
- `maxMinutes`: límite opcional de tiempo en minutos, entero positivo de hasta 240.

Ejemplo de solicitud:

```json
{
  "pantry": [
    {
      "name": "tomate",
      "quantity": 4,
      "unit": "unidad",
      "needsReview": false
    },
    {
      "name": "arroz",
      "quantity": 500,
      "unit": "g",
      "needsReview": false
    }
  ],
  "budget": 20000,
  "servings": 2,
  "maxMinutes": 45
}
```

Cada receta recomendada incluye sus datos de preparación (`name`, `description`, `totalMinutes`, `ingredients` y `steps`), además de:

- `availableIngredients` y `missingIngredients`;
- `estimatedMissingCost`: costo estimado de los ingredientes faltantes;
- `budgetRemaining` y `withinBudget`;
- `convenience`: puntuación calculada por FoodAI (actualmente de 0 a 95);
- `reason`: explicación generada por las reglas de conveniencia.

La respuesta contiene estas recetas en `data.recipes`.

Gemini propone las recetas candidatas (entre una y cinco). FoodAI calcula de manera determinística, a partir de esas candidatas, qué ingredientes están disponibles o faltan, los costos estimados, el presupuesto restante, si cada receta cabe en el presupuesto, la conveniencia y el orden de las recomendaciones. Las recomendaciones se ordenan por mayor conveniencia, menor costo faltante y menor tiempo de preparación, en ese orden de prioridad. Gemini no calcula estos valores ni determina ese orden.

### `POST /api/meal-plans/generate`

Genera un plan de exactamente tres días a partir de una solicitud JSON con los mismos campos y validaciones que `/api/recipes/recommend` (`pantry`, `budget`, `servings` y `maxMinutes` opcional).

El endpoint reutiliza el motor de recomendaciones y selecciona una combinación de tres recetas candidatas. El `budget` se aplica al costo estimado de ingredientes faltantes del plan completo, no por día. Para esta estimación del MVP, si varias recetas requieren un ingrediente faltante con el mismo nombre normalizado, se cuenta una sola vez.

La respuesta incluye `data.days` con los días 1, 2 y 3, cada uno con su `recipe`, además de `totalEstimatedMissingCost`, `budgetRemaining` y `withinBudget` para el plan completo.

Las combinaciones se seleccionan con estos criterios:

Si hay combinaciones dentro del presupuesto:
1. Mayor conveniencia acumulada.
2. Menor costo estimado total.
3. Menor tiempo total.

Si ninguna combinación entra en el presupuesto:
1. Menor costo estimado total.
2. Mayor conveniencia acumulada.
3. Menor tiempo total.

## Lógica y limitaciones actuales

- Los precios son estimaciones de un catálogo local; no son precios en tiempo real.
- La disponibilidad de ingredientes se determina principalmente por coincidencia de nombres y existencia en la despensa.
- No se controla completamente si las cantidades disponibles alcanzan para cada receta.
- No se descuentan progresivamente los ingredientes usados entre los tres días del plan.
- No hay conversiones avanzadas entre unidades.
- El costo del plan deduplica por nombre los ingredientes faltantes repetidos para estimar una compra del MVP; no suma cantidades de esos ingredientes.
- Las recetas y los análisis dependen de respuestas de Gemini. Este repositorio no afirma que el servicio haya sido validado exitosamente en producción.

## Persistencia

El backend es inicialmente stateless: no persiste despensa, recetas ni planes, y este repositorio no contiene una base de datos SQLite ni una base de datos remota. La persistencia de datos en el dispositivo está prevista para la aplicación móvil mediante Expo SQLite; no forma parte de este backend.

## Estructura del proyecto

```text
src/
  app.ts
  server.ts
  config/
    env.ts
  controllers/
  middlewares/
  prompts/
  routes/
  schemas/
  services/
    gemini/
    plans/
    pricing/
    recipes/
  utils/
tests/
  ingredients.routes.test.ts
  mealPlans.routes.test.ts
  recipes.routes.test.ts
```

- `routes/` conecta las rutas HTTP con sus controladores.
- `controllers/` valida las solicitudes, llama a los servicios y construye las respuestas.
- `schemas/` define las validaciones de entrada y salida con Zod.
- `services/` contiene la integración con Gemini, las recomendaciones, los planes y las estimaciones.
- `prompts/` contiene las instrucciones enviadas a Gemini.
- `middlewares/` configura la carga de imágenes y el manejo de errores.
- `tests/` cubre las rutas de análisis de ingredientes, recomendaciones y planes de comidas.
