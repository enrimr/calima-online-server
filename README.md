# 🎮 Calima Online Server

Servidor backend para el MMORPG 2D **Calima Online**, inspirado en el clásico Argentum Online. Proporciona autenticación de usuarios, gestión de personajes, y comunicación en tiempo real mediante WebSockets.

## 🚀 Características

### ✨ Sistema de Autenticación
- Registro e inicio de sesión con JWT
- Encriptación de contraseñas con bcrypt
- Sistema de roles (jugador, moderador, admin)
- Protección contra cuentas baneadas
- Integración futura con Steam

### 👤 Gestión de Personajes
- Creación de hasta 3 personajes por cuenta
- 7 clases disponibles: Guerrero, Mago, Arquero, Clérigo, Asesino, Paladín, Bardo
- Sistema completo de stats y atributos
- Inventario de 20 slots
- Sistema de equipamiento (arma, escudo, casco, armadura, anillo, amuleto)
- Sistema de habilidades y progresión
- Facciones y reputación

### 🌐 Comunicación en Tiempo Real
- WebSockets con Socket.io
- Sincronización de jugadores en mapas
- Sistema de chat global y local
- Actualización de posiciones y movimiento
- Notificaciones de eventos del juego

### 🔒 Seguridad
- Helmet para headers de seguridad
- Rate limiting para prevenir spam
- CORS configurado
- Validación de entrada de datos
- JWT para autenticación segura

## 📋 Requisitos Previos

- Node.js v18 o superior
- MongoDB v5.0 o superior
- npm o yarn

## 🛠️ Instalación

1. **Clonar el repositorio**
```bash
git clone <url-del-repositorio>
cd calima-online-server
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Edita el archivo `.env` con tus configuraciones:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/calima-online
JWT_SECRET=tu_secreto_jwt_muy_seguro_aqui
JWT_EXPIRES_IN=7d
# Puedes usar múltiples orígenes separados por comas
CORS_ORIGIN=http://localhost:8080,https://calimaonline.vercel.app,https://www.calimaonline.com
```

4. **Iniciar MongoDB**
```bash
# En macOS con Homebrew:
brew services start mongodb-community

# O manualmente:
mongod --config /opt/homebrew/etc/mongod.conf
```

5. **Iniciar el servidor**
```bash
# Modo desarrollo (con auto-reload)
npm run dev

# Modo producción
npm start
```

El servidor estará disponible en `http://localhost:3000`

## 📚 Estructura del Proyecto

```
calima-online-server/
├── src/
│   ├── config/
│   │   └── database.js          # Configuración de MongoDB
│   ├── controllers/
│   │   ├── authController.js    # Lógica de autenticación
│   │   └── characterController.js # Lógica de personajes
│   ├── middleware/
│   │   └── auth.js              # Middleware de autenticación
│   ├── models/
│   │   ├── User.js              # Modelo de Usuario
│   │   └── Character.js         # Modelo de Personaje
│   ├── routes/
│   │   ├── authRoutes.js        # Rutas de autenticación
│   │   └── characterRoutes.js   # Rutas de personajes
│   └── server.js                # Punto de entrada principal
├── .env.example                 # Ejemplo de variables de entorno
├── .gitignore
├── package.json
└── README.md
```

## 🔌 API REST Endpoints

### Autenticación

#### Registrar Usuario
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "jugador1",
  "email": "jugador1@example.com",
  "password": "contraseña123"
}
```

#### Iniciar Sesión
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "jugador1",
  "password": "contraseña123"
}
```

#### Obtener Perfil
```http
GET /api/auth/me
Authorization: Bearer {token}
```

#### Verificar Token
```http
GET /api/auth/verify-token
Authorization: Bearer {token}
```

#### Cambiar Contraseña
```http
PUT /api/auth/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "contraseña123",
  "newPassword": "nuevaContraseña456"
}
```

### Personajes

#### Obtener Personajes del Usuario
```http
GET /api/characters
Authorization: Bearer {token}
```

#### Crear Personaje
```http
POST /api/characters
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Guerrero123",
  "class": "guerrero",
  "appearance": {
    "body": 1,
    "head": 5,
    "heading": 3
  }
}
```

