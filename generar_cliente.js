'use strict';
// Acceso compatible al generador publico. Los argumentos antiguos ya no se usan.
console.log('La distribucion ahora es publica y comun para todos los usuarios.');
console.log('Comando recomendado: node generar_distribucion.js [--lite]');
try {
  require('./generar_distribucion').generar({ lite: process.argv.includes('--lite'), zip: !process.argv.includes('--sin-zip') });
} catch (error) { console.error(error.message); process.exitCode = 1; }
