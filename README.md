# Gestor de Torneos — Versión Final (Node 22 + Vite + Netlify)

Este proyecto es un gestor de torneos en React (Vite + Tailwind) con:
- Función **Drop/Reintegrar** jugadores o equipos
- Emparejamientos que **excluyen** dropeados
- **Historial de rondas** persistido en `localStorage`
- Configuración lista para **Netlify** (Node 22)

## Requisitos
- Node 22 (pinned con `.nvmrc`)
- npm 10+

## Desarrollo local
```bash
npm install
npm run dev
```
Abre: http://localhost:5173

## Build de producción
```bash
npm run build
npm run preview
```

## Despliegue en Netlify
- El archivo `netlify.toml` ya está configurado:
  ```toml
  [build]
    command = "npm install && npm run build"
    publish = "dist"

  [build.environment]
    NODE_VERSION = "22"

  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```

## Estructura relevante
```
src/
  components/
    Storage.js              # Lógica de almacenamiento + drop/undrop + emparejamientos + historial
    TournamentSelector.jsx  # UI con botones Drop/Reintegrar + generar emparejamientos + historial
  AdminApp.jsx
  App.jsx
  main.jsx
```

## Notas de compatibilidad
- Importaciones **sensibles a mayúsculas/minúsculas** (Linux/Netlify): verifica que `Storage.js` se importe exactamente como `./Storage.js`.
- Si cambias dependencias, **asegura** que estén listadas en `package.json`.

¡Listo! 🚀
