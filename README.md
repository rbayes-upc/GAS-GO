# GAS&GO

La versión FULL utiliza Google Material Symbols Outlined en navegación, vehículos y controles. DEMO conserva sus emojis originales. Los SVG y su licencia Apache-2.0 se incluyen en `assets/google-material-symbols`; se cargan desde un paquete local, sin fuentes ni CDN adicionales. `node tests/google-icons.cjs` comprueba el cambio entre modos y las ventanas dinámicas (requiere las mismas dependencias de navegador que las otras pruebas UX).

FULL muestra el vehículo activo con cambio rápido, filtros propios de repostaje o recarga, el precio del servicio elegido en las fichas y edición de vehículos guardados. Las correcciones del garaje no reescriben facturas anteriores. `node tests/full-features.cjs` comprueba esos recorridos, los conflictos de matrícula y que DEMO conserva sus controles. El suministro sigue controlándose desde el surtidor; no se añade seguimiento obligatorio en el móvil.

El garaje FULL incorpora una vez por navegador cuatro vehículos ficticios de ejemplo: gasolina 95, diésel, eléctrico CCS2 e híbrido enchufable de gasolina con Tipo 2. No cambia la selección actual, respeta matrículas existentes y no vuelve a crear ejemplos eliminados o editados. `node tests/garage-examples.cjs` comprueba la inicialización, persistencia y selección por combustible y conector. DEMO conserva su garaje anterior.

Prototipo de app y surtidor virtual. Las operaciones, los pagos y la identificación son simulados.

## Desarrollo local

Desde la raíz del repositorio:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Abre `index.html` desde ese servidor. En localhost o con archivos locales, el botón DEMO abre el surtidor en otra pestaña del mismo navegador. En la web publicada, DEMO utiliza la vinculación con el surtidor del ordenador y no abre otro surtidor.

## Despliegue automático en Netlify

Conecta este repositorio desde el sitio de Netlify mediante la opción de importar o vincular un repositorio existente.

- Rama de producción: `main`.
- Directorio base: raíz del repositorio.
- Comando de compilación: vacío; no hay compilación.
- Directorio de publicación: `.`.
- Funciones: `netlify/functions` (declarado en `netlify.toml`).

Netlify desplegará los nuevos commits de `main` automáticamente. GitHub guarda el código y Netlify sirve la app y sus funciones.

## Publicar directamente en GitHub Pages

En el repositorio, abre **Settings → Pages** y selecciona **Deploy from a branch**, rama **main**, carpeta **/ (root)**. Guarda la configuración.

- App: `https://rbayes-upc.github.io/GAS-GO/`
- Surtidor: `https://rbayes-upc.github.io/GAS-GO/surtidor-demo.html`

Estas direcciones estarán disponibles cuando GitHub Pages esté activado y termine el despliegue. Los commits nuevos en `main` se publicarán automáticamente. `.nojekyll` permite servir el proyecto estático sin procesarlo con Jekyll.

El QR utiliza la dirección del sitio actual, por lo que abre la bienvenida de la app del mismo proyecto en GitHub Pages y conserva el surtidor durante la elección de DEMO, login o registro. Las funciones de Netlify y sus cabeceras no se ejecutan en GitHub Pages: la consulta real por matrícula necesita un servidor aparte. El modo DEMO y el alta manual de vehículos no requieren esa función.

## Diagnóstico de vinculación

La app distingue «Conectando con el servicio de enlace» de «Enlazando con el surtidor». El surtidor muestra «Móvil localizado» al recibir la solicitud y «MÓVIL ENLAZADO» cuando abre el canal de datos. Si pierde la señalización, intenta reconectar conservando la sesión; si no lo consigue, indica que hay que generar otro QR. Los eventos de intentos anteriores no deben modificar una conexión nueva.

La prueba `node tests/pairing-recovery.cjs` requiere Playwright disponible para Node y Chromium en `/usr/bin/chromium`. Usa señalización y conexiones simuladas para comprobar reconexión, sesiones antiguas, tiempos de espera y reintentos. No valida la disponibilidad del servidor público PeerJS ni la conectividad WebRTC entre redes o dispositivos reales.

## Surtidor con QR

1. Abre `/surtidor-demo.html` en el ordenador desde el sitio HTTPS de Netlify.
2. Espera a que aparezcan el QR y el estado «QR ACTIVO».
3. Escanéalo con la cámara del móvil: abrirá la bienvenida de `/index.html` en el mismo sitio. Elige DEMO, Iniciar sesión o completa Registrarse; después la app intentará vincularse con esa sesión del surtidor.

Ambos dispositivos necesitan Internet. El enlace usa PeerJS/WebRTC y bibliotecas CDN; algunas redes pueden bloquearlo. Recargar el surtidor genera una sesión nueva. La conexión real entre dos dispositivos debe validarse tras el despliegue.

La consulta real de matrículas requiere configurar `APIVEHICULO_KEY` de forma segura en Netlify. No guardes claves en GitHub ni en archivos del navegador. La consulta es opcional para el modo DEMO.

## Mejoras de uso en FULL

- Se conserva en este navegador el último vehículo de FULL y sus filtros del mapa (precio, disponibilidad, búsqueda, orden, conector y potencia). La elección de servicio del híbrido también se mantiene. Visitar DEMO no sustituye estas preferencias; al volver a iniciar sesión se recuperan. La bienvenida y la entrada desde QR conservan su recorrido.
- Favoritos muestra los precios de los servicios compatibles con el vehículo seleccionado. Guarda una copia de la estación para consultarla cuando no esté en el conjunto actual del mapa; esas copias se señalan como datos guardados que pueden haber cambiado. Las tarifas eléctricas siguen siendo simuladas.
- Historial distingue repostajes y recargas, muestra litros o kWh cuando constan, y permite combinar vehículo histórico y servicio con los filtros de fecha e importe. La factura conserva los datos de la operación original y se puede descargar en PDF.
- Los fallos de ubicación y la pérdida del enlace muestran avisos con reintento en Home. El reintento de enlace no envía otra llegada ni genera una factura; recupera la comunicación. Desvincular voluntariamente no muestra un fallo.
- FULL incorpora controles de al menos 44 px de alto, foco visible, navegación de acciones con teclado, foco contenido en los diálogos y cierre con Escape, campos de 16 px y ajustes para pantallas pequeñas y movimiento reducido.