**Clases disponibles:**
- `guerrero` - Alto HP, fuerza y constitución
- `mago` - Alto maná e inteligencia
- `arquero` - Alta destreza y precisión
- `clerigo` - Balance entre magia y curación
- `asesino` - Alta destreza y daño crítico
- `paladin` - Balance entre fuerza y carisma
- `bardo` - Alto carisma y versatilidad

#### Obtener Personaje Específico
```http
GET /api/characters/:id
Authorization: Bearer {token}
```

#### Actualizar Personaje
```http
PUT /api/characters/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "position": { "x": 50, "y": 50, "map": "newbie_city" },
  "stats": { "hp": 100, "mana": 50 }
}
```

#### Eliminar Personaje
```http
DELETE /api/characters/:id
Authorization: Bearer {token}
```

#### Seleccionar Personaje (Conectar)
```http
POST /api/characters/:id/select
Authorization: Bearer {token}
```

#### Desconectar Personaje
```http
POST /api/characters/:id/disconnect
Authorization: Bearer {token}
Content-Type: application/json

{
  "position": { "x": 50, "y": 50, "map": "newbie_city" },
  "stats": { "hp": 80, "mana": 30 }
}
```

#### Verificar Disponibilidad de Nombre
```http
GET /api/characters/check-name/:name
Authorization: Bearer {token}
```

## 🔌 WebSocket Events (Socket.io)

