'use strict';
/*
 * Fusiona el data.json MAESTRO (este, con el contenido mas reciente) dentro
 * del data.json de un cliente que ya tenia el suyo propio configurado.
 *
 * Que hace:
 * - Perks/asesinos que el cliente YA TENIA (mismo id): se conserva su activo
 *   tal cual lo dejo. No se toca.
 * - Perks/asesinos NUEVOS que el cliente no tenia: se agregan con el activo
 *   que tengan en este data.json maestro (por defecto, inactivos).
 * - Nada se borra: si el cliente tiene algo que el maestro ya no tiene, igual
 *   se conserva.
 *
 * USO (necesitas el data.json actual del cliente, pedile que te lo mande):
 *   node fusionar_data_cliente.js ruta/al/data_del_cliente.json
 *
 * Genera un archivo nuevo al lado del original, con "_fusionado" en el
 * nombre. Ese es el que le mandas de vuelta al cliente para que reemplace
 * su data.json (con el servidor apagado, y lo reinicia despues).
 */
const fs = require('fs');
const path = require('path');

const rutaCliente = process.argv[2];
if (!rutaCliente) {
  console.log('Uso: node fusionar_data_cliente.js ruta/al/data_del_cliente.json');
  process.exit(1);
}
if (!fs.existsSync(rutaCliente)) {
  console.log('No se encontro el archivo:', rutaCliente);
  process.exit(1);
}

const maestro = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
const cliente = JSON.parse(fs.readFileSync(rutaCliente, 'utf8'));
if (!cliente.habilidades) cliente.habilidades = [];
if (!cliente.asesinos) cliente.asesinos = [];

function fusionar(listaCliente, listaMaestro, etiqueta) {
  const idsCliente = new Set(listaCliente.map(x => x.id));
  let agregados = 0;
  for (const item of listaMaestro) {
    if (!idsCliente.has(item.id)) {
      listaCliente.push(item);
      agregados++;
    }
  }
  console.log(etiqueta + ': ' + agregados + ' nuevos agregados, ' + (listaMaestro.length - agregados) + ' ya existian (se conservo su activo).');
}

fusionar(cliente.habilidades, maestro.habilidades, 'Habilidades');
fusionar(cliente.asesinos, maestro.asesinos, 'Asesinos');

const destino = rutaCliente.replace(/\.json$/, '') + '_fusionado.json';
fs.writeFileSync(destino, JSON.stringify(cliente, null, 2));
console.log('');
console.log('Listo:', destino);
console.log('Mandaselo al cliente para que reemplace su data.json (servidor cerrado) y lo reinicie.');
