# Deployment en Vercel - Limitaciones y Alternativas

## ⚠️ LIMITACIÓN IMPORTANTE: WebSockets NO soportados

**Vercel NO soporta WebSockets persistentes** en su arquitectura serverless. Esto significa que:

✅ **Funcionará:**
- API REST (login, registro, CRUD de personajes)
- Endpoints HTTP (`/health`, `/api/auth`, `/api/characters`)
- Operaciones síncronas

❌ **NO funcionará:**
- Socket.io / WebSockets
- Funcionalidades en tiempo real (multijugador)
- Chat en tiempo real
- Sincronización de posiciones de jugadores
- Notificaciones push
- Sistema de desconexión forzada

## Solución Implementada

Se han realizado los siguientes cambios para que el servidor funcione en Vercel (solo API REST):

### 1. **Modificación de server.js**

```javascript
// Solo iniciar el servidor si no estamos en Vercel
if (process.env.VERCEL !== '1') {
  httpServer.listen(PORT, () => {
    console.log('Servidor iniciado...');
  });
}

// Export default para Vercel serverless
export default app;
```

### 2. **Archivo vercel.json**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/health",
      "dest": "src/server.js"
    },
    {
      "src": "/api/(.*)",
      "dest": "src/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "src/server.js"
    }
  ]
}
```

## Variables de Entorno en Vercel

Debes configurar las siguientes variables en el dashboard de Vercel:

```
MONGODB_URI=tu_mongodb_connection_string
JWT_SECRET=tu_jwt_secret
CORS_ORIGIN=https://tu-frontend.vercel.app,https://otro-dominio.com
NODE_ENV=production
```

## Alternativas Recomendadas para Deployment Completo

Si necesitas funcionalidades de WebSocket/Socket.io (multijugador), considera estas alternativas:

### 1. **Railway.app** ⭐ Recomendado
- ✅ Soporta WebSockets
- ✅ Deployment automático desde GitHub
- ✅ Base de datos incluida
- ✅ Fácil configuración
- 💰 Plan gratuito: $5 crédito mensual
- 🔗 https://railway.app

**Deploy en Railway:**
```bash
# 1. Instalar Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Inicializar proyecto
railway init

# 4. Deploy
railway up
```

### 2. **Render.com** ⭐ También recomendado
- ✅ Soporta WebSockets
- ✅ Free tier generoso
- ✅ Deployment desde GitHub
- ✅ Base de datos PostgreSQL/MongoDB
- 💰 Plan gratuito disponible
- 🔗 https://render.com

**Deploy en Render:**
1. Conectar repositorio de GitHub
2. Seleccionar "Web Service"
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Añadir variables de entorno

### 3. **Heroku**
- ✅ Soporta WebSockets
- ✅ Muy establecido
- ✅ Muchos add-ons disponibles
- 💰 Desde $7/mes (ya no tiene free tier)
- 🔗 https://heroku.com

### 4. **DigitalOcean App Platform**
- ✅ Soporta WebSockets
- ✅ VPS tradicional si lo necesitas
- 💰 Desde $5/mes
- 🔗 https://digitalocean.com

### 5. **Fly.io**
- ✅ Soporta WebSockets
- ✅ Edge deployment global
- 💰 Plan gratuito limitado
- 🔗 https://fly.io

## Configuración para Railway (Ejemplo Completo)

### railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Procfile (para Railway/Heroku)
```
web: npm start
```

### Variables de Entorno Necesarias
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=supersecret123
CORS_ORIGIN=https://tu-frontend.vercel.app
PORT=3000
NODE_ENV=production
```

## Comparación de Servicios

| Servicio | WebSockets | Free Tier | Facilidad | Precio |
|----------|-----------|-----------|-----------|--------|
| **Vercel** | ❌ | ✅ Generoso | ⭐⭐⭐⭐⭐ | Gratis |
| **Railway** | ✅ | ✅ $5/mes | ⭐⭐⭐⭐⭐ | $5-20/mes |
| **Render** | ✅ | ✅ Limitado | ⭐⭐⭐⭐ | Gratis |
| **Heroku** | ✅ | ❌ | ⭐⭐⭐⭐⭐ | $7+/mes |
| **DigitalOcean** | ✅ | ❌ | ⭐⭐⭐ | $5+/mes |
| **Fly.io** | ✅ | ✅ Limitado | ⭐⭐⭐ | Gratis |

## Solución Híbrida

Puedes usar una arquitectura híbrida:

```
Frontend (Vercel) ──┐
                    ├──> API REST (Vercel) ──> MongoDB
Cliente Juego ──────┘
                    └──> WebSocket Server (Railway) ──> MongoDB
```

- **Vercel**: Hosting del cliente HTML/JS y API REST (auth, personajes)
- **Railway/Render**: Servidor de WebSockets para multijugador

## Próximos Pasos

1. **Para usar solo API REST en Vercel:**
   - Deploy actual funcionará
   - Desactiva funcionalidades de Socket.io en el cliente
   - Juego funcionará en modo "single player"

2. **Para funcionalidades completas (recomendado):**
   - Migrar a Railway o Render
   - Mantener Vercel solo para el frontend
   - Configurar CORS correctamente entre servicios

## Deploy Actual en Vercel

```bash
# 1. Instalar Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Configurar variables de entorno
vercel env add MONGODB_URI
vercel env add JWT_SECRET
vercel env add CORS_ORIGIN

# 5. Redeploy con variables
vercel --prod
```

## Conclusión

**Para Calima Online**, que es un juego multijugador en tiempo real, **Railway o Render son las mejores opciones** debido al soporte completo de WebSockets y planes gratuitos/económicos disponibles.

Vercel es excelente para el **frontend** y para APIs REST, pero no para el **backend de WebSockets** del juego.

---

**Última actualización:** 29/01/2026  
**Autor:** Sistema de Deployment Calima Online