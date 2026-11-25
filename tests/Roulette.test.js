'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { validarDatos, fusionarDatos, construirWidget } = require('../Roulette');
const root = path.resolve(__dirname, '..');
const catalogo = JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8'));

test('actualizar conserva ajustes, personalizados y killers cuando no se importan', () => {
  const actual = { habilidades: [{ id: 'a', activo: false, nombre_en: 'Anterior' }, { id: 'propia', activo: true }], asesinos: [{ id: 'k', activo: false }], preferencia: 'personal' };
  const result = fusionarDatos(actual, { habilidades: [{ id: 'a', activo: true, nombre_en: 'Corregido' }, { id: 'nueva', activo: true }] });
  assert.equal(result.habilidades[0].activo, false);
  assert.equal(result.habilidades[0].nombre_en, 'Corregido');
  assert.equal(result.habilidades[1].id, 'propia');
  assert.equal(result.habilidades[2].activo, false);
  assert.deepEqual(result.asesinos, actual.asesinos);
  assert.equal(result.preferencia, 'personal');
  assert.equal(actual.habilidades[0].nombre_en, 'Anterior');
});

test('rechaza catalogos invalidos y protege la incrustacion de JSON', () => {
  assert.throws(() => validarDatos({ habilidades: [{ id: 'x' }, { id: 'x' }] }));
  assert.throws(() => validarDatos({ habilidades: [], asesinos: 'incorrecto' }));
  const data = { habilidades: [{ id: 'x', nombre_en: '</script><script>alert(1)</script>$&' }] };
  const html = construirWidget('/*START_HABILIDADES*/[]/*END_HABILIDADES*/;/*START_ASESINOS*/[]/*END_ASESINOS*/', data);
  assert.ok(!html.includes('</script>'));
  assert.ok(html.includes('$&'));
});

test('catalogo e imagenes existentes son coherentes', () => {
  validarDatos(catalogo);
  const defaults = JSON.parse(fs.readFileSync(path.join(root, 'Killers.json'), 'utf8'));
  assert.deepEqual(defaults, catalogo.asesinos);
  for (const [key, dir] of [['habilidades', 'perks'], ['asesinos', 'killers']]) {
    for (const item of catalogo[key]) {
      if (item.imagen) assert.ok(fs.existsSync(path.join(root, 'images', dir, item.imagen)), item.imagen);
    }
  }
});

test('distribucion publica usa carpetas nuevas y excluye archivos historicos', t => {
  const { generar } = require('../Build');
  const stages = [];
  t.after(() => {
    for (const stage of stages) {
      assert.equal(path.dirname(stage), path.join(root, 'dist'));
      assert.ok(path.basename(stage).startsWith('.build-'));
      fs.rmSync(stage, { recursive: true, force: true });
    }
  });
  for (const lite of [false, true]) {
    const dir = generar({ lite, zip: false });
    stages.push(path.dirname(dir));
    const files = fs.readdirSync(dir);
    assert.ok(files.every(file => !/[-_]/.test(file)), 'Los nombres de la distribucion no usan separadores.');
    for (const excluded of ['.git', '.build-cache', 'node_modules', 'backups', 'Profiles.json']) assert.ok(!files.includes(excluded));
    assert.ok(files.includes('LICENSE'));
    assert.ok(files.includes('Roulette.js'));
    assert.ok(files.includes('SurvivorPortraits.json'));
    assert.ok(fs.existsSync(path.join(dir, 'images', 'survivors', 'TheTroupe.png')));
    assert.ok(fs.existsSync(path.join(dir, 'images', 'brand', 'HexRoll.png')));
    assert.ok(files.includes('KRoulette.html'));
    assert.ok(files.includes('PerksRouletteLite.html'));
    assert.ok(files.includes('KRouletteLite.html'));
    const widget = fs.readFileSync(path.join(dir, 'PerksRoulette.html'), 'utf8');
    assert.doesNotMatch(widget, /LICENSE_KEY|LICENSE_URL|perks_device_id|script\.google\.com/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'version.json'), 'utf8')).lite, lite);
    new vm.Script(widget.match(/<script>([\s\S]*?)<\/script>/)[1]);
  }
  assert.notEqual(stages[0], stages[1]);
});

