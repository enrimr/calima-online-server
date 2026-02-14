import Character from '../models/Character.js';
import User from '../models/User.js';
import { connectedPlayers } from '../server.js';
import NPCInstance from '../models/NPCInstance.js';
import NPC from '../models/NPC.js';

/**
 * Obtener estadísticas del juego (solo admin/moderator)
 * GET /api/admin/stats
 */
export const getGameStats = async (req, res) => {
  try {
    // Verificar que el usuario tiene permisos (ya viene en req.user del middleware)
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a esta información'
      });
    }

    // Obtener estadísticas de usuarios
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const bannedUsers = await User.countDocuments({ isBanned: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const moderatorUsers = await User.countDocuments({ role: 'moderator' });

    // Obtener estadísticas de personajes
    const totalCharacters = await Character.countDocuments();
    const onlineCharacters = await Character.countDocuments({ 'state.isOnline': true });
    const ghostCharacters = await Character.countDocuments({ 'stats.hp': 0 });

    // Estadísticas por clase
    const charactersByClass = await Character.aggregate([
      { $group: { _id: '$class', count: { $sum: 1 } } }
    ]);

    // Estadísticas por raza
    const charactersByRace = await Character.aggregate([
      { $group: { _id: '$appearance.race', count: { $sum: 1 } } }
    ]);

    // Top 10 jugadores por nivel
    const topPlayersByLevel = await Character.find()
      .sort({ 'stats.level': -1 })
      .limit(10)
      .select('name stats.level stats.experience class');

    // Top 10 jugadores por oro
    const topPlayersByGold = await Character.find()
      .sort({ 'stats.gold': -1 })
      .limit(10)
      .select('name stats.gold class');

    // Jugadores online actuales (desde memoria)
    const currentOnlinePlayers = Array.from(connectedPlayers.values()).map(p => ({
      socketId: p.userId, // No exponer socketId real por seguridad
      characterId: p.characterId,
      username: p.username,
      level: p.level,
      map: p.map,
      hp: p.hp,
      maxHp: p.maxHp,
      isGhost: p.isGhost,
      faction: p.faction
    }));

    // Estadísticas de combate (aproximadas)
    const totalDeaths = await Character.aggregate([
      {
        $group: {
          _id: null,
          totalDeaths: { $sum: { $cond: [{ $eq: ['$stats.hp', 0] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          banned: bannedUsers,
          admins: adminUsers,
          moderators: moderatorUsers
        },
        characters: {
          total: totalCharacters,
          online: onlineCharacters,
          ghosts: ghostCharacters,
          byClass: charactersByClass,
          byRace: charactersByRace
        },
        rankings: {
          topLevel: topPlayersByLevel,
          topGold: topPlayersByGold
        },
        online: {
          count: currentOnlinePlayers.length,
          players: currentOnlinePlayers
        },
        combat: {
          deaths: totalDeaths[0]?.totalDeaths || 0
        },
        server: {
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del servidor'
    });
  }
};

/**
 * Obtener lista de usuarios (solo admin)
 * GET /api/admin/users
 */
export const getUsers = async (req, res) => {
  try {
    // Verificar que el usuario tiene permisos de admin (ya viene en req.user del middleware)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a esta información'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await User.countDocuments();

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener lista de usuarios'
    });
  }
};

/**
 * Actualizar usuario (solo admin)
 * PUT /api/admin/users/:userId
 */
export const updateUser = async (req, res) => {
  try {
    // Verificar que el usuario tiene permisos de admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para esta acción'
      });
    }

    const { userId } = req.params;
    const { email, role, isActive } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Actualizar campos
    if (email) user.email = email.toLowerCase();
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario'
    });
  }
};

/**
 * Obtener todos los personajes del juego (solo admin/moderator)
 * GET /api/admin/characters
 */
export const getAllCharacters = async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a esta información'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const userId = req.query.userId; // Filtro opcional por usuario

    // Construir query
    const query = userId ? { userId } : {};

    const characters = await Character.find(query)
      .select('-__v')
      .sort({ 'stats.level': -1, lastPlayed: -1 })
      .limit(limit)
      .skip(skip)
      .populate('userId', 'username email'); // Incluir info del usuario

    const total = await Character.countDocuments(query);

    res.json({
      success: true,
      count: characters.length,
      data: characters,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener personajes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener personajes'
    });
  }
};

/**
 * Banear/desbanear usuario (solo admin)
 * POST /api/admin/users/:userId/ban
 */
