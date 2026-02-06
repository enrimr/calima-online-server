import mongoose from 'mongoose';

const npcInstanceSchema = new mongoose.Schema({
  // Referencia al tipo de NPC
  npcTypeId: {
    type: Number,
    required: true,
    index: true
  },
  
  // Referencia al modelo NPC (para datos estáticos)
  npcRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NPC'
  },
  
  // ID único de la instancia (para sincronización con clientes)
  instanceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Posición actual
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    map: { type: String, required: true },
    heading: { type: Number, default: 3 }
  },
  
  // Posición original de spawn (para respawn)
  spawnPosition: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    map: { type: String, required: true }
  },
  
  // Estado actual
  state: {
    isAlive: { type: Boolean, default: true },
    hp: { type: Number, required: true },
    maxHp: { type: Number, required: true },
    isMoving: { type: Boolean, default: false },
    isInCombat: { type: Boolean, default: false },
    isPoisoned: { type: Boolean, default: false },
    isParalyzed: { type: Boolean, default: false }
  },
  
  // Target actual (si está en combate)
  target: {
    type: { type: String, enum: ['player', 'npc', 'none'], default: 'none' },
    id: { type: String, default: null }, // socketId para jugadores, instanceId para NPCs
    lastAttackTime: { type: Date, default: null }
  },
  
  // Sistema de daño - rastrear quién ha atacado al NPC
  damageDealt: [{
    playerId: { type: String, required: true }, // socketId o characterId
    playerName: { type: String, required: true },
    damage: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Timestamps
  spawnedAt: {
    type: Date,
    default: Date.now
  },
  
  lastMovement: {
    type: Date,
    default: Date.now
  },
  
  deathTime: {
    type: Date,
    default: null
  },
  
  // Respawn programado
  respawnScheduled: {
    type: Boolean,
    default: false
  },
  
  respawnAt: {
    type: Date,
    default: null
  }
});

// Índices para búsquedas eficientes
npcInstanceSchema.index({ instanceId: 1 });
npcInstanceSchema.index({ npcTypeId: 1 });
npcInstanceSchema.index({ 'position.map': 1, 'state.isAlive': 1 });
npcInstanceSchema.index({ respawnScheduled: 1, respawnAt: 1 });

// Método para calcular daño total de un jugador
npcInstanceSchema.methods.getTotalDamageByPlayer = function(playerId) {
  return this.damageDealt
    .filter(d => d.playerId === playerId)
    .reduce((total, d) => total + d.damage, 0);
};

// Método para obtener el último atacante
npcInstanceSchema.methods.getLastAttacker = function() {
  if (this.damageDealt.length === 0) return null;
  
  const sorted = this.damageDealt.sort((a, b) => b.timestamp - a.timestamp);
  return sorted[0];
};

// Método para calcular reparto de experiencia/oro
npcInstanceSchema.methods.calculateRewards = function(totalExp, totalGold) {
  if (this.damageDealt.length === 0) {
    return { distribution: [] };
  }
  
  // Calcular daño total
  const totalDamage = this.damageDealt.reduce((sum, d) => sum + d.damage, 0);
  
  if (totalDamage === 0) {
    return { distribution: [] };
  }
  
  // Obtener último atacante (quien mató al NPC)
  const lastAttacker = this.getLastAttacker();
  
  // 50% proporcional al daño, 50% para quien lo mató
  const proportionalExp = Math.floor(totalExp * 0.5);
  const proportionalGold = Math.floor(totalGold * 0.5);
  const killExp = Math.floor(totalExp * 0.5);
  const killGold = Math.floor(totalGold * 0.5);
  
  // Agrupar daño por jugador
  const playerDamage = {};
  this.damageDealt.forEach(d => {
    if (!playerDamage[d.playerId]) {
      playerDamage[d.playerId] = {
        playerId: d.playerId,
        playerName: d.playerName,
        totalDamage: 0
      };
    }
    playerDamage[d.playerId].totalDamage += d.damage;
  });
  
  // Calcular recompensas proporcionales
  const distribution = [];
  Object.values(playerDamage).forEach(player => {
    const damagePercent = player.totalDamage / totalDamage;
    const expFromDamage = Math.floor(proportionalExp * damagePercent);
    const goldFromDamage = Math.floor(proportionalGold * damagePercent);
    
    // Si es el que mató, añadir bonus
    let expFromKill = 0;
    let goldFromKill = 0;
    if (lastAttacker && lastAttacker.playerId === player.playerId) {
      expFromKill = killExp;
      goldFromKill = killGold;
    }
    
    distribution.push({
      playerId: player.playerId,
      playerName: player.playerName,
      experience: expFromDamage + expFromKill,
      gold: goldFromDamage + goldFromKill,
      wasKiller: lastAttacker && lastAttacker.playerId === player.playerId
    });
  });
  
  return { distribution };
};

const NPCInstance = mongoose.model('NPCInstance', npcInstanceSchema);

export default NPCInstance;