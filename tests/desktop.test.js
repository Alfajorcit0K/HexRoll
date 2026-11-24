'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { prepararInstalacion, importarInstalacion } = require('../desktop/storage');
const { iniciarServidor } = require('../editor-ruleta-perks');

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ruleta-desktop-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(base)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(base).startsWith('ruleta-desktop-test-'));
    fs.rmSync(base, { recursive: true, force: true });
  });
  const source = path.join(base, 'programa'), root = path.join(base, 'usuario');
  fs.mkdirSync(path.join(source, 'imagenes', 'perks'), { recursive: true });
  fs.writeFileSync(path.join(source, 'imagenes', 'perks', 'uno.png'), 'imagen de prueba');
  const data = { habilidades: [{ id: 'uno', nombre_en: 'One', activo: true, imagen: 'uno.png' }], asesinos: [{ id: 'killer', activo: true }] };
  fs.writeFileSync(path.join(source, 'data.json'), JSON.stringify(data));
  return { base, source, root, data };
}

test('instalar y actualizar conserva selecciones y respalda antes de migrar', t => {
  const { source, root, data } = fixture(t);
  const sourceBefore = fs.readFileSync(path.join(source, 'data.json'), 'utf8');
  const info = prepararInstalacion(source, root, '1');
  assert.equal(info.widget, path.join(root, 'ruleta-perks.html'));
  assert.ok(fs.existsSync(path.join(root, 'imagenes', 'perks', 'uno.png')));
  const actual = structuredClone(data);
  actual.habilidades[0].activo = false;
  actual.asesinos[0].activo = false;
  fs.writeFileSync(path.join(root, 'data.json'), JSON.stringify(actual));
  prepararInstalacion(source, root, '1');
  assert.ok(!fs.existsSync(path.join(root, 'backups')));
  data.habilidades.push({ id: 'nueva', activo: true });
  fs.writeFileSync(path.join(source, 'data.json'), JSON.stringify(data));
  prepararInstalacion(source, root, '2');
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
  assert.equal(saved.habilidades[0].activo, false);
  assert.equal(saved.habilidades[1].activo, false);
  assert.equal(saved.asesinos[0].activo, false);
  assert.equal(fs.readdirSync(path.join(root, 'backups')).length, 1);
  assert.equal(JSON.parse(sourceBefore).habilidades.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(source, 'data.json'), 'utf8')).habilidades[0].activo, true);
});

test('importar una instalacion antigua conserva sus selecciones e imagenes propias', t => {
  const { base, source, root, data } = fixture(t);
  prepararInstalacion(source, root);
  const old = path.join(base, 'anterior');
  fs.mkdirSync(path.join(old, 'imagenes', 'perks'), { recursive: true });
  const previous = structuredClone(data);
  previous.habilidades[0].activo = false;
  previous.habilidades.push({ id: 'propia', activo: true, imagen: 'propia.png' });
  fs.writeFileSync(path.join(old, 'imagenes', 'perks', 'propia.png'), 'personal');
  const file = path.join(old, 'data.json');
  fs.writeFileSync(file, JSON.stringify(previous));
  const result = importarInstalacion(source, root, file);
  assert.ok(fs.existsSync(result.backup));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8')).habilidades[0].activo, false);
  assert.equal(fs.readFileSync(path.join(root, 'imagenes', 'perks', 'propia.png'), 'utf8'), 'personal');
});

test('datos dañados detienen la actualizacion sin sobrescribirlos', t => {
  const { source, root } = fixture(t);
  prepararInstalacion(source, root);
  fs.writeFileSync(path.join(root, 'data.json'), '{');
  assert.throws(() => prepararInstalacion(source, root, '2'));
  assert.equal(fs.readFileSync(path.join(root, 'data.json'), 'utf8'), '{');
});

test('servidor instalado escribe solo en la carpeta del usuario y sirve el editor empaquetado', async t => {
  const { source, root } = fixture(t);
  const repo = path.resolve(__dirname, '..');
  for (const file of ['widget-template.html', 'widget-template-lite.html', 'personajes-habilidades.json', 'config-publica.json', 'editor-habilidades.html']) fs.copyFileSync(path.join(repo, file), path.join(source, file));
  prepararInstalacion(source, root);
  const server = iniciarServidor({ root, source, port: 0 });
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(base + '/editor')).status, 200);
  const blocked = await fetch(base + '/api/habilidades/uno', { method: 'PUT', headers: { Origin: 'https://otro-sitio.example', 'Content-Type': 'application/json' }, body: '{"activo":false}' });
  assert.equal(blocked.status, 403);
  const res = await fetch(base + '/api/habilidades/uno', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"activo":false}' });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8')).habilidades[0].activo, false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(source, 'data.json'), 'utf8')).habilidades[0].activo, true);
  assert.ok(fs.existsSync(path.join(root, 'ruleta-perks.html')));
  assert.ok(fs.existsSync(path.join(root, 'ruleta-perks-lite-libre.html')));
  for (const archivo of ['ruleta-perks-lite.html', 'ruleta-killers.html', 'ruleta-killers-lite.html']) {
    assert.ok(fs.existsSync(path.join(root, archivo)));
    assert.equal((await fetch(base + '/' + archivo)).status, 200);
  }
  await new Promise(resolve => server.close(resolve));
  // El widget y las imagenes siguen disponibles cuando se cierra la aplicacion.
  assert.ok(fs.readFileSync(path.join(root, 'ruleta-perks.html'), 'utf8').includes('One'));
  assert.ok(fs.existsSync(path.join(root, 'imagenes', 'perks', 'uno.png')));
});
