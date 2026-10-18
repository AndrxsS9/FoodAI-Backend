# FoodAI Backend

FoodAI es una aplicación orientada a aprovechar los alimentos disponibles en casa, reducir el desperdicio de comida y recomendar recetas personalizadas según la despensa y el presupuesto del usuario. Este repositorio contiene la API REST backend desarrollada en Node.js y Express con TypeScript.

El backend recibe los ingredientes disponibles (de forma manual o extraídos desde una fotografía), consulta al modelo Gemini para sugerir recetas y planes de alimentación, y ejecuta lógica propia determinista para normalizar ingredientes, comparar suficiencia de cantidades, estimar costos en pesos colombianos (COP), calcular conveniencia y ordenar las mejores opciones.

---

## Tecnologías Principales

- **Entorno de ejecución:** Node.js (>= 20)
- **Lenguaje:** TypeScript
- **Framework web:** Express 5
- **Seguridad y protección:** Helmet, CORS y `express-rate-limit`
- **Validación de esquemas:** Zod
- **Procesamiento de archivos:** Multer (almacenamiento en memoria para imágenes)
- **Inteligencia Artificial:** SDK oficial `@google/genai` (`gemini-3.8-flash`)
- **Pruebas automatizadas:** Vitest y Supertest
- **Integración continua:** GitHub Actions CI

---

## Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/AndrxsS9/FoodAI-Backend.git
cd FoodAI-Backend
npm install
```

### 2. Variables de entorno
Copia la plantilla de ejemplo y configura tu clave de API:

```bash
cp .env.example .env
```

Contenido de `.env`:
```env
PORT=3000
NODE_ENV=development
GEMINI_API_KEY=tu_clave_de_gemini
```

- `GEMINI_API_KEY`: Clave obligatoria de Google Gemini. Nunca debe subirse al control de versiones ni exponerse en entornos públicos.
- `PORT`: Puerto HTTP (por defecto `3000`).
- `NODE_ENV`: Entorno de ejecución (`development`, `test` o `production`).

---

## Scripts Disponibles

| Script | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor en modo desarrollo con recarga automática (`tsx watch`). |
| `npm run build` | Compila el proyecto TypeScript hacia el directorio `dist/`. |
| `npm start` | Ejecuta la aplicación compilada en producción desde `dist/server.js`. |
| `npm run typecheck` | Verifica los tipos de TypeScript sin emitir archivos (`tsc --noEmit`). |
| `npm test` | Ejecuta todas las pruebas unitarias y de integración con Vitest. |
| `npm run test:watch` | Ejecuta Vitest en modo interactivo/observador. |
| `npm run check` | Valida integralmente el backend ejecutando typecheck, suite de pruebas y compilación en un solo comando. |

---

## Arquitectura de Alto Nivel

El backend sigue una arquitectura desacoplada y orientada a servicios:

```text
HTTP Request
     │
     ▼
[Middlewares globales] ─── Helmet, CORS, Parser JSON/URL
     │
     ▼
[Rate Limiting IA] ─────── express-rate-limit (endpoints costosos)
     │
     ▼
