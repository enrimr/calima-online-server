import mongoose from 'mongoose';
import { getExpForNextLevel } from '../config/experienceTable.js';

const characterSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'El nombre del personaje es obligatorio'],
    unique: true,
    trim: true,
    minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
    maxlength: [20, 'El nombre no puede tener más de 20 caracteres'],
    match: [/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]+$/, 'El nombre solo puede contener letras y números']
  },
  class: {
    type: String,
    required: true,
    enum: ['warrior', 'mage', 'archer', 'cleric', 'thief', 'bard', 'guerrero', 'mago', 'arquero', 'clerigo', 'asesino', 'paladin', 'ladron', 'bandido', 'cazador', 'druida', 'trabajador', 'pirata'],
    default: 'guerrero'
  },
  faction: {
    type: String,
    enum: ['ciudadano', 'criminal', 'armada', 'caos', 'neutral'],
    default: 'ciudadano'
  },
  
  // Apariencia
  appearance: {
    body: { type: Number, default: 1, min: 1, max: 10 },
    head: { type: Number, default: 1, min: 1, max: 50 },
    heading: { type: Number, default: 3, min: 1, max: 4 }, // Dirección que mira
    race: { type: Number, default: 1, min: 1, max: 3 }, // 1=humano, 2=enano, 3=criatura
    hairColor: { type: Number, default: 1, min: 1, max: 9 },
    hairStyle: { type: Number, default: 1, min: 1, max: 5 }
  },
  
  // Posición en el mundo
  position: {
    map: { type: String, default: 'newbie_city' },
    x: { type: Number, default: 50, min: 0, max: 99 },
    y: { type: Number, default: 50, min: 0, max: 99 }
  },
  
  // Stats base
  stats: {
    level: { type: Number, default: 1, min: 1, max: 100 },
    experience: { type: Number, default: 0, min: 0 },
    gold: { type: Number, default: 100, min: 0 },
    
    // Atributos principales
    strength: { type: Number, default: 18, min: 1, max: 99 },
    dexterity: { type: Number, default: 18, min: 1, max: 99 },
    intelligence: { type: Number, default: 18, min: 1, max: 99 },
    constitution: { type: Number, default: 18, min: 1, max: 99 },
    charisma: { type: Number, default: 18, min: 1, max: 99 },
    
    // Vida y maná
    hp: { type: Number, default: 100 },
    maxHp: { type: Number, default: 100 },
    mana: { type: Number, default: 50 },
    maxMana: { type: Number, default: 50 },
    stamina: { type: Number, default: 100 },
    maxStamina: { type: Number, default: 100 },
    
    // Stats de combate
    minDamage: { type: Number, default: 1 },
    maxDamage: { type: Number, default: 3 },
    defense: { type: Number, default: 0 },
    magicDefense: { type: Number, default: 0 },
    evasion: { type: Number, default: 0 },
    accuracy: { type: Number, default: 50 }
  },
  
  // Habilidades
  skills: {
    sword: { type: Number, default: 0, min: 0, max: 100 },
    axe: { type: Number, default: 0, min: 0, max: 100 },
    mace: { type: Number, default: 0, min: 0, max: 100 },
    dagger: { type: Number, default: 0, min: 0, max: 100 },
    staff: { type: Number, default: 0, min: 0, max: 100 },
    bow: { type: Number, default: 0, min: 0, max: 100 },
    projectile: { type: Number, default: 0, min: 0, max: 100 },
    shield: { type: Number, default: 0, min: 0, max: 100 },
    meditation: { type: Number, default: 0, min: 0, max: 100 },
    survival: { type: Number, default: 0, min: 0, max: 100 },
    taming: { type: Number, default: 0, min: 0, max: 100 },
    mining: { type: Number, default: 0, min: 0, max: 100 },
    woodcutting: { type: Number, default: 0, min: 0, max: 100 },
    fishing: { type: Number, default: 0, min: 0, max: 100 },
    blacksmithing: { type: Number, default: 0, min: 0, max: 100 },
    carpentry: { type: Number, default: 0, min: 0, max: 100 },
    lockpicking: { type: Number, default: 0, min: 0, max: 100 },
    stealth: { type: Number, default: 0, min: 0, max: 100 },
    magic: { type: Number, default: 0, min: 0, max: 100 }
  },
  
  // Inventario (slots 1-20)
  inventory: [{
    slot: { type: Number, required: true, min: 1, max: 20 },
    itemId: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 1 }
  }],
  
  // Equipamiento
  equipment: {
    weapon: { type: String, default: null },
    shield: { type: String, default: null },
    helmet: { type: String, default: null },
    armor: { type: String, default: null },
    ring: { type: String, default: null },
    amulet: { type: String, default: null }
  },
  
  // Hechizos conocidos
  spells: [{
    spellId: { type: String, required: true },
    slot: { type: Number, required: true, min: 1, max: 10 }
  }],
  
  // Estado del personaje
  state: {
    isAlive: { type: Boolean, default: true },
    isOnline: { type: Boolean, default: false },
    isMeditating: { type: Boolean, default: false },
    isParalyzed: { type: Boolean, default: false },
    isPoisoned: { type: Boolean, default: false },
    isInvisible: { type: Boolean, default: false }
  },
  
  // Reputación y criminalidad
  reputation: {
    citizens: { type: Number, default: 0 },
    criminals: { type: Number, default: 0 },
    army: { type: Number, default: 0 },
    chaos: { type: Number, default: 0 }
  },
  
  killCount: {
    citizens: { type: Number, default: 0 },
    criminals: { type: Number, default: 0 },
    monsters: { type: Number, default: 0 }
  },
  
  // Guild/Clan
  guild: {
    guildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guild', default: null },
    rank: { type: String, default: null }
  },
  
  // Estadísticas
  statistics: {
    totalPlayTime: { type: Number, default: 0 }, // en minutos
    deaths: { type: Number, default: 0 },
    questsCompleted: { type: Number, default: 0 },
    itemsCrafted: { type: Number, default: 0 },
    distanceTraveled: { type: Number, default: 0 }
  },
  
  // Flags de sistema
  flags: {
    isNewbie: { type: Boolean, default: true },
    canTrade: { type: Boolean, default: true },
    tutorial: {
      completed: { type: Boolean, default: false },
      step: { type: Number, default: 0 }
    }
  },
  
  // Timestamps
  lastPlayed: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Índices
