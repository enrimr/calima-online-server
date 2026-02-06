import mongoose from 'mongoose';

const npcSchema = new mongoose.Schema({
  // Identificador único del tipo de NPC
  npcTypeId: {
    type: Number,
    required: true,
    index: true
  },
  
  // Información básica
  name: {
    type: String,
    required: true
  },
  
  description: {
    type: String,
    default: ''
  },
  
  // Tipo de NPC (enemigo, comerciante, quest, etc.)
  type: {
    type: String,
    enum: ['enemy', 'merchant', 'quest', 'trainer', 'priest', 'banker'],
    default: 'enemy'
  },
  
  // Apariencia
  appearance: {
    body: { type: Number, required: true },
    head: { type: Number, default: 0 },
    heading: { type: Number, default: 3 }
  },
  
  // Stats
  stats: {
    level: { type: Number, default: 1 },
    hp: { type: Number, required: true },
    maxHp: { type: Number, required: true },
    minHit: { type: Number, default: 1 },
    maxHit: { type: Number, default: 5 },
    defense: { type: Number, default: 0 },
    magicDefense: { type: Number, default: 0 },
    evasion: { type: Number, default: 0 }
  },
  
  // Comportamiento
  behavior: {
    hostile: { type: Boolean, default: true },
    attackable: { type: Boolean, default: true },
    movement: {
      type: String,
      enum: ['static', 'random', 'patrol', 'chase', 'flee'],
      default: 'random'
    },
    movementSpeed: { type: Number, default: 2000 }, // ms entre movimientos
    attackRange: { type: Number, default: 1 },
    chaseRange: { type: Number, default: 8 },
    canSwim: { type: Boolean, default: false },
    canWalkOnLand: { type: Boolean, default: true }
  },
  
  // Recompensas
  rewards: {
    experience: { type: Number, default: 0 },
    gold: { type: Number, default: 0 },
    // Array de items que puede dropear con probabilidad
    items: [{
      itemId: { type: Number, required: true },
      dropChance: { type: Number, min: 0, max: 1, default: 0.1 }, // 0-1 (porcentaje)
      minAmount: { type: Number, default: 1 },
      maxAmount: { type: Number, default: 1 }
    }]
  },
  
  // Spawn configuration
  spawnConfig: {
    respawnTime: { type: Number, default: 15000 }, // ms (15 segundos por defecto)
    maxInstances: { type: Number, default: 10 }, // Máximo número de instancias en el mundo
    spawnMaps: [{
      mapId: { type: String, required: true },
      spawnPoints: [{
        x: { type: Number, required: true },
        y: { type: Number, required: true }
      }],
      maxInMap: { type: Number, default: 5 }
    }]
  },
  
  // Habilidades especiales
  abilities: {
    canPoison: { type: Boolean, default: false },
    poisonDamage: { type: Number, default: 5 },
    canParalyze: { type: Boolean, default: false },
    spells: [{ type: Number }] // IDs de hechizos que puede lanzar
  },
  
  // Sonidos
  sounds: {
    idle: { type: Number, default: 0 },
    attack: { type: Number, default: 0 },
    death: { type: Number, default: 0 }
  },
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para búsquedas eficientes
npcSchema.index({ npcTypeId: 1, isActive: 1 });
npcSchema.index({ type: 1 });
npcSchema.index({ 'spawnConfig.spawnMaps.mapId': 1 });

// Middleware para actualizar updatedAt
npcSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const NPC = mongoose.model('NPC', npcSchema);

export default NPC;