'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validarDatos, fusionarDatos, guardarDatos, nombreRespaldo } = require('../Roulette');

function respaldar(root) {
  const dir = path.join(root, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, nombreRespaldo());
  fs.copyFileSync(path.join(root, 'data.json'), backup);
  return backup;
}

function copiarImagenes(source, root, overwrite) {
  for (const carpeta of ['perks', 'killers', 'survivors', 'brand']) {
    const destino = path.join(root, 'images', carpeta);
    fs.mkdirSync(destino, { recursive: true });
    for (const origen of [path.join(source, 'imagenes', carpeta === 'brand' ? 'marca' : carpeta), path.join(source, 'images', carpeta)]) {
      if (!fs.existsSync(origen)) continue;
      for (const file of fs.readdirSync(origen, { withFileTypes: true })) {
        if (!file.isFile() || !/\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)) continue;
        const input = path.join(origen, file.name), target = path.join(destino, file.name);
        if (path.resolve(input) === path.resolve(target)) continue;
        if (carpeta === 'brand' || overwrite || !fs.existsSync(target)) fs.copyFileSync(input, target);
      }
    }
  }
}

function prepararInstalacion(source, root, version = 'desarrollo', widgetRoot = root) {
  const catalogoText = fs.readFileSync(path.join(source, 'data.json'), 'utf8');
  const catalogo = validarDatos(JSON.parse(catalogoText));
  const hash = crypto.createHash('sha256').update(catalogoText).update(version).digest('hex');
  fs.mkdirSync(root, { recursive: true });
  const dataFile = path.join(root, 'data.json');
  const estadoFile = path.join(root, 'CatalogStamp.json');
  const estadoAnterior = fs.existsSync(estadoFile) ? estadoFile : path.join(root, 'catalogo-instalado.json');
  let hashPrevio;
  if (fs.existsSync(estadoAnterior)) hashPrevio = JSON.parse(fs.readFileSync(estadoAnterior, 'utf8')).hash;
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
  copiarImagenes(root, root, false);
  copiarImagenes(source, root, hashPrevio !== hash);
  fs.writeFileSync(estadoFile, JSON.stringify({ hash }, null, 2));
  return {
    root, widgetRoot,
    perksSurvivor: path.join(widgetRoot, 'SPerksRoulette.html'), perksSurvivorLite: path.join(widgetRoot, 'SPerksRouletteLite.html'),
    perksKiller: path.join(widgetRoot, 'KPerksRoulette.html'), perksKillerLite: path.join(widgetRoot, 'KPerksRouletteLite.html'),
    widget: path.join(widgetRoot, 'PerksRoulette.html'), widgetLite: path.join(widgetRoot, 'PerksRouletteLite.html'),
    killer: path.join(widgetRoot, 'KRoulette.html'), killerLite: path.join(widgetRoot, 'KRouletteLite.html')
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
