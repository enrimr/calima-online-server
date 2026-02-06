import mongoose from 'mongoose';
import dotenv from 'dotenv';
import NPC from '../models/NPC.js';

// Cargar variables de entorno
dotenv.config();

// Conectar a la base de datos
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/calima-online', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const sampleNPCs = [
  {
    npcTypeId: 1,
    name: 'Goblin',
    description: 'Un pequeño y malicioso goblin',
    type: 'enemy',
    appearance: {
      body: 301,
      head: 0,
      heading: 3
    },
    stats: {
      level: 1,
      hp: 50,
      maxHp: 50,
      minHit: 3,
      maxHit: 8,
      defense: 2,
      magicDefense: 0,
      evasion: 5
    },
    behavior: {
      hostile: true,
      attackable: true,
      movement: 'random',
      movementSpeed: 3000,
      attackRange: 1,
      chaseRange: 8,
      canSwim: false,
      canWalkOnLand: true
    },
    rewards: {
      experience: 50,
      gold: 10,
      items: [
        { itemId: 1, dropChance: 0.3, minAmount: 1, maxAmount: 1 } // Ejemplo: espada de madera
      ]
    },
    spawnConfig: {
      respawnTime: 15000,
      maxInstances: 20,
      spawnMaps: [
        {
          mapId: 'newbie_city',
          spawnPoints: [
            { x: 15, y: 15 },
            { x: 25, y: 20 },
            { x: 35, y: 25 },
            { x: 20, y: 35 },
            { x: 40, y: 30 }
          ],
          maxInMap: 5
        },
        {
          mapId: 'training_fields',
          spawnPoints: [
            { x: 12, y: 15 },
            { x: 20, y: 12 },
            { x: 30, y: 18 },
            { x: 25, y: 25 }
          ],
          maxInMap: 4
        },
        {
          mapId: 'forest_outskirts_1',
          spawnPoints: [
            { x: 15, y: 20 },
            { x: 35, y: 15 },
            { x: 25, y: 30 }
          ],
          maxInMap: 3
        }
      ]
    },
    abilities: {
      canPoison: false,
      poisonDamage: 0,
      canParalyze: false,
      spells: []
    },
    sounds: {
      idle: 0,
      attack: 0,
      death: 0
    },
    isActive: true
  },
  {
    npcTypeId: 2,
    name: 'Araña Gigante',
    description: 'Una araña venenosa de gran tamaño',
    type: 'enemy',
    appearance: {
      body: 302,
      head: 0,
      heading: 3
    },
    stats: {
      level: 3,
      hp: 80,
      maxHp: 80,
      minHit: 5,
      maxHit: 12,
      defense: 3,
      magicDefense: 0,
      evasion: 8
    },
    behavior: {
      hostile: true,
      attackable: true,
      movement: 'chase',
      movementSpeed: 2500,
      attackRange: 1,
      chaseRange: 10,
      canSwim: false,
      canWalkOnLand: true
    },
    rewards: {
      experience: 120,
      gold: 25,
      items: [
        { itemId: 2, dropChance: 0.2, minAmount: 1, maxAmount: 3 } // Ejemplo: veneno
      ]
    },
    spawnConfig: {
      respawnTime: 20000,
      maxInstances: 15,
      spawnMaps: [
        {
          mapId: 'newbie_city',
          spawnPoints: [
            { x: 18, y: 18 },
            { x: 45, y: 20 },
            { x: 30, y: 40 }
          ],
          maxInMap: 3
        },
        {
          mapId: 'training_fields',
          spawnPoints: [
            { x: 15, y: 25 },
            { x: 40, y: 20 },
            { x: 35, y: 35 }
          ],
          maxInMap: 3
        },
        {
          mapId: 'forest_outskirts_1',
          spawnPoints: [
            { x: 20, y: 25 },
            { x: 40, y: 30 }
          ],
          maxInMap: 2
        }
      ]
    },
    abilities: {
      canPoison: true,
      poisonDamage: 5,
      canParalyze: false,
      spells: []
    },
    sounds: {
      idle: 0,
      attack: 0,
      death: 0
    },
    isActive: true
  },
  {
    npcTypeId: 3,
    name: 'Lobo Salvaje',
    description: 'Un lobo feroz que caza en manada',
    type: 'enemy',
    appearance: {
      body: 303,
      head: 0,
      heading: 3
    },
    stats: {
      level: 2,
      hp: 60,
      maxHp: 60,
      minHit: 4,
      maxHit: 10,
      defense: 2,
      magicDefense: 0,
      evasion: 10
    },
    behavior: {
      hostile: true,
      attackable: true,
      movement: 'chase',
      movementSpeed: 2000,
      attackRange: 1,
      chaseRange: 12,
      canSwim: false,
      canWalkOnLand: true
    },
    rewards: {
      experience: 80,
      gold: 15,
      items: [
        { itemId: 3, dropChance: 0.25, minAmount: 1, maxAmount: 2 } // Ejemplo: piel de lobo
      ]
    },
    spawnConfig: {
      respawnTime: 18000,
      maxInstances: 18,
      spawnMaps: [
        {
          mapId: 'newbie_city',
          spawnPoints: [
            { x: 22, y: 22 },
            { x: 38, y: 28 },
            { x: 28, y: 45 },
            { x: 42, y: 35 }
          ],
          maxInMap: 4
        },
        {
          mapId: 'training_fields',
          spawnPoints: [
            { x: 18, y: 22 },
            { x: 32, y: 28 },
            { x: 45, y: 25 },
            { x: 38, y: 18 }
          ],
          maxInMap: 4
        },
        {
          mapId: 'forest_outskirts_1',
          spawnPoints: [
            { x: 25, y: 18 },
            { x: 35, y: 22 },
            { x: 42, y: 28 }
          ],
          maxInMap: 3
        }
      ]
    },
    abilities: {
      canPoison: false,
      poisonDamage: 0,
      canParalyze: false,
      spells: []
    },
    sounds: {
      idle: 0,
      attack: 0,
      death: 0
    },
    isActive: true
  },
  {
    npcTypeId: 100,
    name: 'Sacerdote',
    description: 'Un sacerdote que puede resucitar a los muertos',
    type: 'priest',
    appearance: {
      body: 200,
      head: 1,
      heading: 3
    },
    stats: {
      level: 10,
      hp: 200,
      maxHp: 200,
      minHit: 0,
      maxHit: 0,
      defense: 10,
      magicDefense: 10,
      evasion: 0
    },
    behavior: {
      hostile: false,
      attackable: false,
      movement: 'static',
      movementSpeed: 0,
      attackRange: 0,
      chaseRange: 0,
      canSwim: false,
      canWalkOnLand: true
    },
    rewards: {
      experience: 0,
      gold: 0,
      items: []
    },
    spawnConfig: {
      respawnTime: 0,
      maxInstances: 1,
      spawnMaps: [
        {
          mapId: 'newbie_city',
          spawnPoints: [
            { x: 50, y: 50 }
          ],
          maxInMap: 1
        }
      ]
    },
    abilities: {
      canPoison: false,
      poisonDamage: 0,
      canParalyze: false,
      spells: []
    },
    sounds: {
      idle: 0,
      attack: 0,
      death: 0
    },
    isActive: true
  }
];

async function seedNPCs() {
  try {
    console.log('🌱 Iniciando seed de NPCs...');
    
    // Limpiar NPCs existentes
    await NPC.deleteMany({});
    console.log('🧹 NPCs existentes eliminados');
    
    // Insertar nuevos NPCs
    const result = await NPC.insertMany(sampleNPCs);
    console.log(`✅ ${result.length} NPCs creados exitosamente`);
    
    // Mostrar resumen
    for (const npc of result) {
      console.log(`  - ${npc.name} (ID: ${npc.npcTypeId}, Tipo: ${npc.type})`);
    }
    
    console.log('\n🎉 Seed completado exitosamente');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error al hacer seed de NPCs:', error);
    process.exit(1);
  }
}

// Ejecutar seed
seedNPCs();