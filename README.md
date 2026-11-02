# GAS&GO

Prototipo de app y surtidor virtual. Las operaciones, los pagos y la identificación son simulados.

## Desarrollo local

Desde la raíz del repositorio:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Abre `index.html` desde ese servidor. El botón DEMO abre el surtidor en otra pestaña del mismo navegador.

## Despliegue automático en Netlify

Conecta este repositorio desde el sitio de Netlify mediante la opción de importar o vincular un repositorio existente.

- Rama de producción: `main`.
- Directorio base: raíz del repositorio.
- Comando de compilación: vacío; no hay compilación.
- Directorio de publicación: `.`.
- Funciones: `netlify/functions` (declarado en `netlify.toml`).

Netlify desplegará los nuevos commits de `main` automáticamente. GitHub guarda el código y Netlify sirve la app y sus funciones.

## Surtidor con QR

1. Abre `/surtidor-demo.html` en el ordenador desde el sitio HTTPS de Netlify.
2. Espera a que aparezcan el QR y el estado «QR ACTIVO».
3. Escanéalo con la cámara del móvil: abrirá `/index.html` en el mismo sitio e intentará vincular la app con esa sesión del surtidor.

Ambos dispositivos necesitan Internet. El enlace usa PeerJS/WebRTC y bibliotecas CDN; algunas redes pueden bloquearlo. Recargar el surtidor genera una sesión nueva. La conexión real entre dos dispositivos debe validarse tras el despliegue.

La consulta real de matrículas requiere configurar `APIVEHICULO_KEY` de forma segura en Netlify. No guardes claves en GitHub ni en archivos del navegador. La consulta es opcional para el modo DEMO.
