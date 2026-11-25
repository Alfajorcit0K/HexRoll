'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validarDatos, fusionarDatos, guardarDatos } = require('../ruleta-core');

function respaldar(root) {
  const dir = path.join(root, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, 'data-' + Date.now() + '-' + crypto.randomUUID() + '.json');
  fs.copyFileSync(path.join(root, 'data.json'), backup);
  return backup;
}

function copiarImagenes(source, root, overwrite) {
  for (const carpeta of ['perks', 'killers']) {
    const origen = path.join(source, 'imagenes', carpeta);
    const destino = path.join(root, 'imagenes', carpeta);
    fs.mkdirSync(destino, { recursive: true });
    if (!fs.existsSync(origen)) continue;
    for (const file of fs.readdirSync(origen, { withFileTypes: true })) {
      if (!file.isFile() || !/\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)) continue;
      const target = path.join(destino, file.name);
      if (overwrite || !fs.existsSync(target)) fs.copyFileSync(path.join(origen, file.name), target);
    }
  }
}

function prepararInstalacion(source, root, version = 'desarrollo') {
  const catalogoText = fs.readFileSync(path.join(source, 'data.json'), 'utf8');
  const catalogo = validarDatos(JSON.parse(catalogoText));
  const hash = crypto.createHash('sha256').update(catalogoText).update(version).digest('hex');
  fs.mkdirSync(root, { recursive: true });
  const dataFile = path.join(root, 'data.json');
  const estadoFile = path.join(root, 'catalogo-instalado.json');
  let hashPrevio;
  if (fs.existsSync(estadoFile)) hashPrevio = JSON.parse(fs.readFileSync(estadoFile, 'utf8')).hash;
  if (fs.existsSync(dataFile)) {
    // Validar antes de copiar o escribir: una instalacion dañada se conserva.
    const actual = validarDatos(JSON.parse(fs.readFileSync(dataFile, 'utf8')));
    if (hashPrevio !== hash) {
      respaldar(root);
      guardarDatos(dataFile, fusionarDatos(actual, catalogo));
    }
  } else {
    guardarDatos(dataFile, catalogo);
  }
  copiarImagenes(source, root, hashPrevio !== hash);
  fs.writeFileSync(estadoFile, JSON.stringify({ hash }, null, 2));
  return {
    root,
    perksSurvivor: path.join(root, 'ruleta-perks-survivor.html'), perksSurvivorLite: path.join(root, 'ruleta-perks-survivor-lite.html'),
    perksKiller: path.join(root, 'ruleta-perks-killer.html'), perksKillerLite: path.join(root, 'ruleta-perks-killer-lite.html'),
    widget: path.join(root, 'ruleta-perks.html'), widgetLite: path.join(root, 'ruleta-perks-lite.html'),
    killer: path.join(root, 'ruleta-killers.html'), killerLite: path.join(root, 'ruleta-killers-lite.html')
  };
}

function importarInstalacion(source, root, archivo) {
  const anteriores = validarDatos(JSON.parse(fs.readFileSync(archivo, 'utf8')));
  const catalogo = validarDatos(JSON.parse(fs.readFileSync(path.join(source, 'data.json'), 'utf8')));
  const merged = fusionarDatos(anteriores, catalogo);
  const backup = respaldar(root);
  copiarImagenes(path.dirname(archivo), root, false);
  guardarDatos(path.join(root, 'data.json'), merged);
  return { backup };
}

module.exports = { prepararInstalacion, importarInstalacion };
