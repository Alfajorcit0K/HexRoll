'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { once } = require('node:events');
const { getMakeNsisPath, getNsisPluginsPath } = require('app-builder-lib/out/toolsets/windows');

async function probar() {
  const cache = path.resolve('.build-cache');
  fs.mkdirSync(cache, { recursive: true });
  const root = fs.mkdtempSync(path.join(cache, 'installer-probe-'));
  let app;
  const quote = text => text.replace(/\$/g, '$$$$').replace(/"/g, '$\\"');
  try {
    const name = 'RuletaProbe-' + path.basename(root) + '.exe';
    const setup = path.join(root, name.replace('.exe', '-Setup.exe'));
    const script = path.join(root, 'probe.nsi');
    const compiler = await getMakeNsisPath();
    const plugins = await getNsisPluginsPath();
    const includes = path.resolve('node_modules/app-builder-lib/templates/nsis/include');
    fs.writeFileSync(script, [
      'Unicode true', 'Name "Ruleta Installer Guard Test"', 'RequestExecutionLevel user', 'SilentInstall silent',
      'OutFile "' + quote(setup) + '"',
      '!include "LogicLib.nsh"',
      '!addincludedir "' + quote(includes) + '"',
      '!addplugindir /x86-unicode "' + quote(path.join(plugins, 'x86-unicode')) + '"',
      '!include "nsProcess.nsh"',
      '!define APP_EXECUTABLE_FILENAME "' + name + '"',
      '!include "' + quote(path.resolve('installer/running-app.nsh')) + '"',
      'Section', 'StrCpy $INSTDIR "' + quote(root) + '"',
      '!insertmacro customCheckAppRunning', 'SetErrorLevel 0', 'SectionEnd'
    ].join('\n'));
    execFileSync(compiler.path, ['/V2', script], { env: { ...process.env, ...compiler.env }, windowsHide: true, stdio: 'pipe' });
    async function comprobar() {
      const child = spawn(setup, ['/S'], { windowsHide: true, stdio: 'ignore' });
      const timeout = setTimeout(() => child.kill(), 15000);
      try { const [code] = await once(child, 'exit'); return code; }
      finally { clearTimeout(timeout); }
    }
    // El propio instalador comparte carpeta y prefijo de nombre, pero NO es la app.
    assert.equal(await comprobar(), 0, 'El instalador no debe detectarse a si mismo.');
    const fakeApp = path.join(root, name);
    fs.copyFileSync(path.join(process.env.SystemRoot, 'System32', 'PING.EXE'), fakeApp);
    app = spawn(fakeApp, ['-t', '127.0.0.1'], { windowsHide: true, stdio: 'ignore' });
    await once(app, 'spawn');
    assert.equal(await comprobar(), 2, 'Debe detenerse si el ejecutable exacto esta abierto.');
    assert.equal(app.exitCode, null, 'La comprobacion no debe cerrar la aplicacion.');
    const stopped = once(app, 'exit'); app.kill(); await stopped; app = null;
    assert.equal(await comprobar(), 0, 'Debe continuar despues de cerrar la aplicacion.');
    console.log('RULETA_INSTALLER_CHECK_OK: sin falsos positivos, bloqueo real y sin cierre forzado.');
  } finally {
    if (app && app.exitCode === null && app.signalCode === null) { const stopped = once(app, 'exit'); app.kill(); await stopped; }
    assert.equal(path.dirname(root), cache);
    assert.ok(path.basename(root).startsWith('installer-probe-'));
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

probar().catch(error => { console.error(error); process.exitCode = 1; });
