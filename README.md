# FoodAI Backend

FoodAI es una aplicación orientada a aprovechar los alimentos disponibles en casa, reducir el desperdicio de comida y recomendar recetas personalizadas según la despensa y el presupuesto del usuario. Este repositorio contiene la API REST backend desarrollada en Node.js y Express 5 con TypeScript.

El backend recibe los ingredientes disponibles (de forma manual o extraídos desde una fotografía), verifica criptográficamente la sesión del usuario autenticado en Supabase, consulta al modelo Gemini para sugerir recetas y planes de alimentación, y ejecuta lógica propia determinista para normalizar ingredientes, comparar suficiencia de cantidades, estimar costos en pesos colombianos (COP), calcular conveniencia y ordenar las mejores opciones.

---

## Tecnologías Principales

- **Entorno de ejecución:** Node.js (`>= 22.0.0`)
- **Lenguaje:** TypeScript
- **Framework web:** Express 5
- **Autenticación:** Verificación criptográfica de JWT de Supabase con `jose` (JWKS asimétrico `ES256`/`RS256` y soporte opcional `HS256`)
- **Seguridad y protección:** Helmet, CORS con lista blanca explícita, `express-rate-limit` (por IP y por usuario), límite de concurrencia de IA y redacción de secretos en logs
- **Validación de esquemas:** Zod
- **Procesamiento de archivos:** Multer (almacenamiento en memoria acotado para imágenes)
- **Inteligencia Artificial:** SDK oficial `@google/genai` (`gemini-3.5-flash-lite`)
- **Pruebas automatizadas:** Vitest y Supertest
- **Integración continua:** GitHub Actions CI

---

## Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/AndrxsS9/FoodAI-Backend.git
cd FoodAI-Backend
npm ci
```

### 2. Variables de entorno
Copia la plantilla de ejemplo y configura tus variables locales:

```bash
cp .env.example .env
```

Variables soportadas:

| Variable | Obligatoria | Valor por defecto | Descripción |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Sí | — | Clave privada de Google Gemini (solo backend; jamás exponer en frontend). |
| `SUPABASE_URL` | Sí (`dev`/`prod`) | — | URL base del proyecto Supabase (`https://<ref>.supabase.co`). En `production` debe usar HTTPS real. |
| `PORT` | No | `3000` | Puerto HTTP en el que escucha el servidor (`0.0.0.0`). Render lo inyecta automáticamente. |
| `NODE_ENV` | No | `development` | Entorno de ejecución: `development`, `test` o `production`. |
| `SUPABASE_JWT_AUDIENCE` | No | `authenticated` | Audiencia requerida (`aud`) en el JWT de Supabase. |
| `SUPABASE_JWT_SECRET` | No | — | Secreto simétrico `HS256` (`>= 32` caracteres) solo si el proyecto usa firma legada `HS256`. Dejar vacío cuando Supabase firma con `ES256`/`RS256` vía JWKS. |
| `CORS_ALLOWED_ORIGINS` | No | Orígenes `localhost` en `dev` | Orígenes web permitidos separados por comas (sin `*`; solo HTTPS en `production`). |
| `TRUST_PROXY_HOPS` | No | `1` en `prod`, `0` en `dev`/`test` | Saltos exactos de proxy inverso confiables (`0..5`; nunca `true` ni `*`). |
| `AI_RATE_LIMIT_WINDOW_MS` | No | `60000` | Ventana de tiempo (ms) para limitadores de tasa en rutas de IA. |
| `AI_RATE_LIMIT_MAX` | No | `30` | Máximo de solicitudes por IP dentro de la ventana en rutas de IA. |
| `AI_USER_RATE_LIMIT_MAX` | No | `20` | Máximo de solicitudes por usuario autenticado (`sub`) dentro de la ventana. |
| `AI_MAX_CONCURRENT_REQUESTS` | No | `10` | Máximo de solicitudes simultáneas en vuelo hacia endpoints de IA (`1..100`). |

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

## Arquitectura y Capas de Seguridad

```text
HTTP Request
     │
     ▼
[Proxy & Seguridad HTTP] ── trust proxy acotado, Helmet, CORS allowlist, JSON <= 100kb
     │
     ├─► GET /api/health ── Público (sin JWT ni consumo de IA; health check de Render)
     │
     ▼
[Rate Limit por IP] ─────── express-rate-limit (mitiga ráfagas y escaneo por IP)
     │
     ▼
[Auth JWT Supabase] ─────── Verificación criptográfica JWKS (firma, iss, aud, exp, sub, role)
     │
     ▼
[Rate Limit por Usuario] ── Límite por sub verificado + guardia de concurrencia IA
     │
     ▼
[Upload / Validación Zod] ─ Multer acotado (<= 8 MB, 1 imagen) y esquemas Zod acotados
     │
     ▼
[Services] ──────────────── Gemini + Matcher + Pricing COP + Convenience Engine
     │
     ▼
[HTTP Response] ─────────── Contrato uniforme { success, data | error } + logs redactados
```