### Conectar al Servidor
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'tu_jwt_token_aqui'
  }
});
```

### Eventos del Cliente → Servidor

#### Unirse al Juego
```javascript
socket.emit('join_game', {
  characterId: '507f1f77bcf86cd799439011'
});
```

#### Mover Jugador
```javascript
socket.emit('player_move', {
  x: 50,
  y: 50,
  map: 'newbie_city' // Opcional, solo si cambia de mapa
});
```

#### Actualizar Stats
```javascript
socket.emit('update_stats', {
  stats: {
    hp: 80,
    mana: 30,
    experience: 150
  },
  inventory: [...],
  equipment: {...}
});
```

#### Enviar Mensaje de Chat
```javascript
socket.emit('chat_message', {
  message: 'Hola a todos!',
  type: 'global' // o 'local'
});
```

### Eventos del Servidor → Cliente

#### Juego Unido Exitosamente
```javascript
socket.on('game_joined', (data) => {
  console.log('Datos del personaje:', data.characterData);
  console.log('Jugadores online:', data.onlinePlayers);
});
```

#### Jugador Se Unió al Mapa
```javascript
socket.on('player_joined', (data) => {
  console.log('Nuevo jugador:', data.username);
  // Renderizar jugador en el mapa
});
```

#### Jugador Se Movió
```javascript
socket.on('player_moved', (data) => {
  // Actualizar posición del jugador en el mapa
  console.log('Jugador movido:', data.socketId, data.position);
});
```

#### Jugador Salió
```javascript
socket.on('player_left', (data) => {
  // Remover jugador del mapa
  console.log('Jugador salió:', data.socketId);
});
```

#### Mensaje de Chat
```javascript
socket.on('chat_message', (data) => {
  console.log(`[${data.type}] ${data.username}: ${data.message}`);
});
```

#### Error
```javascript
socket.on('error', (data) => {
  console.error('Error:', data.message);
});
```

#### Stats Actualizadas
```javascript
socket.on('stats_updated', (data) => {
  console.log('Stats guardadas exitosamente');
});
```

## 🗄️ Modelos de Datos

### Usuario (User)
```javascript
{
  username: String,       // Único, 3-20 caracteres
  email: String,         // Único
  password: String,      // Hasheada con bcrypt
  isActive: Boolean,     // Cuenta activa
  isBanned: Boolean,     // Baneado
  banReason: String,     // Razón del ban
  bannedUntil: Date,     // Fecha fin ban temporal
  role: String,          // 'player', 'moderator', 'admin'
  steamId: String,       // Para integración con Steam
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Personaje (Character)
```javascript
{
  userId: ObjectId,           // Referencia al usuario
  name: String,               // Único, nombre del personaje
  class: String,              // Clase del personaje
  faction: String,            // Facción
  appearance: {
    body: Number,             // 1-10
    head: Number,             // 1-50
    heading: Number           // 1-4 (dirección)
  },
  position: {
    map: String,              // ID del mapa
    x: Number,                // Posición X (0-99)
    y: Number                 // Posición Y (0-99)
  },
  stats: {
    level: Number,            // 1-100
    experience: Number,
    gold: Number,
    // Atributos
    strength: Number,         // 1-99
    dexterity: Number,
    intelligence: Number,
    constitution: Number,
    charisma: Number,
    // Vida/Maná
    hp: Number,
    maxHp: Number,
    mana: Number,
    maxMana: Number,
    stamina: Number,
    maxStamina: Number,
    // Combate
    minDamage: Number,
    maxDamage: Number,
    defense: Number,
    magicDefense: Number,
    evasion: Number,
    accuracy: Number
  },
  skills: {
    sword: Number,            // 0-100
    // ... 18 habilidades más
  },
  inventory: [{
    slot: Number,             // 1-20
    itemId: String,
    quantity: Number
  }],
  equipment: {
    weapon: String,
    shield: String,
    helmet: String,
    armor: String,
    ring: String,
    amulet: String
  },
  spells: [{
    spellId: String,
    slot: Number              // 1-10
  }],
  state: {
    isAlive: Boolean,
    isOnline: Boolean,
    isMeditating: Boolean,
    isParalyzed: Boolean,
    isPoisoned: Boolean,
    isInvisible: Boolean
  },
  // ... más campos
}
```

## 🔐 Seguridad

### Contraseñas
- Hasheadas con bcrypt (salt rounds: 10)
- Nunca se devuelven en las respuestas de la API
- Validación de longitud mínima (6 caracteres)

### JWT Tokens
- Firmados con secreto configurable
- Expiración configurable (por defecto 7 días)
- Incluidos en header `Authorization: Bearer {token}`

### Rate Limiting
- Límite configurable de peticiones por IP
- Por defecto: 100 peticiones cada 15 minutos
- Protege contra ataques de fuerza bruta

### CORS
- Configurado para origen específico
- Credenciales permitidas

## 🧪 Testing

```bash
# Instalar dependencias de desarrollo
npm install --save-dev

# Ejecutar tests (cuando estén implementados)
npm test
```

## 🚀 Despliegue

### Variables de Entorno en Producción
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://usuario:contraseña@host:puerto/calima-online
JWT_SECRET=secreto_muy_seguro_y_largo_generado_aleatoriamente
CORS_ORIGIN=https://calima-online.com
```

### Recomendaciones
1. Usa MongoDB Atlas o similar para la base de datos
2. Usa un gestor de procesos como PM2
3. Configura HTTPS con certificados SSL
4. Implementa logs con Winston o similar
5. Monitoriza el servidor con herramientas como Datadog o New Relic

## 🎯 Roadmap

### Fase 1 - MVP (Actual) ✅
- [x] Sistema de autenticación de usuarios
- [x] Gestión de personajes CRUD
- [x] WebSockets para comunicación en tiempo real
- [x] Sistema básico de chat

### Fase 2 - Gameplay
- [ ] Sistema de combate PvE (vs NPCs)
- [ ] Sistema de NPCs con IA
- [ ] Sistema de items y loot
- [ ] Sistema de quests
- [ ] Sistema de comercio entre jugadores

### Fase 3 - Social
- [ ] Sistema de guilds/clanes
- [ ] Chat de guild
- [ ] Sistema de amigos
- [ ] Mensajes privados
- [ ] Rankings y leaderboards

### Fase 4 - Avanzado
- [ ] PvP (combate entre jugadores)
- [ ] Dungeons instanciadas
- [ ] Eventos programados
- [ ] Sistema de crafteo avanzado
- [ ] Mascotas y monturas

### Fase 5 - Steam
- [ ] Integración completa con Steam
- [ ] Achievements
- [ ] Trading Cards
- [ ] Workshop para contenido personalizado

## 📝 Licencia

Este proyecto está bajo licencia MIT.

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📧 Contacto

Para preguntas o soporte, contacta a través de [GitHub Issues].

---

**¡Disfruta desarrollando Calima Online!** 🎮✨