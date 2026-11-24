'use strict';
const fs = require('fs');

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

function construirWidget(template, data, { modo = null } = {}) {
  validarDatos(data);
  if (![null, 'perks', 'asesino'].includes(modo)) throw new Error('Modo de widget invalido.');
  let output = template;
  if (modo && !output.includes('/*START_MODO_FIJO*/')) throw new Error('La plantilla no admite widgets independientes.');
  for (const [marker, value] of [['HABILIDADES', modo === 'asesino' ? [] : data.habilidades], ['ASESINOS', modo === 'perks' ? [] : data.asesinos || []]]) {
    const regex = new RegExp('/\\*START_' + marker + '\\*/.*?/\\*END_' + marker + '\\*/', 's');
    if (!regex.test(output)) throw new Error('Falta el marcador ' + marker + ' en la plantilla.');
    const json = JSON.stringify(value).replace(/</g, '\\u003c');
    output = output.replace(regex, () => '/*START_' + marker + '*/' + json + '/*END_' + marker + '*/');
  }
  output = output.replace(/\/\*START_MODO_FIJO\*\/.*?\/\*END_MODO_FIJO\*\//s,
    () => '/*START_MODO_FIJO*/' + JSON.stringify(modo) + '/*END_MODO_FIJO*/');
  if (modo) {
    output = output.replace(/\s*<div class="idioma-toggle" id="modoToggle" title="Modo de ruleta">[\s\S]*?<\/div>/, '');
    output = output.replace('<title>Ruleta Perks</title>', '<title>Ruleta de ' + (modo === 'perks' ? 'perks' : 'killers') + '</title>');
  }
  return output;
}

const VARIANTES_WIDGET = Object.freeze([
  { archivo: 'ruleta-perks.html', modo: 'perks' },
  { archivo: 'ruleta-killers.html', modo: 'asesino' },
  { archivo: 'ruleta-perks-lite.html', modo: 'perks', lite: true },
  { archivo: 'ruleta-killers-lite.html', modo: 'asesino', lite: true },
  // Compatibilidad para fuentes anteriores y para recuperar la ruleta combinada.
  { archivo: 'ruleta-perks-libre.html', modo: null },
  { archivo: 'ruleta-perks-lite-libre.html', modo: null, lite: true },
  { archivo: 'ruleta-completa.html', modo: null }
]);

function construirWidgets({ normal, lite = normal }, data) {
  return Object.fromEntries(VARIANTES_WIDGET.map(variante => [variante.archivo,
    construirWidget(variante.lite ? lite : normal, data, { modo: variante.modo })]));
}

function guardarDatos(file, data) {
  validarDatos(data);
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(file + '.tmp', file);
}

module.exports = { validarDatos, fusionarDatos, construirWidget, construirWidgets, VARIANTES_WIDGET, guardarDatos };
