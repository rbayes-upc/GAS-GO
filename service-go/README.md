# Service&Go

Prototipo autónomo para dos servicios de estación. El inflador utiliza presiones de ejemplo por vehículo y eje. La boquilla se conecta a una rueda cada vez, ajusta la presión en ambos sentidos y se detiene al llegar al objetivo. El box de autolavado utiliza una pistola con agua, espuma y aclarado. Las pausas no consumen saldo en ninguno de los equipos.

## Ejecutar

Desde la raíz del repositorio, ejecuta `python3 -m http.server 8000` y abre `/service-go/` desde el servidor local. Pulsa **Abrir simulador** para abrir la segunda pantalla. Usa dos pestañas del mismo navegador y perfil, en localhost o en un sitio HTTPS. Las dos pantallas comparten la sesión local usando el origen del sitio. La sincronización entre navegadores o dispositivos requiere un canal remoto.

1. En la app, elige servicio, vehículo, método de identificación y máximo entre 0,50 € y 50,00 €.
2. En el simulador, pulsa **Identificar cliente**. El modo automático autoriza tras una breve espera, la confirmación se hace en la app y el código temporal de seis cifras se introduce en el equipo. La solicitud caduca a los 90 segundos.
3. Conecta la boquilla o activa la pistola. La simulación cobra 0,02 €/s por inflado o 0,05 €/s por lavado. El servicio se cierra al llegar al máximo, al completar las cuatro ruedas o al finalizarlo manualmente.
4. Descarga la factura en PDF desde la app antes de iniciar otra sesión. El documento y los pagos son simulados.

Service&Go se publica como sitio estático bajo `/service-go/`. Todos sus recursos están en esta carpeta.
