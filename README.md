# HexRoll

Una ruleta de Dead by Daylight para elegir cuatro perks o un killer al azar y mostrarlos en OBS. Tú decides qué entra en el sorteo. Hay tres widgets independientes: perks de survivor, perks de killer y personaje killer. Puedes ponerlos donde quieras en tu escena.

## Para empezar

HexRoll es para Windows de 64 bits. Descarga el instalador de [Releases](https://github.com/Alfajorcit0K/Perks-Killer-Roulette/releases/latest), instala la aplicación y ábrela desde el escritorio o el menú Inicio; no hace falta instalar Node.js ni usar la consola.

La barra superior reúne las secciones, el cambio de tema y los botones para minimizar, maximizar y cerrar. Puedes arrastrarla para mover la ventana.

En **Mi contenido** puedes activar personajes completos o elegir perks y killers uno por uno. Si vienes de una versión anterior, usa **Importar ajustes anteriores** y selecciona tu `data.json`.

**Mis personajes** tiene un cuadro de killers y otro de survivors, con un retrato pequeño junto a cada nombre. Las perks generales están dentro de su grupo correspondiente y los espacios vacíos tienen un apartado propio. La búsqueda sirve para ambos cuadros.

En **Mis personajes**, el selector **Idioma de killers** cambia los nombres entre inglés, español de España y español de México. Empieza en inglés y recuerda tu elección. Puedes buscar un personaje por cualquiera de sus nombres.

### Añadir las ruletas a OBS

1. En la tarjeta **Perks de survivor**, pulsa **Copiar ruta de survivor**.
2. En OBS, crea una fuente de **Navegador**, marca **Archivo local** y pega la ruta.
3. Repite con **Perks de killer** y, si quieres sortear también el personaje, con **Personaje killer**.
4. Oculta y vuelve a mostrar la fuente para hacer un sorteo. También puedes usar Espacio desde **Interactuar** en OBS.

| Widget | Archivo | Tamaño recomendado |
| --- | --- | --- |
| Cuatro perks de survivor | `SPerksRoulette.html` | 1120 × 440 |
| Cuatro perks de killer | `KPerksRoulette.html` | 1120 × 440 |
| Un killer | `KRoulette.html` | 460 × 440 |

Puedes probar cada widget desde la aplicación antes de añadirlo a OBS. Una vez configurados, puedes cerrar el editor: las fuentes siguen funcionando con sus archivos locales.

El instalador deja los HTML junto a `HexRoll.exe`, con las imágenes que necesitan. **Abrir carpeta de widgets** te lleva allí. Al editar se actualizan esos archivos y también las fuentes de versiones anteriores que tengas en OBS.

Deja cada fuente en su escena de survivor o killer. El tipo de perks es fijo en cada una: para cambiar de rol basta con cambiar de escena o mostrar la otra fuente, sin editar la configuración ni refrescarla.

## Dejarla a tu gusto

En **Mis widgets** puedes cambiar el color, el idioma y la duración del giro. Cada widget tiene sus propios ajustes y los cambios se guardan automáticamente. Las vistas previas se actualizan solas; refresca las fuentes en OBS para verlos allí. El idioma inicial es inglés y se respetan las preferencias que ya hayas guardado.

- Hay nombres en inglés, español de España y español de México.
- Cada widget tiene una versión ligera por si necesitas reducir los efectos.
- Los controles están ocultos por defecto. Si los activas, aparecen el selector de color y los botones de idioma dentro de la transmisión. Puedes pulsarlos desde **Interactuar** en OBS; usa 520 de alto para que quepan.
- Las perks generales aparecen primero en cada cuadro de personajes, con una **G**. Los espacios vacíos llevan un **—**; puedes añadirlos y quitarlos con los botones **+** y **−**, o escribir una cantidad. La aplicación muestra su probabilidad según las perks activas de cada rol. Esa cantidad también se guarda en los perfiles.
- El interruptor de modo claro y oscuro cambia el tema del editor y recuerda tu elección.
- Puedes elegir el color del editor desde la paleta o el selector de color. Los fondos y el texto se adaptan al modo claro u oscuro; el switch lleva un sol y una luna. Tu elección se conserva al reiniciar y actualizar.
- El logo y el icono de la ventana siguen el color elegido. El instalador y los accesos directos usan el logo blanco.
- En **Perfiles y respaldos** puedes guardar distintas selecciones y apariencias para recuperarlas después.

El catálogo incluye a **Terrifier**, sus tres perks y las tres de **Sienna Shaw**. Las perks de The Cenobite, The Shape, Laurie Strode y The Good Guy muestran también sus nombres generales entre paréntesis. Las traducciones de esos alias se comprobaron en los archivos del juego; están anotadas en [este registro](docs/PerkNames.json).

## Actualizar y conservar tus ajustes

La versión 1.0.0 se instala una vez. Después, HexRoll busca actualizaciones al abrirse, descarga las versiones nuevas y muestra **Reiniciar e instalar** cuando están listas. También puedes usar **Buscar actualizaciones** en la esquina superior izquierda. El aviso aparece al consultar manualmente o cuando hay una descarga disponible. Tú eliges cuándo reiniciar; cerrar la aplicación por tu cuenta no instala nada. No necesitas cuenta de GitHub ni tokens. Tus selecciones, perfiles y apariencia se guardan aparte del programa y se conservan al actualizar. El contenido nuevo queda desactivado para que elijas si quieres añadirlo a tus sorteos.

Los ajustes, perfiles, respaldos e imágenes originales se conservan en `%APPDATA%\RuletaPerksKillers\widget`. Para hacer una copia completa, guarda esa carpeta, incluidas tus imágenes propias y los perfiles. Los HTML de la carpeta de instalación se regeneran con esos datos al abrir la aplicación o editar los ajustes.

La aplicación crea un respaldo antes de actualizar el catálogo, cargar un perfil o restaurar datos. Los respaldos se pueden recuperar desde **Perfiles y respaldos**.

Al actualizar se conservan tus selecciones y los ajustes de cada widget. Las fuentes que ya tengas en OBS mantienen sus rutas anteriores; al añadir una fuente nueva, usa los nombres de la tabla. La ruleta combinada está disponible como `CombinedRoulette.html`.

Tienes más detalles y soluciones a problemas comunes en la [guía de uso](UserGuide.txt).

## Desarrollo

Para ejecutar el proyecto desde el código necesitas Node.js 24. Los comandos principales son:

```sh
npm ci
npm start
npm test
npm run dist:windows
```

El instalador se genera en `release/`. También puedes arrancar solo el editor con `npm run start:server`, o generar un paquete ZIP con `npm run build`. El editor de ese ZIP sí necesita Node.js.

Las plantillas de los widgets son `RouletteTemplate.html` y `RouletteLiteTemplate.html`. Los HTML finales se generan a partir de ellas.

GitHub Actions prueba la aplicación y la instalación en Windows. Para publicar una versión, cambia el número en package.json y package-lock.json, actualiza ReleaseNotes.md y sube una etiqueta como v1.0.1. Si las comprobaciones pasan, el workflow publica juntos el instalador, su blockmap y latest.yml en GitHub Releases. HexRoll usa esa release para actualizarse. No reemplaces los archivos de una versión ya publicada: crea una nueva.

Para proponer cambios, consulta [CONTRIBUTING.md](CONTRIBUTING.md).

## Autor y créditos

Hecha por [Alfajorcit0K_](https://www.twitch.tv/alfajorcit0k_). Puedes encontrar la comunidad en [Discord](https://discord.gg/mKQ4ynsQKS).

El código original está bajo [MIT](LICENSE). Los nombres, personajes e imágenes de Dead by Daylight pertenecen a sus respectivos titulares y quedan fuera de esa licencia; consulta los [avisos de terceros](Credits.md). Este es un proyecto de fans, sin afiliación oficial con Behaviour Interactive.