### Autenticación en Endpoints de IA
Los tres endpoints que consumen IA requieren un `access_token` vigente emitido por Supabase Auth para un usuario con `role: "authenticated"`:

```http
Authorization: Bearer <supabase_access_token>
```

- La identidad del usuario se toma exclusivamente del claim `sub` tras verificar firma, `iss` (`${SUPABASE_URL}/auth/v1`), `aud` (`authenticated`) y `exp`.
- Nunca se aceptan tokens por query params ni IDs de usuario enviados por el cliente.
- Respuestas de rechazo:
  - `401 AUTH_TOKEN_REQUIRED`: falta encabezado `Authorization: Bearer <token>`.
  - `401 INVALID_AUTH_TOKEN`: formato inválido, firma inválida, emisor/audiencia incorrectos o rol no autenticado (ej. `anon`).
  - `401 AUTH_TOKEN_EXPIRED`: token expirado.

---

## Endpoints de la API

Todas las respuestas exitosas siguen la estructura `{ "success": true, "data": ... }`. En caso de error, la respuesta entrega `{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }`.

### 1. `GET /api/health` (Público)
Verifica el estado del servicio. No requiere autenticación, no consume cuota de IA y sirve como health check oficial en Render.

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

### 2. `POST /api/ingredients/analyze` (Protegido — Bearer JWT)
Analiza una fotografía de alimentos y devuelve los ingredientes identificados.
- **Autenticación:** `Authorization: Bearer <supabase_access_token>`
- **Content-Type:** `multipart/form-data`
- **Campo de archivo:** `image` (máximo 1 archivo no vacío, hasta 8 MB)
- **Formatos soportados:** JPEG (`image/jpeg`), PNG (`image/png`), WEBP (`image/webp`)

---

### 3. `POST /api/recipes/recommend` (Protegido — Bearer JWT)
Recibe la despensa del usuario y genera recomendaciones de recetas adaptadas al presupuesto.
- **Autenticación:** `Authorization: Bearer <supabase_access_token>`
- **Content-Type:** `application/json` (hasta `100kb`, máximo 100 ingredientes por solicitud)

---

### 4. `POST /api/meal-plans/generate` (Protegido — Bearer JWT)
Genera un plan de alimentación balanceado de exactamente **3 días** optimizando las combinaciones de recetas según presupuesto y conveniencia acumulada.
- **Autenticación:** `Authorization: Bearer <supabase_access_token>`
- **Content-Type:** `application/json` (hasta `100kb`, máximo 100 ingredientes por solicitud)

---

## Despliegue Seguro en Render (HTTPS Web Service)

1. **Runtime:** Node.js (`>= 22.0.0`).
2. **Build Command:** `npm ci && npm run build`
3. **Start Command:** `npm start` (ejecuta `node dist/server.js` escuchando en `0.0.0.0:$PORT`).
4. **Health Check Path:** `/api/health`
5. **Variables mínimas en Render:**
   - `NODE_ENV=production`
   - `GEMINI_API_KEY=<clave_privada_gemini>`
   - `SUPABASE_URL=https://<project-ref>.supabase.co`
   - `SUPABASE_JWT_AUDIENCE=authenticated`
   - `TRUST_PROXY_HOPS=1`
   - `CORS_ALLOWED_ORIGINS=` (solo orígenes web HTTPS requeridos; vacío si únicamente consume el APK Android)

---

## Pruebas Automatizadas y CI

La suite de pruebas en `tests/` valida todas las capas del backend usando mocks y claves criptográficas efímeras locales, sin realizar llamadas reales a la red ni consumir cuota de Gemini:
- **Ejecución de pruebas:** `npm test`
- **Validación completa (typecheck + tests + build):** `npm run check`

---

## Persistencia y Estado

El backend de FoodAI es **completamente stateless**. No persiste despensa, recetas ni planes en una base de datos local o remota. La persistencia de datos en el dispositivo del usuario está diseñada para la capa móvil mediante Expo SQLite / almacenamiento local sincronizado con la sesión del usuario.