[Router] ───────────────── Rutas HTTP montadas en /api/*
     │
     ▼
[Controllers] ──────────── Validación Zod de entrada y orquestación
     │
     ▼
[Services] ─────────────── Lógica de negocio determinista
     ├── AI Service ────── Wrapper de resiliencia (retry 429/503, timeout 20s)
     ├── Matcher ───────── Normalización, plurales, aliases, suficiencia de cantidades
     ├── Pricing ───────── Catálogo local referencial de precios en COP
     └── Convenience ───── Puntuación de conveniencia según despensa y presupuesto
     │
     ▼
[HTTP Response] ────────── Formato uniforme de éxito o error
```

---

## Endpoints de la API

Todas las respuestas exitosas siguen la estructura `{ "success": true, "data": ... }`. En caso de error, la respuesta entrega `{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }`.

### 1. `GET /api/health`
Verifica el estado del servicio. Este endpoint **no** consume cuota de IA ni está sujeto al rate limit de endpoints costosos.

**Respuesta (200 OK):**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "FoodAI Backend",
    "timestamp": "2026-10-18T15:30:00.000Z"
  }
}
```

---

### 2. `POST /api/ingredients/analyze`
Analiza una fotografía de alimentos y devuelve los ingredientes identificados.
- **Content-Type:** `multipart/form-data`
- **Campo de archivo:** `image`
- **Formatos soportados:** JPEG (`image/jpeg`), PNG (`image/png`), WEBP (`image/webp`)
- **Límite de tamaño:** 8 MB

**Respuesta de ejemplo (200 OK):**
```json
{
  "success": true,
  "data": {
    "ingredients": [
      {
        "name": "tomate",
        "quantity": 3,
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

---

### 3. `POST /api/recipes/recommend`
Recibe la despensa del usuario y genera recomendaciones de recetas adaptadas al presupuesto.
- **Content-Type:** `application/json`

**Cuerpo de la solicitud:**
```json
{
  "pantry": [
    {
      "name": "arroz",
      "quantity": 500,
      "unit": "g",
      "needsReview": false
    },
    {
      "name": "huevo",
      "quantity": 4,
      "unit": "unidad",
      "needsReview": false
    }
  ],
  "budget": 20000,
  "servings": 2,
  "maxMinutes": 45
}
```

**Respuesta de ejemplo (200 OK):**
```json
{
  "success": true,
  "data": {
    "recipes": [
      {
        "name": "Arroz frito con huevo",
        "description": "Receta rápida y económica usando ingredientes básicos.",
        "totalMinutes": 25,
        "ingredients": [
          { "name": "arroz", "quantity": 300, "unit": "g" },
          { "name": "huevo", "quantity": 2, "unit": "unidad" }
        ],
        "steps": [
          "Cocer el arroz con una pizca de sal.",
          "Saltear el arroz con los huevos batidos."
        ],
        "availableIngredients": [
          { "name": "arroz", "quantity": 300, "unit": "g" },
          { "name": "huevo", "quantity": 2, "unit": "unidad" }
        ],
        "missingIngredients": [],
        "estimatedMissingCost": 0,
        "budgetRemaining": 20000,
        "withinBudget": true,
        "convenience": 95,
        "reason": "Todos los ingredientes están disponibles en tu despensa y no requiere gasto adicional."
      }
    ]
  }
}
```

---

### 4. `POST /api/meal-plans/generate`
Genera un plan de alimentación balanceado de exactamente **3 días** optimizando las combinaciones de recetas según presupuesto y conveniencia acumulada. El presupuesto se evalúa sobre el costo global del plan.

---

## Reglas de Negocio del Backend

### 1. Coincidencia y Suficiencia de Ingredientes (`pantryMatcher`)
- **Normalización de nombres:** Minúsculas, eliminación de acentos, caracteres especiales y espacios redundantes.
- **Manejo controlado de plurales y singulares:** Conversión controlada (`tomates` $\rightarrow$ `tomate`, `huevos` $\rightarrow$ `huevo`).
- **Resolución de alias:** Mapeo de términos gastronómicos comunes (`patata` $\rightarrow$ `papa`).
- **Prevención de falsos positivos:** Evita coincidencias erróneas por subcadenas (por ejemplo, `salsa` no coincide con `sal`).
- **Conversión de unidades compatibles:**
  - Masa: gramos y kilogramos (`g` $\leftrightarrow$ `kg`).
  - Volumen: mililitros y litros (`ml` $\leftrightarrow$ `l`).
  - Conteo: unidades (`unidad`).
- **Agregación de existencias múltiples:** Si la despensa tiene varias entradas compatibles de un mismo ingrediente (ej. 300 g de arroz y 250 g de arroz), se suman para evaluar si cubren el requerimiento (550 g $\ge$ 500 g).
- **Política conservadora para cantidades desconocidas (`unknown`):** Si la cantidad o unidad no puede determinarse de forma segura, o se utilizan unidades culinarias no convertibles (tazas, cucharadas), se asume disponible en despensa sin cobrar costo faltante innecesario.

### 2. Estimación de Costos
- Basado en un catálogo referencial en moneda local (COP).
- Si un ingrediente falta o su cantidad es insuficiente, se estima el costo de adquisición completo de dicho ingrediente en el catálogo. No se calcula costo proporcional a la fracción faltante en el MVP.

### 3. Puntuación de Conveniencia
- FoodAI calcula de forma determinista una puntuación entre 0 y 95 basada en la proporción de ingredientes disponibles (70%) y el presupuesto restante (30%). Gemini propone las recetas, pero **no** decide la conveniencia ni el orden final.

---

## Integración y Resiliencia con Gemini

- **Modelo:** `gemini-3.8-flash` mediante `geminiClient.interactions.create`.
- **Reintentos con Backoff:** Errores transitorios de cuota (`429`) o saturación (`503`) se reintentan hasta un máximo de 3 intentos totales (intento inicial + 2 reintentos) con backoff exponencial determinista (250 ms, 500 ms).
- **Timeout controlado:** Cada solicitud cuenta con un temporizador de 20 segundos (`GEMINI_TIMEOUT_MS = 20_000`). Si se supera, se rechaza de inmediato con error `504` (`GEMINI_TIMEOUT`) sin reintentos automáticos.
- **Aislamiento de parsing:** Respuestas vacías (`EMPTY_*`), JSON malformado (`INVALID_*_JSON`) o esquemas no válidos (`INVALID_*_RESPONSE`) fallan de inmediato sin reintentos inútiles.

---

## Protección de Solicitudes (Rate Limiting)

Para proteger los recursos computacionales y la cuota de IA, las rutas que invocan Gemini (`/api/ingredients/analyze`, `/api/recipes/recommend`, `/api/meal-plans/generate`) están protegidas localmente mediante `express-rate-limit`:
- **Ventana:** 60 segundos por IP.
- **Límite:** 30 solicitudes.
- **Respuesta ante exceso:** HTTP `429` con código de error propio: `RATE_LIMIT_EXCEEDED`.
- El endpoint `/api/health` permanece libre de esta restricción.

---

## Pruebas Automatizadas y CI

La suite de pruebas se encuentra organizada en el directorio `tests/` y valida todas las capas del backend sin realizar llamadas reales a la red ni consumir cuota de Gemini:
- **Ejecución de pruebas:** `npm test`
- **Validación completa:** `npm run check`

Al cierre del MVP, el proyecto cuenta con 20 archivos de prueba y 444 tests automatizados aprobados.

### Integración Continua (GitHub Actions)
El flujo `.github/workflows/backend-ci.yml` ejecuta automáticamente `npm ci` y `npm run check` ante cualquier `push` o `pull_request` sobre las ramas `develop` y `main`, garantizando que ningún cambio degrade la calidad del código.

---

## Persistencia y Estado

El backend de FoodAI es **completamente stateless**. No persiste despensa, recetas ni planes en una base de datos local o remota. La persistencia de datos en el dispositivo del usuario está diseñada para la capa móvil mediante Expo SQLite.

---

## Limitaciones Conocidas del MVP

1. **Sin consumo progresivo de despensa:** No se descuentan los ingredientes utilizados de una receta para evaluar la siguiente en un plan de 3 días; cada receta o día se evalúa independientemente frente a la despensa inicial.
2. **Conversiones culinarias restringidas:** No se realizan conversiones de unidades volumétricas no estandarizadas (`taza`, `cucharada`, `cucharadita`) ni conversiones entre masa y volumen (no se asumen densidades de alimentos).
3. **Catálogo de precios local:** Los precios corresponden a un catálogo estático de referencia y no reflejan variaciones comerciales en tiempo real.
4. **Costo de faltantes no proporcional:** Cuando un ingrediente en despensa no cubre la cantidad de la receta, se contabiliza el valor completo de la unidad de compra comercial, no la fracción exacta faltante.
5. **Cancelación a nivel de red:** El timeout de 20s cancela la espera en la promesa de la aplicación Express, pero no necesariamente interrumpe la conexión TCP a nivel de socket si la API del SDK no ofrece `AbortSignal` en dicha llamada.
