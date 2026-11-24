'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const executable = path.resolve(process.argv[2] || 'release/win-unpacked/Ruleta Perks y Killers.exe');
if (!fs.existsSync(executable)) throw new Error('Primero genera la aplicacion con npm run dist:windows.');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ruleta-app-smoke-'));
const env = { ...process.env, RULETA_DESKTOP_DATA: profile };
delete env.ELECTRON_RUN_AS_NODE;
if (process.platform === 'win32') {
  delete env.PATH;
  env.Path = path.join(process.env.SystemRoot, 'System32');
}
const child = spawn(executable, ['--smoke-test'], { env, windowsHide: true, stdio: 'pipe' });
let output = '', timedOut = false;
const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 45000);
child.stdout.on('data', chunk => { output += chunk; process.stdout.write(chunk); });
child.stderr.on('data', chunk => process.stderr.write(chunk));
function limpiar() {
  clearTimeout(timeout);
  if (path.dirname(profile) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith('ruleta-app-smoke-')) throw new Error('Perfil de prueba inesperado.');
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
child.on('error', error => { limpiar(); console.error(error); process.exitCode = 1; });
child.on('exit', code => {
  limpiar();
  if (timedOut || code !== 0 || !output.includes('RULETA_SMOKE_OK')) {
    console.error('La aplicacion empaquetada no supero la prueba de arranque. Codigo: ' + code);
    process.exitCode = 1;
  }
});
