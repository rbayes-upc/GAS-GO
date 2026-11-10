# TAKE&GO · prototipo independiente

Abrir `index.html` (cliente) mediante un servidor HTTP y pulsar **Probar TAKE&GO → Abrir tienda virtual**. Ambas pestañas deben permanecer en el mismo navegador y origen. La tienda también se puede abrir en `tienda.html`; desde allí se abre la app del cliente con el enlace de sesión correcto.

Identidad de prueba Alex García. La acreditación automática A representa BLE + UWB + token; en «Escenarios de prueba» también están B (confirmación en app) y C (código temporal mostrado por la tienda). Son métodos conceptuales de GAS&GO, sin conexión a sus cuentas ni credenciales.

Coger/devolver productos representa acciones físicas, con dos observaciones simuladas independientes: seguimiento visual y etiqueta RFID única. La correlación usa datos de prueba fijos, no visión artificial real. Las etiquetas repetidas y observaciones antiguas se descartan. Si falta una lectura, la salida bloquea el pago hasta contrastarla o devolver el producto. También se pueden probar pagos rechazados, reintentos y salida sin compra.

La salida congela la cesta, genera un pago ficticio y envía el recibo al cliente automáticamente. La vista previa y el PDF usan la plantilla V2 de factura de GAS&GO (cabecera, resumen, facturación, detalle, pago y total), adaptada a marrón y al catálogo TAKE&GO. El documento sigue siendo de demostración, sin validez fiscal; se indica que los impuestos están incluidos sin inventar tipos impositivos o datos fiscales no registrados. No hay cobros, cámara, permisos de vídeo, sensores ni backend. Los datos se guardan bajo claves `takego_*`; no se toca GAS&GO, su surtidor o el dashboard. BroadcastChannel no enlaza dispositivos distintos. Web Locks evita dos tiendas de la misma sesión en navegadores compatibles.

Recargar durante un pago interrumpe la simulación y permite reintentar sin producir un recibo duplicado. Los recibos completados se conservan y se sincronizan al reconectar la app. Para producción serán necesarios acreditación real y consentimiento, vinculación segura de persona y productos, sensores y correlación espacio-temporal, backend de cobro con idempotencia, cumplimiento de privacidad, recibos fiscales y gestión de excepciones.

En **Perfil → Método de pago** están Visa, Mastercard, PayPal y Bizum con el mismo formato de GAS&GO adaptado a la paleta marrón. El método predeterminado se guarda y se aplica al iniciar la siguiente visita; el método de una visita abierta permanece fijo salvo que se elija explícitamente otro al resolver un pago rechazado.

En **Perfil → Límites de compra** se pueden establecer topes opcionales diarios, semanales (lunes a domingo) y mensuales, en periodos naturales de Europe/Madrid. Vacío significa sin límite; 0 € bloquea compras. Se acumulan únicamente compras completadas, con cualquier método, en este navegador. Se comparte el registro entre las tiendas virtuales mediante `takego_spending_v1` y se serializa la comprobación final/pago con Web Locks. Se vuelve a comprobar justo antes del pago, incluso si se cambian los límites durante la visita. Igualar el tope está permitido; superarlo no genera pago ni recibo. Los cambios de navegador o dispositivo no comparten límites sin un backend.

Verificación: `node tests/take-go-engine.cjs`; `node tests/take-go-spending.cjs`; `node tests/take-go.cjs` (requiere Playwright y Chromium).

Los PNG de `assets/logo-takego-completo.png` y `assets/logo-takego-abreviado.png` son los originales del ZIP facilitado por el usuario. Se conserva su contenido: los márgenes se encuadran mediante CSS en pantalla y mediante `drawImage` en el PDF. Como en GAS&GO, el completo aparece en bienvenida/cabecera de factura y el abreviado en cabeceras/pie de factura. Las descargas esperan a que ambos logos estén cargados y muestran un aviso si falla un recurso.

## Iteración tras el think-aloud

La guía inicial distingue la cuenta del cliente de la tienda virtual. La tienda muestra avisos de acceso, verificación y salida en una región accesible; se pueden activar avisos de voz del navegador. Se simula un comprador por sesión: no se ha añadido atribución física entre varias personas ni sensores reales.

Los productos detectados pendientes cuentan en la cesta y muestran «Importe pendiente», sin presentarlos como gratuitos. El cobro sigue basándose solo en lecturas contrastadas. El presupuesto previo incluye una estimación claramente indicada cuando hay productos pendientes. Se permite devolver directamente tras superar un tope y volver a comprobar la salida tras ajustar el presupuesto. Los topes tienen un interruptor explícito: desactivado = sin límite; activado con 0 € = compras bloqueadas, con aviso junto al campo.

Tras un pago rechazado se puede elegir otro de los métodos ficticios para esa compra, tanto en la tienda como en la app. Se mantiene el mismo identificador de intento/cesta para evitar duplicados y la elección puntual no cambia por sí sola el predeterminado para futuras visitas. Se mantienen los controles finales de presupuesto.

La app detecta la pérdida de respuesta de la tienda (umbral de seis segundos; aviso inmediato al cerrar la pestaña cuando el navegador entrega el evento), muestra el último estado recibido y desactiva las acciones remotas hasta reconectar. Una recarga conserva ese estado en la sesión, claramente señalado como pendiente de conexión. La tienda puede terminar la compra simulada con la app cerrada y sincronizar la factura cuando vuelva; la falta de respuesta de la app también se indica.

La cesta completada queda marcada como pagada. La navegación usa el historial del navegador y Atrás cierra la factura antes de abandonar la pantalla. La barra inferior permanece accesible mientras se desplaza el contenido de la app. Los formularios no se reconstruyen en cada señal periódica de conexión.

Desde una factura o una compra completada se puede registrar una incidencia ficticia asociada a su referencia. Se guarda únicamente bajo `takego_issues_v1`, con una copia de texto descargable y acceso desde Perfil → Mis incidencias. No hay envío a una estación, seguimiento remoto, devoluciones de dinero ni afirmación de resolución. Los detalles se escapan al mostrarse.

Pruebas adicionales: `node tests/take-go-ux.cjs` cubre Atrás/Adelante, guía persistente, navegación móvil, borradores, verificación pendiente, tarjetas alternativas, límite y devolución directa, incidencias locales, recarga/reconexión y pago con la app cerrada.
