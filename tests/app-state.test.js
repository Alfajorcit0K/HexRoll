'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { iniciarServidor } = require('../editor-ruleta-perks');
const { prepararInstalacion } = require('../desktop/storage');
const { configuracionActual, personajes } = require('../app-state');
const repo = path.resolve(__dirname, '..');
const catalogo = JSON.parse(fs.readFileSync(path.join(repo, 'data.json'), 'utf8'));

test('Terrifier y Sienna Shaw tienen sus tres perks, nombres e imagenes correctos', () => {
  const killer = catalogo.asesinos.find(x => x.id === 'k_terrifier');
  assert.deepEqual([killer.nombre_en, killer.nombre_es, killer.nombre_es_es], ['The Terrifier', 'Terrifier', 'Terrifier']);
  const esperadas = [
    ['terrifier1', 'Funny Business', 'Nada de Jueguitos', 'Triquiñuela', 'FunnyBusiness.png'],
    ['terrifier2', 'Kill Spree', 'Racha Asesina', 'Oleada de Asesinatos', 'KillSpree.png'],
    ['terrifier3', 'Laughingstock', 'Hazmerreír', 'Hazmerreír', 'Laughingstock.png'],
    ['sienna1', 'Best Gift Ever', 'El Mejor Regalo del Mundo', 'El Mejor Regalo del Mundo', 'BestGiftEver.png'],
    ['sienna2', 'Shared Trauma', 'Trauma Compartido', 'Trauma Compartido', 'SharedTrauma.png'],
    ['sienna3', 'Valkyries Rage', 'Furia de la Valquiria', 'Furia de la Valquiria', 'ValkyriesRage.png']
  ];
  for (const [id, ...nombres] of esperadas) {
    const perk = catalogo.habilidades.find(x => x.id === id);
    assert.deepEqual([perk.nombre_en, perk.nombre_es, perk.nombre_es_es, perk.imagen], nombres);
    assert.equal(perk.personaje, id.startsWith('sienna') ? 'Sienna Shaw' : 'The Terrifier');
  }
  const groups = personajes(catalogo);
  assert.equal(groups.find(g => g.id === 'killer:The Terrifier').total, 4);
  assert.equal(groups.find(g => g.id === 'survivor:Sienna Shaw').total, 3);
  assert.equal(groups.find(g => g.id === 'killer:The Onryo').total, 4, 'Las variantes con y sin acentos se agrupan juntas.');
});

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ruleta-state-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('ruleta-state-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  prepararInstalacion(repo, root, 'test');
  const server = iniciarServidor({ root, source: repo, port: 0 });
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const api = async (route, method = 'GET', body, status = 200) => {
    const res = await fetch(base + '/api/' + route, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal(res.status, status, await res.clone().text());
    return res.headers.get('Content-Type')?.includes('application/json') ? res.json() : res.text();
  };
  return { root, api, read: () => JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8')) };
}

test('API configura widgets, agrupa personajes y recupera un perfil sin eliminar catalogo nuevo', async t => {
  const { root, api, read } = await fixture(t);
  const config = configuracionActual(catalogo);
  config.perks = { color: '#12ab56', idioma: 'en', duracion: 4000, mostrarControles: false, tipo: 'killer' };
  await api('configuracion', 'PUT', config);
  const html = fs.readFileSync(path.join(root, 'ruleta-perks.html'), 'utf8');
  assert.ok(html.includes('"color":"#12ab56"'));
  assert.ok(html.includes('"administrado":true'));
  await api('personajes/' + encodeURIComponent('killer:The Terrifier'), 'PUT', { activo: false });
  assert.equal(read().asesinos.find(x => x.id === 'k_terrifier').activo, false);
  assert.ok(read().habilidades.filter(x => x.personaje === 'The Terrifier').every(x => x.activo === false));
  await api('habilidades/terrifier1', 'PUT', { activo: true });
  assert.equal((await api('estado')).personajes.find(x => x.id === 'killer:The Terrifier').parcial, true);
  const profile = await api('perfiles', 'POST', { nombre: 'Mi desafío' });
  await api('perfiles', 'POST', { nombre: 'MI DESAFÍO' }, 400);
  await api('personajes/' + encodeURIComponent('survivor:Sienna Shaw'), 'PUT', { activo: false });
  config.perks.idioma = 'es-es'; await api('configuracion', 'PUT', config);
  const expanded = read(); expanded.habilidades.push({ id: 'nueva_despues', nombre_en: 'New perk', activo: true });
  fs.writeFileSync(path.join(root, 'data.json'), JSON.stringify(expanded));
  await api('perfiles/' + profile.id + '/aplicar', 'POST');
  assert.equal(read().ajustes.perks.idioma, 'en');
  assert.equal(read().habilidades.find(x => x.id === 'sienna1').activo, true);
  assert.equal(read().habilidades.find(x => x.id === 'nueva_despues').activo, false);
  assert.equal((await api('estado')).respaldos.length, 1);
  await api('perfiles/' + profile.id, 'DELETE');
  assert.equal((await api('estado')).perfiles.length, 0);
});

test('respaldos restauran ajustes y seleccion; datos invalidos nunca sobrescriben los actuales', async t => {
  const { root, api, read } = await fixture(t);
  const config = configuracionActual(catalogo); config.killers.idioma = 'en';
  await api('configuracion', 'PUT', config);
  const widgetAntes = fs.readFileSync(path.join(root, 'ruleta-perks.html'), 'utf8');
  await api('preferencias-editor', 'PUT', { tema: 'claro' });
  assert.equal((await api('estado')).temaEditor, 'claro');
  assert.equal(fs.readFileSync(path.join(root, 'ruleta-perks.html'), 'utf8'), widgetAntes, 'El tema del editor no modifica los widgets.');
  const saved = await api('respaldos', 'POST');
  await api('personajes/' + encodeURIComponent('killer:The Terrifier'), 'PUT', { activo: false });
  const result = await api('respaldos/' + saved.backup + '/restaurar', 'POST');
  assert.equal(read().asesinos.find(x => x.id === 'k_terrifier').activo, true);
  assert.equal(read().ajustes.killers.idioma, 'en');
  assert.equal((await api('estado')).temaEditor, 'claro', 'Restaurar un sorteo no altera el tema del editor.');
  await api('preferencias-editor', 'PUT', { tema: 'invalido' }, 400);
  assert.equal((await api('estado')).temaEditor, 'claro');
  const previous = JSON.parse(fs.readFileSync(path.join(root, 'backups', result.backup), 'utf8'));
  assert.equal(previous.asesinos.find(x => x.id === 'k_terrifier').activo, false);
  const before = fs.readFileSync(path.join(root, 'data.json'), 'utf8');
  await api('configuracion', 'PUT', { ...config, perks: { ...config.perks, color: '</script>' } }, 400);
  await api('personajes/no-existe', 'PUT', { activo: true }, 400);
  fs.writeFileSync(path.join(root, 'backups', 'roto.json'), '{');
  await api('respaldos/roto.json/restaurar', 'POST', undefined, 400);
  await api('respaldos/' + encodeURIComponent('../data.json') + '/restaurar', 'POST', undefined, 404);
  assert.equal(fs.readFileSync(path.join(root, 'data.json'), 'utf8'), before);
});
