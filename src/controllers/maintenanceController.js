/**
 * Maintenance Controller
 * Operaciones de mantenimiento del servidor accesibles desde el panel de admin
 */

import NPCInstance from '../models/NPCInstance.js';
import NPC from '../models/NPC.js';
import Character from '../models/Character.js';

// Tiempo de respawn por defecto en ms (configurable via variable de entorno)
// NPC_RESPAWN_TIME_MS=30000 (por defecto: 30 segundos)
const DEFAULT_RESPAWN_TIME = parseInt(process.env.NPC_RESPAWN_TIME_MS) || 30000;

console.log(`⏰ NPC respawn time: ${DEFAULT_RESPAWN_TIME / 1000}s (configurable via NPC_RESPAWN_TIME_MS)`);

// Definición de los tipos de NPC del juego
const NPC_TYPES_DATA = [
  {
    npcTypeId: 1,
    name: 'Goblin',
    description: 'Un pequeño y malicioso goblin',
    type: 'enemy',
    appearance: { body: 301, head: 0, heading: 3 },
    stats: { level: 1, hp: 50, maxHp: 50, minHit: 3, maxHit: 8, defense: 2, magicDefense: 0, evasion: 5 },
    behavior: { hostile: true, attackable: true, movement: 'random', movementSpeed: 3000, attackRange: 1, chaseRange: 8, canSwim: false, canWalkOnLand: true },
    rewards: { experience: 50, gold: 10, items: [] },
    spawnConfig: {
      respawnTime: DEFAULT_RESPAWN_TIME, maxInstances: 20,
      spawnMaps: [
        { mapId: 'newbie_city', spawnPoints: [{ x: 15, y: 15 }, { x: 25, y: 20 }, { x: 35, y: 25 }, { x: 20, y: 35 }, { x: 40, y: 30 }], maxInMap: 5 },
        { mapId: 'training_fields', spawnPoints: [{ x: 12, y: 15 }, { x: 20, y: 12 }, { x: 30, y: 18 }, { x: 25, y: 25 }], maxInMap: 4 },
        { mapId: 'forest_outskirts_1', spawnPoints: [{ x: 15, y: 20 }, { x: 35, y: 15 }, { x: 25, y: 30 }], maxInMap: 3 }
      ]
    },
    abilities: { canPoison: false, poisonDamage: 0, canParalyze: false, spells: [] },
    sounds: { idle: 0, attack: 0, death: 0 },
    isActive: true
  },
  {
    npcTypeId: 2,
    name: 'Araña Gigante',
    description: 'Una araña venenosa de gran tamaño',
    type: 'enemy',
    appearance: { body: 302, head: 0, heading: 3 },
    stats: { level: 3, hp: 80, maxHp: 80, minHit: 5, maxHit: 12, defense: 3, magicDefense: 0, evasion: 8 },
    behavior: { hostile: true, attackable: true, movement: 'chase', movementSpeed: 2500, attackRange: 1, chaseRange: 10, canSwim: false, canWalkOnLand: true },
    rewards: { experience: 120, gold: 25, items: [] },
    spawnConfig: {
      respawnTime: DEFAULT_RESPAWN_TIME, maxInstances: 15,
      spawnMaps: [
        { mapId: 'newbie_city', spawnPoints: [{ x: 18, y: 18 }, { x: 45, y: 20 }, { x: 30, y: 40 }], maxInMap: 3 },
        { mapId: 'training_fields', spawnPoints: [{ x: 15, y: 25 }, { x: 40, y: 20 }, { x: 35, y: 35 }], maxInMap: 3 },
        { mapId: 'forest_outskirts_1', spawnPoints: [{ x: 20, y: 25 }, { x: 40, y: 30 }], maxInMap: 2 }
      ]
    },
    abilities: { canPoison: true, poisonDamage: 5, canParalyze: false, spells: [] },
    sounds: { idle: 0, attack: 0, death: 0 },
    isActive: true
  },
  {
    npcTypeId: 3,
    name: 'Lobo Salvaje',
    description: 'Un lobo feroz que caza en manada',
    type: 'enemy',
    appearance: { body: 303, head: 0, heading: 3 },
    stats: { level: 2, hp: 60, maxHp: 60, minHit: 4, maxHit: 10, defense: 2, magicDefense: 0, evasion: 10 },
    behavior: { hostile: true, attackable: true, movement: 'chase', movementSpeed: 2000, attackRange: 1, chaseRange: 12, canSwim: false, canWalkOnLand: true },
    rewards: { experience: 80, gold: 15, items: [] },
    spawnConfig: {
      respawnTime: DEFAULT_RESPAWN_TIME, maxInstances: 18,
      spawnMaps: [
        { mapId: 'newbie_city', spawnPoints: [{ x: 22, y: 22 }, { x: 38, y: 28 }, { x: 28, y: 45 }, { x: 42, y: 35 }], maxInMap: 4 },
        { mapId: 'training_fields', spawnPoints: [{ x: 18, y: 22 }, { x: 32, y: 28 }, { x: 45, y: 25 }, { x: 38, y: 18 }], maxInMap: 4 },
        { mapId: 'forest_outskirts_1', spawnPoints: [{ x: 25, y: 18 }, { x: 35, y: 22 }, { x: 42, y: 28 }], maxInMap: 3 }
      ]
    },
    abilities: { canPoison: false, poisonDamage: 0, canParalyze: false, spells: [] },
    sounds: { idle: 0, attack: 0, death: 0 },
    isActive: true
  },
  {
    npcTypeId: 100,
    name: 'Sacerdote',
    description: 'Un sacerdote que puede resucitar a los muertos',
    type: 'priest',
    appearance: { body: 200, head: 1, heading: 3 },
    stats: { level: 10, hp: 200, maxHp: 200, minHit: 0, maxHit: 0, defense: 10, magicDefense: 10, evasion: 0 },
    behavior: { hostile: false, attackable: false, movement: 'static', movementSpeed: 0, attackRange: 0, chaseRange: 0, canSwim: false, canWalkOnLand: true },
    rewards: { experience: 0, gold: 0, items: [] },
    spawnConfig: {
      respawnTime: 0, maxInstances: 1,
      spawnMaps: [
        { mapId: 'newbie_city', spawnPoints: [{ x: 50, y: 50 }], maxInMap: 1 }
      ]
    },
    abilities: { canPoison: false, poisonDamage: 0, canParalyze: false, spells: [] },
    sounds: { idle: 0, attack: 0, death: 0 },
    isActive: true
  }
];

/**
 * @desc    Inicializar tipos de NPC en la base de datos (seed) y luego spawnear instancias
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

    // Paso 1: Limpiar e insertar tipos de NPC en la BD
    await NPC.deleteMany({});
    const insertedTypes = await NPC.insertMany(NPC_TYPES_DATA);
    console.log(`✅ ${insertedTypes.length} tipos de NPC insertados en BD`);

    // Paso 2: Spawnear instancias de cada tipo
    const currentInstanceCount = await NPCInstance.countDocuments();
    let spawned = 0;
    for (const npcType of insertedTypes) {
      try {
        await npcManager.spawnNPCsByType(npcType);
        spawned++;
      } catch (err) {
        console.error(`Error spawning ${npcType.name}:`, err.message);
      }
    }

    const newInstanceCount = await NPCInstance.countDocuments();

    res.json({
      success: true,
      message: `Tipos insertados y NPCs spawneados exitosamente`,
      data: {
        typesInserted: insertedTypes.length,
        previousInstances: currentInstanceCount,
        newInstances: newInstanceCount,
        typesSpawned: spawned
      }
    });
  } catch (error) {
    console.error('Error en seedNPCs:', error);
    res.status(500).json({
      success: false,
      message: 'Error al seedear NPCs',
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
