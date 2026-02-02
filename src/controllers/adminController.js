import Character from '../models/Character.js';
import User from '../models/User.js';
import { connectedPlayers } from '../server.js';

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