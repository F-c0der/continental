# Continental · Marcador (PWA)
App web instalable y offline para llevar la puntuación por rondas del juego Continental.

## Uso rápido
1. Sube toda esta carpeta a un repo de GitHub (por ejemplo `continental-pwa`).
2. En el repo: **Settings → Pages → Deploy from a branch → main / (root)**.
3. Abre la URL de GitHub Pages desde tu móvil.
4. En el navegador: **Añadir a pantalla de inicio**. Tras la primera carga funciona **offline**.

## Personalización
- En ⚙️ puedes editar las rondas: una por línea con formato `Nombre | Cartas`.
- Exporta/Importa partidas (JSON).

## Desarrollo local
Abre `index.html` con un servidor estático (por ejemplo: VS Code + Live Server).
El service worker cachea assets en producción (HTTPS).