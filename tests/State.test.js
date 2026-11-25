'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { iniciarServidor } = require('../Server');
const { prepararInstalacion } = require('../desktop/storage');
const { configuracionActual, validarConfiguracion, personajes } = require('../State');
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
  const survivors = groups.filter(g => g.tipo === 'survivor' && g.nombre !== 'Perks generales');
  assert.equal(survivors.length, 55);
  assert.ok(survivors.every(g => g.imagen && fs.existsSync(path.join(repo, 'images', g.imagen))), 'Cada survivor tiene un retrato local.');
  assert.equal(groups.find(g => g.nombre === 'Aestri Yazar & Baermar Uraz').imagen, 'survivors/TheTroupe.png');
  assert.equal(groups.find(g => g.nombre === 'Rick Grimes').imagen, 'survivors/RickGrimes.png');
  assert.equal(groups.find(g => g.id === 'killer:The Trapper').imagen, 'killers/TheTrapper.png');
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

test('configuracion anterior conserva su apariencia y crea ajustes independientes por rol', () => {
  const anterior = { perks: { color: '#123abc', idioma: 'en', duracion: 4000, mostrarControles: true, tipo: 'killer' }, killers: { color: '#abcdef', idioma: 'es-es', duracion: 1000, mostrarControles: false } };
  const config = validarConfiguracion(anterior);
  assert.deepEqual(config.perks, anterior.perks);
  assert.equal(config.perksSurvivor.tipo, 'survivor');
  assert.equal(config.perksKiller.tipo, 'killer');
  assert.equal(config.perksSurvivor.color, anterior.perks.color);
  config.perksSurvivor.color = '#112233';
  assert.equal(config.perksKiller.color, '#123abc');
  assert.equal(anterior.perks.color, '#123abc');
  assert.throws(() => validarConfiguracion({ ...config, perksKiller: { ...config.perksKiller, tipo: 'survivor' } }));
});

test('perfiles y preferencias con nombres antiguos se recuperan en los archivos nuevos', async t => {
  const { root, api, read } = await fixture(t);
  const profile = { id: 'anterior', nombre: 'Mi perfil anterior', ajustes: configuracionActual(catalogo), seleccion: { habilidades: { sienna1: true }, asesinos: { k_terrifier: true } } };
  const oldProfiles = JSON.stringify([profile]);
  const oldSettings = JSON.stringify({ tema: 'oscuro', idiomaPersonajes: 'es-es' });
  fs.writeFileSync(path.join(root, 'perfiles.json'), oldProfiles);
  fs.writeFileSync(path.join(root, 'editor-preferencias.json'), oldSettings);
  const estado = await api('estado');
  assert.equal(estado.perfiles[0].nombre, profile.nombre);
  assert.equal(estado.temaEditor, 'oscuro');
  assert.equal(estado.idiomaPersonajes, 'es-es');
  await api('perfiles/anterior/aplicar', 'POST');
  assert.equal(read().habilidades.find(h => h.id === 'sienna1').activo, true);
  await api('perfiles', 'POST', { nombre: 'Nuevo' });
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'Profiles.json'), 'utf8')).length, 2);
  await api('preferencias-editor', 'PUT', { tema: 'claro' });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'EditorSettings.json'), 'utf8')), { tema: 'claro', idiomaPersonajes: 'es-es' });
  assert.equal(fs.readFileSync(path.join(root, 'perfiles.json'), 'utf8'), oldProfiles);
  assert.equal(fs.readFileSync(path.join(root, 'editor-preferencias.json'), 'utf8'), oldSettings);
});