export const banUser = async (req, res) => {
  try {
    // Verificar que el usuario tiene permisos de admin (ya viene en req.user del middleware)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para esta acción'
      });
    }

    const { userId } = req.params;
    const { isBanned, banReason, duration } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // No permitir banear a otros admins
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No puedes banear a un administrador'
      });
    }

    user.isBanned = isBanned;
    user.banReason = isBanned ? banReason : null;
    
    // Si hay duración, calcular fecha de expiración
    if (isBanned && duration) {
      const durationHours = parseInt(duration);
      user.bannedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    } else {
      user.bannedUntil = null;
    }

    await user.save();

    res.json({
      success: true,
      message: isBanned ? 'Usuario baneado exitosamente' : 'Ban removido exitosamente',
      user: {
        id: user._id,
        username: user.username,
        isBanned: user.isBanned,
        banReason: user.banReason,
        bannedUntil: user.bannedUntil
      }
    });

  } catch (error) {
    console.error('Error al banear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la acción de ban'
    });
  }
};

/**
 * Actualizar personaje (solo admin/moderator)
 * PUT /api/admin/characters/:characterId
 */
export const updateCharacter = async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para esta acción'
      });
    }

    const { characterId } = req.params;
    const updates = req.body;

    const character = await Character.findById(characterId);
    if (!character) {
      return res.status(404).json({
        success: false,
        message: 'Personaje no encontrado'
      });
    }

    // Actualizar campos básicos
    if (updates.name) character.name = updates.name;
    if (updates.class) character.class = updates.class;

    // Actualizar stats
    if (updates.stats) {
      if (updates.stats.level !== undefined) character.stats.level = updates.stats.level;
      if (updates.stats.experience !== undefined) character.stats.experience = updates.stats.experience;
      if (updates.stats.gold !== undefined) character.stats.gold = updates.stats.gold;
      if (updates.stats.hp !== undefined) character.stats.hp = updates.stats.hp;
      if (updates.stats.maxHp !== undefined) character.stats.maxHp = updates.stats.maxHp;
      if (updates.stats.mana !== undefined) character.stats.mana = updates.stats.mana;
      if (updates.stats.maxMana !== undefined) character.stats.maxMana = updates.stats.maxMana;
      if (updates.stats.stamina !== undefined) character.stats.stamina = updates.stats.stamina;
      if (updates.stats.maxStamina !== undefined) character.stats.maxStamina = updates.stats.maxStamina;
      if (updates.stats.strength !== undefined) character.stats.strength = updates.stats.strength;
      if (updates.stats.dexterity !== undefined) character.stats.dexterity = updates.stats.dexterity;
      if (updates.stats.intelligence !== undefined) character.stats.intelligence = updates.stats.intelligence;
      if (updates.stats.constitution !== undefined) character.stats.constitution = updates.stats.constitution;
    }

    // Actualizar apariencia
    if (updates.appearance) {
      if (updates.appearance.body !== undefined) character.appearance.body = updates.appearance.body;
      if (updates.appearance.head !== undefined) character.appearance.head = updates.appearance.head;
      if (updates.appearance.race !== undefined) character.appearance.race = updates.appearance.race;
    }

    // Actualizar estado
    if (updates.state) {
      if (updates.state.isAlive !== undefined) {
        character.state.isAlive = updates.state.isAlive;
        // Si el personaje muere, poner HP en 0
        if (!updates.state.isAlive) {
          character.stats.hp = 0;
        }
      }
    }

    // Actualizar criminalidad
    if (updates.criminalStatus !== undefined) {
      character.criminalStatus = updates.criminalStatus;
    }

    await character.save();

    // IMPORTANTE: Si el personaje está online, desconectarlo para que recargue con los nuevos datos
    // Esto evita que los datos en memoria sobrescriban los cambios del admin
    const { characterSockets, io } = await import('../server.js');
    const socketId = characterSockets.get(characterId);
    
    if (socketId) {
      console.log(`⚠️ Personaje ${character.name} estaba online - desconectando para aplicar cambios del admin...`);
      
      // Enviar notificación al cliente antes de desconectar
      io.to(socketId).emit('admin_update', {
        message: 'Tu personaje ha sido modificado por un administrador. Serás desconectado para aplicar los cambios.',
        reason: 'admin_modification'
      });
      
      // Dar tiempo para que el mensaje llegue, luego desconectar
      setTimeout(() => {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
          console.log(`✅ Jugador ${character.name} desconectado por modificación admin`);
        }
      }, 1000);
    }

    res.json({
      success: true,
      message: socketId 
        ? 'Personaje actualizado exitosamente. El jugador será desconectado para aplicar los cambios.'
        : 'Personaje actualizado exitosamente',
      data: character,
      wasOnline: !!socketId
    });

  } catch (error) {
    console.error('Error al actualizar personaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar personaje'
    });
  }
};

/**
 * Obtener lista de NPCs activos (solo admin/moderator)
 * GET /api/admin/npcs
 */
/**
 * @desc    Regenerar instancias de NPCs (limpia y vuelve a spawnear todos)
 * @route   POST /api/admin/npcs/regenerate
 * @access  Private (Admin)
 */
