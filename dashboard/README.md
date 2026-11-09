# GAS&GO Insights · Uso y experiencia del servicio

Panel web independiente para entender cuánto se usa GAS&GO, cómo se completa el recorrido del usuario y dónde aparecen fricciones. Mantiene el diseño bento y la paleta de la app. No es un gestor de depósitos, mantenimiento o actividad general de la estación.

## Abrir

Servir la raíz del repositorio con un servidor estático y abrir `/dashboard/`. En Pages: `https://rbayes-upc.github.io/GAS-GO/dashboard/?v=4`. Sin compilación, claves ni peticiones a servicios externos. Se reutilizan el logotipo y el catálogo local de Material Symbols (Apache-2.0); la app y el surtidor originales no se modifican ni se cargan.

## Vistas

- **Visión general:** diferencias entre pasos clasificadas en avances, fallos, cierres y pendientes; sesiones GAS&GO, operaciones completadas, autorización automática e importe asociado; gráfica de actividad, recorrido de la misma cohorte, comparación entre estaciones, incidencias del servicio y personas que lo usan.
- **Estaciones:** tasas de finalización y método A, usuarios únicos con operación, tiempo hasta autorizar, facturas e importe GAS&GO de cada estación.
- **Sesiones GAS&GO:** registro paginado de 20 en 20, búsqueda y filtros por resultado, paso alcanzado o error de factura. El detalle muestra exactamente los eventos registrados, sin inventar pasos que no ocurrieron.
- **Incidencias del servicio:** grupos por estación y evento de enlace, autorización o factura. Cada aviso lleva a sus sesiones afectadas. El seguimiento es local y reversible y no altera los eventos ni los resultados de las sesiones.
- **Rendimiento:** comparación de intentos por método, sus resultados, tiempos y cambios explícitos A/B/C; tiempos medio y percentil 95 hasta autorizar, métodos A/B/C, usuarios, repetición del día, facturas y volúmenes por servicio. Litros y kWh se mantienen separados.
- **Periodos globales:** Hoy, Ayer y Últimos 7 días aplican a métricas, cohortes, usuarios, tablas, incidencias, búsquedas, gráficas y exportaciones.
- **Comparación y definiciones:** los cuatro indicadores principales muestran la variación con una ventana anterior equivalente; el botón «?» explica fórmula, cifras actuales y base anterior. «Cómo se compara» aclara los cortes temporales.
- **Exportación:** CSV de todas las coincidencias del filtro, no solo la página visible; avisos agrupados o resumen del periodo por estación. Los resúmenes incluyen inicio y fin de ventana en ISO y los registros incluyen el inicio de sesión en ISO. La gráfica permite consultar su tabla de datos.
- **Búsqueda y preferencias:** Ctrl/Cmd + K para estaciones, sesiones o avisos; densidad cómoda/compacta. El almacenamiento propio es `gasgo_service_analytics_v2`. No se accede a `gasgo_demo` ni se importan los seguimientos de incidencias físicas de la versión anterior.

## Definiciones

Los indicadores del periodo se derivan de `sessions`, `archivedSessions` y sus eventos en `data.js`:

| Indicador | Cálculo |
| --- | --- |
| Sesiones | Sesiones GAS&GO iniciadas dentro del periodo y la selección. No son todas las operaciones de la estación. |
| Operaciones completadas | Sesiones con `supply_finished`. |
| Tasa de finalización | Completadas / sesiones iniciadas. La cohorte incluye las que siguen en curso. |
| Autorización automática | Autorizaciones completadas por método A / todas las autorizaciones completadas. No incluye solicitudes fallidas. |
| Importe GAS&GO | Suma del importe de operaciones completadas. Las no finalizadas conservan su importe provisional solo en el registro. No es facturación incremental ni total de la estación. |
| Usuario único | Identificador anonimizado con al menos una operación completada en el periodo. Se deduplica entre estaciones al elegir toda la red. |
| Recurrente en el periodo | Usuario con dos o más operaciones completadas dentro del periodo y la selección. No afirma una recurrencia histórica. |
| Hasta autorizar | Diferencia entre `session_started` y `authorization_succeeded`, solo en sesiones autorizadas. Media y percentil 95 sobre sesiones, no media de medias de estaciones. |
| Factura generada | Sesión completada con `invoice_generated`; la tasa usa las operaciones completadas como denominador. |
| Descarga iniciada | Evento `invoice_download_requested`. No confirma que el usuario guardó el archivo. |

El recorrido usa una sola cohorte de sesiones iniciadas en la ventana seleccionada: sesión iniciada → enlace → identificación → autorización → suministro finalizado → factura generada. Las diferencias incluyen fallos, sesiones cerradas sin completar y sesiones en curso; no se etiquetan automáticamente como abandono. Todos los porcentajes de la red se recalculan con sus numeradores y denominadores, sin promediar porcentajes de estaciones.

No se conoce la actividad fuera de GAS&GO. No se muestra cuota de adopción sobre el total de la estación, tiempo ahorrado frente al proceso tradicional ni ingresos adicionales atribuibles al servicio sin una fuente de comparación.

## Datos de demostración y futura integración

