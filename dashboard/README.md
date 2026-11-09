# GAS&GO · Centro de control

Prototipo web independiente para supervisar una estación o una red de estaciones. No carga el código de la app del conductor ni del surtidor, no lee sus datos, no cambia sus páginas y no se registra en su caché offline. Reutiliza únicamente el logotipo y el catálogo local de Google Material Symbols (Apache-2.0).

## Abrir

Desde la raíz del repositorio, servir los archivos con cualquier servidor estático y abrir `/dashboard/`. En GitHub Pages: `https://rbayes-upc.github.io/GAS-GO/dashboard/`.

No hay compilación, instalaciones ni claves. HTML, CSS y JavaScript locales; no se hacen solicitudes a APIs ni a servicios externos.

## Qué se puede revisar

- **Visión general:** métricas diarias, actividad, estado de estaciones, avisos, recarga, operaciones recientes y reservas.
- **Selector de estación:** actualiza conjuntamente todas las tarjetas y permite volver a la vista de toda la red.
- **Estaciones:** detalle de surtidores y cargadores y reservas por producto. Cada equipo abre su ficha de supervisión.
- **Operaciones:** búsqueda, filtros de estado, trazabilidad de una operación y exportación CSV del resultado filtrado.
- **Incidencias:** prioridad y seguimiento reversible, sin cambiar el estado físico del equipo. Los avisos críticos siguen visibles aunque estén en seguimiento.
- **Informes:** serie de hoy o siete días, tabla accesible con los datos del gráfico y resumen por estación.
- **Búsqueda global:** estaciones, operaciones o avisos. Atajo Ctrl/Cmd + K.
- **Preferencias:** densidad cómoda/compacta. Se guarda, junto con el seguimiento de avisos, bajo `gasgo_station_dashboard_v1`; no se accede a `gasgo_demo`.

## Datos y límites del prototipo

`data.js` contiene tres estaciones ficticias y una instantánea fechada el 9 de noviembre de 2026, a las 13:42 de Madrid. Las métricas diarias son resúmenes de muestra y el registro de operaciones es una muestra ilustrativa reciente, no todas las operaciones del día. Los importes de operaciones en curso son provisionales. Los depósitos muestran una autonomía calculada con consumos medios de ejemplo.

No hay telemetría en vivo, autenticación, cámaras conectadas, acciones físicas remotas, pagos, solicitudes al proveedor ni mensajes a terceros. Poner una incidencia en seguimiento solo guarda un estado local. Su equipo continúa averiado hasta que la fuente de datos cambie. Este diseño no demuestra que una estación pueda operar sin personal o sin sus procedimientos operativos.

Para conectarlo posteriormente se necesita una fuente de telemetría y operaciones, control de acceso por estación, estados de comunicación y auditoría de acciones. La app y el surtidor actuales permanecen separados.

## Verificación

`node tests/dashboard.cjs` con Playwright y Chromium en `/usr/bin/chromium`. Comprueba agregación, filtros por estación, equipos, seguimiento, exportación filtrada, búsquedas, informes, persistencia independiente y navegación por teclado. Revisa anchos de 1440, 1024, 768, 430 y 375 px y comprueba que no se hacen peticiones externas ni se altera el almacenamiento de la app.
