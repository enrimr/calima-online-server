import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './config/database.js';
import { GAME_CONFIG, validateConfig } from './config/gameConfig.js';
import authRoutes from './routes/authRoutes.js';
import characterRoutes from './routes/characterRoutes.js';
import Character from './models/Character.js';
import jwt from 'jsonwebtoken';

// Cargar variables de entorno
dotenv.config();

// Validar configuración del juego
validateConfig();

// Conectar a la base de datos
connectDB();

// Procesar CORS_ORIGIN (puede ser una URL o múltiples separadas por comas)
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:8080'];

// Crear aplicación Express
const app = express();
const httpServer = createServer(app);

// Configurar Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware de seguridad
app.use(helmet());

// CORS
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde'
});

app.use('/api/', limiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/characters', characterRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Calima Online Server API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      characters: '/api/characters',
      health: '/health'
    }
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor'
  });
});

// ==================== SOCKET.IO ====================

// Almacenar jugadores conectados
const connectedPlayers = new Map(); // socketId -> { userId, characterId, username, position, map }
const characterSockets = new Map(); // characterId -> socketId (para desconexión forzada)

// Timer para guardado automático periódico (configurado en gameConfig.js)
const AUTOSAVE_INTERVAL = GAME_CONFIG.autosave.interval;
setInterval(async () => {
  console.log(`🔄 Guardado automático: ${connectedPlayers.size} jugadores online`);
  
  for (const [socketId, playerData] of connectedPlayers) {
    try {
      // Guardar posición actualizada
      await Character.findByIdAndUpdate(playerData.characterId, {
        'position.x': playerData.position.x,
        'position.y': playerData.position.y,
        'position.map': playerData.map,
        lastPlayed: new Date()
      });
    } catch (error) {
      console.error(`Error en guardado automático para ${playerData.username}:`, error);
    }
  }
}, AUTOSAVE_INTERVAL);

// Middleware de autenticación para Socket.io
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Token no proporcionado'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    next(new Error('Token inválido'));
  }
});

