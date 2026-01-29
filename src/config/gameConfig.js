/**
 * gameConfig.js
 * Configuración general del juego en el servidor
 */

export const GAME_CONFIG = {
  // Límites de personajes
  characters: {
    maxPerUser: 5, // Máximo de personajes que puede crear un usuario
    minNameLength: 3,
    maxNameLength: 20,
    namePattern: /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]+$/ // Solo letras y números
  },

  // Configuración de stats iniciales
  stats: {
    initialGold: 100,
    initialLevel: 1,
    initialExperience: 0,
    minAttributeValue: 1,
    maxAttributeValue: 99,
    defaultAttributes: 18, // Fuerza, destreza, inteligencia, etc.
    initialHP: 100,
    initialMana: 50,
    initialStamina: 100
  },

  // Configuración de spawn inicial
  spawn: {
    defaultMap: 'newbie_city',
    defaultX: 25,
    defaultY: 15,
    safeZoneRadius: 10 // Radio en tiles considerado zona segura
  },

  // Configuración de inventario
  inventory: {
    maxSlots: 20,
    initialItems: [
      // Items iniciales que reciben los nuevos personajes
      // { itemId: 'POTION_RED', quantity: 5 },
      // { itemId: 'BREAD', quantity: 10 }
    ]
  },

  // Configuración de guardado automático
  autosave: {
    interval: 30000, // 30 segundos
    onDisconnect: true,
    onMapChange: true
  },

  // Configuración de Socket.io
  socket: {
    pingTimeout: 60000, // 60 segundos
    pingInterval: 25000, // 25 segundos
    syncInterval: 100, // Sincronizar posición cada 100ms
    fullStateSyncInterval: 5000 // Sincronizar estado completo cada 5 segundos
  },

  // Límites de sesión
  session: {
    maxIdleTime: 300000, // 5 minutos de inactividad antes de kick
    maxSessionTime: 14400000, // 4 horas de sesión continua
    autoKickInactive: false // Desactivado por defecto
  },

  // Configuración de respawn de enemigos
  enemies: {
    defaultRespawnTime: 30000, // 30 segundos
    bossRespawnTime: 300000, // 5 minutos
    maxEnemiesPerMap: 50
  },

  // Configuración de facciones
  factions: {
    default: 'ciudadano',
    allowed: ['ciudadano', 'criminal', 'armada', 'caos', 'neutral'],
    criminalThreshold: 50, // Puntos de criminalidad para ser criminal
    chaosThreshold: 100 // Puntos para pertenecer al caos
  },

  // Configuración de nivel
  leveling: {
    maxLevel: 100,
    expFormulaMultiplier: 100,
    expFormulaPower: 1.5,
    hpPerLevel: 10,
    manaPerLevel: 5,
    staminaPerLevel: 5
  },

  // Configuración de combate
  combat: {
    pvpEnabled: true,
    pvpInSafeZones: false,
    criminalPenaltyForPvp: true,
    deathPenalty: {
      experienceLoss: 0, // Porcentaje de exp que se pierde al morir (0 = no se pierde)
      goldLoss: 0, // Porcentaje de oro que se pierde al morir
      itemsDrop: true // Si los items caen al suelo al morir
    }
  },

  // Configuración de guilds/clanes
  guilds: {
    maxMembers: 50,
    minNameLength: 3,
    maxNameLength: 30,
    creationCost: 10000 // Oro necesario para crear un clan
  },

  // Configuración de trade/comercio
  trading: {
    enabled: true,
    maxDistance: 3, // Tiles de distancia máxima para comerciar
    maxItems: 20, // Items máximos por trade
    taxRate: 0.05 // 5% de impuesto en trades
  },

  // Configuración de chat
  chat: {
    maxMessageLength: 200,
    floodProtection: true,
    floodThreshold: 5, // Mensajes por ventana de tiempo
    floodWindow: 10000, // 10 segundos
    allowedChannels: ['global', 'local', 'guild', 'whisper']
  },

  // Configuración de mundo
  world: {
    mapWidth: 100,
    mapHeight: 100,
    defaultTileSize: 32,
    maxMapsLoaded: 10 // Máximo de mapas cargados en memoria simultáneamente
  },

  // Configuración de eventos
  events: {
    enabled: true,
    randomEvents: true,
    bossEvents: true,
    pvpEvents: true
  },

  // Configuración de seguridad
  security: {
    rateLimitWindow: 900000, // 15 minutos
    rateLimitMaxRequests: 100,
    enableHelmet: true,
    enableCors: true,
    jwtExpiresIn: '7d' // Los tokens expiran en 7 días
  },

  // Configuración de administración
  admin: {
    enableDebugCommands: process.env.NODE_ENV === 'development',
    enableGodMode: false,
    logAllEvents: process.env.NODE_ENV === 'development'
  }
};

// Función helper para obtener configuración
export function getConfig(path) {
  const keys = path.split('.');
  let value = GAME_CONFIG;
  
  for (const key of keys) {
    if (value && typeof value === 'object') {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

// Función helper para validar configuración
export function validateConfig() {
  const errors = [];
  
  // Validar que los valores críticos estén configurados
  if (!GAME_CONFIG.characters.maxPerUser || GAME_CONFIG.characters.maxPerUser < 1) {
    errors.push('characters.maxPerUser debe ser al menos 1');
  }
  
  if (!GAME_CONFIG.spawn.defaultMap) {
    errors.push('spawn.defaultMap debe estar definido');
  }
  
  if (errors.length > 0) {
    console.error('❌ Errores de configuración:', errors);
    return false;
  }
  
  console.log('✅ Configuración del juego validada correctamente');
  return true;
}

export default GAME_CONFIG;