# Ruleta de perks y killers para OBS

Una ruleta de Dead by Daylight para elegir cuatro perks o un killer al azar y mostrarlos en OBS. Tú decides qué entra en el sorteo. Los dos widgets funcionan por separado, así que puedes ponerlos donde quieras en tu escena.

## Para empezar

La aplicación es para Windows de 64 bits. Instala la ruleta y ábrela desde el escritorio o el menú Inicio; no hace falta instalar Node.js ni usar la consola.

En **Mi contenido** puedes activar personajes completos o elegir perks y killers uno por uno. Si vienes de una versión anterior, usa **Importar ajustes anteriores** y selecciona tu `data.json`.

### Añadir las ruletas a OBS

1. En la tarjeta de perks, pulsa **Copiar ruta de perks**.
2. En OBS, crea una fuente de **Navegador**, marca **Archivo local** y pega la ruta.
3. Para el killer, crea otra fuente y usa **Copiar ruta de killers**.
4. Oculta y vuelve a mostrar la fuente para hacer un sorteo. También puedes usar Espacio desde **Interactuar** en OBS.

| Widget | Archivo | Tamaño recomendado |
| --- | --- | --- |
| Cuatro perks | `ruleta-perks.html` | 1120 × 440 |
| Un killer | `ruleta-killers.html` | 460 × 440 |

Puedes probar cada widget desde la aplicación antes de añadirlo a OBS. Una vez configurados, puedes cerrar el editor: las fuentes siguen funcionando con sus archivos locales.

## Dejarla a tu gusto

En **Mis widgets** puedes cambiar el color, el idioma, la duración del giro y el tipo de perks. Cada widget tiene sus propios ajustes. Pulsa **Aplicar apariencia** y refresca las fuentes en OBS para ver los cambios.

- Hay nombres en inglés, español de España y español de México.
- Cada widget tiene una versión ligera por si necesitas reducir los efectos.
- Los controles están ocultos por defecto. Si los activas, usa 520 de alto en OBS.
- El interruptor de modo claro y oscuro cambia el tema del editor y recuerda tu elección.
- En **Perfiles y respaldos** puedes guardar distintas selecciones y apariencias para recuperarlas después.

El catálogo incluye a **Terrifier**, sus tres perks y las tres de **Sienna Shaw**. Las perks de The Cenobite, The Shape, Laurie Strode y The Good Guy muestran también sus nombres generales entre paréntesis. Las traducciones de esos alias se comprobaron en los archivos del juego; están anotadas en [este registro](docs/localizaciones-perks.json).

## Actualizar y conservar tus ajustes

Por ahora las actualizaciones se instalan a mano: cierra la aplicación y ejecuta el instalador nuevo. Tus selecciones, perfiles y apariencia se guardan aparte del programa y se conservan al actualizar. El contenido nuevo queda desactivado para que elijas si quieres añadirlo a tus sorteos.

Los datos y las imágenes están en `%APPDATA%\RuletaPerksKillers\widget`. Puedes llegar desde **Abrir carpeta de widgets**. Para hacer una copia completa, guarda esa carpeta, incluidas tus imágenes propias y los perfiles.

La aplicación crea un respaldo antes de actualizar el catálogo, cargar un perfil o restaurar datos. Los respaldos se pueden recuperar desde **Perfiles y respaldos**.

Si usabas la antigua ruleta combinada para sortear killers, cambia esa fuente a `ruleta-killers.html`. La combinada sigue disponible como `ruleta-completa.html`.

Tienes más detalles y soluciones a problemas comunes en la [guía de uso](GUIA_DE_USO.txt).

## Desarrollo

Para ejecutar el proyecto desde el código necesitas Node.js 24. Los comandos principales son:

```sh
npm ci
npm start
npm test
npm run dist:windows
```

El instalador se genera en `release/`. También puedes arrancar solo el editor con `npm run start:server`, o generar un paquete ZIP con `npm run build`. El editor de ese ZIP sí necesita Node.js.

Las plantillas de los widgets son `widget-template.html` y `widget-template-lite.html`. Los HTML finales se generan a partir de ellas.

GitHub Actions ejecuta las pruebas y comprueba la instalación y la conservación de ajustes en Windows. El instalador queda en el artefacto **instalador-windows** de cada ejecución de [Pruebas](https://github.com/Alfajorcit0K/Perks-Killer-Roulette/actions/workflows/tests.yml); necesitas acceso al repositorio para descargarlo. Todavía no hay actualizador automático.

Para proponer cambios, consulta [CONTRIBUTING.md](CONTRIBUTING.md).

## Autor y créditos

Hecha por [Alfajorcit0K_](https://www.twitch.tv/alfajorcit0k_). Puedes encontrar la comunidad en [Discord](https://discord.gg/mKQ4ynsQKS).

El código original está bajo [MIT](LICENSE). Los nombres, personajes e imágenes de Dead by Daylight pertenecen a sus respectivos titulares y quedan fuera de esa licencia; consulta los [avisos de terceros](THIRD_PARTY_NOTICES.md). Este es un proyecto de fans, sin afiliación oficial con Behaviour Interactive.
