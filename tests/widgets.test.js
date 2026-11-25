'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { construirWidget } = require('../ruleta-core');
const root = path.resolve(__dirname, '..');
const catalogo = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));

async function abrir(template, modo, saved, configuracion = null) {
  const html = construirWidget(fs.readFileSync(path.join(root, template), 'utf8'), catalogo, { modo, configuracion });
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      style: { setProperty() {} }, dataset: {}, listeners: {},
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(event, fn) { this.listeners[event] = fn; },
      click() { this.listeners.click?.(); },
      getBoundingClientRect: () => ({ left: 0, width: 360 }),
      querySelector: selector => element(id + selector)
    });
    return elements.get(id);
  }
  const idiomas = ['es', 'es-es', 'en'].map(id => Object.assign(element('idioma-' + id), { dataset: { idioma: id } }));
  const tipos = ['survivor', 'killer'].map(id => Object.assign(element('tipo-' + id), { dataset: { tipo: id } }));
  let time = 0;
  const context = vm.createContext({
    document: { getElementById: element, querySelector: element,
      querySelectorAll: selector => selector === '.idioma-btn' ? idiomas : selector === '.tipo-btn' ? tipos : [],
      documentElement: element('html'), visibilityState: 'visible', addEventListener() {} },
    window: { addEventListener() {} },
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    performance: { now: () => time }, requestAnimationFrame: fn => { time += 10000; fn(time); },
    setTimeout: fn => fn(), fetch: () => { throw new Error('El widget debe funcionar sin red.'); }
  });
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  await new Promise(setImmediate);
  return { html, context, elements, idiomas, tipos };
}

for (const template of ['widget-template.html', 'widget-template-lite.html']) {
  test(template + ': survivor y killer mantienen el tipo fijo aunque OBS tenga preferencias contrarias', async () => {
    const saved = new Map([['perks_tipo', 'killer'], ['ruleta_perks_survivor_tipo', 'killer'], ['ruleta_perks_killer_tipo', 'survivor']]);
    for (const tipo of ['survivor', 'killer']) {
      const app = await abrir(template, 'perks', saved, { tipoFijo: tipo, tipo, color: tipo === 'survivor' ? '#22cc88' : '#cc2288', idioma: tipo === 'survivor' ? 'en' : 'es-es', duracion: 1000, mostrarControles: true, administrado: true });
      assert.equal(vm.runInContext('currentTipo', app.context), tipo);
      assert.doesNotMatch(app.html, /data-tipo=|data-modo=/);
      const ids = vm.runInContext('lastTargets.filter(Boolean).map(h => h.id)', app.context);
      assert.equal(ids.length, 4);
      assert.equal(new Set(ids).size, 4);
      assert.ok(vm.runInContext('activePool().every(h => h.esVacio || h.tipo === currentTipo)', app.context));
      app.tipos.find(btn => btn.dataset.tipo !== tipo).click();
      assert.equal(vm.runInContext('currentTipo', app.context), tipo);
      assert.equal(app.elements.get('tipoToggle').style.display, 'none');
      app.idiomas.find(btn => btn.dataset.idioma === 'es').click();
      assert.equal(saved.get('ruleta_perks_' + tipo + '_idioma'), 'es');
    }
    assert.equal(saved.get('ruleta_perks_survivor_tipo'), 'killer', 'El widget no utiliza ni cambia la preferencia de tipo de OBS.');
    assert.equal(saved.get('ruleta_perks_killer_tipo'), 'survivor');
  });
  test(template + ': configuracion de la app prevalece sobre preferencias antiguas de OBS', async () => {
    const saved = new Map([['ruleta_perks_idioma', 'es-es'], ['ruleta_perks_tipo', 'survivor'], ['ruleta_perks_color', 'hsl(90,90%,55%)']]);
    const app = await abrir(template, 'perks', saved, { color: '#aabb22', idioma: 'en', tipo: 'killer', duracion: 4000, mostrarControles: false, administrado: true });
    assert.equal(vm.runInContext('currentIdioma', app.context), 'en');
    assert.equal(vm.runInContext('currentTipo', app.context), 'killer');
    assert.equal(vm.runInContext('BASE_DURATION', app.context), 4000);
    assert.equal(app.elements.get('colorToggle').style.background, '#aabb22');
    assert.equal(app.elements.get('.top-controls').hidden, true);
    assert.ok(vm.runInContext('lastTargets.filter(Boolean).every(h => h.esVacio || h.tipo === "killer")', app.context));
  });
  for (const modo of ['perks', 'asesino']) {
    test(template + ': widget fijo ' + modo + ' ignora el modo antiguo y sortea solo su contenido', async () => {
      const saved = new Map([['perks_modo', modo === 'perks' ? 'asesino' : 'perks']]);
      const app = await abrir(template, modo, saved);
      assert.doesNotMatch(app.html, /data-modo=/);
      assert.equal(vm.runInContext('currentModo', app.context), modo);
      assert.equal(vm.runInContext('spinning', app.context), false);
      if (modo === 'perks') {
        assert.equal(vm.runInContext('ASESINOS.length', app.context), 0);
        assert.equal(vm.runInContext('lastTargets.filter(Boolean).length', app.context), 4);
        assert.equal(app.elements.get('reel-asesino').style.display, 'none');
      } else {
        assert.equal(vm.runInContext('HABILIDADES.length', app.context), 0);
        assert.ok(vm.runInContext('lastAsesino', app.context));
        assert.equal(app.elements.get('reels').style.display, 'none');
        assert.equal(app.elements.get('tipoToggle').style.display, 'none');
        assert.equal(app.elements.get('.modo-stage').style.width, '420px');
      }
    });
  }
}

test('perks y killers conservan colores e idiomas independientes al reabrirse', async () => {
  const saved = new Map([['perks_idioma', 'es-es'], ['perks_color', 'hsl(90,90%,55%)']]);
  const perks = await abrir('widget-template.html', 'perks', saved);
  await abrir('widget-template.html', 'asesino', saved);
  perks.idiomas.find(btn => btn.dataset.idioma === 'en').click();
  perks.elements.get('hueSlider').listeners.mousedown({ clientX: 120 });
  const killers = await abrir('widget-template.html', 'asesino', saved);
  assert.equal(vm.runInContext('currentIdioma', killers.context), 'es-es');
  assert.equal(killers.elements.get('colorToggle').style.background, 'hsl(90,90%,55%)');
  killers.idiomas.find(btn => btn.dataset.idioma === 'es').click();
  const reabiertas = await abrir('widget-template-lite.html', 'perks', saved);
  assert.equal(vm.runInContext('currentIdioma', reabiertas.context), 'en');
  assert.equal(reabiertas.elements.get('colorToggle').style.background, 'hsl(120,90%,55%)');
});