characterSchema.index({ userId: 1 });
characterSchema.index({ name: 1 });
characterSchema.index({ 'position.map': 1 });
characterSchema.index({ 'state.isOnline': 1 });

// Método para calcular experiencia necesaria para siguiente nivel
characterSchema.methods.getExpForNextLevel = function() {
  return getExpForNextLevel(this.stats.level);
};

// Método para subir de nivel
characterSchema.methods.levelUp = function() {
  const oldLevel = this.stats.level;
  this.stats.level += 1;
  
  // Aumentar stats base según clase (basado en AO)
  const classModifiers = {
    // Clases en inglés (Godot client)
    warrior: { str: 3, dex: 1, int: 0, con: 3, cha: 1, hp: 10, mana: 3 },
    mage: { str: 0, dex: 1, int: 3, con: 1, cha: 2, hp: 7, mana: 8 },
    archer: { str: 1, dex: 3, int: 1, con: 2, cha: 1, hp: 9, mana: 4 },
    cleric: { str: 1, dex: 1, int: 2, con: 2, cha: 3, hp: 8, mana: 7 },
    thief: { str: 1, dex: 4, int: 1, con: 0, cha: 1, hp: 10, mana: 2 },
    bard: { str: 1, dex: 2, int: 2, con: 1, cha: 3, hp: 8, mana: 6 },
    // Clases en español (legacy)
    guerrero: { str: 3, dex: 1, int: 0, con: 3, cha: 1, hp: 10, mana: 3 },
    mago: { str: 0, dex: 1, int: 3, con: 1, cha: 2, hp: 7, mana: 8 },
    arquero: { str: 1, dex: 3, int: 1, con: 2, cha: 1, hp: 9, mana: 4 },
    clerigo: { str: 1, dex: 1, int: 2, con: 2, cha: 3, hp: 8, mana: 7 },
    asesino: { str: 2, dex: 3, int: 1, con: 1, cha: 1, hp: 8, mana: 3 },
    paladin: { str: 2, dex: 1, int: 1, con: 3, cha: 2, hp: 9, mana: 5 },
    ladron: { str: 1, dex: 4, int: 1, con: 0, cha: 1, hp: 10, mana: 2 },
    bandido: { str: 2, dex: 2, int: 0, con: 2, cha: 1, hp: 9, mana: 2 },
    cazador: { str: 2, dex: 3, int: 0, con: 1, cha: 1, hp: 9, mana: 3 },
    druida: { str: 1, dex: 1, int: 3, con: 1, cha: 2, hp: 8, mana: 7 },
    trabajador: { str: 2, dex: 2, int: 1, con: 2, cha: 1, hp: 9, mana: 3 },
    pirata: { str: 2, dex: 2, int: 0, con: 2, cha: 1, hp: 9, mana: 2 }
  };
  
  const mods = classModifiers[this.class] || classModifiers.guerrero;
  
  // Aumentar stats (máximo 99)
  this.stats.strength = Math.min(99, this.stats.strength + mods.str);
  this.stats.dexterity = Math.min(99, this.stats.dexterity + mods.dex);
  this.stats.intelligence = Math.min(99, this.stats.intelligence + mods.int);
  this.stats.constitution = Math.min(99, this.stats.constitution + mods.con);
  this.stats.charisma = Math.min(99, this.stats.charisma + mods.cha);
  
  // Aumentar HP y Mana según clase
  const hpGain = mods.hp + Math.floor(this.stats.constitution / 10);
  const manaGain = mods.mana + Math.floor(this.stats.intelligence / 10);
  
  this.stats.maxHp += hpGain;
  this.stats.maxMana += manaGain;
  this.stats.maxStamina += 5;
  
  // Curar completamente al subir de nivel
  this.stats.hp = this.stats.maxHp;
  this.stats.mana = this.stats.maxMana;
  this.stats.stamina = this.stats.maxStamina;
  
  // Actualizar stats de combate
  this.stats.minDamage = Math.floor(1 + (this.stats.level / 5));
  this.stats.maxDamage = Math.floor(3 + (this.stats.level / 3));
  
  return {
    oldLevel,
    newLevel: this.stats.level,
    hpGained: hpGain,
    manaGained: manaGain,
    newMaxHp: this.stats.maxHp,
    newMaxMana: this.stats.maxMana,
    newStats: {
      strength: this.stats.strength,
      dexterity: this.stats.dexterity,
      intelligence: this.stats.intelligence,
      constitution: this.stats.constitution,
      charisma: this.stats.charisma
    }
  };
};

