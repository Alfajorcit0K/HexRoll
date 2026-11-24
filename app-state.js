'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = { color: '#c83cff', idioma: 'es', duracion: 2200, mostrarControles: false };
function configuracionActual(data) {
  return { perks: { ...BASE, tipo: 'survivor', ...data.ajustes?.perks }, killers: { ...BASE, ...data.ajustes?.killers } };
}
function validarConfiguracion(config) {
  if (!config || typeof config !== 'object') throw new Error('Configuracion invalida.');
  const result = {};
  for (const tipo of ['perks', 'killers']) {
    const item = config[tipo];
    if (!item || !/^#[a-f0-9]{6}$/i.test(item.color) || !['es', 'es-es', 'en'].includes(item.idioma) ||
        !Number.isInteger(item.duracion) || item.duracion < 800 || item.duracion > 6000 || typeof item.mostrarControles !== 'boolean' ||
        (tipo === 'perks' && !['survivor', 'killer'].includes(item.tipo))) throw new Error('Revisa el color, idioma, tipo y duracion (800 a 6000 ms).');
    result[tipo] = { color: item.color.toLowerCase(), idioma: item.idioma, duracion: item.duracion, mostrarControles: item.mostrarControles };
    if (tipo === 'perks') result[tipo].tipo = item.tipo;
  }
  return result;
}

function personajes(data) {
  const groups = new Map();
  const normalizar = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const nombresKillers = new Map((data.asesinos || []).filter(k => k.nombre_en).map(k => [normalizar(k.nombre_en), k.nombre_en]));
  function group(tipo, personaje) {
    if (tipo === 'killer') personaje = nombresKillers.get(normalizar(personaje)) || personaje;
    const id = tipo + ':' + personaje;
    if (!groups.has(id)) groups.set(id, { id, tipo, nombre: personaje, habilidades: [], asesinos: [] });
    return groups.get(id);
  }
  for (const h of data.habilidades) group(h.esVacio ? 'vacio' : h.tipo || 'survivor', h.esVacio ? 'Espacios vacios' : h.general ? 'Perks generales' : h.personaje || 'Sin personaje').habilidades.push(h);
  for (const killer of data.asesinos || []) {
    const g = group('killer', killer.nombre_en);
    g.asesinos.push(killer);
    g.nombre = killer.nombre_es || killer.nombre_en;
    g.nombre_en = killer.nombre_en;
  }
  return [...groups.values()].map(g => {
    const items = [...g.habilidades, ...g.asesinos];
    const activos = items.filter(x => x.activo !== false).length;
    return { ...g, habilidades: g.habilidades.map(x => x.id), asesinos: g.asesinos.map(x => x.id), total: items.length, activos, activo: activos === items.length, parcial: activos > 0 && activos < items.length };
  }).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nombre.localeCompare(b.nombre));
}

function crearEstado(root, catalogo, readData, writeData, regenerar) {
  const { validarDatos, fusionarDatos } = require('./ruleta-core');
  const profilesFile = path.join(root, 'perfiles.json');
  const editorFile = path.join(root, 'editor-preferencias.json');
  const backupDir = path.join(root, 'backups');
  function guardarJSON(file, value) { fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2)); fs.renameSync(file + '.tmp', file); }
  function perfiles() {
    if (!fs.existsSync(profilesFile)) return [];
    const value = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
    if (!Array.isArray(value)) throw new Error('El archivo de perfiles esta dañado. Conserva una copia antes de recuperarlo.');
    return value;
  }
  function respaldar() {
    fs.mkdirSync(backupDir, { recursive: true });
    const nombre = 'data-' + Date.now() + '-' + crypto.randomUUID() + '.json';
    guardarJSON(path.join(backupDir, nombre), readData());
    return nombre;
  }
  function respaldos() {
    if (!fs.existsSync(backupDir)) return [];
    return fs.readdirSync(backupDir, { withFileTypes: true }).filter(x => x.isFile() && /^[a-zA-Z0-9_-]+\.json$/.test(x.name)).map(x => ({ nombre: x.name, fecha: fs.statSync(path.join(backupDir, x.name)).mtime.toISOString() })).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  function guardar(data) { writeData(data); regenerar(); }
  return {
    obtener() {
      const preferencias = fs.existsSync(editorFile) ? JSON.parse(fs.readFileSync(editorFile, 'utf8')) : {};
      return { temaEditor: ['oscuro', 'claro'].includes(preferencias.tema) ? preferencias.tema : null, configuracion: configuracionActual(readData()), personajes: personajes(readData()), perfiles: perfiles().map(({ id, nombre, fecha }) => ({ id, nombre, fecha })), respaldos: respaldos() };
    },
    temaEditor(tema) {
      if (!['oscuro', 'claro'].includes(tema)) throw new Error('Selecciona un tema claro u oscuro.');
      guardarJSON(editorFile, { tema }); return { tema };
    },
    configurar(config) { const data = readData(); data.ajustes = validarConfiguracion(config); guardar(data); return data.ajustes; },
    personaje(id, activo) {
      if (typeof activo !== 'boolean') throw new Error('Seleccion de personaje invalida.');
      const data = readData(), g = personajes(data).find(x => x.id === id);
      if (!g) throw new Error('Personaje no encontrado.');
      for (const item of data.habilidades) if (g.habilidades.includes(item.id)) item.activo = activo;
      for (const item of data.asesinos || []) if (g.asesinos.includes(item.id)) item.activo = activo;
      guardar(data); return { ok: true };
    },
    crearPerfil(nombre) {
      if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 60) throw new Error('Escribe un nombre de perfil de hasta 60 caracteres.');
      const list = perfiles();
      if (list.length >= 50) throw new Error('Puedes guardar hasta 50 perfiles.');
      if (list.some(x => x.nombre.toLocaleLowerCase() === nombre.trim().toLocaleLowerCase())) throw new Error('Ya existe un perfil con ese nombre.');
      const data = readData(), seleccion = {};
      for (const key of ['habilidades', 'asesinos']) seleccion[key] = Object.fromEntries((data[key] || []).map(x => [x.id, x.activo !== false]));
      const perfil = { id: crypto.randomUUID(), nombre: nombre.trim(), fecha: new Date().toISOString(), ajustes: configuracionActual(data), seleccion };
      guardarJSON(profilesFile, [...list, perfil]); return { id: perfil.id };
    },
    aplicarPerfil(id) {
      const perfil = perfiles().find(x => x.id === id);
      if (!perfil) throw new Error('Perfil no encontrado.');
      const data = readData();
      data.ajustes = validarConfiguracion(perfil.ajustes);
      for (const key of ['habilidades', 'asesinos']) for (const item of data[key] || []) item.activo = perfil.seleccion?.[key]?.[item.id] === true;
      const backup = respaldar(); guardar(data); return { backup };
    },
    borrarPerfil(id) { const list = perfiles(); if (!list.some(x => x.id === id)) throw new Error('Perfil no encontrado.'); guardarJSON(profilesFile, list.filter(x => x.id !== id)); return { ok: true }; },
    crearRespaldo() { return { backup: respaldar() }; },
    restaurar(nombre) {
      if (!respaldos().some(x => x.nombre === nombre)) throw new Error('Respaldo no encontrado.');
      const anterior = validarDatos(JSON.parse(fs.readFileSync(path.join(backupDir, nombre), 'utf8')));
      if (anterior.ajustes) validarConfiguracion(anterior.ajustes);
      const merged = fusionarDatos(anterior, catalogo());
      const backup = respaldar(); guardar(merged); return { backup };
    }
  };
}

module.exports = { configuracionActual, validarConfiguracion, personajes, crearEstado };
