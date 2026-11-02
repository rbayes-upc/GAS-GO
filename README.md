# GAS&GO

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

## Surtidor con QR

1. Abre `/surtidor-demo.html` en el ordenador desde el sitio HTTPS de Netlify.
2. Espera a que aparezcan el QR y el estado «QR ACTIVO».
3. Escanéalo con la cámara del móvil: abrirá la bienvenida de `/index.html` en el mismo sitio. Elige DEMO, Iniciar sesión o completa Registrarse; después la app intentará vincularse con esa sesión del surtidor.

Ambos dispositivos necesitan Internet. El enlace usa PeerJS/WebRTC y bibliotecas CDN; algunas redes pueden bloquearlo. Recargar el surtidor genera una sesión nueva. La conexión real entre dos dispositivos debe validarse tras el despliegue.

La consulta real de matrículas requiere configurar `APIVEHICULO_KEY` de forma segura en Netlify. No guardes claves en GitHub ni en archivos del navegador. La consulta es opcional para el modo DEMO.
