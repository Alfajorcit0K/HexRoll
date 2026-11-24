'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { validarDatos, construirWidgets } = require('./ruleta-core');

function generar({ lite = false, zip = true } = {}) {
  const root = __dirname;
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const nombre = 'ruleta-perks-' + version + (lite ? '-lite' : '');
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  // Construye siempre en una carpeta nueva para no arrastrar archivos ajenos
  // ni sobrescribir una instalacion que alguien haya abierto desde dist/.
  const stage = fs.mkdtempSync(path.join(dist, '.build-'));
  const destino = path.join(stage, nombre);
  fs.mkdirSync(destino, { recursive: true });
  // Lista explicita: excluye archivos personales y carpetas historicas.
  const archivos = [
    'editor-ruleta-perks.js', 'ruleta-core.js', 'app-state.js', 'editor-habilidades.html',
    'editor-ui.js',
    'ABRIR_EDITOR_PERKS.bat', 'MANUAL_CLIENTE.txt', 'README.md', 'LICENSE',
    'THIRD_PARTY_NOTICES.md', 'asesinos-default.json', 'personajes-habilidades.json', 'config-publica.json'
  ];
  for (const file of archivos) fs.copyFileSync(path.join(root, file), path.join(destino, file));
  const template = fs.readFileSync(path.join(root, lite ? 'widget-template-lite.html' : 'widget-template.html'), 'utf8');
  const catalogo = validarDatos(JSON.parse(fs.readFileSync(path.join(root, 'data.json'), 'utf8')));
  fs.writeFileSync(path.join(destino, 'widget-template.html'), template);
  fs.writeFileSync(path.join(destino, 'data.json'), JSON.stringify(catalogo, null, 2));
  const templateLite = fs.readFileSync(path.join(root, 'widget-template-lite.html'), 'utf8');
  fs.writeFileSync(path.join(destino, 'widget-template-lite.html'), templateLite);
  for (const [archivo, html] of Object.entries(construirWidgets({ normal: template, lite: templateLite }, catalogo))) {
    fs.writeFileSync(path.join(destino, archivo), html);
  }
  fs.writeFileSync(path.join(destino, 'version.json'), JSON.stringify({ version, lite }, null, 2));

  // Incluye solo las imagenes referenciadas por el catalogo.
  for (const [key, carpeta] of [['habilidades', 'perks'], ['asesinos', 'killers']]) {
    const imageDir = path.join(destino, 'imagenes', carpeta);
    fs.mkdirSync(imageDir, { recursive: true });
    for (const item of catalogo[key] || []) {
      if (!item.imagen) continue;
      if (path.basename(item.imagen) !== item.imagen) throw new Error('Ruta de imagen invalida: ' + item.id);
      fs.copyFileSync(path.join(root, 'imagenes', carpeta, item.imagen), path.join(imageDir, item.imagen));
    }
  }

  console.log('Paquete local listo: ' + destino);
  if (zip) {
    if (process.platform !== 'win32') {
      console.log('La carpeta esta lista. Comprimela como ZIP para distribuirla.');
    } else {
      const zipPath = path.join(root, 'dist', nombre + '.zip');
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        'Compress-Archive -LiteralPath $env:RULETA_BUILD_DIR -DestinationPath $env:RULETA_BUILD_ZIP -Force'], {
        windowsHide: true,
        env: { ...process.env, RULETA_BUILD_DIR: destino, RULETA_BUILD_ZIP: zipPath },
        stdio: 'pipe'
      });
      console.log('ZIP local listo: ' + zipPath);
    }
  }
  return destino;
}

module.exports = { generar };
if (require.main === module) {
  try { generar({ lite: process.argv.includes('--lite'), zip: !process.argv.includes('--sin-zip') }); }
  catch (error) { console.error('No se pudo generar el paquete: ' + error.message); process.exitCode = 1; }
}
