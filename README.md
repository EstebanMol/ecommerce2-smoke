# 🛒 pipe.store — Smoke Tests de Precios

Proyecto Playwright para detectar el bug de precios rotos en producción  
(precios que se renderizan con valores absurdamente largos como `AR$ 179.769.313.486.231.570.000...`).

## 📁 Estructura

```
pipe-store-tests/
├── tests/
│   ├── helpers/
│   │   └── priceValidator.js   # Lógica de validación reutilizable
│   └── smoke-precios.spec.js   # Tests principales
├── playwright.config.js
├── package.json
└── README.md
```

## 🚀 Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Instalar browsers de Playwright
npx playwright install chromium
```

## ▶️ Correr los tests

```bash
# Modo headless (CI/CD)
npm test

# Con browser visible (debugging)
npm run test:headed

# Con UI interactiva de Playwright
npm run test:ui

# Ver reporte HTML después de correr
npm run test:report
```

## 🧪 Tests incluidos

| Test | Descripción |
|------|-------------|
| Sitio carga sin errores | Verifica HTTP 200 y ausencia de errores críticos |
| Precios en Home | Valida todos los precios visibles en la home |
| Precios en Televisores | Valida precios en la categoría /televisores |
| Precios en Lavarropas | Valida precios en /lavarropas |
| Precios en Heladeras | Valida precios en /heladeras |
| Precios en Aire Acondicionado | Valida precios en /aire-acondicionado |
| Precio en detalle de producto | Navega a un producto y valida su precio |
| **Detector de overflow** | Escanea TODO el DOM buscando el bug conocido |

## ✅ Reglas de validación

Un precio es válido si:
- Contiene el prefijo `AR$`
- Tiene menos de **20 caracteres** de longitud
- Contiene menos de **10 dígitos numéricos**
- Su valor está entre **$1.000** y **$99.999.999**
- No contiene saltos de línea (indicador de overflow visual)

Estas reglas están centralizadas en `tests/helpers/priceValidator.js`  
y se pueden ajustar fácilmente cambiando las constantes en `PRECIO_RULES`.

## ⚙️ Configuración

Para ajustar categorías testeadas, editar el array `PAGINAS` en `smoke-precios.spec.js`:

```js
const PAGINAS = [
  { nombre: 'Home', path: '/' },
  { nombre: 'Televisores', path: '/televisores' },
  // Agregar más categorías aquí...
];
```

Para ajustar los selectores CSS (si el HTML del sitio cambia):

```js
const SELECTORS = {
  PRECIO_TARJETA: '[class*="price"]',  // ← ajustar aquí
  ...
};
```

## 🔴 Qué pasa cuando detecta el bug

1. El test **falla** con un mensaje descriptivo indicando cuántos precios están rotos
2. Se toma un **screenshot automático** con los precios rotos marcados en rojo
3. Se genera un **reporte HTML** completo en `/playwright-report/`

## 🔄 Integración CI/CD

Agregar a GitHub Actions / GitLab CI:

```yaml
- name: Run price smoke tests
  run: |
    npm ci
    npx playwright install --with-deps chromium
    npm test
  
- name: Upload test report
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```