export const regenerateNPCInstances = async (req, res) => {
  try {
    console.log('🔄 Iniciando regeneración de instancias de NPCs...');
    
    // Importar dinámicamente para evitar problemas de dependencias circulares
    const NPCInstance = (await import('../models/NPCInstance.js')).default;
    const NPC = (await import('../models/NPC.js')).default;
    
    // Limpiar todas las instancias
    const deleteResult = await NPCInstance.deleteMany({});
    console.log(`🧹 ${deleteResult.deletedCount} instancias eliminadas`);
    
    // Obtener tipos de NPCs activos
    const npcTypes = await NPC.find({ isActive: true });
    console.log(`📦 ${npcTypes.length} tipos de NPCs encontrados`);
    
    // El servidor respawneará automáticamente los NPCs cuando detecte que no hay instancias
    // o puedes forzar el respawn reiniciando el servidor
    
    res.json({
      success: true,
      message: 'Instancias de NPCs eliminadas. Reinicia el servidor para respawnear.',
      deleted: deleteResult.deletedCount,
      npcTypes: npcTypes.length
    });
    
  } catch (error) {
    console.error('❌ Error al regenerar instancias de NPCs:', error);
    res.status(500).json({
      success: false,
      message: 'Error al regenerar instancias de NPCs'
    });
  }
};

export const getActiveNPCs = async (req, res) => {
  try {
    // Verificar permisos
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a esta información'
      });
    }

    const mapId = req.query.map; // Filtro opcional por mapa

    // Construir query
    const query = mapId ? { 'position.map': mapId } : {};

    // Obtener instancias de NPCs activas con referencia al tipo
    const npcInstances = await NPCInstance.find(query)
      .populate('npcRef')
      .sort({ 'position.map': 1, 'position.x': 1, 'position.y': 1 });

    // Obtener tipos de NPCs para hacer lookup manual si npcRef no existe
    const npcTypes = await NPC.find();
    const npcTypeMap = {};
    npcTypes.forEach(type => {
      npcTypeMap[type.npcTypeId] = type;
    });

    // Agrupar NPCs por mapa
    const npcsByMap = {};
    npcInstances.forEach(instance => {
      const map = instance.position.map;
      if (!npcsByMap[map]) {
        npcsByMap[map] = [];
      }
      
      // Obtener info del tipo de NPC
      const npcType = instance.npcRef || npcTypeMap[instance.npcTypeId];
      const npcTypeName = npcType ? npcType.name : 'Desconocido';
      
      npcsByMap[map].push({
        instanceId: instance.instanceId,
        name: npcType ? npcType.name : 'NPC',
        npcTypeId: instance.npcTypeId,
        npcTypeName: npcTypeName,
        position: instance.position,
        stats: instance.state || { hp: 0, maxHp: 100, level: 1 },
        behavior: npcType ? npcType.behavior : { hostile: false },
        isAlive: instance.state ? instance.state.isAlive : false,
        spawnedAt: instance.spawnedAt,
        lastAttackTime: instance.lastMovement
      });
    });

    // Estadísticas generales
    const totalNPCs = npcInstances.length;
    const aliveNPCs = npcInstances.filter(npc => npc.state && npc.state.isAlive).length;
    const deadNPCs = totalNPCs - aliveNPCs;

    // NPCs por tipo
    const npcsByType = {};
    npcInstances.forEach(instance => {
      const npcType = instance.npcRef || npcTypeMap[instance.npcTypeId];
      const typeName = npcType ? npcType.name : 'Desconocido';
      npcsByType[typeName] = (npcsByType[typeName] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        npcs: npcInstances.map(instance => {
          const npcType = instance.npcRef || npcTypeMap[instance.npcTypeId];
          return {
            instanceId: instance.instanceId,
            name: npcType ? npcType.name : 'NPC',
            type: npcType ? npcType.name : 'Desconocido',
            npcTypeId: instance.npcTypeId,
            position: instance.position,
            stats: instance.state || { hp: 0, maxHp: 100, level: 1 },
            behavior: npcType ? npcType.behavior : { hostile: false },
            isAlive: instance.state ? instance.state.isAlive : false,
            spawnedAt: instance.spawnedAt,
            lastAttackTime: instance.lastMovement
          };
        }),
        byMap: npcsByMap,
        stats: {
          total: totalNPCs,
          alive: aliveNPCs,
          dead: deadNPCs,
          byType: npcsByType
        },
        npcTypes: npcTypes.map(type => ({
          id: type._id,
          npcTypeId: type.npcTypeId,
          name: type.name,
          stats: type.stats,
          behavior: type.behavior
        }))
      }
    });

  } catch (error) {
    console.error('Error al obtener NPCs:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener lista de NPCs'
    });
  }
};
