# Sistema de NPCs de Calima Online

## Descripción General

El sistema de NPCs de Calima Online está inspirado en Argentum Online y proporciona un sistema completo de enemigos y NPCs que son sincronizados entre todos los jugadores. Los NPCs tienen posiciones persistentes en la base de datos, pueden moverse, atacar jugadores, y respawnear después de ser derrotados.

## Características Principales

### 1. **Sincronización Global**
- Todos los jugadores ven los mismos NPCs en las mismas posiciones
- Los movimientos y acciones de los NPCs son visibles para todos
- El estado de salud (HP) se sincroniza en tiempo real

### 2. **Sistema de Combate**
- Los NPCs pueden atacar a jugadores que estén en rango
- Los jugadores pueden atacar a NPCs
- El daño infligido por múltiples jugadores se registra
- Sistema de IA para perseguir objetivos

### 3. **Sistema de Recompensas**
El reparto de oro y experiencia funciona de la siguiente manera:
- **50%** se reparte proporcionalmente entre todos los jugadores que atacaron al NPC (basado en el daño infligido)
- **50%** se otorga al jugador que dio el golpe final

### 4. **Sistema de Loot**
- Los NPCs pueden dropear items al morir
- Los items aparecen en la posición donde murió el NPC
- Cada item tiene una probabilidad de drop configurable

### 5. **Sistema de Respawn**
- Los NPCs respawnean después de un tiempo configurable (por defecto 15 segundos)
- Pueden respawnear en su posición original o en posiciones alternativas
- El tiempo de respawn es personalizable por tipo de NPC

## Arquitectura del Sistema

### Modelos de Base de Datos

#### NPC (Modelo de Tipo de NPC)
Define las características estáticas de un tipo de NPC:

```javascript
{
  npcTypeId: Number,        // ID único del tipo de NPC
  name: String,             // Nombre del NPC
  type: String,             // enemy, merchant, quest, etc.
  appearance: {             // Apariencia
    body: Number,
    head: Number,
    heading: Number
  },
  stats: {                  // Estadísticas
    level: Number,
    maxHp: Number,
    minHit: Number,
    maxHit: Number,
    defense: Number,
    evasion: Number
  },
  behavior: {               // Comportamiento
    hostile: Boolean,
    movement: String,       // static, random, chase, patrol
    movementSpeed: Number,
    attackRange: Number,
    chaseRange: Number
  },
  rewards: {                // Recompensas
    experience: Number,
    gold: Number,
    items: [{
      itemId: Number,
      dropChance: Number,   // 0-1 (0% - 100%)
      minAmount: Number,
      maxAmount: Number
    }]
  },
  spawnConfig: {            // Configuración de spawn
    respawnTime: Number,    // en milisegundos
    maxInstances: Number,
    spawnMaps: [{
      mapId: String,
      spawnPoints: [{ x: Number, y: Number }],
      maxInMap: Number
    }]
  }
}
```

#### NPCInstance (Instancia de NPC Spawneada)
Representa un NPC específico en el mundo:

```javascript
{
  instanceId: String,       // ID único de la instancia
  npcTypeId: Number,        // Referencia al tipo de NPC
  position: {               // Posición actual
    x: Number,
    y: Number,
    map: String,
    heading: Number
  },
  spawnPosition: {          // Posición de spawn original
    x: Number,
    y: Number,
    map: String
  },
  state: {                  // Estado actual
    isAlive: Boolean,
    hp: Number,
    maxHp: Number,
    isInCombat: Boolean
  },
  target: {                 // Objetivo actual (si está en combate)
    type: String,           // player, npc, none
    id: String
  },
  damageDealt: [{           // Registro de daño recibido
    playerId: String,
    playerName: String,
    damage: Number,
    timestamp: Date
  }]
}
```

### NPCManager

El `NPCManager` es el sistema central que gestiona todos los NPCs:

**Responsabilidades:**
- Spawnear NPCs según su configuración
- Gestionar movimiento de NPCs
- Controlar IA de NPCs hostiles
- Procesar combate entre NPCs y jugadores
- Distribuir recompensas
- Gestionar respawn de NPCs

**Métodos Principales:**
- `initialize()`: Inicializa el sistema y spawnea NPCs
- `spawnNPC()`: Spawnea un NPC específico
- `moveNPC()`: Mueve un NPC
- `damageNPC()`: Aplica daño a un NPC
- `handleNPCDeath()`: Procesa la muerte de un NPC
- `respawnNPC()`: Respawnea un NPC

## Eventos de Socket.io

### Eventos del Servidor al Cliente

#### `npc_spawned`
Se emite cuando un NPC aparece en el mundo:
```javascript
{
  instanceId: String,
  npcTypeId: Number,
  name: String,
  position: { x, y, map },
  appearance: { body, head, heading },
  stats: { hp, maxHp, level },
  behavior: { hostile, movement, ... },
  isAlive: Boolean
}
```

#### `npc_moved`
Se emite cuando un NPC se mueve:
```javascript
{
  instanceId: String,
  position: { x, y, map, heading }
}
```

#### `npc_hp_changed`
Se emite cuando el HP de un NPC cambia:
```javascript
{
  instanceId: String,
  hp: Number,
  maxHp: Number,
  damage: Number,
  attackerName: String
}
```

#### `npc_died`
Se emite cuando un NPC muere:
```javascript
{
  instanceId: String,
  npcName: String,
  position: { x, y, map }
}
```

#### `npc_respawned`
Se emite cuando un NPC respawnea:
```javascript
{
  instanceId: String,
  npcTypeId: Number,
  name: String,
  position: { x, y, map },
  appearance: { body, head, heading },
  stats: { hp, maxHp, level }
}
```

