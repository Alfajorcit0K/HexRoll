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

function construirWidget(template, data) {
  validarDatos(data);
  let output = template;
  for (const [marker, value] of [['HABILIDADES', data.habilidades], ['ASESINOS', data.asesinos || []]]) {
    const regex = new RegExp('/\\*START_' + marker + '\\*/.*?/\\*END_' + marker + '\\*/', 's');
    if (!regex.test(output)) throw new Error('Falta el marcador ' + marker + ' en la plantilla.');
    const json = JSON.stringify(value).replace(/</g, '\\u003c');
    output = output.replace(regex, () => '/*START_' + marker + '*/' + json + '/*END_' + marker + '*/');
  }
  return output;
}

function guardarDatos(file, data) {
  validarDatos(data);
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(file + '.tmp', file);
}

module.exports = { validarDatos, fusionarDatos, construirWidget, guardarDatos };
