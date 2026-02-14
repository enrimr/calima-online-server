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
import NPCManager from './systems/NPCManager.js';
import { getInstance as getMapManager } from './systems/MapManager.js';
import PureWebSocketBridge from './systems/PureWebSocketBridge.js';

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
import adminRoutes from './routes/adminRoutes.js';
app.use('/api/auth', authRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/admin', adminRoutes);

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

// ==================== PURE WEBSOCKET BRIDGE ====================

// Inicializar WebSocket Bridge (puerto 3002) para Godot
const wsBridge = new PureWebSocketBridge(httpServer, io, connectedPlayers);
wsBridge.initialize();

// ==================== NPC SYSTEM ====================

// Inicializar NPCManager
const npcManager = new NPCManager(io);

// Conectar funciones auxiliares del NPCManager con los datos del servidor
npcManager.getPlayersInMap = (mapId) => {
  return getPlayersInMap(mapId);
};

npcManager.getPlayer = (socketId) => {
  return connectedPlayers.get(socketId) || null;
};

// ==================== MAP SYSTEM ====================

// Inicializar MapManager
const mapManager = getMapManager();

// Inicializar sistemas después de que la base de datos esté conectada
setTimeout(async () => {
  try {
    // Inicializar MapManager (cargar mapas)
    await mapManager.loadAllMaps();
    console.log('✅ MapManager inicializado correctamente');
    
    // IMPORTANTE: Asignar MapManager al NPCManager para colisiones
    npcManager.mapManager = mapManager;
    console.log('✅ MapManager asignado a NPCManager');
    
    // Inicializar NPCManager
    await npcManager.initialize();
    console.log('✅ NPCManager inicializado correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar sistemas:', error);
  }
}, 2000); // Esperar 2 segundos para asegurar conexión a BD

// Timer para guardado automático periódico (configurado en gameConfig.js)
const AUTOSAVE_INTERVAL = GAME_CONFIG.autosave.interval;
setInterval(async () => {
  // Log comentado para evitar spam en consola
  // console.log(`🔄 Guardado automático: ${connectedPlayers.size} jugadores online`);
  
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
    console.log(`📥 [${socket.id}] Recibido join_game:`, data);
    try {
      const { characterId } = data;
      console.log(`🔍 [${socket.id}] Buscando personaje ${characterId} para usuario ${socket.userId}`);

      // Verificar que el personaje existe y pertenece al usuario
      const character = await Character.findOne({
        _id: characterId,
        userId: socket.userId
      });

      if (!character) {
        console.error(`❌ [${socket.id}] Personaje ${characterId} no encontrado`);
        socket.emit('error', { message: 'Personaje no encontrado' });
        return;
      }
      
      console.log(`✅ [${socket.id}] Personaje encontrado: ${character.name}`);

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

      // Obtener lista de jugadores en el mapa (excepto el que se está uniendo)
      const playersInMap = getPlayersInMap(playerData.map, socket.id);
      console.log(`📋 [${socket.id}] Jugadores en el mapa ${playerData.map}: ${playersInMap.length}`);
      playersInMap.forEach(p => {
        console.log(`  - ${p.username} (${p.socketId}) en (${p.position.x}, ${p.position.y})`);
      });

      // Obtener lista de NPCs en el mapa
      const npcsInMap = await npcManager.getNPCsInMap(playerData.map);
      console.log(`📋 [${socket.id}] NPCs en el mapa ${playerData.map}: ${npcsInMap.length}`);

      // Preparar datos para game_joined
      const gameJoinedData = {
        characterData: character,
        onlinePlayers: playersInMap,
        npcs: npcsInMap,
        startPosition: savedPosition
      };

      console.log(`📤 [${socket.id}] Enviando game_joined a ${playerData.username}...`);
      console.log(`  - characterData.name: ${character.name}`);
      console.log(`  - onlinePlayers.length: ${playersInMap.length}`);
      console.log(`  - startPosition:`, savedPosition);

      // Notificar al jugador que se unió exitosamente
      socket.emit('game_joined', gameJoinedData);
      
      console.log(`✅ [${socket.id}] game_joined enviado a ${playerData.username}`);

      // Notificar a otros jugadores en el mismo mapa con información completa
      console.log(`📣 [${socket.id}] Enviando player_joined a otros jugadores en ${playerData.map}...`);
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

      // Validar movimiento con MapManager (solo si no es cambio de mapa)
      if (!map || map === player.map) {
        const currentMap = map || player.map;
        const validation = mapManager.validateMovement(
          currentMap,
          player.position.x,
          player.position.y,
          x,
          y
        );

        if (!validation.valid) {
          console.log(`🚫 Movimiento rechazado para ${player.username}: ${validation.reason}`);
          // Enviar posición actual de vuelta al cliente para corregir
          socket.emit('movement_rejected', {
            reason: validation.reason,
            correctPosition: player.position
          });
          return;
        }

        // Si hay un portal en la posición de destino, manejarlo
        if (validation.portal) {
          console.log(`🚪 ${player.username} usó portal: ${validation.portal.name} -> ${validation.portal.targetMap}`);
          // El cliente manejará el cambio de mapa con la información del portal
        }
      }

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

        // IMPORTANTE: Enviar lista de jugadores y NPCs en el nuevo mapa al jugador que cambió
        const npcsInNewMap = await npcManager.getNPCsInMap(map);
        
        socket.emit('map_changed', {
          newMap: map,
          playersInMap: getPlayersInMap(map, socket.id),
          npcs: npcsInNewMap
        });
        
        console.log(`🗺️ ${player.username} cambió de ${oldMap} a ${map}, enviando lista de ${getPlayersInMap(map, socket.id).length} jugadores y ${npcsInNewMap.length} NPCs`);
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
      const wasAliveBeforeUpdate = player.isAlive && player.hp > 0;
      
      if (character.stats.hp <= 0) {
        character.stats.hp = 0;
        character.state.isAlive = false;
        
        // Si el jugador acaba de morir (transición de vivo a muerto)
        if (wasAliveBeforeUpdate) {
          console.log(`💀💀💀 ${player.username} ACABA DE MORIR - Limpiando NPCs...`);
          console.log(`  Estado anterior: hp=${player.hp}, isAlive=${player.isAlive}, isGhost=${player.isGhost}`);
          
          // Actualizar estado en memoria ANTES de limpiar
          player.hp = 0;
          player.isAlive = false;
          player.isGhost = true;
          
          console.log(`  Estado nuevo: hp=${player.hp}, isAlive=${player.isAlive}, isGhost=${player.isGhost}`);
          
          // Limpiar NPCs
          await npcManager.clearPlayerAsTarget(socket.id);
          
          console.log(`✅ Limpieza de NPCs completada para ${player.username}`);
        }
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

  // Chat - Manejo completo de mensajes (Global, Local, Group, Private)
  socket.on('chat_message', (data) => {
    try {
      const player = connectedPlayers.get(socket.id);
      if (!player) {
        console.error('❌ Jugador no encontrado para enviar mensaje de chat');
        return;
      }

      const { message, type = 'global', targetSocketId } = data;

      console.log(`💬 [${player.username}] Mensaje tipo ${type}:`, message.substring(0, 50));

      // Estructura base del mensaje
      const chatMessage = {
        socketId: socket.id,
        username: player.username,
        message,
        type,
        timestamp: Date.now()
      };

      switch (type) {
        case 'global':
          // Mensaje global: a TODOS los jugadores online en todos los mapas
          console.log(`📢 [Global] ${player.username}: ${message}`);
          io.emit('chat_message', chatMessage);
          break;

        case 'local':
          // Mensaje local: solo a jugadores en el mismo mapa (cercanos)
          console.log(`📍 [Local/${player.map}] ${player.username}: ${message}`);
          io.to(player.map).emit('chat_message', chatMessage);
          break;

        case 'group':
          // Mensaje de grupo: por implementar (enviar mensaje de error)
          console.log(`👥 [Grupo] ${player.username} intentó enviar mensaje de grupo (no implementado)`);
          socket.emit('chat_message', {
            socketId: 'system',
            username: 'Sistema',
            message: 'Los grupos/parties aún no están implementados. Usa Global o Cercanos.',
            type: 'system',
            timestamp: Date.now()
          });
          break;

        case 'private':
          // Mensaje privado: a un jugador específico
          if (!targetSocketId) {
            console.error('❌ Mensaje privado sin destinatario');
            socket.emit('chat_message', {
              socketId: 'system',
              username: 'Sistema',
              message: 'Error: Debes especificar un destinatario para mensajes privados.',
              type: 'system',
              timestamp: Date.now()
            });
            return;
          }

          const targetPlayer = connectedPlayers.get(targetSocketId);
          if (!targetPlayer) {
            console.error(`❌ Jugador destinatario ${targetSocketId} no encontrado`);
            socket.emit('chat_message', {
              socketId: 'system',
              username: 'Sistema',
              message: 'Error: El jugador destinatario no está online.',
              type: 'system',
              timestamp: Date.now()
            });
            return;
          }

          console.log(`💌 [Privado] ${player.username} → ${targetPlayer.username}: ${message}`);

          // Enviar mensaje al destinatario
          io.to(targetSocketId).emit('chat_message', {
            ...chatMessage,
            targetUsername: player.username // Para que sepa quién le envió el mensaje
          });

          // Confirmar al remitente (echo del mensaje enviado)
          socket.emit('chat_message', {
            socketId: socket.id,
            username: targetPlayer.username, // Mostrar a quién se lo envió
            message,
            type: 'private',
            timestamp: Date.now()
          });
          break;

        default:
          console.error(`❌ Tipo de mensaje desconocido: ${type}`);
          socket.emit('chat_message', {
            socketId: 'system',
            username: 'Sistema',
            message: 'Error: Tipo de mensaje no válido.',
            type: 'system',
            timestamp: Date.now()
          });
      }
    } catch (error) {
      console.error('Error en chat_message:', error);
      socket.emit('chat_message', {
        socketId: 'system',
        username: 'Sistema',
        message: 'Error al enviar mensaje de chat.',
        type: 'system',
        timestamp: Date.now()
      });
    }
  });

  // ===== COMBAT PVP SYSTEM =====

  // Ataque entre jugadores
  socket.on('player_attack', async (data) => {
    try {
      const attacker = connectedPlayers.get(socket.id);
      if (!attacker) {
        console.error('❌ Atacante no encontrado:', socket.id);
        return;
      }

      const { targetSocketId, weaponType, position } = data;
      
      console.log(`\n⚔️ ===== INTENTO DE ATAQUE PVP =====`);
      console.log(`Atacante: ${attacker.username} (${socket.id})`);
      console.log(`Objetivo: ${targetSocketId}`);
      console.log(`Tipo de arma: ${weaponType}`);
      console.log(`Posición atacante: (${position.x}, ${position.y})`);

      // Validar que el objetivo existe
      const defender = connectedPlayers.get(targetSocketId);
      if (!defender) {
        console.error('❌ Defensor no encontrado:', targetSocketId);
        socket.emit('player_attack_result', {
          success: false,
          reason: 'Jugador objetivo no encontrado'
        });
        return;
      }
      
      console.log(`Defensor: ${defender.username} en (${defender.position.x}, ${defender.position.y})`);

      // Validar que están en el mismo mapa
      if (attacker.map !== defender.map) {
        console.error('❌ Jugadores en mapas diferentes');
        socket.emit('player_attack_result', {
          success: false,
          reason: 'El jugador objetivo está en otro mapa'
        });
        return;
      }

      // Validar que el atacante está vivo
      if (attacker.hp <= 0 || attacker.isGhost) {
        socket.emit('player_attack_result', {
          success: false,
          reason: 'No puedes atacar estando muerto'
        });
        return;
      }

      // Validar que el defensor está vivo (no atacar fantasmas)
      if (defender.hp <= 0 || defender.isGhost) {
        socket.emit('player_attack_result', {
          success: false,
          reason: 'No puedes atacar a un fantasma'
        });
        return;
      }

      // Rate limiting mejorado: 10 ataques por segundo (ventana deslizante)
      const now = Date.now();
      const RATE_LIMIT_WINDOW = 1000; // 1 segundo
      const MAX_ATTACKS_PER_WINDOW = 10; // Máximo 10 ataques por segundo
      
      // Inicializar array de ataques si no existe
      if (!attacker.recentAttacks) {
        attacker.recentAttacks = [];
      }
      
      // Limpiar ataques fuera de la ventana de tiempo
      attacker.recentAttacks = attacker.recentAttacks.filter(
        timestamp => (now - timestamp) < RATE_LIMIT_WINDOW
      );
      
      // Verificar si excede el límite
      if (attacker.recentAttacks.length >= MAX_ATTACKS_PER_WINDOW) {
        socket.emit('player_attack_result', {
          success: false,
          reason: 'Demasiados ataques, espera un momento'
        });
        return;
      }

      // Validar rango de ataque
      const MELEE_RANGE = 1.5;
      const RANGED_RANGE = 8;
      const attackRange = weaponType === 'ranged' ? RANGED_RANGE : MELEE_RANGE;

      const dx = position.x - defender.position.x;
      const dy = position.y - defender.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > attackRange) {
        socket.emit('player_attack_result', {
          success: false,
          reason: 'Objetivo fuera de rango'
        });
        return;
      }

      // ✅ Todas las validaciones pasadas - procesar ataque
      console.log(`✅ Validaciones completadas - procesando ataque`);

      // Registrar este ataque en el rate limiter
      attacker.recentAttacks.push(now);

      // Calcular daño (servidor autoritario)
      console.log(`🎲 Cargando datos de personajes desde BD...`);
      const attackerCharacter = await Character.findById(attacker.characterId);
      const defenderCharacter = await Character.findById(defender.characterId);

      if (!attackerCharacter || !defenderCharacter) {
        console.error('❌ Error al cargar personajes para combate');
        return;
      }

      console.log(`📊 Stats del atacante: Nivel ${attackerCharacter.stats.level}, HP ${attackerCharacter.stats.hp}/${attackerCharacter.stats.maxHp}`);
      console.log(`📊 Stats del defensor: Nivel ${defenderCharacter.stats.level}, HP ${defenderCharacter.stats.hp}/${defenderCharacter.stats.maxHp}`);

      // Cálculo de daño base
      let baseDamage = 10 + Math.floor(Math.random() * 11); // 10-20
      baseDamage += attackerCharacter.stats.level * 2;
      console.log(`🎲 Daño base calculado: ${baseDamage} (10-20 + nivel*2)`);

      // Bonus de arma equipada
      if (attackerCharacter.equipment && attackerCharacter.equipment.weapon) {
        // TODO: Implementar bonus de arma desde ItemTypes
        baseDamage += 5; // Bonus temporal
        console.log(`🗡️ Bonus de arma: +5 (total: ${baseDamage})`);
      }

      // Reducción por armadura del defensor
      let defense = 0;
      if (defenderCharacter.equipment && defenderCharacter.equipment.shield) {
        defense += 3; // Bonus temporal de escudo
        console.log(`🛡️ Defensa del escudo: -3`);
      }

      const finalDamage = Math.max(1, baseDamage - defense);
      console.log(`💥 Daño final calculado: ${finalDamage} (${baseDamage} - ${defense})`);

      // Aplicar daño al defensor
      const oldHp = defenderCharacter.stats.hp;
      defenderCharacter.stats.hp -= finalDamage;
      const targetDied = defenderCharacter.stats.hp <= 0;

      if (targetDied) {
        defenderCharacter.stats.hp = 0;
        defenderCharacter.state.isAlive = false;
      }

      console.log(`❤️ HP del defensor: ${oldHp} → ${defenderCharacter.stats.hp} (${targetDied ? '💀 MUERTO' : 'VIVO'})`);

      // Actualizar HP en connectedPlayers
      defender.hp = defenderCharacter.stats.hp;
      defender.isAlive = defenderCharacter.state.isAlive;
      defender.isGhost = targetDied;

      // Guardar cambios en BD
      await defenderCharacter.save();
      console.log(`💾 Cambios guardados en BD`);

      // Sistema de criminalidad
      let criminalityGained = 0;
      const CRIMINAL_THRESHOLD = 50;
      const CRIMINAL_POINTS_PER_ATTACK = 10;
      const CRIMINAL_POINTS_PER_KILL = 20;

      // Si el defensor no es criminal, el atacante gana puntos criminales
      const defenderCriminalStatus = defenderCharacter.criminalStatus || 0;
      if (defenderCriminalStatus < CRIMINAL_THRESHOLD) {
        criminalityGained = CRIMINAL_POINTS_PER_ATTACK;
        
        if (targetDied) {
          criminalityGained += CRIMINAL_POINTS_PER_KILL;
        }

        attackerCharacter.criminalStatus = (attackerCharacter.criminalStatus || 0) + criminalityGained;
        attacker.criminalStatus = attackerCharacter.criminalStatus;
        await attackerCharacter.save();

        console.log(`⚖️ ${attacker.username} ganó ${criminalityGained} puntos criminales (total: ${attacker.criminalStatus})`);
      }

      // Enviar resultado al atacante
      console.log(`📤 Enviando player_attack_result a atacante (${attacker.username})`);
      socket.emit('player_attack_result', {
        success: true,
        targetSocketId: targetSocketId,
        targetUsername: defender.username,
        damage: finalDamage,
        targetNewHp: defender.hp,
        targetDied: targetDied,
        criminalityGained: criminalityGained
      });

      // Enviar evento al defensor
      console.log(`📤 Enviando player_attacked a defensor (${defender.username})`);
      io.to(targetSocketId).emit('player_attacked', {
        attackerSocketId: socket.id,
        attackerUsername: attacker.username,
        damage: finalDamage,
        newHp: defender.hp,
        died: targetDied
      });

      // Broadcast a espectadores en el mismo mapa
      console.log(`📤 Broadcasting combat_action a espectadores en ${attacker.map}`);
      socket.to(attacker.map).emit('combat_action', {
        attackerSocketId: socket.id,
        attackerUsername: attacker.username,
        targetSocketId: targetSocketId,
        targetUsername: defender.username,
        damage: finalDamage,
        attackType: weaponType
      });

      console.log(`✅ ⚔️ PvP COMPLETADO: ${attacker.username} atacó a ${defender.username} (${finalDamage} daño, HP: ${oldHp}→${defender.hp})`);
      console.log(`===================================\n`);

      // Si el defensor murió, notificar a todos los jugadores en el mapa
      if (targetDied) {
        console.log(`💀 ${defender.username} fue matado por ${attacker.username}`);
        
        // IMPORTANTE: Limpiar al jugador muerto como objetivo de todos los NPCs
        await npcManager.clearPlayerAsTarget(targetSocketId);
        
        // Broadcast cambio de estado a todos en el mapa (incluyendo al defensor)
        io.to(defender.map).emit('player_state_changed', {
          socketId: targetSocketId,
          username: defender.username,
          isGhost: true,
          isAlive: false,
          hp: 0,
          reason: 'death',
          killedBy: attacker.username
        });
        
        console.log(`📤 Broadcasting player_state_changed (muerte) a jugadores en ${defender.map}`);
      }

    } catch (error) {
      console.error('Error en player_attack:', error);
      socket.emit('player_attack_result', {
        success: false,
        reason: 'Error del servidor al procesar ataque'
      });
    }
  });

  // ===== NPC COMBAT SYSTEM =====

  // Ataque a NPCs
  socket.on('attack_npc', async (data) => {
    try {
      const attacker = connectedPlayers.get(socket.id);
      if (!attacker) {
        console.error('❌ Atacante no encontrado:', socket.id);
        return;
      }

      const { instanceId, weaponType, position } = data;
      
      console.log(`\n⚔️ ===== ATAQUE A NPC =====`);
      console.log(`Atacante: ${attacker.username} (${socket.id})`);
      console.log(`NPC: ${instanceId}`);
      console.log(`Tipo de arma: ${weaponType}`);

      // Validar que el atacante está vivo
      if (attacker.hp <= 0 || attacker.isGhost) {
        socket.emit('attack_npc_result', {
          success: false,
          reason: 'No puedes atacar estando muerto'
        });
        return;
      }

      // Rate limiting mejorado: 10 ataques por segundo (ventana deslizante)
      const now = Date.now();
      const RATE_LIMIT_WINDOW = 1000; // 1 segundo
      const MAX_ATTACKS_PER_WINDOW = 10; // Máximo 10 ataques por segundo
      
      // Inicializar array de ataques si no existe
      if (!attacker.recentAttacks) {
        attacker.recentAttacks = [];
      }
      
      // Limpiar ataques fuera de la ventana de tiempo
      attacker.recentAttacks = attacker.recentAttacks.filter(
        timestamp => (now - timestamp) < RATE_LIMIT_WINDOW
      );
      
      // Verificar si excede el límite
      if (attacker.recentAttacks.length >= MAX_ATTACKS_PER_WINDOW) {
        socket.emit('attack_npc_result', {
          success: false,
          reason: 'Demasiados ataques, espera un momento'
        });
        return;
      }
      
      // Registrar este ataque
      attacker.recentAttacks.push(now);

      // Cargar stats del atacante para calcular daño
      const attackerCharacter = await Character.findById(attacker.characterId);
      if (!attackerCharacter) {
        console.error('❌ Error al cargar personaje atacante');
        return;
      }

      // Calcular daño
      let baseDamage = 10 + Math.floor(Math.random() * 11); // 10-20
      baseDamage += attackerCharacter.stats.level * 2;

      // Bonus de arma equipada
      if (attackerCharacter.equipment && attackerCharacter.equipment.weapon) {
        baseDamage += 5; // Bonus temporal
      }

      const finalDamage = baseDamage;
      console.log(`💥 Daño calculado: ${finalDamage}`);

      // Delegar al NPCManager para aplicar el daño
      const result = await npcManager.damageNPC(
        instanceId,
        socket.id,
        attacker.username,
        finalDamage
      );

      if (!result.success) {
        socket.emit('attack_npc_result', {
          success: false,
          reason: result.reason
        });
        return;
      }

      // Enviar resultado al atacante
      socket.emit('attack_npc_result', {
        success: true,
        instanceId,
        damage: finalDamage,
        npcHp: result.newHp,
        npcMaxHp: result.maxHp,
        npcDied: result.died
      });

      console.log(`✅ ⚔️ Ataque a NPC completado: ${attacker.username} atacó (${finalDamage} daño)`);
      console.log(`===================================\n`);

    } catch (error) {
      console.error('Error en attack_npc:', error);
      socket.emit('attack_npc_result', {
        success: false,
        reason: 'Error del servidor'
      });
    }
  });

  // Evento: Jugador resucita (desde NPC sacerdote)
  socket.on('player_resurrect', async (data) => {
    try {
      const player = connectedPlayers.get(socket.id);
      if (!player) {
        console.error('❌ Jugador no encontrado para resurrección:', socket.id);
        return;
      }

      console.log(`\n⛪ ===== SOLICITUD DE RESURRECCIÓN =====`);
      console.log(`Jugador: ${player.username} (${socket.id})`);
      console.log(`Estado actual: isGhost=${player.isGhost}, hp=${player.hp}/${player.maxHp}`);

      // Cargar personaje desde BD
      const character = await Character.findById(player.characterId);
      if (!character) {
        console.error('❌ Personaje no encontrado en BD');
        return;
      }

      // Verificar que está muerto
      if (character.stats.hp > 0 && character.state.isAlive) {
        console.log('❌ Jugador ya está vivo, rechazando resurrección');
        socket.emit('resurrect_result', {
          success: false,
          reason: 'Ya estás vivo'
        });
        return;
      }

      // Resucitar: restaurar HP y estado
      character.stats.hp = character.stats.maxHp;
      character.state.isAlive = true;
      await character.save();
      console.log(`💾 Estado guardado en BD: hp=${character.stats.hp}, isAlive=true`);

      // Actualizar en connectedPlayers
      player.hp = character.stats.hp;
      player.isAlive = true;
      player.isGhost = false;

      console.log(`⛪ ${player.username} resucitado: HP=${player.hp}/${player.maxHp}`);

      // Notificar al jugador resucitado
      console.log(`📤 Enviando resurrect_result al jugador resucitado`);
      socket.emit('resurrect_result', {
        success: true,
        hp: player.hp,
        maxHp: player.maxHp
      });

      // Broadcast cambio de estado a TODOS en el mapa (incluyendo al resucitado)
      const stateChangeData = {
        socketId: socket.id,
        username: player.username,
        isGhost: false,
        isAlive: true,
        hp: player.hp,
        maxHp: player.maxHp,
        reason: 'resurrection'
      };
      
      console.log(`📤 Broadcasting player_state_changed a jugadores en ${player.map}:`, stateChangeData);
      
      // Usar io.to() para enviar a todos en la sala (excluye al emisor)
      socket.to(player.map).emit('player_state_changed', stateChangeData);
      
      // TAMBIÉN enviar al propio jugador para asegurar consistencia
      socket.emit('player_state_changed', stateChangeData);
      
      console.log(`✅ ⛪ RESURRECCIÓN COMPLETADA`);
      console.log(`===================================\n`);

    } catch (error) {
      console.error('Error en player_resurrect:', error);
      socket.emit('resurrect_result', {
        success: false,
        reason: 'Error del servidor'
      });
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
  const HOST = '0.0.0.0'; // Escuchar en todas las interfaces (necesario para Docker)
  
  httpServer.listen(PORT, HOST, () => {
    console.log('\n===========================================');
    console.log(`🚀 Servidor Calima Online iniciado`);
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🌐 Host: ${HOST} (accesible desde localhost:${PORT})`);
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
