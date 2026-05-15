// tests/smoke-precios.spec.js
/**
 * Smoke Test: Validación de precios en pipe.store
 *
 * Detecta el bug conocido donde los precios se renderizan con valores
 * absurdamente largos (ej: AR$ 179.769.313.486.231.570.000.000...)
 * en lugar del precio real del producto.
 */

require('dotenv').config();
const { notificarError } = require('./helpers/notificaciones');

const { test, expect } = require('@playwright/test');
const { validarPrecio, validarPrecios } = require('./helpers/priceValidator');

// ─── Selectores centralizados ────────────────────────────────────────────────
// Ajustar si el HTML de pipe.store cambia  
const SELECTORS = {
  // Precio en tarjetas de producto (Material UI)
  PRECIO_TARJETA: 'h5[id*="-price"]',

  // Precio en página de detalle
  PRECIO_DETALLE: 'h5[id*="-price"]',

  // Tarjetas de producto
  TARJETA_PRODUCTO: '[class*="MuiCard"], [class*="MuiPaper"], [class*="product"]',
};

// ─── Páginas a testear ───────────────────────────────────────────────────────
const PAGINAS = [
  { nombre: 'Home', path: '/' },
  { nombre: 'Televisores', path: '/categories/962b9949-c7e2-4a1e-b4f8-837bc9ecc58d' },
  { nombre: 'Lavarropas', path: '/categories/4019235d-a385-4c8d-89af-69d8c2e20fe9' },
  { nombre: 'Celulares', path: '/categories/d910010c-1cc3-4bc3-be52-8036693fb07f' },
  { nombre: 'Notebook', path: '/categories/663b3f19-01f1-470a-aee0-1dad98a035e3' },
];

// ─── Helper: extraer precios visibles de la página ──────────────────────────
async function extraerPrecios(page, selector) {
  return page.evaluate((sel) => {
    const elementos = document.querySelectorAll(sel);
    const textos = [];

    elementos.forEach((el) => {
      const texto = el.innerText?.trim() || el.textContent?.trim();
      if (texto && texto.includes('AR$')) {
        // Tomamos la primera línea (por si el elemento tiene info adicional)
        const primeraLinea = texto.split('\n')[0].trim();
        if (primeraLinea) textos.push(primeraLinea);
      }
    });

    return [...new Set(textos)]; // Deduplicar
  }, selector);
}

// ─── Helper: tomar screenshot con precios marcados ──────────────────────────
async function marcarPreciosRotos(page, selector) {
  await page.evaluate((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      const texto = el.innerText || el.textContent || '';
      if (texto.length > 50 && texto.includes('AR$')) {
        el.style.outline = '3px solid red';
        el.style.backgroundColor = 'rgba(255,0,0,0.1)';
      }
    });
  }, selector);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST SUITE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

