# Configuración Docker + Desarrollo Local

## 🎯 Escenarios de Uso

Tienes dos formas de trabajar con Calima Online:

### Opción 1: Todo en Docker (Recomendado para comenzar)
Todo corre dentro de contenedores Docker.

### Opción 2: Híbrido (Recomendado para desarrollo)
MongoDB en Docker, pero servidor y cliente corriendo localmente.

---

## 📦 Opción 1: Todo en Docker

### Levantar todo el stack:
```bash
docker-compose up
```

### Acceder a los servicios:
- 🌐 Cliente: http://localhost:8080
- 🖥️ Servidor: http://localhost:3000
- 🗄️ MongoDB: mongodb://localhost:27017/calima-online-dev

### Ventajas:
✅ Setup rápido
✅ Ambiente aislado
✅ Igual en todos los sistemas

### Desventajas:
❌ Hot reload puede ser más lento
❌ Debugging más complicado
❌ Consume más recursos

---

## 🔧 Opción 2: Híbrido (Solo MongoDB en Docker)

Esta es la configuración **recomendada para desarrollo activo**.

### 1. Levantar solo MongoDB:

```bash
# Solo MongoDB
docker-compose up mongodb

# O en segundo plano
docker-compose up -d mongodb
```

### 2. Configurar .env.local

En `calima-online-server/.env.local`:

```env
# Conecta al MongoDB que corre en Docker
MONGODB_URI=mongodb://localhost:27017/calima-online-dev
NODE_ENV=development
PORT=3000
JWT_SECRET=dev_secret_key_super_seguro_local
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:8080,http://localhost:5173
```

**IMPORTANTE**: La URI es `mongodb://localhost:27017` porque el contenedor expone el puerto 27017 a tu máquina local.

### 3. Iniciar el servidor localmente:

```bash
cd calima-online-server
npm run dev
```

Deberías ver:
```
🌍 Entorno: development
📦 Conectando a MongoDB DEVELOPMENT...
✅ MongoDB conectado: localhost
📊 Base de datos: calima-online-dev
```

### 4. Iniciar el cliente localmente:

```bash
# En otra terminal
cd calima-online-client

# Opción A: Con http-server (si lo tienes instalado)
npx http-server -p 8080 -c-1

# Opción B: Con Python (si lo tienes instalado)
python3 -m http.server 8080

# Opción C: Con Node.js (si tienes el script)
npm run dev
```

### Ventajas:
✅ **Hot reload instantáneo** en servidor y cliente
✅ **Debugging fácil** con breakpoints
✅ **Logs claros** en la terminal
✅ **Consume menos recursos**
✅ **Datos persistentes** en MongoDB Docker

### Desventajas:
❌ Necesitas tener Node.js instalado localmente
❌ Dos terminales (o más) abiertas

---

## 🔄 Cambiar Entre Modos

### De Docker a Local:

1. Detén todo Docker:
```bash
docker-compose down
```

2. Levanta solo MongoDB:
```bash
docker-compose up -d mongodb
```

3. Verifica que MongoDB está corriendo:
```bash
docker-compose ps
# Deberías ver calima-mongodb en estado "Up"
```

4. Inicia servidor y cliente localmente (ver Opción 2, pasos 3-4)

### De Local a Docker:

1. Detén servidor y cliente locales (Ctrl+C en cada terminal)

2. Levanta todo el stack:
```bash
docker-compose up
```

---

## 🔍 Verificación de Conexión

### Verificar que MongoDB acepta conexiones:

```bash
# Desde tu máquina
mongosh mongodb://localhost:27017/calima-online-dev

# Si conecta exitosamente, verás:
# Current Mongosh Log ID: ...
# Connecting to: mongodb://localhost:27017/calima-online-dev
# Using MongoDB: 7.0.x
```

### Probar conexión desde el servidor:

El servidor mostrará en los logs al iniciar:
```
✅ MongoDB conectado: localhost
📊 Base de datos: calima-online-dev
```

---

## 🐛 Troubleshooting

### Error: "ECONNREFUSED 127.0.0.1:27017"

**Causa**: MongoDB no está corriendo o no está exponiendo el puerto.

**Solución**:
```bash
# Verifica que MongoDB está corriendo
docker-compose ps

# Si no está, inícialo
docker-compose up -d mongodb

# Verifica los logs
docker-compose logs mongodb
```

### Error: "MongoServerError: Authentication failed"

**Causa**: Credenciales incorrectas (poco común en desarrollo sin auth).

**Solución**:
- Verifica que `MONGODB_URI` no incluye usuario/contraseña
- La configuración por defecto NO usa autenticación en desarrollo

### Error: "Cannot connect to mongodb service"

**Causa**: Estás usando el nombre de servicio `mongodb` en lugar de `localhost`.

**Solución**:
- **Dentro de Docker**: usa `mongodb://mongodb:27017/...`
- **Fuera de Docker** (local): usa `mongodb://localhost:27017/...`

### El servidor no se conecta después de cambiar .env

**Solución**:
```bash
# Reinicia el servidor
# Ctrl+C y luego npm run dev

# O si usas nodemon, debería reiniciarse automáticamente
```

---

## 📊 Resumen de URIs

| Contexto | URI de MongoDB | ¿Cuándo usar? |
|----------|---------------|---------------|
| Servidor **dentro** de Docker | `mongodb://mongodb:27017/calima-online-dev` | docker-compose.yml |
| Servidor **fuera** de Docker | `mongodb://localhost:27017/calima-online-dev` | .env.local |
| Cliente MongoDB GUI | `mongodb://localhost:27017` | MongoDB Compass, etc. |

---

## 🎯 Configuración Recomendada

Para **desarrollo diario**, usa la **Opción 2 (Híbrido)**:

1. MongoDB en Docker (persistencia de datos)
2. Servidor local (hot reload rápido)
3. Cliente local (cambios instantáneos)

```bash
# Terminal 1: MongoDB
docker-compose up mongodb

# Terminal 2: Servidor
cd calima-online-server && npm run dev

# Terminal 3: Cliente
cd calima-online-client && npx http-server -p 8080 -c-1
```

---

## 💡 Tips Adicionales

### Ver datos en MongoDB:

```bash
# Conectar con mongosh
docker exec -it calima-mongodb mongosh calima-online-dev

# Ver colecciones
show collections

# Ver usuarios
db.users.find().pretty()

# Ver personajes
db.characters.find().pretty()
```

### Backup de datos:

```bash
# Exportar datos
docker exec calima-mongodb mongodump --out=/data/backup

# Copiar backup a tu máquina
docker cp calima-mongodb:/data/backup ./mongodb-backup
```

### Limpiar base de datos:

```bash
# CUIDADO: Esto borra todos los datos
docker exec -it calima-mongodb mongosh calima-online-dev --eval "db.dropDatabase()"

# Reiniciar MongoDB para ejecutar mongo-init.js de nuevo
docker-compose restart mongodb
```

---

## 🚀 Workflow Recomendado

1. **Inicio del día**:
```bash
docker-compose up -d mongodb
cd calima-online-server && npm run dev
```

2. **Abrir otra terminal para el cliente**:
```bash
cd calima-online-client && npx http-server -p 8080 -c-1
```

3. **Desarrollar normalmente** con hot reload instantáneo

4. **Fin del día**:
```bash
# Detener servidor y cliente: Ctrl+C en cada terminal
# Mantener MongoDB corriendo o detenerlo:
docker-compose stop mongodb
```

5. **Próximo día**: Solo necesitas iniciar servidor y cliente, MongoDB sigue con tus datos.