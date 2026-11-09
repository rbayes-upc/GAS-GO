# GAS&GO Insights · Uso y experiencia del servicio

Panel web independiente para entender cuánto se usa GAS&GO, cómo se completa el recorrido del usuario y dónde aparecen fricciones. Mantiene el diseño bento y la paleta de la app. No es un gestor de depósitos, mantenimiento o actividad general de la estación.

## Abrir

Servir la raíz del repositorio con un servidor estático y abrir `/dashboard/`. En Pages: `https://rbayes-upc.github.io/GAS-GO/dashboard/?v=2`. Sin compilación, claves ni peticiones a servicios externos. Se reutilizan el logotipo y el catálogo local de Material Symbols (Apache-2.0); la app y el surtidor originales no se modifican ni se cargan.

## Vistas

- **Visión general:** sesiones GAS&GO, operaciones completadas, autorización automática e importe asociado; gráfica de actividad, recorrido de la misma cohorte, comparación entre estaciones, incidencias del servicio y personas que lo usan.
- **Estaciones:** tasas de finalización y método A, usuarios únicos con operación, tiempo hasta autorizar, facturas e importe GAS&GO de cada estación.
- **Sesiones GAS&GO:** registro paginado de 20 en 20, búsqueda y filtros por resultado, paso alcanzado o error de factura. El detalle muestra exactamente los eventos registrados, sin inventar pasos que no ocurrieron.
- **Incidencias del servicio:** grupos por estación y evento de enlace, autorización o factura. Cada aviso lleva a sus sesiones afectadas. El seguimiento es local y reversible y no altera los eventos ni los resultados de las sesiones.
- **Rendimiento:** tiempos medio y percentil 95 hasta autorizar, métodos A/B/C, usuarios, repetición del día, facturas y volúmenes por servicio. Litros y kWh se mantienen separados.
- **Exportación:** CSV de todas las coincidencias del filtro, no solo la página visible; avisos agrupados o resumen de hoy por estación según la vista. La gráfica permite consultar la tabla de su periodo.
- **Búsqueda y preferencias:** Ctrl/Cmd + K para estaciones, sesiones o avisos; densidad cómoda/compacta. El almacenamiento propio es `gasgo_service_analytics_v2`. No se accede a `gasgo_demo` ni se importan los seguimientos de incidencias físicas de la versión anterior.

## Definiciones

Los indicadores del día se derivan de `sessions` y sus eventos en `data.js`:

| Indicador | Cálculo |
| --- | --- |
| Sesiones | Sesiones GAS&GO iniciadas hoy en la selección. No son todas las operaciones de la estación. |
| Operaciones completadas | Sesiones con `supply_finished`. |
| Tasa de finalización | Completadas / sesiones iniciadas. La cohorte incluye las que siguen en curso. |
| Autorización automática | Autorizaciones completadas por método A / todas las autorizaciones completadas. No incluye solicitudes fallidas. |
| Importe GAS&GO | Suma del importe de operaciones completadas. Las no finalizadas conservan su importe provisional solo en el registro. No es facturación incremental ni total de la estación. |
| Usuario único | Identificador anonimizado con al menos una operación completada hoy. Se deduplica entre estaciones al elegir toda la red. |
| Recurrente en el día | Usuario con dos o más operaciones completadas hoy dentro de la selección. No afirma una recurrencia histórica. |
| Hasta autorizar | Diferencia entre `session_started` y `authorization_succeeded`, solo en sesiones autorizadas. Media y percentil 95 sobre sesiones, no media de medias de estaciones. |
| Factura generada | Sesión completada con `invoice_generated`; la tasa usa las operaciones completadas como denominador. |
| Descarga iniciada | Evento `invoice_download_requested`. No confirma que el usuario guardó el archivo. |

El recorrido usa una sola cohorte: sesión iniciada → enlace → identificación → autorización → suministro finalizado → factura generada. Las diferencias incluyen fallos, sesiones cerradas sin completar y sesiones en curso; no se etiquetan automáticamente como abandono. Todos los porcentajes de la red se recalculan con sus numeradores y denominadores, sin promediar porcentajes de estaciones.

No se conoce la actividad fuera de GAS&GO. No se muestra cuota de adopción sobre el total de la estación, tiempo ahorrado frente al proceso tradicional ni ingresos adicionales atribuibles al servicio sin una fuente de comparación.

## Datos de demostración y futura integración

La instantánea ficticia corresponde al 9 de noviembre de 2026, 13:42 en Madrid: tres estaciones, 286 sesiones, 256 operaciones completadas, 267 autorizaciones, 253 facturas generadas y 147 usuarios únicos con operación. Los pasos del día se generan como eventos temporales coherentes; ninguna marca temporal está después del corte. La serie de los seis días anteriores es un agregado simulado y solo se usa para la gráfica histórica.

No hay telemetría real, instrumentación en la app, control físico, pagos, reintentos reales, envíos ni solicitudes a terceros. Los estados locales de seguimiento no dan un incidente por resuelto.

Una futura conexión requiere capturar los eventos de cada sesión con identificadores estables, estación, marcas temporales y resultado, y un identificador de usuario anonimizado que permita deduplicar. Se debe validar la disponibilidad de cada señal y sus denominadores antes de mostrar indicadores reales. La generación y la solicitud de descarga de una factura son eventos distintos.

## Verificación

`node tests/dashboard.cjs` con Playwright y Chromium en `/usr/bin/chromium`. Verifica la cohorte, ponderación de tasas y tiempos, deduplicación de usuarios, filtros por estación, incidencias y sesiones afectadas, paginación/exportación, errores de factura separados del resultado del suministro, búsqueda, persistencia propia y anchos de 1440, 1024, 768, 430 y 375 px. Comprueba que no hay peticiones externas, excepciones de navegador ni cambios en el almacenamiento de la app.
