'use strict';
const $ = id => document.getElementById(id);
const WIDGETS = [
  ['perksSurvivor', 'Survivor', 1120, 'SPerksRoulette'],
  ['perksKiller', 'PerksKiller', 1120, 'KPerksRoulette'],
  ['killers', 'Killers', 460, 'KRoulette']
];
let habilidades = [], asesinos = [], estado;
let colorEditor = '#d52b40';
let marcaSolicitud = 0, marcaBase;
async function actualizarMarca(color) {
  const solicitud = ++marcaSolicitud;
  try {
    let imagen;
    if (window.ruletaDesktop?.colorearLogo) imagen = await window.ruletaDesktop.colorearLogo(color);
    else {
      if (!marcaBase) marcaBase = new Promise((resolve, reject) => {
        const logo = new Image(); logo.onload = () => resolve(logo); logo.onerror = reject;
        logo.src = 'images/brand/HexRollTint.png';
      });
      const logo = await marcaBase, canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const context = canvas.getContext('2d'); context.drawImage(logo, 0, 0, 256, 256);
      const pixels = context.getImageData(0, 0, 256, 256);
      HexRollTheme.tintPixels(pixels.data, color); context.putImageData(pixels, 0, 0);
      imagen = canvas.toDataURL('image/png');
    }
    if (solicitud !== marcaSolicitud) return;
    document.querySelectorAll('.marca, .barra-marca img').forEach(logo => { logo.src = imagen; });
    document.querySelector('link[rel="icon"]').href = imagen;
  } catch (_) { /* El logo blanco sigue disponible si no se puede generar el color. */ }
}
function aplicarColorEditor(color) {
  colorEditor = color;
  const values = HexRollTheme.palette(color, document.documentElement.dataset.tema || 'oscuro');
  for (const [key, value] of Object.entries(values)) document.documentElement.style.setProperty('--' + key, value);
  $('colorEditor').value = color;
  document.querySelectorAll('[data-editor-color]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.editorColor === color)));
  void actualizarMarca(color);
}
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  $('cambiarTema').setAttribute('aria-checked', String(tema === 'oscuro'));
  $('nombreTema').textContent = tema === 'oscuro' ? 'Modo oscuro' : 'Modo claro';
  aplicarColorEditor(colorEditor);
  try { localStorage.setItem('ruleta_editor_tema', tema); } catch (_) {}
}
let temaInicial = window.matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro';
try { const cache = localStorage.getItem('ruleta_editor_tema'); if (['oscuro', 'claro'].includes(cache)) temaInicial = cache; } catch (_) {}
aplicarTema(temaInicial);
$('cambiarTema').addEventListener('click', () => accion($('cambiarTema'), async () => {
  const anterior = document.documentElement.dataset.tema;
  const tema = anterior === 'oscuro' ? 'claro' : 'oscuro';
  aplicarTema(tema);
  try { await request('/api/preferencias-editor', 'PUT', { tema }); if (estado) estado.temaEditor = tema; }
  catch (error) { aplicarTema(anterior); throw error; }
}));
const texto = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const coincide = (values, filtro) => values.some(value => texto(value).includes(texto(filtro.trim())));
function aviso(message) { $('estadoGlobal').textContent = message; $('estadoGlobal').hidden = false; }
async function request(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo guardar el cambio.');
  return result;
}
async function accion(button, callback, message = '') {
  button.disabled = true;
  try { await callback(); if (message) aviso(message); }
  catch (error) { aviso(error.message); if (estado) renderContenido(); }
  finally { button.disabled = false; }
}
async function refrescarVistas() { if (window.ruletaDesktop) await window.ruletaDesktop.refrescarVistas(); }
async function cargarTodo() {
  [habilidades, asesinos, estado] = await Promise.all([request('/api/habilidades'), request('/api/asesinos'), request('/api/estado')]);
  if (estado.temaEditor) aplicarTema(estado.temaEditor);
  aplicarColorEditor(estado.colorEditor);
  renderContenido(); renderAjustes(); renderPerfiles();
}
async function guardarColorEditor(color) {
  const anterior = estado?.colorEditor || '#d52b40';
  const controles = [$('colorEditor'), ...document.querySelectorAll('[data-editor-color]')];
  controles.forEach(control => { control.disabled = true; });
  aplicarColorEditor(color);
  try { await request('/api/preferencias-editor', 'PUT', { colorEditor: color }); estado.colorEditor = color; }
  catch (error) { aplicarColorEditor(anterior); aviso(error.message); }
  finally { controles.forEach(control => { control.disabled = false; }); }
}
$('colorEditor').addEventListener('input', () => aplicarColorEditor($('colorEditor').value));
$('colorEditor').addEventListener('change', () => { void guardarColorEditor($('colorEditor').value); });
for (const button of document.querySelectorAll('[data-editor-color]')) button.addEventListener('click', () => accion(button, () => guardarColorEditor(button.dataset.editorColor)));
function pestana(nombre) {
  document.querySelectorAll('[data-vista]').forEach(el => { el.hidden = el.dataset.vista !== nombre; });
  document.querySelectorAll('[data-pestana]').forEach(el => {
    el.classList.toggle('secondary', el.dataset.pestana !== nombre);
    el.setAttribute('aria-pressed', String(el.dataset.pestana === nombre));
  });
}
document.querySelectorAll('[data-pestana]').forEach(button => button.addEventListener('click', () => pestana(button.dataset.pestana)));

