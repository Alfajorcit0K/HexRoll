'use strict';
const fs = require('fs');
const crypto = require('crypto');

function nombreRespaldo() { return 'Snapshot' + Date.now() + crypto.randomBytes(4).toString('hex') + '.json'; }


function validarDatos(data) {
  if (!data || !Array.isArray(data.habilidades) ||
      (data.asesinos !== undefined && !Array.isArray(data.asesinos))) {
    throw new Error('El archivo debe contener una lista de habilidades y, opcionalmente, de asesinos.');
  }
  for (const key of ['habilidades', 'asesinos']) {
    const ids = new Set();
    for (const item of data[key] || []) {
      if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.id) || ids.has(item.id)) {
        throw new Error('Identificador ausente, invalido o repetido en ' + key + '.');
      }
      ids.add(item.id);
      if (item.imagen != null && (typeof item.imagen !== 'string' || /[\\/<>:"'\u0000-\u001f]/.test(item.imagen))) {
        throw new Error('La imagen debe ser un nombre de archivo local valido.');
      }
      if (item.activo !== undefined && typeof item.activo !== 'boolean') {
        throw new Error('El campo activo debe ser verdadero o falso.');
      }
    }
  }
  if (data.ajustes !== undefined) require('./State').validarConfiguracion(data.ajustes);
  return data;
}

// Actualiza los metadatos y conserva selecciones y elementos personalizados.
// El contenido nuevo queda desactivado hasta que el usuario decida usarlo.
function fusionarDatos(actual, catalogo) {
  validarDatos(actual);
  validarDatos(catalogo);
  const resultado = { ...actual };
  for (const key of ['habilidades', 'asesinos']) {
    const anteriores = actual[key] || [];
    const porId = new Map(anteriores.map(item => [item.id, item]));
    const nuevos = new Map((catalogo[key] || []).map(item => [item.id, item]));
    resultado[key] = anteriores.map(item => nuevos.has(item.id)
      ? { ...item, ...nuevos.get(item.id), activo: item.activo !== false }
      : { ...item });
    for (const item of nuevos.values()) {
      if (!porId.has(item.id)) resultado[key].push({ ...item, activo: false });
    }
  }
  return resultado;
}

function construirWidget(template, data, { modo = null, configuracion = null } = {}) {
  validarDatos(data);
  if (![null, 'perks', 'asesino'].includes(modo)) throw new Error('Modo de widget invalido.');
  let output = template;
  if (modo && !output.includes('/*START_MODO_FIJO*/')) throw new Error('La plantilla no admite widgets independientes.');
  const habilidades = configuracion?.tipoFijo
    ? data.habilidades.filter(h => h.esVacio || h.tipo === configuracion.tipoFijo) : data.habilidades;
  for (const [marker, value] of [['HABILIDADES', modo === 'asesino' ? [] : habilidades], ['ASESINOS', modo === 'perks' ? [] : data.asesinos || []]]) {
    const regex = new RegExp('/\\*START_' + marker + '\\*/.*?/\\*END_' + marker + '\\*/', 's');
    if (!regex.test(output)) throw new Error('Falta el marcador ' + marker + ' en la plantilla.');
    const json = JSON.stringify(value).replace(/</g, '\\u003c');
    output = output.replace(regex, () => '/*START_' + marker + '*/' + json + '/*END_' + marker + '*/');
  }
  output = output.replace(/\/\*START_MODO_FIJO\*\/.*?\/\*END_MODO_FIJO\*\//s,
    () => '/*START_MODO_FIJO*/' + JSON.stringify(modo) + '/*END_MODO_FIJO*/');
  output = output.replace(/\/\*START_CONFIG_WIDGET\*\/.*?\/\*END_CONFIG_WIDGET\*\//s,
    () => '/*START_CONFIG_WIDGET*/' + JSON.stringify(configuracion).replace(/</g, '\\u003c') + '/*END_CONFIG_WIDGET*/');
  if (modo) {
    output = output.replace(/\s*<div class="idioma-toggle" id="modoToggle" title="Modo de ruleta">[\s\S]*?<\/div>/, '');
    output = output.replace('<title>HexRoll</title>', '<title>HexRoll · ' + (modo === 'perks' ? 'perks' : 'killers') + '</title>');
  }
  if (configuracion?.tipoFijo) {
    output = output.replace(/\s*<div class="idioma-toggle" id="tipoToggle" title="Tipo de perks">[\s\S]*?<\/div>/, '');
    output = output.replace('<title>HexRoll · perks</title>', '<title>HexRoll · Perks de ' + configuracion.tipoFijo + '</title>');
  }
  return output;
}

// Las rutas anteriores solo se regeneran cuando ya existen en la instalacion.
const WIDGET_ALIASES = Object.freeze({
  "ruleta-perks-survivor.html": "SPerksRoulette.html",
  "ruleta-perks-killer.html": "KPerksRoulette.html",
  "ruleta-killers.html": "KRoulette.html",
  "ruleta-perks-survivor-lite.html": "SPerksRouletteLite.html",
  "ruleta-perks-killer-lite.html": "KPerksRouletteLite.html",
  "ruleta-killers-lite.html": "KRouletteLite.html",
  "ruleta-perks.html": "PerksRoulette.html",
  "ruleta-perks-lite.html": "PerksRouletteLite.html",
  "ruleta-perks-libre.html": "CombinedRoulette.html",
  "ruleta-perks-lite-libre.html": "CombinedRouletteLite.html",
  "ruleta-completa.html": "CombinedRoulette.html"
});

const VARIANTES_WIDGET = Object.freeze([
  { archivo: 'SPerksRoulette.html', modo: 'perks', config: 'perksSurvivor', tipo: 'survivor' },
  { archivo: 'KPerksRoulette.html', modo: 'perks', config: 'perksKiller', tipo: 'killer' },
  { archivo: 'SPerksRouletteLite.html', modo: 'perks', config: 'perksSurvivor', tipo: 'survivor', lite: true },
  { archivo: 'KPerksRouletteLite.html', modo: 'perks', config: 'perksKiller', tipo: 'killer', lite: true },
  { archivo: 'PerksRoulette.html', modo: 'perks' },
  { archivo: 'KRoulette.html', modo: 'asesino' },
  { archivo: 'PerksRouletteLite.html', modo: 'perks', lite: true },
  { archivo: 'KRouletteLite.html', modo: 'asesino', lite: true },
  // Compatibilidad para fuentes anteriores y para recuperar la ruleta combinada.
  { archivo: 'CombinedRoulette.html', modo: null },
  { archivo: 'CombinedRouletteLite.html', modo: null, lite: true },
]);

function construirWidgets({ normal, lite = normal }, data) {
  const config = require('./State').configuracionActual(data);
  return Object.fromEntries(VARIANTES_WIDGET.map(variante => [variante.archivo,
    construirWidget(variante.lite ? lite : normal, data, { modo: variante.modo, configuracion: variante.modo ? {
      ...config[variante.config || (variante.modo === 'perks' ? 'perks' : 'killers')],
      ...(variante.tipo ? { tipoFijo: variante.tipo } : {}), administrado: !!variante.tipo || !!data.ajustes
    } : null })]));
}

function guardarDatos(file, data) {
  validarDatos(data);
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(file + '.tmp', file);
}

module.exports = { validarDatos, fusionarDatos, construirWidget, construirWidgets, VARIANTES_WIDGET, WIDGET_ALIASES, nombreRespaldo, guardarDatos };