La instantánea ficticia corresponde al 9 de noviembre de 2026, 13:42 en Madrid: tres estaciones; en «Hoy», 286 sesiones, 256 operaciones completadas, 267 autorizaciones, 253 facturas generadas y 147 usuarios únicos con operación. Los pasos y escenarios de cambio de método se generan como eventos temporales coherentes de demostración; ninguna marca temporal está después del corte. Se incluyen trece días anteriores de sesiones generadas, con identificadores de sesión únicos y usuarios anonimizados estables. Los históricos también tienen eventos completos y se filtran como cualquier otra sesión; no se mezclan agregados históricos con datos detallados.

### Ventanas comparables

- **Hoy:** desde las 00:00 hasta el corte simulado (13:42), frente a ayer hasta la misma hora.
- **Ayer:** día completo, frente al día anterior completo.
- **Últimos 7 días:** seis días completos y el día del corte hasta las 13:42, frente a la semana previa con el último día recortado a esa misma hora.

Se seleccionan sesiones por su inicio y se descartan los eventos posteriores al fin de cada ventana. Si una sesión histórica termina después del corte, sigue figurando en curso en ese corte; su importe y cantidad futuros no se revelan. Si el suministro ya terminó pero la factura llega después, se conserva el importe final y la factura aún no cuenta como generada.

La variación de sesiones e importes es relativa (%). La variación de finalización y autorización automática es la diferencia de tasas en puntos porcentuales (pp). Si falta un denominador o una base anterior, se indica que no es comparable. No se atribuye causalidad a estos cambios. Las tablas semanales muestran la fecha además de la hora.

No hay telemetría real, instrumentación en la app, control físico, pagos, reintentos reales, envíos ni solicitudes a terceros. Los estados locales de seguimiento no dan un incidente por resuelto.

Una futura conexión requiere capturar los eventos de cada sesión con identificadores estables, estación, marcas temporales y resultado, y un identificador de usuario anonimizado que permita deduplicar. Se debe validar la disponibilidad de cada señal y sus denominadores antes de mostrar indicadores reales. La generación y la solicitud de descarga de una factura son eventos distintos.

## Diferencias entre pasos

Al pulsar un paso posterior al inicio se toma como base la cohorte que llegó al paso anterior. `analytics.js` clasifica cada sesión en un grupo excluyente:

- **Avanzaron:** existe el evento del paso de destino, aunque haya otro fallo más adelante.
- **Con fallo:** falta el destino y hay un evento de error explícito de esa transición (enlace, identificación, autorización, suministro o factura).
- **Cerradas sin completar:** falta el destino y se registró un cierre explícito de sesión.
- **Pendientes:** no consta destino, error de esa transición ni cierre antes del corte. No demuestra abandono ni actividad física todavía en curso.

Los cuatro grupos suman la base del paso anterior y se pueden abrir como filtros del registro de sesiones. En «Hoy», la diferencia de identificación son 2 cierres y 5 pendientes; la de factura son 3 errores sobre suministros ya completados. Un error de factura no se convierte en abandono del repostaje.

## Intentos y alternativas A/B/C

Los fixtures incluyen `authorization_attempt_started`, `authorization_attempt_succeeded`, `authorization_attempt_failed`, `authorization_attempt_cancelled` y `authorization_method_changed`. Un identificador de intento es local a su sesión; la clave analítica compuesta sesión/intento es única en todo el historial. Un método final C no implica que se haya empezado con A: solo se cuentan intentos y cambios explícitos.

- **Tasa por intento:** autorizados / iniciados del método, incluyendo cancelados y pendientes en la base. Es distinta de la cuota de autorizaciones que terminan por A del indicador principal.
- **Duración media resuelta:** inicio del intento a autorización o fallo. Excluye cancelaciones, pendientes y la espera previa al método. Un intento posterior no hereda el tiempo de espera del anterior.
- **Sesiones frente a intentos:** las celdas muestran intentos; al pulsarlas se listan sesiones únicas que contienen al menos uno con ese resultado. Su estado global puede ser «Completada» aunque un intento A haya fallado.
- **Cambios:** cada pareja A→B, A→C o B→C abre las sesiones con ese evento. A→B→C aparece en dos parejas; no se suman como usuarios o sesiones únicos. «Autorizadas después» describe una secuencia temporal, no causalidad.
- **Cortes históricos:** un intento cuyo resultado ocurre después del corte sigue pendiente; no se anticipa su éxito ni su duración final.
- **Exportación:** la comparación CSV incluye estación, ventana, numeradores, denominadores y tiempos. Los registros CSV incluyen el filtro analítico aplicado, cantidad de intentos y cambios registrados.

Son escenarios simulados de un posible registro de eventos, no transiciones observadas ni una nueva capacidad instrumentada en la app o en el surtidor actuales. Una integración real necesita capturar y validar estos eventos; no se los reconstruye a partir del método final.

## Verificación

`node tests/dashboard-analytics.cjs` comprueba particiones excluyentes, reintentos del mismo método, cancelaciones, cambios encadenados, cortes temporales e identificadores de intento.

`node tests/dashboard.cjs` con Playwright y Chromium en `/usr/bin/chromium`. Verifica la cohorte, ponderación de tasas y tiempos, deduplicación de usuarios por periodo, ventanas anteriores equivalentes y exclusión de resultados futuros en cada corte, filtros por estación, incidencias y sesiones afectadas, análisis de pasos y métodos con sus filtros y CSV, paginación/exportación, errores de factura separados del resultado del suministro, búsqueda, persistencia propia y anchos de 1440, 1024, 768, 430 y 375 px. Comprueba que no hay peticiones externas, excepciones de navegador ni cambios en el almacenamiento de la app.
