'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { prepararInstalacion, importarInstalacion } = require('../desktop/storage');
const { iniciarServidor } = require('../Server');

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ruleta-desktop-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(base)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(base).startsWith('ruleta-desktop-test-'));
    fs.rmSync(base, { recursive: true, force: true });
  });
  const source = path.join(base, 'programa'), root = path.join(base, 'usuario');
  fs.mkdirSync(path.join(source, 'images', 'perks'), { recursive: true });
  fs.writeFileSync(path.join(source, 'images', 'perks', 'uno.png'), 'imagen de prueba');
  const data = { habilidades: [{ id: 'uno', nombre_en: 'One', activo: true, imagen: 'uno.png' }], asesinos: [{ id: 'killer', activo: true }] };
  fs.writeFileSync(path.join(source, 'data.json'), JSON.stringify(data));
  return { base, source, root, data };
}

test('instalar y actualizar conserva selecciones y respalda antes de migrar', t => {
  const { source, root, data } = fixture(t);
  fs.mkdirSync(path.join(source, 'images', 'brand'), { recursive: true });
  fs.writeFileSync(path.join(source, 'images', 'brand', 'logo.png'), 'logo anterior');
  const sourceBefore = fs.readFileSync(path.join(source, 'data.json'), 'utf8');
  const info = prepararInstalacion(source, root, '1');
  assert.equal(info.widget, path.join(root, 'PerksRoulette.html'));
  assert.ok(fs.existsSync(path.join(root, 'images', 'perks', 'uno.png')));
  const actual = structuredClone(data);
  actual.habilidades[0].activo = false;
  actual.asesinos[0].activo = false;
  actual.ajustes = require('../State').configuracionActual(actual);
  actual.ajustes.perks.color = '#1256ab';
  fs.writeFileSync(path.join(root, 'Profiles.json'), '[{"id":"propio","nombre":"Personal"}]');
  fs.writeFileSync(path.join(root, 'EditorSettings.json'), '{"tema":"claro"}');
  fs.writeFileSync(path.join(root, 'data.json'), JSON.stringify(actual));
  fs.writeFileSync(path.join(source, 'images', 'brand', 'logo.png'), 'logo actualizado');
  prepararInstalacion(source, root, '1');
  assert.equal(fs.readFileSync(path.join(root, 'images', 'brand', 'logo.png'), 'utf8'), 'logo actualizado', 'La marca se refresca aunque no cambie el catalogo.');
  assert.ok(!fs.existsSync(path.join(root, 'backups')));
  data.habilidades.push({ id: 'nueva', activo: true });
  fs.writeFileSync(path.join(source, 'data.json'), JSON.stringify(data));
  prepararInstalacion(source, root, '2');
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));
  assert.equal(saved.habilidades[0].activo, false);
  assert.equal(saved.habilidades[1].activo, false);
  assert.equal(saved.asesinos[0].activo, false);
  assert.deepEqual(saved.ajustes, actual.ajustes);
  assert.equal(fs.readFileSync(path.join(root, 'Profiles.json'), 'utf8'), '[{"id":"propio","nombre":"Personal"}]');
  assert.equal(fs.readFileSync(path.join(root, 'EditorSettings.json'), 'utf8'), '{"tema":"claro"}');
  assert.equal(fs.readdirSync(path.join(root, 'backups')).length, 1);
  assert.equal(JSON.parse(sourceBefore).habilidades.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(source, 'data.json'), 'utf8')).habilidades[0].activo, true);
});

test('importar una instalacion antigua conserva sus selecciones e imagenes propias', t => {
  const { base, source, root, data } = fixture(t);
  prepararInstalacion(source, root);
  const old = path.join(base, 'anterior');
  fs.mkdirSync(path.join(old, 'images', 'perks'), { recursive: true });
  const previous = structuredClone(data);
  previous.habilidades[0].activo = false;
  previous.habilidades.push({ id: 'propia', activo: true, imagen: 'propia.png' });
  fs.writeFileSync(path.join(old, 'images', 'perks', 'propia.png'), 'personal');
  const file = path.join(old, 'data.json');
  fs.writeFileSync(file, JSON.stringify(previous));
  const result = importarInstalacion(source, root, file);
  assert.ok(fs.existsSync(result.backup));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8')).habilidades[0].activo, false);
  assert.equal(fs.readFileSync(path.join(root, 'images', 'perks', 'propia.png'), 'utf8'), 'personal');
});

