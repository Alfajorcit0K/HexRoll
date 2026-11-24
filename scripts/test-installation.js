'use strict';
// Exclusivo del runner desechable: prueba el instalador y el desinstalador reales.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { configuracionActual } = require('../app-state');

async function run(executable, args, env = process.env) {
  const child = spawn(executable, args, { env, windowsHide: true, stdio: 'pipe' });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const timeout = setTimeout(() => child.kill(), 90000);
  try { const [code] = await once(child, 'exit'); assert.equal(code, 0, output); return output; }
  finally { clearTimeout(timeout); }
}

async function probar() {
  assert.equal(process.platform, 'win32');
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Solo se ejecuta en GitHub Actions, nunca sobre la instalacion del usuario.');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted', 'Requiere un runner desechable de GitHub.');
  const version = require('../package.json').version;
  const setup = path.resolve('release', 'Ruleta-Perks-Killers-' + version + '-Setup.exe');
  const userRoot = path.resolve(process.env.APPDATA, 'RuletaPerksKillers');
  assert.ok(!fs.existsSync(userRoot), 'El runner ya tiene datos de otra instalacion; no se modificaran.');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ruleta-install-test-'));
  const install = path.join(root, 'programa');
  const dataFile = path.join(userRoot, 'widget', 'data.json');
  let installed = false;
  async function desinstalar() {
    if (!installed || !fs.existsSync(install)) return;
    const file = fs.readdirSync(install).find(x => /^Uninstall.*\.exe$/i.test(x));
    assert.ok(file, 'Falta el desinstalador.');
    const outside = path.join(root, 'uninstall-probe.exe');
    fs.copyFileSync(path.join(install, file), outside);
    await run(outside, ['/S', '/currentuser', '/KEEP_APP_DATA', '_?=' + install]);
    installed = false;
  }
  try {
    await run(setup, ['/S', '/currentuser', '/D=' + install]); installed = true;
    const executable = path.join(install, 'Ruleta Perks y Killers.exe');
    assert.ok(fs.existsSync(executable));
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    const data = JSON.parse(fs.readFileSync(path.resolve('data.json'), 'utf8'));
    data.habilidades[0].activo = false;
    data.asesinos[0].activo = false;
    data.ajustes = configuracionActual(data);
    fs.writeFileSync(dataFile, JSON.stringify(data));
    const env = { ...process.env, RULETA_DESKTOP_DATA: userRoot };
    delete env.ELECTRON_RUN_AS_NODE; delete env.PATH;
    env.Path = path.join(process.env.SystemRoot, 'System32');
    assert.ok((await run(executable, ['--smoke-test'], env)).includes('RULETA_SMOKE_OK'));
    const before = fs.readFileSync(dataFile, 'utf8');
    const profiles = fs.readFileSync(path.join(userRoot, 'widget', 'perfiles.json'), 'utf8');
    const themeFile = path.join(userRoot, 'widget', 'editor-preferencias.json');
    const theme = fs.readFileSync(themeFile, 'utf8');
    assert.equal(JSON.parse(before).habilidades[0].activo, false);
    assert.equal(JSON.parse(before).asesinos[0].activo, false);
    await run(setup, ['/S', '/currentuser', '/D=' + install]);
    assert.equal(fs.readFileSync(dataFile, 'utf8'), before, 'Reinstalar altero los ajustes.');
    assert.ok(fs.existsSync(executable));
    await desinstalar();
    assert.ok(!fs.existsSync(executable));
    assert.equal(fs.readFileSync(dataFile, 'utf8'), before, 'Desinstalar elimino los ajustes.');
    assert.equal(fs.readFileSync(path.join(userRoot, 'widget', 'perfiles.json'), 'utf8'), profiles);
    assert.equal(fs.readFileSync(themeFile, 'utf8'), theme);
    await run(setup, ['/S', '/currentuser', '/D=' + install]); installed = true;
    assert.ok(fs.existsSync(executable));
    assert.equal(fs.readFileSync(dataFile, 'utf8'), before, 'Instalar de nuevo altero los ajustes.');
    console.log('RULETA_INSTALLATION_OK: instalar, abrir sin Node, reinstalar, desinstalar y recuperar ajustes y perfiles.');
  } finally {
    await desinstalar();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('ruleta-install-test-'));
    assert.equal(userRoot, path.join(path.resolve(process.env.APPDATA), 'RuletaPerksKillers'));
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    fs.rmSync(userRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
probar().catch(error => { console.error(error); process.exitCode = 1; });