// Eventos de Socket.io
io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);

  // Unirse al juego con un personaje
  socket.on('join_game', async (data) => {
    try {
      const { characterId } = data;

      // Verificar que el personaje existe y pertenece al usuario
      const character = await Character.findOne({
        _id: characterId,
        userId: socket.userId
      });

      if (!character) {
        socket.emit('error', { message: 'Personaje no encontrado' });
        return;
      }

      // Marcar personaje como online
      character.state.isOnline = true;
      await character.save();

      // IMPORTANTE: Usar la posición guardada en la BD
      const savedPosition = {
        x: character.position.x || 50,
        y: character.position.y || 50,
        map: character.position.map || 'newbie_city'
      };

      // Mapear race de número a string para el cliente
      const raceMap = { 1: 'human', 2: 'dwarf', 3: 'creature' };
      const raceString = character.appearance?.race ? raceMap[character.appearance.race] : 'human';

      // Guardar información del jugador conectado con apariencia, equipamiento, stats y estado
      const playerData = {
        userId: socket.userId,
        characterId: character._id.toString(),
        username: character.name,
        position: savedPosition,
        map: savedPosition.map,
        class: character.class,
        level: character.stats.level,
        appearance: character.appearance,
        equipment: character.equipment,
        race: raceString,
        // Stats para mostrar vida
        hp: character.stats.hp || 0,
        maxHp: character.stats.maxHp || 100,
        // Estado (vivo/muerto/fantasma)
        isAlive: character.state.isAlive !== false,
        isGhost: character.stats.hp === 0 || character.state.isAlive === false,
        // Facción
        faction: character.faction || 'ciudadano'
      };

      connectedPlayers.set(socket.id, playerData);
      
      // Registrar mapeo characterId -> socketId para desconexión forzada
      characterSockets.set(character._id.toString(), socket.id);

      // Unirse a la sala del mapa
      socket.join(playerData.map);

      console.log(`✅ ${playerData.username} se unió al mapa ${playerData.map} en posición (${savedPosition.x}, ${savedPosition.y})`);

      // Notificar al jugador que se unió exitosamente
      // IMPORTANTE: Excluir el propio jugador de la lista
      socket.emit('game_joined', {
        characterData: character,
        onlinePlayers: getPlayersInMap(playerData.map, socket.id),
        startPosition: savedPosition // Enviar posición inicial explícitamente
      });

      // Notificar a otros jugadores en el mismo mapa con información completa
      socket.to(playerData.map).emit('player_joined', {
        socketId: socket.id,
        username: playerData.username,
        position: savedPosition,
        class: playerData.class,
        level: playerData.level,
        appearance: playerData.appearance,
        equipment: playerData.equipment,
        race: playerData.race,
        hp: playerData.hp,
        maxHp: playerData.maxHp,
        isAlive: playerData.isAlive,
        isGhost: playerData.isGhost,
        faction: playerData.faction
      });
    } catch (error) {
      console.error('Error en join_game:', error);
      socket.emit('error', { message: 'Error al unirse al juego' });
    }
  });

  // Movimiento del jugador
  socket.on('player_move', async (data) => {
    try {
      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const { x, y, map } = data;

      // Si cambió de mapa
      if (map && map !== player.map) {
        const oldMap = player.map;
        
        socket.leave(oldMap);
        socket.join(map);
        
        // Notificar salida del mapa anterior
        socket.to(oldMap).emit('player_left', { socketId: socket.id });
        
        player.map = map;
        
        // Notificar entrada al nuevo mapa con información completa
        socket.to(map).emit('player_joined', {
          socketId: socket.id,
          username: player.username,
          position: { x, y, map },
          class: player.class,
          level: player.level,
          appearance: player.appearance,
          equipment: player.equipment,
          race: player.race,
          hp: player.hp,
          maxHp: player.maxHp,
          isAlive: player.isAlive,
          isGhost: player.isGhost,
          faction: player.faction
        });

        // IMPORTANTE: Enviar lista de jugadores en el nuevo mapa al jugador que cambió
        socket.emit('map_changed', {
          newMap: map,
          playersInMap: getPlayersInMap(map, socket.id)
        });
        
        console.log(`🗺️ ${player.username} cambió de ${oldMap} a ${map}, enviando lista de ${getPlayersInMap(map, socket.id).length} jugadores`);
      }

      // Actualizar posición
      player.position = { x, y, map: map || player.map };

      // Actualizar en base de datos (sin esperar)
      Character.findByIdAndUpdate(player.characterId, {
        'position.x': x,
        'position.y': y,
        'position.map': player.map
      }).catch(err => console.error('Error al actualizar posición:', err));

      // Broadcast a otros jugadores en el mismo mapa
      socket.to(player.map).emit('player_moved', {
        socketId: socket.id,
        position: player.position
      });
    } catch (error) {
      console.error('Error en player_move:', error);
    }
  });

  // Actualización de stats del jugador (COMPLETA)
  socket.on('update_stats', async (data) => {
    try {
      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const character = await Character.findById(player.characterId);
      if (!character) return;

      // Actualizar stats (HP, Mana, Stamina, Level, Experience, Gold, etc.)
      if (data.stats) {
        Object.assign(character.stats, data.stats);
      }

      // Actualizar estado (isAlive, isMeditating, etc.)
      if (data.state) {
        Object.assign(character.state, data.state);
      }

      // IMPORTANTE: Asegurar consistencia entre HP y estado isAlive
      if (character.stats.hp <= 0) {
        character.stats.hp = 0;
        character.state.isAlive = false;
      } else if (character.stats.hp > 0 && !character.state.isAlive) {
        // Si tiene HP pero isAlive es false, significa que fue resucitado
        character.state.isAlive = true;
      }

      // Actualizar inventario completo
      if (data.inventory) {
        character.inventory = data.inventory;
      }

      // Actualizar equipamiento
      if (data.equipment) {
        Object.assign(character.equipment, data.equipment);
      }

      // Actualizar hechizos
      if (data.spells) {
        character.spells = data.spells;
      }

      // Actualizar skills
      if (data.skills) {
        Object.assign(character.skills, data.skills);
      }

      // Actualizar posición si se proporciona
      if (data.position) {
        character.position = data.position;
        // Actualizar también en connectedPlayers
        player.position = data.position;
        player.map = data.position.map;
      }

      await character.save();

      console.log(`💾 Estado guardado para ${player.username}: HP=${character.stats.hp}/${character.stats.maxHp}, Mana=${character.stats.mana}/${character.stats.maxMana}`);

      // Confirmar actualización
      socket.emit('stats_updated', { success: true });
    } catch (error) {
      console.error('Error en update_stats:', error);
      socket.emit('error', { message: 'Error al actualizar stats' });
    }
  });

  // Chat
  socket.on('chat_message', (data) => {
    try {
      const player = connectedPlayers.get(socket.id);
      if (!player) return;

      const { message, type = 'global' } = data;

      // Broadcast del mensaje
      if (type === 'global') {
        io.to(player.map).emit('chat_message', {
          username: player.username,
          message,
          type,
          timestamp: Date.now()
        });
      } else if (type === 'local') {
        // Solo a jugadores cercanos (mismo mapa por ahora)
        io.to(player.map).emit('chat_message', {
          username: player.username,
          message,
          type,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error en chat_message:', error);
    }
  });

  // Desconexión (con guardado completo)
  socket.on('disconnect', async () => {
    try {
      const player = connectedPlayers.get(socket.id);
      
      if (player) {
        console.log(`🔌 ${player.username} se desconectó, guardando estado final...`);

        // Marcar personaje como offline y guardar última posición
        await Character.findByIdAndUpdate(player.characterId, {
          'state.isOnline': false,
          'state.isMeditating': false,
          'position.x': player.position.x,
          'position.y': player.position.y,
          'position.map': player.map,
          lastPlayed: new Date()
        });

        console.log(`💾 Estado final guardado para ${player.username} en ${player.map} (${player.position.x}, ${player.position.y})`);

        // Notificar a otros jugadores
        socket.to(player.map).emit('player_left', { socketId: socket.id });

        // Eliminar de la lista de conectados y del mapeo
        connectedPlayers.delete(socket.id);
        characterSockets.delete(player.characterId);
      }
    } catch (error) {
      console.error('Error en disconnect:', error);
    }
  });
});

// Función auxiliar para obtener jugadores en un mapa con información completa
function getPlayersInMap(mapName, excludeSocketId = null) {
  const players = [];
  for (const [socketId, player] of connectedPlayers) {
    // Excluir el jugador especificado (típicamente el que está consultando)
    if (socketId === excludeSocketId) {
      continue;
    }
    
    if (player.map === mapName) {
      players.push({
        socketId,
        username: player.username,
        position: player.position,
        class: player.class,
        level: player.level,
        appearance: player.appearance,
        equipment: player.equipment,
        race: player.race,
        hp: player.hp,
        maxHp: player.maxHp,
        isAlive: player.isAlive,
        isGhost: player.isGhost,
        faction: player.faction
      });
    }
  }
  return players;
}

// ==================== INICIAR SERVIDOR ====================

const PORT = process.env.PORT || 3000;

// Solo iniciar el servidor si no estamos en Vercel (Vercel maneja el inicio)
if (process.env.VERCEL !== '1') {
  httpServer.listen(PORT, () => {
    console.log('\n===========================================');
    console.log(`🚀 Servidor Calima Online iniciado`);
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🌍 Modo: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log('===========================================\n');
  });

  // Manejo de errores no capturados
  process.on('unhandledRejection', (err) => {
    console.error('❌ Error no manejado:', err);
    // Cerrar servidor gracefully
    httpServer.close(() => process.exit(1));
  });
}

// Exportar para Vercel serverless (default export)
export default app;

// Exportar para uso interno
export { io, connectedPlayers, characterSockets, httpServer };
