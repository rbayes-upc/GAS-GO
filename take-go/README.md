# TAKE&GO · prototipo independiente

Abrir `index.html` (cliente) mediante un servidor HTTP y pulsar **Probar TAKE&GO → Abrir tienda virtual**. Ambas pestañas deben permanecer en el mismo navegador y origen. La tienda también se puede abrir en `tienda.html`; desde allí se abre la app del cliente con el enlace de sesión correcto.

Identidad de prueba Alex García. La acreditación automática A representa BLE + UWB + token; en «Escenarios de prueba» también están B (confirmación en app) y C (código temporal mostrado por la tienda). Son métodos conceptuales de GAS&GO, sin conexión a sus cuentas ni credenciales.

Coger/devolver productos representa acciones físicas, con dos observaciones simuladas independientes: seguimiento visual y etiqueta RFID única. La correlación usa datos de prueba fijos, no visión artificial real. Las etiquetas repetidas y observaciones antiguas se descartan. Si falta una lectura, la salida bloquea el pago hasta contrastarla o devolver el producto. También se pueden probar pagos rechazados, reintentos y salida sin compra.

La salida congela la cesta, genera un pago ficticio y envía el recibo al cliente automáticamente. El PDF es un recibo de demostración, sin validez fiscal. No hay cobros, cámara, permisos de vídeo, sensores ni backend. Los datos se guardan bajo claves `takego_*`; no se toca GAS&GO, su surtidor o el dashboard. BroadcastChannel no enlaza dispositivos distintos. Web Locks evita dos tiendas de la misma sesión en navegadores compatibles.

Recargar durante un pago interrumpe la simulación y permite reintentar sin producir un recibo duplicado. Los recibos completados se conservan y se sincronizan al reconectar la app. Para producción serán necesarios acreditación real y consentimiento, vinculación segura de persona y productos, sensores y correlación espacio-temporal, backend de cobro con idempotencia, cumplimiento de privacidad, recibos fiscales y gestión de excepciones.

En **Perfil → Método de pago** están Visa, Mastercard, PayPal y Bizum con el mismo formato de GAS&GO adaptado a la paleta marrón. El método predeterminado se guarda y se aplica al iniciar la siguiente visita; el método de una visita abierta permanece fijo.

En **Perfil → Límites de compra** se pueden establecer topes opcionales diarios, semanales (lunes a domingo) y mensuales, en periodos naturales de Europe/Madrid. Vacío significa sin límite; 0 € bloquea compras. Se acumulan únicamente compras completadas, con cualquier método, en este navegador. Se comparte el registro entre las tiendas virtuales mediante `takego_spending_v1` y se serializa la comprobación final/pago con Web Locks. Se vuelve a comprobar justo antes del pago, incluso si se cambian los límites durante la visita. Igualar el tope está permitido; superarlo no genera pago ni recibo. Los cambios de navegador o dispositivo no comparten límites sin un backend.

Verificación: `node tests/take-go-engine.cjs`; `node tests/take-go-spending.cjs`; `node tests/take-go.cjs` (requiere Playwright y Chromium).