function renderLista(items, container, carpeta, endpoint) {
  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const row = document.createElement('label'); row.className = 'fila';
    if (item.imagen) { const img = document.createElement('img'); img.src = 'images/' + carpeta + '/' + encodeURIComponent(item.imagen); img.alt = ''; img.loading = 'lazy'; row.append(img); }
    else { const tag = document.createElement('span'); tag.className = 'vacio-tag'; tag.textContent = item.esVacio ? 'vacío' : 'sin img'; row.append(tag); }
    const nombres = document.createElement('span'); nombres.className = 'nombre';
    for (const key of ['nombre_es_es', 'nombre_es', 'nombre_en']) { const span = document.createElement('span'); span.textContent = item[key] || '—'; nombres.append(span); }
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.id = item.id; checkbox.checked = item.activo !== false;
    checkbox.setAttribute('aria-label', 'Activar ' + (item.nombre_es || item.nombre_en || 'espacio vacío'));
    checkbox.addEventListener('change', () => accion(checkbox, async () => {
      await request(endpoint + '/' + encodeURIComponent(item.id), 'PUT', { activo: checkbox.checked });
      await cargarContenido(); await refrescarVistas();
    }, 'Selección guardada. Refresca la fuente en OBS.'));
    row.append(nombres, checkbox); fragment.append(row);
  }
  $(container).replaceChildren(fragment);
}
function renderContenido() {
  $('idiomaPersonajes').value = estado.idiomaPersonajes;
  const filtro = $('buscador').value, tipo = $('filtroTipo').value;
  const perks = habilidades.filter(h => (!tipo || h.esVacio || h.tipo === tipo) && coincide([h.nombre_es, h.nombre_es_es, h.nombre_en, h.personaje, h.general ? 'general' : '', ...asesinos.filter(a => texto(a.nombre_en) === texto(h.personaje)).flatMap(a => [a.nombre_es, a.nombre_es_es])], filtro));
  renderLista(perks, 'lista', 'perks', '/api/habilidades');
  renderLista(asesinos.filter(a => coincide([a.nombre_es, a.nombre_es_es, a.nombre_en], $('buscadorAsesino').value)), 'listaAsesinos', 'killers', '/api/asesinos');
  const activos = tipo => habilidades.filter(h => !h.esVacio && h.tipo === tipo && h.activo !== false).length;
  $('contador').textContent = activos('survivor') + ' perks de superviviente y ' + activos('killer') + ' de asesino activas · ' + habilidades.filter(h => h.esVacio && h.activo !== false).length + ' espacios vacíos. Se necesitan al menos 4 opciones del tipo elegido.';
  $('contadorAsesino').textContent = asesinos.filter(a => a.activo !== false).length + ' activos de ' + asesinos.length;
  const groups = { killer: document.createDocumentFragment(), survivor: document.createDocumentFragment(), vacio: document.createDocumentFragment() };
  const cantidades = { killer: 0, survivor: 0, vacio: 0 };
  const nombrePersonaje = g => g.tipo === 'killer' ? (g[{ en: 'nombre_en', es: 'nombre_es', 'es-es': 'nombre_es_es' }[estado.idiomaPersonajes]] || g.nombre) : g.nombre;
  const locale = { en: 'en', es: 'es-MX', 'es-es': 'es-ES' }[estado.idiomaPersonajes];
  const visibles = estado.personajes.filter(g => coincide([g.nombre, g.nombre_en, g.nombre_es, g.nombre_es_es], $('buscarPersonaje').value))
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || nombrePersonaje(a).localeCompare(nombrePersonaje(b), locale));
  for (const g of visibles) {
    const row = document.createElement('label'); row.className = 'personaje';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = g.activo; checkbox.indeterminate = g.parcial;
    const retrato = document.createElement('span'); retrato.className = 'personaje-retrato'; retrato.setAttribute('aria-hidden', 'true');
    const iniciales = nombrePersonaje(g).split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('');
    if (g.imagen) {
      const img = document.createElement('img'); img.src = 'images/' + g.imagen.split('/').map(encodeURIComponent).join('/'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      img.addEventListener('error', () => { retrato.replaceChildren(iniciales); });
      retrato.append(img);
    } else retrato.textContent = iniciales;
    const name = document.createElement('span'); name.className = 'personaje-nombre'; name.textContent = nombrePersonaje(g);
    const count = document.createElement('small'); count.textContent = g.habilidades.length + ' perks' + (g.asesinos.length ? ' + killer' : '') + ' · ' + g.activos + '/' + g.total + ' activos'; name.append(count);
    checkbox.addEventListener('change', () => accion(checkbox, async () => {
      await request('/api/personajes/' + encodeURIComponent(g.id), 'PUT', { activo: checkbox.checked });
      await cargarContenido(); await refrescarVistas();
    }, 'Contenido del personaje guardado. Refresca las fuentes en OBS.'));
    row.append(checkbox, retrato, name);
    const tipo = groups[g.tipo] ? g.tipo : 'survivor'; groups[tipo].append(row); cantidades[tipo]++;
  }
  $('personajesKillers').replaceChildren(groups.killer);
  $('personajesSurvivors').replaceChildren(groups.survivor);
  $('personajesVacios').replaceChildren(groups.vacio);
  $('sinPersonajesKillers').hidden = cantidades.killer > 0;
  $('sinPersonajesSurvivors').hidden = cantidades.survivor > 0;
  $('bloqueEspaciosVacios').hidden = cantidades.vacio === 0;
}
async function cargarContenido() {
  [habilidades, asesinos, estado] = await Promise.all([request('/api/habilidades'), request('/api/asesinos'), request('/api/estado')]);
  renderContenido();
}
for (const id of ['buscador', 'buscadorAsesino', 'buscarPersonaje']) $(id).addEventListener('input', () => renderContenido());
$('filtroTipo').addEventListener('change', () => renderContenido());
$('idiomaPersonajes').addEventListener('change', () => accion($('idiomaPersonajes'), async () => {
  const preferencias = await request('/api/preferencias-editor', 'PUT', { idiomaPersonajes: $('idiomaPersonajes').value });
  estado.idiomaPersonajes = preferencias.idiomaPersonajes;
  renderContenido();
}));
for (const [suffix, lista, endpoint] of [['', 'lista', '/api/habilidades-bulk-activo'], ['Asesino', 'listaAsesinos', '/api/asesinos-bulk-activo']]) {
  for (const [prefijo, activo] of [['activarTodas', true], ['desactivarTodas', false]]) {
    const button = $(prefijo + suffix);
    button.addEventListener('click', () => accion(button, async () => {
      const ids = [...$(lista).querySelectorAll('input')].map(el => el.dataset.id);
      await request(endpoint, 'POST', { ids, activo }); await cargarContenido(); await refrescarVistas();
    }, 'Selección visible guardada. Refresca las fuentes en OBS.'));
  }
}
function renderAjustes() {
  for (const [tipo, sufijo, ancho] of WIDGETS) {
    const config = estado.configuracion[tipo];
    $('color' + sufijo).value = config.color; $('idioma' + sufijo).value = config.idioma;
    const duracion = $('duracion' + sufijo);
    if (![...duracion.options].some(o => Number(o.value) === config.duracion)) duracion.add(new Option(config.duracion / 1000 + ' s', config.duracion));
    duracion.value = config.duracion; $('controles' + sufijo).checked = config.mostrarControles;
    $('tamano' + sufijo).textContent = ancho + ' × ' + (config.mostrarControles ? 520 : 440);
  }
}
for (const [tipo, sufijo] of WIDGETS) {
  $('ajustes' + sufijo).addEventListener('submit', event => {
    event.preventDefault();
    accion($('guardar' + sufijo), async () => {
      const config = structuredClone(estado.configuracion);
      config[tipo] = { color: $('color' + sufijo).value, idioma: $('idioma' + sufijo).value, duracion: Number($('duracion' + sufijo).value), mostrarControles: $('controles' + sufijo).checked };
      estado.configuracion = await request('/api/configuracion', 'PUT', config);
      renderAjustes(); await refrescarVistas();
    }, 'Apariencia guardada y vista previa actualizada. Refresca la fuente en OBS.');
  });
}
function opciones(id, items, value, label, empty) {
  const selected = $(id).value;
  $(id).replaceChildren(...items.map(item => new Option(label(item), item[value])));
  if (!items.length) $(id).add(new Option(empty, ''));
  if (items.some(item => item[value] === selected)) $(id).value = selected;
}
function renderPerfiles() {
  opciones('listaPerfiles', estado.perfiles, 'id', p => p.nombre, 'Sin perfiles guardados');
  opciones('listaRespaldos', estado.respaldos, 'nombre', b => new Date(b.fecha).toLocaleString() + ' · ' + b.nombre.slice(0, 24), 'Sin respaldos');
  $('aplicarPerfil').disabled = $('borrarPerfil').disabled = !estado.perfiles.length;
  $('restaurarRespaldo').disabled = !estado.respaldos.length;
}
$('guardarPerfil').addEventListener('click', () => accion($('guardarPerfil'), async () => {
  await request('/api/perfiles', 'POST', { nombre: $('nombrePerfil').value }); $('nombrePerfil').value = ''; await cargarTodo();
}, 'Perfil guardado con tu selección y apariencia actuales.'));
$('aplicarPerfil').addEventListener('click', () => accion($('aplicarPerfil'), async () => {
  await request('/api/perfiles/' + $('listaPerfiles').value + '/aplicar', 'POST'); await cargarTodo(); await refrescarVistas();
}, 'Perfil cargado. Guardamos un respaldo del estado anterior. Refresca las fuentes en OBS.'));
$('borrarPerfil').addEventListener('click', () => {
  if (confirm('¿Eliminar este perfil guardado? Tu selección actual se conserva.')) accion($('borrarPerfil'), async () => {
    await request('/api/perfiles/' + $('listaPerfiles').value, 'DELETE'); await cargarTodo();
  }, 'Perfil eliminado.');
});
$('crearRespaldo').addEventListener('click', () => accion($('crearRespaldo'), async () => {
  await request('/api/respaldos', 'POST'); await cargarTodo();
}, 'Respaldo creado.'));
$('restaurarRespaldo').addEventListener('click', () => {
  if (confirm('¿Restaurar este respaldo? Primero guardaremos tu configuración actual.')) accion($('restaurarRespaldo'), async () => {
    await request('/api/respaldos/' + encodeURIComponent($('listaRespaldos').value) + '/restaurar', 'POST'); await cargarTodo(); await refrescarVistas();
  }, 'Respaldo restaurado. Refresca las fuentes en OBS.');
});
async function iniciarActualizaciones(api) {
  $('updatePanel').hidden = false;
  function render(update) {
    const messages = {
      idle: 'Buscaré nuevas versiones al abrir HexRoll y cada seis horas.',
      checking: 'Buscando una nueva versión…',
      downloading: 'Descargando HexRoll ' + (update.nextVersion || '') + ' · ' + update.percent + '%',
      ready: 'HexRoll ' + update.nextVersion + ' está lista. Reinicia cuando te venga bien para instalarla.',
      current: 'Tienes la última versión disponible: ' + update.version + '.',
      error: 'No se pudo completar la actualización. Revisa tu conexión e inténtalo de nuevo.',
      development: 'Las actualizaciones se habilitan en la aplicación instalada.'
    };
    $('updateStatus').textContent = messages[update.phase] || '';
    const busy = ['checking', 'downloading'].includes(update.phase), development = update.phase === 'development';
    $('checkUpdate').disabled = busy || development || update.phase === 'ready';
    $('installUpdate').hidden = update.phase !== 'ready';
    $('updateProgress').hidden = update.phase !== 'downloading'; $('updateProgress').value = update.percent;
  }
  async function act(button, callback) {
    button.disabled = true;
    try { await callback(); } catch (error) { aviso(error.message); }
    finally { render(await api.actualizaciones()); }
  }
  const unsubscribe = api.alCambiarActualizaciones(render);
  window.addEventListener('unload', unsubscribe, { once: true });
  render(await api.actualizaciones());
  $('checkUpdate').addEventListener('click', () => { void act($('checkUpdate'), () => api.buscarActualizacion()); });
  $('installUpdate').addEventListener('click', () => { void act($('installUpdate'), () => api.instalarActualizacion()); });
}
async function iniciarDesktop() {
  if (!window.ruletaDesktop) {
    for (const [tipo, sufijo, ancho, archivo] of WIDGETS) {
      for (const accion of ['copiar', 'probar']) $(accion + sufijo).hidden = true;
      const ruta = $('rutaWidget' + sufijo), lite = $('lite' + sufijo);
      ruta.value = archivo + '.html';
      lite.addEventListener('change', () => { ruta.value = archivo + (lite.checked ? 'Lite' : '') + '.html'; });
    }
    $('abrirCarpeta').hidden = $('importarAnterior').hidden = true;
    pestana('contenido'); return;
  }
  const api = window.ruletaDesktop, info = await api.informacion();
  await iniciarActualizaciones(api);
  document.body.classList.add('escritorio');
  $('navegacionApp').append(document.querySelector('nav.tabs'));
  $('temaApp').append($('cambiarTema'));
  document.querySelector('header.cabecera').hidden = true;
  $('barraApp').hidden = false;
  const actualizarVentana = ({ maximizada }) => {
    const texto = maximizada ? 'Restaurar tamaño' : 'Maximizar';
    $('maximizarVentana').setAttribute('aria-label', texto); $('maximizarVentana').title = texto;
    $('iconoMaximizar').setAttribute('d', maximizada ? 'M5 3h8v8M3 5h8v8H3z' : 'M3 3h10v10H3z');
  };
  actualizarVentana(await api.estadoVentana());
  const dejarDeEscuchar = api.alCambiarVentana(actualizarVentana);
  window.addEventListener('unload', dejarDeEscuchar, { once: true });
  for (const [id, accionVentana] of [['minimizarVentana', 'minimizar'], ['maximizarVentana', 'maximizar'], ['cerrarVentana', 'cerrar']]) {
    $(id).addEventListener('click', () => accion($(id), async () => actualizarVentana(await api.controlarVentana(accionVentana))));
  }
  $('estadoDesktop').textContent = 'Versión ' + info.version + ' · Lista para configurar';
  for (const [tipo, sufijo] of WIDGETS) {
    const widget = info.widgets[tipo], lite = $('lite' + sufijo), ruta = $('rutaWidget' + sufijo);
    ruta.value = widget.ruta; lite.addEventListener('change', () => { ruta.value = lite.checked ? widget.rutaLite : widget.ruta; });
    $('copiar' + sufijo).addEventListener('click', () => accion($('copiar' + sufijo), () => api.copiarRuta(tipo, lite.checked), 'Ruta copiada. Pégala en la fuente de OBS.'));
    $('probar' + sufijo).addEventListener('click', () => accion($('probar' + sufijo), () => api.vistaPrevia(tipo, lite.checked)));
  }
  $('abrirCarpeta').addEventListener('click', () => accion($('abrirCarpeta'), () => api.abrirCarpeta()));
  $('importarAnterior').addEventListener('click', () => accion($('importarAnterior'), async () => {
    const result = await api.importar();
    if (!result.cancelado) { await cargarTodo(); await refrescarVistas(); aviso('Ajustes importados. Guardamos un respaldo de la configuración anterior. Refresca las fuentes en OBS.'); }
  }));
  pestana('widgets');
}
window.ruletaLista = Promise.all([cargarTodo(), iniciarDesktop()]).catch(error => {
  aviso('No se pudo preparar la aplicación: ' + error.message); throw error;
});
request('/api/proyecto').then(config => {
  if (!config.repositorio) return;
  const url = new URL(config.repositorio);
  if (url.protocol === 'https:') { $('enlaceRepositorio').href = url.href; $('enlaceRepositorio').hidden = false; }
}).catch(() => {});