// Método para añadir experiencia y verificar level ups
characterSchema.methods.addExperience = function(amount) {
  this.stats.experience += amount;
  
  const levelUps = [];
  
  // Verificar si sube de nivel (puede subir múltiples niveles)
  while (this.stats.experience >= this.getExpForNextLevel() && this.stats.level < 50) {
    const expNeeded = this.getExpForNextLevel();
    this.stats.experience -= expNeeded;
    const levelUpInfo = this.levelUp();
    levelUps.push(levelUpInfo);
  }
  
  return {
    expGained: amount,
    levelUps: levelUps,
    currentLevel: this.stats.level,
    currentExp: this.stats.experience,
    expForNext: this.getExpForNextLevel()
  };
};

// Método para verificar si hay espacio en inventario
characterSchema.methods.hasInventorySpace = function() {
  return this.inventory.length < 20;
};

// Método para añadir item al inventario
characterSchema.methods.addItem = function(itemId, quantity = 1) {
  // Buscar si ya existe el item (para items stackeables)
  const existingItem = this.inventory.find(item => item.itemId === itemId);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    if (!this.hasInventorySpace()) {
      return false;
    }
    
    // Encontrar primer slot vacío
    const usedSlots = new Set(this.inventory.map(item => item.slot));
    let slot = 1;
    while (usedSlots.has(slot) && slot <= 20) {
      slot++;
    }
    
    if (slot > 20) return false;
    
    this.inventory.push({ slot, itemId, quantity });
  }
  
  return true;
};

// Método para remover item del inventario
characterSchema.methods.removeItem = function(slot, quantity = null) {
  const itemIndex = this.inventory.findIndex(item => item.slot === slot);
  
  if (itemIndex === -1) return false;
  
  if (quantity === null || this.inventory[itemIndex].quantity <= quantity) {
    this.inventory.splice(itemIndex, 1);
  } else {
    this.inventory[itemIndex].quantity -= quantity;
  }
  
  return true;
};

const Character = mongoose.model('Character', characterSchema);

export default Character;