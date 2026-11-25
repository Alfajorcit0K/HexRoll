'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('actualizaciones permanecen discretas y se pueden volver a abrir despues de cerrar el aviso', async () => {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { hidden: true, textContent: '', attributes: {}, listeners: {},
      setAttribute(key, value) { this.attributes[key] = value; }, querySelector: () => $('buttonLabel'),
      addEventListener(event, callback) { this.listeners[event] = callback; } });
    return elements.get(id);
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'Editor.js'), 'utf8');
  const code = source.slice(source.indexOf('async function iniciarActualizaciones(api)'), source.indexOf('async function iniciarDesktop()'));
  const context = vm.createContext({ $, window: { addEventListener() {} }, aviso: message => assert.fail(message) });
  vm.runInContext(code, context);
  let state = { phase: 'idle', version: '1.0.0', percent: 0 }, render;
  await context.iniciarActualizaciones({ actualizaciones: async () => state, buscarActualizacion: async () => state,
    instalarActualizacion: async () => {}, alCambiarActualizaciones: callback => { render = callback; return () => {}; } });
  const change = patch => { state = { ...state, ...patch }; render(state); };
  const click = async id => { $(id).listeners.click(); await new Promise(setImmediate); };
  assert.equal($('updatePanel').hidden, true);
  change({ phase: 'checking' }); assert.equal($('updatePanel').hidden, true);
  change({ phase: 'error', reason: 'unavailable' }); assert.equal($('updatePanel').hidden, true);
  await click('checkUpdate');
  assert.equal($('updatePanel').hidden, false);
  assert.match($('updateStatus').textContent, /canal/);
  assert.doesNotMatch($('updateStatus').textContent, /conexión/);
  await click('dismissUpdate'); assert.equal($('updatePanel').hidden, true);
  change({ phase: 'downloading', nextVersion: '1.0.1', percent: 20 }); assert.equal($('updatePanel').hidden, false);
  await click('dismissUpdate'); change({ percent: 30 }); assert.equal($('updatePanel').hidden, true);
  await click('checkUpdate'); assert.equal($('updatePanel').hidden, false);
  change({ phase: 'ready' }); await click('dismissUpdate');
  assert.equal($('checkUpdate').disabled, false);
  await click('checkUpdate'); assert.equal($('updatePanel').hidden, false); assert.equal($('installUpdate').hidden, false);
});
