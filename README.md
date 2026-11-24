# Ruleta Perks y Killers para OBS

Herramienta gratuita de Alfajorcit0K_. Todas las funciones están disponibles para todos. El código original se ofrece bajo [MIT](LICENSE); los recursos del juego están excluidos de esa licencia y se detallan en [los avisos de terceros](THIRD_PARTY_NOTICES.md).

El repositorio de desarrollo [Perks-Killer-Roulette](https://github.com/Alfajorcit0K/Perks-Killer-Roulette) se mantiene **privado** por decisión del autor. La licencia del código y la visibilidad del repositorio son decisiones independientes.

## Usar la ruleta

Extrae el paquete completo en una carpeta permanente. Instala Node.js desde [su sitio oficial](https://nodejs.org), abre `ABRIR_EDITOR_PERKS.bat` y elige tus perks y killers. No hace falta ejecutar `npm install`.

En OBS, agrega una fuente de navegador, marca **Archivo local** y selecciona `ruleta-perks.html`. Comienza con un tamaño de 1000 × 600 y ajusta a tu escena. Usa **Interactuar** para cambiar idioma, color y modo. Oculta y muestra la fuente para sortear; también puedes pulsar Espacio al interactuar.

El widget sigue funcionando cuando cierras el editor. Consulta `MANUAL_CLIENTE.txt` para más ayuda. Esta primera versión todavía requiere Node.js para el editor.

## Desarrollo y distribución

- `npm start`: abrir el servidor del editor en `http://127.0.0.1:4002/editor`.
- `npm test`: ejecutar las pruebas de datos y distribución.
- `npm run build`: generar carpeta y ZIP de la versión normal en `dist/`.
- `npm run build:lite`: generar la variante de menor carga visual.
- `node generar_distribucion.js --sin-zip`: generar solamente la carpeta.

Los paquetes locales incluyen el catálogo y las imágenes existentes para probar el funcionamiento. Su publicación requiere resolver los permisos indicados en los avisos de terceros.

La distribución usa una lista explícita de archivos. Los paquetes son comunes para todos; `clientes/` y `Claude outputs/` están excluidos del paquete y de Git. `generar_cliente.js` se conserva como acceso compatible al nuevo generador; sus argumentos antiguos ya no se usan.

Las fuentes visuales son `widget-template.html` y `widget-template-lite.html`. Los archivos con sufijo `-libre` conservan nombres anteriores para instalaciones existentes.

## GitHub y aportes

El repositorio de desarrollo es privado. El actualizador automático todavía está pendiente. El campo `repositorio` de `config-publica.json` queda vacío para evitar mostrar a los usuarios un enlace al que no tienen acceso.

No deben incluirse credenciales de GitHub en la aplicación para descargar desde este repositorio. La distribución de actualizaciones a usuarios requerirá un canal de descargas separado o un servicio intermediario.

El campo `aportes` queda reservado y vacío. No se muestra ningún enlace de pago. Antes de habilitar aportes vinculados a recursos del juego, deben resolverse las restricciones de la política de Behaviour.

## Conservar ajustes

`data.json` contiene las selecciones de la instalación. Guarda una copia antes de actualizar manualmente y conserva las imágenes personalizadas. No reemplaces este archivo por el de una descarga nueva.

La importación de catálogos del servidor conserva las selecciones por ID, mantiene los elementos propios y crea un respaldo en `backups/`. Las entradas nuevas quedan desactivadas. Un archivo de datos dañado detiene el arranque en lugar de reemplazarse por uno vacío.

## Créditos

Creado por [Alfajorcit0K_](https://www.twitch.tv/alfajorcit0k_). [Comunidad en Discord](https://discord.gg/mKQ4ynsQKS).

Proyecto de fans de Dead by Daylight, sin afiliación ni aprobación oficial. Los nombres, personajes e imágenes pertenecen a sus respectivos titulares.