test('fuentes por rol conservan apariencia propia al guardar perfiles y al recuperar perfiles antiguos', async t => {
  const { root, api, read } = await fixture(t);
  const config = configuracionActual(catalogo);
  config.perksSurvivor.color = '#11aa44'; config.perksSurvivor.idioma = 'en';
  config.perksKiller.color = '#cc5522'; config.perksKiller.idioma = 'es-es';
  await api('configuracion', 'PUT', config);
  for (const [archivo, color, tipo] of [['SPerksRoulette.html', '#11aa44', 'survivor'], ['KPerksRouletteLite.html', '#cc5522', 'killer']]) {
    const html = fs.readFileSync(path.join(root, archivo), 'utf8');
    const payload = JSON.parse(html.match(/\/\*START_HABILIDADES\*\/([\s\S]*?)\/\*END_HABILIDADES\*\//)[1]);
    assert.ok(payload.some(h => !h.esVacio));
    assert.ok(payload.every(h => h.esVacio || h.tipo === tipo));
    assert.ok(html.includes('"color":"' + color + '"'));
    assert.doesNotMatch(html, /data-tipo=/);
  }
  const saved = await api('perfiles', 'POST', { nombre: 'Dos tipos' });
  config.perksKiller.color = '#223344'; await api('configuracion', 'PUT', config);
  await api('perfiles/' + saved.id + '/aplicar', 'POST');
  assert.equal(read().ajustes.perksKiller.color, '#cc5522');
  assert.equal(read().ajustes.perksSurvivor.color, '#11aa44');

  const file = path.join(root, 'Profiles.json'), profiles = JSON.parse(fs.readFileSync(file, 'utf8'));
  profiles[0].ajustes = { perks: { ...config.perks, color: '#aabbcc', tipo: 'killer' }, killers: config.killers };
  fs.writeFileSync(file, JSON.stringify(profiles));
  await api('perfiles/' + saved.id + '/aplicar', 'POST');
  const restored = read().ajustes;
  assert.equal(restored.perks.tipo, 'killer');
  assert.equal(restored.perksSurvivor.tipo, 'survivor');
  assert.equal(restored.perksKiller.tipo, 'killer');
  assert.equal(restored.perksSurvivor.color, '#aabbcc');
  assert.equal(restored.perksKiller.color, '#aabbcc');
});

test('API configura widgets, agrupa personajes y recupera un perfil sin eliminar catalogo nuevo', async t => {
  const { root, api, read } = await fixture(t);
  const config = configuracionActual(catalogo);
  config.perks = { color: '#12ab56', idioma: 'en', duracion: 4000, mostrarControles: false, tipo: 'killer' };
  await api('configuracion', 'PUT', config);
  const html = fs.readFileSync(path.join(root, 'PerksRoulette.html'), 'utf8');
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
  const widgetAntes = fs.readFileSync(path.join(root, 'PerksRoulette.html'), 'utf8');
  await api('preferencias-editor', 'PUT', { tema: 'claro' });
  assert.equal((await api('estado')).temaEditor, 'claro');
  assert.equal((await api('estado')).idiomaPersonajes, 'en');
  const datosAntesIdioma = fs.readFileSync(path.join(root, 'data.json'), 'utf8');
  await api('preferencias-editor', 'PUT', { idiomaPersonajes: 'es-es' });
  assert.equal((await api('estado')).temaEditor, 'claro');
  await api('preferencias-editor', 'PUT', { tema: 'oscuro' });
  assert.equal((await api('estado')).idiomaPersonajes, 'es-es', 'Cambiar el tema conserva el idioma de los nombres.');
  await api('preferencias-editor', 'PUT', { tema: 'claro' });
  await api('preferencias-editor', 'PUT', { tema: 'oscuro', idiomaPersonajes: 'xx' }, 400);
  assert.equal((await api('estado')).temaEditor, 'claro', 'Un cambio invalido no guarda parcialmente las preferencias.');
  const executioner = (await api('estado')).personajes.find(g => g.id === 'killer:The Executioner');
  assert.deepEqual([executioner.nombre_en, executioner.nombre_es_es, executioner.nombre_es], ['The Executioner', 'El Verdugo', 'El Ejecutor']);
  assert.equal(fs.readFileSync(path.join(root, 'data.json'), 'utf8'), datosAntesIdioma, 'El idioma de los nombres no altera la seleccion ni la apariencia de los widgets.');
  await api('preferencias-editor', 'PUT', { colorEditor: '#2478cc' });
  await api('preferencias-editor', 'PUT', { tema: 'oscuro' });
  assert.equal((await api('estado')).colorEditor, '#2478cc');
  assert.equal((await api('estado')).idiomaPersonajes, 'es-es');
  await api('preferencias-editor', 'PUT', { colorEditor: 'invalido', tema: 'claro' }, 400);
  assert.equal((await api('estado')).temaEditor, 'oscuro');
  await api('preferencias-editor', 'PUT', { tema: 'claro' });
  assert.equal(fs.readFileSync(path.join(root, 'data.json'), 'utf8'), datosAntesIdioma, 'El tema del editor no altera los widgets.');
  assert.equal(fs.readFileSync(path.join(root, 'PerksRoulette.html'), 'utf8'), widgetAntes, 'El tema del editor no modifica los widgets.');
  const saved = await api('respaldos', 'POST');
  await api('personajes/' + encodeURIComponent('killer:The Terrifier'), 'PUT', { activo: false });
  const result = await api('respaldos/' + saved.backup + '/restaurar', 'POST');
  assert.equal(read().asesinos.find(x => x.id === 'k_terrifier').activo, true);
  assert.equal(read().ajustes.killers.idioma, 'en');
  assert.equal((await api('estado')).temaEditor, 'claro', 'Restaurar un sorteo no altera el tema del editor.');
  assert.equal((await api('estado')).idiomaPersonajes, 'es-es', 'Restaurar un sorteo conserva el idioma del editor.');
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
