# Configuración de Entornos - Calima Online Server

## Descripción

El servidor ahora soporta múltiples entornos (desarrollo/producción) con bases de datos separadas para evitar conflictos entre local y producción.

## Variables de Entorno

### Desarrollo Local

Crea un archivo `.env` en la raíz del servidor con:

```env
# Entorno
NODE_ENV=development

# MongoDB - Base de datos de DESARROLLO
MONGODB_URI=mongodb://localhost:27017/calima-online-dev

# Puerto del servidor
PORT=3000

# JWT
JWT_SECRET=tu_clave_secreta_super_segura_aqui
JWT_EXPIRES_IN=7d

# Otros...
```

### Producción

En tu plataforma de despliegue (Railway, Heroku, Vercel, etc.), configura:

```env
# Entorno (IMPORTANTE)
NODE_ENV=production

# MongoDB - Base de datos de PRODUCCIÓN
MONGODB_URI_PRODUCTION=mongodb+srv://usuario:password@cluster.mongodb.net/calima-online-prod

# Puerto del servidor (opcional, muchas plataformas lo asignan automáticamente)
PORT=3000

# JWT
JWT_SECRET=tu_clave_secreta_diferente_para_produccion
JWT_EXPIRES_IN=7d

# Otros...
```

## Cómo Funciona

El sistema usa `NODE_ENV` para determinar qué base de datos usar:

```javascript
const isProduction = process.env.NODE_ENV === 'production';
const mongoURI = isProduction 
  ? process.env.MONGODB_URI_PRODUCTION  // Producción
  : process.env.MONGODB_URI;             // Desarrollo
```

### Estados del Sistema:

| NODE_ENV | Variable Usada | Base de Datos |
|----------|----------------|---------------|
| `development` (o no configurado) | `MONGODB_URI` | `calima-online-dev` |
| `production` | `MONGODB_URI_PRODUCTION` | `calima-online-prod` |

## Configuración en Railway

Si estás usando Railway:

1. Ve a tu proyecto en Railway
2. Haz clic en tu servicio del servidor
3. Ve a la pestaña "Variables"
4. Añade/modifica estas variables:
   ```
   NODE_ENV=production
   MONGODB_URI_PRODUCTION=mongodb+srv://...tu-uri-de-produccion...
   JWT_SECRET=tu_clave_secreta_produccion
   ```

## Configuración en Vercel

Si estás usando Vercel:

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Añade estas variables para "Production":
   ```
   NODE_ENV=production
   MONGODB_URI_PRODUCTION=mongodb+srv://...tu-uri-de-produccion...
   JWT_SECRET=tu_clave_secreta_produccion
   ```

## Bases de Datos MongoDB

### Opción 1: MongoDB Atlas (Recomendado para Producción)

1. Crea una cuenta en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crea dos clusters o dos bases de datos:
   - **Desarrollo**: `calima-online-dev`
   - **Producción**: `calima-online-prod`
3. Obtén las URIs de conexión para cada una
4. Usa la URI de desarrollo en `.env` local
5. Usa la URI de producción en las variables de entorno de tu plataforma

### Opción 2: MongoDB Local + Atlas

- **Local**: `mongodb://localhost:27017/calima-online-dev`
- **Producción**: `mongodb+srv://...atlas.../calima-online-prod`

### Opción 3: Dos Bases de Datos Locales (solo para testing)

```env
# Desarrollo
MONGODB_URI=mongodb://localhost:27017/calima-online-dev

# Producción (aún local, pero separado)
MONGODB_URI_PRODUCTION=mongodb://localhost:27017/calima-online-prod
```

## Verificación

Al iniciar el servidor, deberías ver:

### En Desarrollo:
```
🌍 Entorno: development
📦 Conectando a MongoDB DEVELOPMENT...
✅ MongoDB conectado: localhost
📊 Base de datos: calima-online-dev
```

### En Producción:
```
🌍 Entorno: production
📦 Conectando a MongoDB PRODUCTION...
✅ MongoDB conectado: cluster0.mongodb.net
📊 Base de datos: calima-online-prod
```

## Migración de Datos Existentes

Si ya tienes datos en una base de datos compartida, puedes:

### 1. Exportar datos de desarrollo:
```bash
mongodump --uri="mongodb://localhost:27017/calima-online" --out=./backup-dev
```

### 2. Importar a base de datos de desarrollo:
```bash
mongorestore --uri="mongodb://localhost:27017/calima-online-dev" ./backup-dev/calima-online
```

### 3. Exportar datos de producción (si tienes):
```bash
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/calima-online" --out=./backup-prod
```

### 4. Importar a base de datos de producción:
```bash
mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net/calima-online-prod" ./backup-prod/calima-online
```

## Troubleshooting

### Error: "No se encontró URI de MongoDB"

**Causa**: No has configurado las variables de entorno correctamente.

**Solución**:
- Verifica que `.env` existe y tiene `MONGODB_URI`
- En producción, verifica que `MONGODB_URI_PRODUCTION` está configurado
- Verifica que `NODE_ENV` está configurado correctamente

### Error: "Authentication failed"

**Causa**: Credenciales incorrectas en la URI de MongoDB.

**Solución**:
- Verifica usuario y contraseña en MongoDB Atlas
- Asegúrate de que tu IP está en la whitelist de Atlas
- Verifica que la URI está correctamente escapada (sin caracteres especiales sin codificar)

### Advertencia: "NODE_ENV no está configurado"

**Causa**: La variable `NODE_ENV` no existe.

**Solución**:
- Añade `NODE_ENV=development` a tu `.env` local
- En producción, asegúrate de que está configurado como `production`

## Mejores Prácticas

1. ✅ **Nunca** compartas el mismo `.env` entre desarrollo y producción
2. ✅ **Siempre** usa bases de datos separadas para dev/prod
3. ✅ **Nunca** commits el archivo `.env` al repositorio
4. ✅ Usa secretos diferentes para JWT en dev/prod
5. ✅ Haz backups regulares de la base de datos de producción
6. ✅ Prueba cambios en desarrollo antes de desplegar a producción

## Comandos Útiles

### Verificar configuración actual:
```bash
# Ver variables de entorno
cat .env

# Iniciar en desarrollo
npm run dev

# Iniciar en producción (localmente)
NODE_ENV=production npm start
```

### Limpiar base de datos de desarrollo (cuidado):
```bash
mongosh
use calima-online-dev
db.dropDatabase()
```

## Notas Importantes

- 🔒 La base de datos de **producción** contiene datos reales de jugadores
- 🧪 La base de datos de **desarrollo** es para testing y desarrollo local
- 🚫 **NUNCA** ejecutes scripts de testing contra producción
- 💾 Haz backups regulares de producción antes de cambios importantes