for (const template of ['RouletteTemplate.html', 'RouletteLiteTemplate.html']) {
  for (const modo of ['perks', 'asesino']) {
    test(template + ': completa el sorteo ' + modo + ' sin red ni activacion', async () => {
      const html = construirWidget(fs.readFileSync(path.join(root, template), 'utf8'), catalogo);
      assert.doesNotMatch(html, /LICENSE_|licenciaValida|perks_device_id|script\.google\.com/);
      const elements = new Map();
      function element(id) {
        if (!elements.has(id)) elements.set(id, { style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, querySelector: selector => element(id + selector) });
        return elements.get(id);
      }
      const saved = new Map([['perks_modo', modo]]);
      let time = 0;
      const context = vm.createContext({
        document: { getElementById: element, querySelector: element, querySelectorAll: () => [], documentElement: element('html'), visibilityState: 'visible', addEventListener() {} },
        window: { addEventListener() {} },
        localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
        performance: { now: () => time },
        requestAnimationFrame: fn => { time += 10000; fn(time); },
        setTimeout: fn => fn(),
        fetch: () => { throw new Error('El widget no debe pedir acceso a la red'); }
      });
      vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
      await new Promise(setImmediate);
      assert.equal(vm.runInContext('spinning', context), false);
      if (modo === 'perks') assert.equal(vm.runInContext('lastTargets.filter(Boolean).length', context), 4);
      else assert.ok(vm.runInContext('lastAsesino', context));
      assert.equal(saved.has('perks_device_id'), false);
    });
  }
}

test('API publica importa con respaldo y conserva killers y selecciones', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruleta-test-'));
  let child;
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) { const stopped = once(child, 'exit'); child.kill(); await stopped; }
    const resolved = path.resolve(dir);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('ruleta-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  for (const file of ['Server.js', 'Roulette.js', 'State.js', 'RouletteTemplate.html', 'Killers.json', 'Characters.json', 'SurvivorPortraits.json', 'AppLinks.json']) fs.copyFileSync(path.join(root, file), path.join(dir, file));
  const data = structuredClone(catalogo);
  data.habilidades[0].activo = false;
  data.asesinos[0].activo = false;
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(data));
  child = spawn(process.execPath, ['Server.js'], { cwd: dir, env: { ...process.env, RULETA_PORT: '0' }, windowsHide: true });
  const base = await new Promise((resolve, reject) => {
    let output = '', errors = '';
    const timer = setTimeout(() => reject(new Error('El servidor no arranco: ' + errors)), 10000);
    child.stderr.on('data', chunk => errors += chunk);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { clearTimeout(timer); reject(new Error('Salida inesperada: ' + code + ' ' + errors)); });
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)\/editor/);
      if (match) { clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]); }
    });
  });
  const response = await fetch(base + '/api/import-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ habilidades: catalogo.habilidades }) });
  assert.equal(response.status, 200);
  const after = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
  assert.equal(after.asesinos.length, catalogo.asesinos.length);
  assert.equal(after.asesinos[0].activo, false);
  assert.equal(after.habilidades[0].activo, false);
  const backups = fs.readdirSync(path.join(dir, 'backups'));
  assert.equal(backups.length, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'backups', backups[0]), 'utf8')), data);
  assert.equal((await fetch(base + '/api/proyecto')).status, 200);
  const invalid = await fetch(base + '/api/import-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ habilidades: [{ id: 'x' }, { id: 'x' }] }) });
  assert.equal(invalid.status, 400);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8')), after);
  const stopped = once(child, 'exit'); child.kill(); await stopped;
  child = null;
  fs.writeFileSync(path.join(dir, 'data.json'), '{');
  const broken = spawn(process.execPath, ['Server.js'], { cwd: dir, env: { ...process.env, RULETA_PORT: '0' }, windowsHide: true, stdio: 'ignore' });
  const [code] = await once(broken, 'exit');
  assert.notEqual(code, 0);
  assert.equal(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'), '{');
});