Validación: `node tests/full-polish.cjs`, `node tests/pairing-recovery.cjs` y `node tests/refuel-iteration.cjs`. La primera prueba cubre persistencia, favoritos, filtros de historial, PDF, reintento de ubicación y teclado/tamaños de pantalla. La segunda usa conexiones simuladas; la tercera ejecuta el repostaje DEMO con el surtidor local y su factura real de prueba.

## Buscar lugares y comparar estaciones (FULL)

La lupa busca estaciones del mapa y permite consultar direcciones o poblaciones de España. La consulta de lugares usa Nominatim/OpenStreetMap únicamente al enviar el formulario: no hay peticiones mientras se escribe. Se muestran hasta cinco coincidencias, se cachean temporalmente durante la sesión y las peticiones tienen un límite de espera de diez segundos. No requiere claves. Si el servicio falla, el formulario permite volver a buscar.

Al elegir un lugar se centra el mapa y se consultan estaciones en esa zona, manteniendo la posición GPS del usuario. Las distancias corresponden al centro de la zona explorada, en línea recta. La ficha «Explorando» permite regresar a la zona anterior y reintentar una carga fallida. Las estaciones ficticias de otra ciudad no se presentan como resultados de la búsqueda; los cargadores del censo integrado pueden seguir disponibles si falla la API de carburantes.

«Comparar», disponible tanto en el mapa como en la lista, muestra precio y distancia de los servicios compatibles con el vehículo y los filtros actuales. Permite ordenar por menor precio o cercanía y consultar más resultados. Para híbridos en «Ver ambas», cada servicio tiene su propia tabla: nunca se ordenan conjuntamente €/L y €/kWh. Pulsar una estación abre su ficha sin iniciar el suministro. DEMO conserva su búsqueda y controles anteriores.

Validación: `node tests/explore-compare.cjs`. Usa respuestas HTTP controladas para geocodificación y estaciones, el cargador real de datos y Leaflet. Cubre elección de zona, ubicación GPS tardía, caché, errores, cancelación, tiempos de espera, los cuatro tipos de vehículo, filtros, unidades, orden, paginación y presentación móvil. La disponibilidad real y CORS del servicio público de geocodificación deben verificarse desde el sitio publicado; la política de red del entorno de desarrollo bloquea Nominatim.

## Preferencias por vehículo y uso sin conexión (FULL)

En **Mi garaje → Preferencias**, cada matrícula guarda un método de pago ficticio y un límite opcional por operación de 1 a 300 €. El combustible de un vehículo de combustión o eléctrico depende de su motor; en los híbridos se puede elegir Repostar o Recargar como servicio habitual al seleccionar el vehículo. Es posible cambiar de servicio después en el mapa. Editar una matrícula conserva estas preferencias; eliminar el vehículo las elimina.

La llegada al surtidor transmite el límite y el pago junto con el vehículo. La operación conserva esa configuración aunque la selección de la app cambie después. El surtidor limita la cantidad suministrada sin superar el máximo **antes de descuentos**, tanto en litros como en kWh, y detiene el flujo al alcanzarlo. Se mantiene el botón de finalización existente para guardar la factura, y se puede finalizar antes del límite. DEMO no hereda los límites de FULL. No se realizan cobros reales.

El acceso sin conexión se prepara automáticamente al abrir la app por HTTPS o localhost con Internet. **Configuración → Acceso sin conexión** muestra cuándo se prepararon los archivos y permite reintentar si falla. Una vez preparado, se puede abrir una pestaña nueva o recargar bajo `/GAS-GO/` sin red y entrar con **Consultar historial guardado**. El PDF se genera localmente a partir de la operación guardada, sin bibliotecas ni imágenes externas. El historial indica su fecha de guardado local, no una sincronización con un servidor.

Sin conexión se oculta el mapa para evitar mostrar datos que no se pueden actualizar y se bloquean nuevas operaciones, vínculos y búsquedas. Recuperar la conexión conserva los datos y no recarga automáticamente una sesión en curso. Los datos personales y recibos siguen en el almacenamiento de este navegador; la caché del service worker contiene únicamente archivos estáticos de la app. No se cachean las APIs de precios, geocodificación o vinculación ni la página del surtidor.

**Mantenimiento de la copia sin conexión:** `sw.js` precarga los archivos locales de `index.html` y los logotipos de las facturas. Al añadir o quitar recursos, actualizar `ASSETS`; al publicar cambios en recursos precargados, incrementar `VERSION`. La instalación nueva solo se activa al completar la precarga; las cachés anteriores de este proyecto se eliminan al activar la nueva. Las peticiones online priorizan la red y usan la copia guardada si falla.

Pruebas: `node tests/preferences.cjs` valida configuración, migración de matrícula, autorización y suministro real del simulador con transporte controlado, límites de combustible/electricidad y datos congelados del recibo. `node tests/offline.cjs` usa un service worker real bajo `/GAS-GO/`, desactiva la red en Chromium y comprueba pestaña nueva, recarga, consulta, PDF y recuperación. La primera prueba no valida WebRTC entre dispositivos físicos.