test('actualizar una carpeta antigua conserva imagenes propias y reconoce su catalogo instalado', t => {
  const { source, root, data } = fixture(t);
  fs.mkdirSync(path.join(root, 'imagenes', 'perks'), { recursive: true });
  fs.writeFileSync(path.join(root, 'imagenes', 'perks', 'Custom.png'), 'imagen propia');
  const saved = structuredClone(data);
  saved.habilidades[0].activo = false;
  saved.habilidades.push({ id: 'propia', activo: true, imagen: 'Custom.png' });
  fs.writeFileSync(path.join(root, 'data.json'), JSON.stringify(saved));
  const hash = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(source, 'data.json'), 'utf8')).update('1').digest('hex');
  fs.writeFileSync(path.join(root, 'catalogo-instalado.json'), JSON.stringify({ hash }));
  prepararInstalacion(source, root, '1');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8')), saved);
  assert.equal(fs.readFileSync(path.join(root, 'images', 'perks', 'Custom.png'), 'utf8'), 'imagen propia');
  assert.equal(fs.readFileSync(path.join(root, 'imagenes', 'perks', 'Custom.png'), 'utf8'), 'imagen propia');
  assert.ok(fs.existsSync(path.join(root, 'CatalogStamp.json')));
  assert.ok(!fs.existsSync(path.join(root, 'backups')), 'Un cambio de nombres no provoca una migracion del catalogo.');
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
  for (const file of ['RouletteTemplate.html', 'RouletteLiteTemplate.html', 'Characters.json', 'AppLinks.json', 'Editor.html', 'Editor.js', 'Theme.js']) fs.copyFileSync(path.join(repo, file), path.join(source, file));
  prepararInstalacion(source, root);
  fs.writeFileSync(path.join(root, 'ruleta-perks-survivor.html'), 'fuente anterior de OBS');
  const server = iniciarServidor({ root, source, port: 0 });
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const anterior = await fetch(base + '/ruleta-perks-survivor.html');
  assert.equal(anterior.status, 200);
  assert.equal(await anterior.text(), fs.readFileSync(path.join(root, 'SPerksRoulette.html'), 'utf8'));
  assert.equal((await fetch(base + '/editor')).status, 200);
  assert.equal((await fetch(base + '/Editor.js')).status, 200);
  const blocked = await fetch(base + '/api/habilidades/uno', { method: 'PUT', headers: { Origin: 'https://otro-sitio.example', 'Content-Type': 'application/json' }, body: '{"activo":false}' });
  assert.equal(blocked.status, 403);
  const res = await fetch(base + '/api/habilidades/uno', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"activo":false}' });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8')).habilidades[0].activo, false);
  assert.equal(fs.readFileSync(path.join(root, 'ruleta-perks-survivor.html'), 'utf8'), fs.readFileSync(path.join(root, 'SPerksRoulette.html'), 'utf8'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(source, 'data.json'), 'utf8')).habilidades[0].activo, true);
  assert.ok(fs.existsSync(path.join(root, 'PerksRoulette.html')));
  assert.ok(fs.existsSync(path.join(root, 'CombinedRouletteLite.html')));
  for (const archivo of ['SPerksRoulette.html', 'KPerksRoulette.html', 'SPerksRouletteLite.html', 'KPerksRouletteLite.html', 'PerksRouletteLite.html', 'KRoulette.html', 'KRouletteLite.html']) {
    assert.ok(fs.existsSync(path.join(root, archivo)));
    assert.equal((await fetch(base + '/' + archivo)).status, 200);
  }
  await new Promise(resolve => server.close(resolve));
  // El widget y las imagenes siguen disponibles cuando se cierra la aplicacion.
  assert.ok(fs.readFileSync(path.join(root, 'PerksRoulette.html'), 'utf8').includes('One'));
  assert.ok(fs.existsSync(path.join(root, 'images', 'perks', 'uno.png')));
});