test.describe('🔥 Smoke Test — Validación de precios pipe.store', () => {

  test('El sitio carga sin errores críticos', async ({ page }) => {

  // 1. PRIMERO los listeners
  const erroresConsola = [];
  const recursos404 = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') erroresConsola.push(msg.text());
  });

  page.on('response', (resp) => {
    if (resp.status() === 404) {
      recursos404.push({ url: resp.url() });
    }
  });

  // 2. DESPUÉS el goto
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response.status(), 'El sitio debe responder con HTTP 200').toBe(200);

  await page.waitForTimeout(2000);

  // 3. Mostrar resultados
  console.log(`Errores de consola detectados: ${erroresConsola.length}`);
  if (erroresConsola.length > 0) {
    console.log('\nDetalle de errores JS:');
    erroresConsola.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
  }

  console.log(`\nRecursos con 404: ${recursos404.length}`);
  if (recursos404.length > 0) {
    console.log('\nDetalle de 404s:');
    recursos404.forEach((r, i) => console.log(`  ${i + 1}. ${r.url}`));
  }

});

  // ── Test 2: Validar precios en todas las páginas del catálogo ────────────
  for (const pagina of PAGINAS) {
    test(`Precios correctos en: ${pagina.nombre} (${pagina.path})`, async ({ page }) => {
      await page.goto(pagina.path, { waitUntil: 'domcontentloaded' });

      // Scroll progresivo para disparar lazy loading
      await page.evaluate(() => window.scrollTo(0, 300));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(1000);

      // Esperar a que aparezca al menos un precio en el DOM
    try {
      await page.waitForSelector('h5[id*="-price"]', { timeout: 20000 });
    } catch {
      console.warn(`⚠️  Timeout esperando precios en ${pagina.nombre}`);
    }

      const preciosRaw = await extraerPrecios(page, SELECTORS.PRECIO_TARJETA);

      // Si no hay precios, puede ser que el selector no matchea — loguear como warning
      if (preciosRaw.length === 0) {
        console.warn(
          `⚠️  No se encontraron precios en ${pagina.nombre}. ` +
          `Verificar selector: ${SELECTORS.PRECIO_TARJETA}`
        );
        test.skip(); // No falla, pero marca el test para revisión
        return;
      }

      console.log(`\n📋 Página: ${pagina.nombre} — ${preciosRaw.length} precios encontrados`);

      const reporte = validarPrecios(preciosRaw);

      // Imprimir detalle en consola para debugging
      reporte.detalle.forEach(({ precio, valid, errores }) => {
        if (valid) {
          console.log(`  ✅ ${precio}`);
        } else {
          console.error(`  ❌ "${precio}"`);
          errores.forEach((e) => console.error(`     → ${e}`));
        }
      });

      // Si hay precios rotos, tomar screenshot con ellos marcados en rojo
      if (reporte.invalidos > 0) {
        await marcarPreciosRotos(page, SELECTORS.PRECIO_TARJETA);
        await page.screenshot({
          path: `playwright-report/precios-rotos-${pagina.nombre.toLowerCase()}.png`,
          fullPage: false,
        });

        await notificarError({
        titulo: `Precios inválidos en categoría ${pagina.nombre}`,
        mensaje: `Se encontraron ${reporte.invalidos} precio(s) inválido(s)`,
        detalles: reporte.detalle
          .filter((r) => !r.valid)
          .map((r) => `${r.precio} → ${r.errores.join(', ')}`),
        });
      }

      // ── Assertions ──────────────────────────────────────────────────────
      const preciosInvalidos = reporte.detalle
        .filter((r) => !r.valid)
        .map((r) => `"${r.precio}" → ${r.errores.join(', ')}`)
        .join('\n');

      expect(
        reporte.invalidos,
        `Se encontraron ${reporte.invalidos} precio(s) inválido(s) en ${pagina.nombre}:\n${preciosInvalidos}`
      ).toBe(0);
    });
  }

  // ── Test 3: Validar precio en página de detalle de producto ─────────────
  test('Precio correcto en página de detalle de producto', async ({ page }) => {
    // Ir a la home y hacer click en el primer producto disponible
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Intentar clickear el primer producto
    const primerProducto = page.locator(SELECTORS.TARJETA_PRODUCTO).first();
    const existe = await primerProducto.count();

    if (existe === 0) {
      console.warn('⚠️  No se encontró ninguna tarjeta de producto en home');
      test.skip();
      return;
    }

    await primerProducto.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const url = page.url();
    console.log(`\n📦 Testeando detalle de producto: ${url}`);

    const preciosRaw = await extraerPrecios(page, SELECTORS.PRECIO_DETALLE);

    if (preciosRaw.length === 0) {
      // Fallback: buscar cualquier elemento con AR$
      const preciosFallback = await extraerPrecios(page, '*');
      console.warn(`Selector de detalle no matcheó. Fallback encontró: ${preciosFallback.length} precios`);
      preciosRaw.push(...preciosFallback.slice(0, 5));
    }

    expect(preciosRaw.length, 'Debe haber al menos un precio en la página de detalle').toBeGreaterThan(0);

    const reporte = validarPrecios(preciosRaw);

    console.log(`Precios encontrados: ${reporte.total} | Válidos: ${reporte.validos} | Inválidos: ${reporte.invalidos}`);

    reporte.detalle.forEach(({ precio, valid, errores }) => {
      if (!valid) console.error(`❌ "${precio}" → ${errores.join(', ')}`);
    });

    const preciosInvalidos = reporte.detalle
      .filter((r) => !r.valid)
      .map((r) => `"${r.precio}" → ${r.errores.join(', ')}`)
      .join('\n');

    expect(
      reporte.invalidos,
      `Precio roto en detalle de producto:\n${preciosInvalidos}`
    ).toBe(0);
  });

  // ── Test 4: Detector específico del bug de precios extremadamente largos ─
  test('No hay precios con overflow (bug conocido de producción)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Buscar CUALQUIER texto en la página que contenga "AR$" y sea anormalmente largo
      const preciosRotos = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );

      const encontrados = [];
      let nodo;

      while ((nodo = walker.nextNode())) {
        const texto = nodo.textContent?.trim();
        if (texto && texto.includes('AR$') && texto.length > 30) {
          encontrados.push({
            texto: texto.substring(0, 100), // Solo los primeros 100 chars para el log
            longitud: texto.length,
            padre: nodo.parentElement?.className || nodo.parentElement?.tagName,
          });
        }
      }

      return encontrados;
    });

    if (preciosRotos.length > 0) {
      console.error('\n🚨 PRECIOS ROTOS DETECTADOS:');
      preciosRotos.forEach(({ texto, longitud, padre }) => {
        console.error(`  Longitud: ${longitud} | Clase: ${padre}`);
        console.error(`  Texto: "${texto}..."`);
      });

      await page.screenshot({
        path: 'playwright-report/bug-precios-overflow.png',
        fullPage: true,
      });

       // 🔔 Enviar alerta por email
      await notificarError({
        titulo: 'Bug de precios rotos detectado en producción',
        mensaje: `Se encontraron ${preciosRotos.length} precio(s) con overflow en la Home`,
        detalles: preciosRotos.map(
          (p) => `"${p.texto.substring(0, 60)}..." (${p.longitud} caracteres) — clase: ${p.padre}`
        ),
      });
    }

    expect(
      preciosRotos.length,
      `Se detectaron ${preciosRotos.length} precio(s) con overflow (bug de producción conocido):\n` +
      preciosRotos.map((p) => `  "${p.texto.substring(0, 50)}..." (${p.longitud} chars)`).join('\n')
    ).toBe(0);
  });
});
