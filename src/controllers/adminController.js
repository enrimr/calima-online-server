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
 * Obtener lista de NPCs activos (solo admin/moderator)
 * GET /api/admin/npcs
 */
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
