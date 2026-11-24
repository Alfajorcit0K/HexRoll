# Ruleta Perks y Killers para OBS

Herramienta gratuita de Alfajorcit0K_. Todas las funciones están disponibles para todos. El código original se ofrece bajo [MIT](LICENSE); los recursos del juego están excluidos de esa licencia y se detallan en [los avisos de terceros](THIRD_PARTY_NOTICES.md).

El repositorio de desarrollo [Perks-Killer-Roulette](https://github.com/Alfajorcit0K/Perks-Killer-Roulette) se mantiene **privado** por decisión del autor. La licencia del código y la visibilidad del repositorio son decisiones independientes.

## Usar la ruleta

La aplicación instalable para Windows incluye todo lo necesario. El cliente **no necesita instalar Node.js**.

1. Ejecuta `Ruleta-Perks-Killers-1.2.0-Setup.exe` y completa el asistente.
2. Abre **Ruleta Perks y Killers** desde el escritorio o el menú Inicio.
3. Elige tus perks y killers. Para migrar una instalación antigua, pulsa **Importar ajustes anteriores** y selecciona su `data.json`.
4. En la tarjeta **Ruleta de perks**, pulsa **Copiar ruta de perks**. En OBS agrega una fuente de Navegador, marca **Archivo local** y pega la ruta.
5. Repite con **Copiar ruta de killers** para crear una segunda fuente independiente. Puedes usar una o ambas en tu escena.
6. Usa **Interactuar** para personalizar cada widget. Oculta y muestra su fuente para sortear.

| Widget | Archivo | Tamaño inicial en OBS |
| --- | --- | --- |
| Cuatro perks | `ruleta-perks.html` | 1120 × 520 |
| Un killer | `ruleta-killers.html` | 460 × 520 |

Cada tarjeta tiene su propia vista previa y opción ligera (`ruleta-perks-lite.html` o `ruleta-killers-lite.html`). El color y el idioma se guardan por separado para perks y killers. Los widgets independientes no tienen selector PERKS/KILLER; el de perks conserva SURV/KILLER para elegir el tipo de habilidades.

Si antes usabas `ruleta-perks.html` en modo killer, cambia esa fuente a la nueva ruta de killers. Para recuperar la ruleta combinada anterior está disponible `ruleta-completa.html`; los nombres antiguos con sufijo `-libre` también se siguen generando para compatibilidad.

El widget y las imágenes se guardan en `%APPDATA%\RuletaPerksKillers\widget`, fuera de la carpeta del programa. OBS sigue funcionando cuando cierras la aplicación. Los ajustes se conservan al instalar una versión nueva y al desinstalar; puedes abrir su carpeta desde la aplicación para respaldarlos.

El instalador actual es para Windows x64 y no está firmado digitalmente. La integración directa con OBS y las actualizaciones automáticas siguen pendientes; la aplicación guía la configuración de la fuente local.

El paquete ZIP anterior se mantiene como alternativa de desarrollo y sigue necesitando Node.js para su editor.

## Desarrollo y distribución

- `npm ci`: instalar las herramientas de desarrollo (Node.js 24 recomendado).
- `npm start`: abrir la aplicación de escritorio en desarrollo.
- `npm run start:server`: abrir únicamente el servidor en `http://127.0.0.1:4002/editor`.
- `npm test`: ejecutar las pruebas de datos y distribución.
- `npm run dist:windows`: generar el instalador x64 en `release/`.
- `npm run build`: generar carpeta y ZIP de la versión normal en `dist/`.
- `npm run build:lite`: generar la variante de menor carga visual.
- `node generar_distribucion.js --sin-zip`: generar solamente la carpeta.

Los paquetes locales incluyen el catálogo y las imágenes existentes para probar el funcionamiento. Su publicación requiere resolver los permisos indicados en los avisos de terceros.

GitHub Actions ejecuta las pruebas y genera el instalador como artefacto privado después de cada push. No publica releases automáticamente. Para obtenerlo, abre la ejecución de **Pruebas** y descarga el artefacto **instalador-windows**.

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