#### `npc_reward`
Se emite cuando un jugador recibe recompensas de un NPC:
```javascript
{
  instanceId: String,
  npcName: String,
  experience: Number,
  gold: Number,
  wasKiller: Boolean  // true si fue quien dio el golpe final
}
```

#### `npc_loot_dropped`
Se emite cuando un NPC dropea items:
```javascript
{
  instanceId: String,
  position: { x, y, map },
  items: [{ itemId, amount }]
}
```

#### `npc_combat_action`
Se emite cuando un NPC ataca a un jugador:
```javascript
{
  instanceId: String,
  npcName: String,
  targetSocketId: String,
  targetName: String,
  damage: Number
}
```

#### `npc_attacked_player`
Se emite al jugador específico que fue atacado por un NPC:
```javascript
{
  instanceId: String,
  npcName: String,
  damage: Number,
  timestamp: Number
}
```

### Eventos del Cliente al Servidor

#### `attack_npc`
El cliente envía este evento para atacar a un NPC:
```javascript
{
  instanceId: String,
  weaponType: String,  // melee, ranged
  position: { x, y }   // posición del jugador
}
```

**Respuesta:** `attack_npc_result`
```javascript
{
  success: Boolean,
  instanceId: String,
  damage: Number,
  npcHp: Number,
  npcMaxHp: Number,
  npcDied: Boolean,
  reason: String  // si success es false
}
```

## Configuración y Uso

### 1. Instalación de Dependencias

```bash
cd calima-online-server
npm install uuid
```

### 2. Cargar Datos de Ejemplo

Ejecutar el script de seed para crear NPCs de ejemplo:

```bash
node src/scripts/seedNPCs.js
```

Esto creará los siguientes NPCs:
- **Goblin** (Nivel 1, hostil)
- **Araña Gigante** (Nivel 3, hostil, venenosa)
- **Lobo Salvaje** (Nivel 2, hostil, rápido)
- **Sacerdote** (NPC pacífico, estático)

### 3. Iniciar el Servidor

El sistema de NPCs se inicializa automáticamente al iniciar el servidor:

```bash
npm run dev
```

El NPCManager se inicializa 2 segundos después de conectar a la base de datos.

### 4. Crear Nuevos Tipos de NPCs

Puedes agregar nuevos tipos de NPCs directamente en la base de datos o mediante un script:

```javascript
import NPC from './models/NPC.js';

await NPC.create({
  npcTypeId: 4,
  name: 'Dragón',
  type: 'enemy',
  appearance: { body: 304, head: 0, heading: 3 },
  stats: {
    level: 10,
    hp: 500,
    maxHp: 500,
    minHit: 20,
    maxHit: 40,
    defense: 15,
    evasion: 5
  },
  behavior: {
    hostile: true,
    attackable: true,
    movement: 'chase',
    movementSpeed: 2000,
    attackRange: 2,
    chaseRange: 15
  },
  rewards: {
    experience: 1000,
    gold: 200,
    items: [
      { itemId: 10, dropChance: 0.5, minAmount: 1, maxAmount: 1 }
    ]
  },
  spawnConfig: {
    respawnTime: 60000,  // 1 minuto
    maxInstances: 2,
    spawnMaps: [{
      mapId: 'dragon_cave',
      spawnPoints: [{ x: 50, y: 50 }],
      maxInMap: 1
    }]
  }
});
```

## Sistema de Combate con NPCs

### Flujo de Combate

1. **Jugador ataca NPC:**
   - Cliente envía evento `attack_npc` con instanceId
   - Servidor valida el ataque (rango, cooldown, estado del jugador)
   - Servidor calcula daño basado en stats del jugador
   - Servidor registra el daño en el NPC
   - Servidor envía resultado al atacante
   - Servidor broadcast cambio de HP a todos los jugadores en el mapa

2. **NPC ataca Jugador:**
   - NPC AI detecta jugador en rango
   - NPC calcula daño basado en sus stats
   - Servidor aplica daño al jugador
   - Servidor envía evento de ataque al jugador
   - Servidor broadcast acción de combate a espectadores

3. **NPC muere:**
   - Servidor calcula distribución de recompensas
   - Servidor envía recompensas a cada jugador participante
   - Servidor dropea items según probabilidad
   - Servidor broadcast muerte del NPC
   - Servidor programa respawn

4. **NPC respawnea:**
   - Después del tiempo configurado, el NPC reaparece
   - Se resetea su HP y estado
   - Se broadcast evento de respawn a jugadores en el mapa

## Consideraciones de Rendimiento

- Las instancias de NPCs se guardan en memoria para acceso rápido
- Los movimientos se actualizan en BD de forma asíncrona
- El respawn se gestiona mediante timers en memoria
- Se utilizan salas de Socket.io por mapa para broadcasting eficiente

## Próximas Mejoras

- [ ] Sistema de patrullaje de NPCs
- [ ] Grupos/manadas de NPCs coordinados
- [ ] Habilidades especiales y hechizos para NPCs
- [ ] Sistema de agresividad por facción
- [ ] NPCs comerciantes funcionales
- [ ] NPCs de quest con diálogos
- [ ] Sistema de banco con NPCs banqueros

## Debugging

Para ver logs detallados del sistema de NPCs, busca en la consola del servidor:

- `🎮 Inicializando NPCManager...`
- `✨ NPC spawneado: [nombre]`
- `⚔️ [jugador] atacó a [NPC]`
- `💀 NPC [nombre] murió`
- `✨ NPC respawneado: [nombre]`

## Soporte

Para reportar bugs o sugerir mejoras al sistema de NPCs, crea un issue en el repositorio del proyecto.