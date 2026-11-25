# Service&Go

Prototipo autónomo para dos servicios de estación. El inflador utiliza presiones de ejemplo por vehículo y eje. La boquilla se conecta a una rueda cada vez, ajusta la presión en ambos sentidos y se detiene al llegar al objetivo. El box de autolavado utiliza una lanza con desengrasante, lavado, jabón y aclarado. Las pausas no consumen saldo en ninguno de los equipos.

## Ejecutar

Desde la raíz del repositorio, ejecuta `python3 -m http.server 8000` y abre `/service-go/` desde el servidor local. Al preparar la sesión, el simulador se abre al lado de la app en escritorio y debajo en pantallas estrechas. Puedes volver a abrirlo desde **Abrir simulador**. La app y el simulador comparten la sesión local en el mismo origen, en localhost o HTTPS.

1. Pulsa **Probar Service&Go** y elige un servicio. La app reutiliza el nombre, el vehículo activo y la etiqueta del método de pago del perfil local de GAS&GO si está disponible en el mismo navegador y origen. Si falta, usa un perfil de ejemplo. La identificación automática y el máximo de 3 € vienen seleccionados. En **Opciones de sesión** puedes cambiar el método de identificación y fijar un máximo entre 0,50 € y 50,00 €.
2. En el simulador, pulsa **Identificar cliente**. El modo automático autoriza tras una breve espera, la confirmación se hace en la app y el código temporal de seis cifras se introduce en el equipo. La solicitud caduca a los 90 segundos.
3. En el inflador, elige una rueda, cambia el objetivo con **+** o **−**, pulsa **SET** y luego **Presionar**. **UNIT** alterna entre BAR, PSI y kPa. En el box elige **Desengrasante**, **Lavado**, **Jabón** o **Aclarado** y pulsa **Usar lanza**. La simulación cobra 0,05 €/s por inflado o 1 €/min por lavado, en proporción al tiempo activo. El servicio se cierra al llegar al máximo, al ajustar todos los neumáticos o al finalizarlo manualmente.
4. Descarga la factura en PDF desde la app antes de iniciar otra sesión. El documento y los pagos son simulados.

Service&Go se publica como sitio estático bajo `/service-go/`. Todos sus recursos están en esta carpeta.
