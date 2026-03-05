/**
 * Maintenance Controller
 * Operaciones de mantenimiento del servidor accesibles desde el panel de admin
 */

import NPCInstance from '../models/NPCInstance.js';
import NPC from '../models/NPC.js';
import Character from '../models/Character.js';

/**
 * @desc    Spawnear NPCs de todos los tipos activos
 * @route   POST /api/admin/maintenance/seed-npcs
 * @access  Admin only
 */
export const seedNPCs = async (req, res) => {
  try {
    const { npcManager } = req.app.locals;

    if (!npcManager) {
      return res.status(500).json({
        success: false,
        message: 'NPCManager no está disponible'
      });
    }

    const currentCount = await NPCInstance.countDocuments();
    const npcTypes = await NPC.find({ isActive: true });

    let spawned = 0;
    for (const npcType of npcTypes) {
      try {
        await npcManager.spawnNPCsByType(npcType);
        spawned++;
      } catch (err) {
        console.error(`Error spawning ${npcType.name}:`, err.message);
      }
    }

    const newCount = await NPCInstance.countDocuments();

    res.json({
      success: true,
      message: `NPCs spawneados exitosamente`,
      data: {
        previousCount: currentCount,
        newCount: newCount,
        typesProcessed: spawned,
        npcTypes: npcTypes.length
      }
    });
  } catch (error) {
    console.error('Error en seedNPCs:', error);
    res.status(500).json({
      success: false,
      message: 'Error al spawnear NPCs',
      error: error.message
    });
  }
};

/**
 * @desc    Limpiar todos los NPCs muertos de la base de datos
 * @route   POST /api/admin/maintenance/clean-dead-npcs
 * @access  Admin only
 */
export const cleanDeadNPCs = async (req, res) => {
  try {
    const result = await NPCInstance.deleteMany({
      'state.isAlive': false
    });

    res.json({
      success: true,
      message: `${result.deletedCount} NPCs muertos eliminados`,
      data: {
        deleted: result.deletedCount
      }
    });
  } catch (error) {
    console.error('Error en cleanDeadNPCs:', error);
    res.status(500).json({
      success: false,
      message: 'Error al limpiar NPCs muertos',
      error: error.message
    });
  }
};

/**
 * @desc    Respawnear todos los NPCs muertos inmediatamente
 * @route   POST /api/admin/maintenance/respawn-all-npcs
 * @access  Admin only
 */
export const respawnAllNPCs = async (req, res) => {
  try {
    const { npcManager } = req.app.locals;

    if (!npcManager) {
      return res.status(500).json({
        success: false,
        message: 'NPCManager no está disponible'
      });
    }

    const deadNPCs = await NPCInstance.find({
      $or: [
        { 'state.isAlive': false },
        { respawnScheduled: true }
      ]
    });

    let respawned = 0;
    for (const npc of deadNPCs) {
      try {
        await npcManager.respawnNPC(npc.instanceId);
        respawned++;
      } catch (err) {
        console.error(`Error respawning NPC ${npc.instanceId}:`, err.message);
      }
    }

    res.json({
      success: true,
      message: `${respawned} NPCs respawneados`,
      data: {
        found: deadNPCs.length,
        respawned: respawned
      }
    });
  } catch (error) {
    console.error('Error en respawnAllNPCs:', error);
    res.status(500).json({
      success: false,
      message: 'Error al respawnear NPCs',
      error: error.message
    });
  }
};

/**
 * @desc    Reiniciar sistema de NPCs (eliminar todo y respawnear)
 * @route   POST /api/admin/maintenance/reset-npc-system
 * @access  Admin only
 */
export const resetNPCSystem = async (req, res) => {
  try {
    const { npcManager } = req.app.locals;

    if (!npcManager) {
      return res.status(500).json({
        success: false,
        message: 'NPCManager no está disponible'
      });
    }

    // 1. Eliminar todas las instancias
    const deleteResult = await NPCInstance.deleteMany({});

    // 2. Limpiar estado en memoria
    npcManager.activeNPCs.clear();
    if (npcManager.combatTimers) npcManager.combatTimers.clear();
    if (npcManager.respawnTimers) npcManager.respawnTimers.clear();

    // 3. Reinicializar
    await npcManager.initialize();

    const newCount = await NPCInstance.countDocuments();

    res.json({
      success: true,
      message: 'Sistema de NPCs reiniciado exitosamente',
      data: {
        deleted: deleteResult.deletedCount,
        respawned: newCount
      }
    });
  } catch (error) {
    console.error('Error en resetNPCSystem:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reiniciar sistema de NPCs',
      error: error.message
    });
  }
};

/**
 * @desc    Revivir todos los personajes muertos (fantasmas)
 * @route   POST /api/admin/maintenance/revive-all-characters
 * @access  Admin only
 */
export const reviveAllCharacters = async (req, res) => {
  try {
    const result = await Character.updateMany(
      { 'state.isAlive': false },
      {
        $set: {
          'state.isAlive': true,
          'stats.hp': 100
        }
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} personajes revividos`,
      data: {
        modified: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error en reviveAllCharacters:', error);
    res.status(500).json({
      success: false,
      message: 'Error al revivir personajes',
      error: error.message
    });
  }
};

/**
 * @desc    Obtener estadísticas detalladas del servidor
 * @route   GET /api/admin/maintenance/server-stats
 * @access  Admin only
 */
export const getServerStats = async (req, res) => {
  try {
    const { npcManager } = req.app.locals;

    const [
      totalNPCs,
      aliveNPCs,
      deadNPCs,
      scheduledRespawns,
      npcTypes,
      totalCharacters,
      aliveCharacters,
      ghostCharacters
    ] = await Promise.all([
      NPCInstance.countDocuments(),
      NPCInstance.countDocuments({ 'state.isAlive': true }),
      NPCInstance.countDocuments({ 'state.isAlive': false }),
      NPCInstance.countDocuments({ respawnScheduled: true }),
      NPC.countDocuments({ isActive: true }),
      Character.countDocuments(),
      Character.countDocuments({ 'state.isAlive': true }),
      Character.countDocuments({ 'state.isAlive': false })
    ]);

    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    res.json({
      success: true,
      data: {
        npcs: {
          total: totalNPCs,
          alive: aliveNPCs,
          dead: deadNPCs,
          scheduledRespawns: scheduledRespawns,
          types: npcTypes,
          activeInMemory: npcManager ? npcManager.activeNPCs.size : 0
        },
        characters: {
          total: totalCharacters,
          alive: aliveCharacters,
          ghosts: ghostCharacters
        },
        server: {
          uptime: uptime,
          uptimeFormatted: formatUptime(uptime),
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB'
          },
          nodeVersion: process.version,
          platform: process.platform
        }
      }
    });
  } catch (error) {
    console.error('Error en getServerStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

/**
 * Helper para formatear uptime en formato legible
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}
