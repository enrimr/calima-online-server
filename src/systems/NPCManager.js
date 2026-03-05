import NPC from '../models/NPC.js';
import NPCInstance from '../models/NPCInstance.js';
import Character from '../models/Character.js';
import { applyClassModifier } from '../config/experienceTable.js';
import { v4 as uuidv4 } from 'uuid';

class NPCManager {
  constructor(io) {
    this.io = io;
    this.activeNPCs = new Map(); // instanceId -> NPC instance data
    this.movementTimers = new Map(); // instanceId -> timer
    this.combatTimers = new Map(); // instanceId -> timer
    this.respawnTimers = new Map(); // instanceId -> timer
    
    // Configuración
    this.MOVEMENT_INTERVAL = 2000; // ms
    this.COMBAT_CHECK_INTERVAL = 1000; // ms
    this.MAX_CHASE_DISTANCE = 15; // tiles
  }

  // ==================== INITIALIZATION ====================

  async initialize() {
    console.log('🎮 Inicializando NPCManager...');
    
    try {
      // Limpiar instancias anteriores (por si el servidor se reinició)
      await NPCInstance.deleteMany({});
      console.log('🧹 Instancias de NPCs limpiadas');
      
      // Cargar tipos de NPCs activos
      const npcTypes = await NPC.find({ isActive: true });
      console.log(`📦 ${npcTypes.length} tipos de NPCs cargados`);
      
      // Spawnear NPCs iniciales
      for (const npcType of npcTypes) {
        await this.spawnNPCsByType(npcType);
      }
      
      console.log(`✅ NPCManager inicializado con ${this.activeNPCs.size} NPCs activos`);
      
      // Iniciar loop de respawn
      this.startRespawnLoop();
      
    } catch (error) {
      console.error('❌ Error al inicializar NPCManager:', error);
    }
  }

  // ==================== SPAWN SYSTEM ====================

  async spawnNPCsByType(npcType) {
    const { spawnConfig, npcTypeId } = npcType;
    
    if (!spawnConfig || !spawnConfig.spawnMaps) {
      return;
    }
    
    for (const mapConfig of spawnConfig.spawnMaps) {
      const { mapId, spawnPoints, maxInMap } = mapConfig;
      
      if (!spawnPoints || spawnPoints.length === 0) {
        continue;
      }
      
      // Spawnear hasta el máximo permitido en el mapa
      const spawnCount = Math.min(maxInMap || 5, spawnPoints.length);
      
      for (let i = 0; i < spawnCount; i++) {
        const spawnPoint = spawnPoints[i % spawnPoints.length];
        await this.spawnNPC(npcTypeId, mapId, spawnPoint.x, spawnPoint.y);
      }
    }
  }

  async spawnNPC(npcTypeId, mapId, x, y) {
    try {
      // Cargar datos del tipo de NPC
      const npcType = await NPC.findOne({ npcTypeId, isActive: true });
      
      if (!npcType) {
        console.error(`❌ Tipo de NPC ${npcTypeId} no encontrado`);
        return null;
      }
      
      // Validar que la posición de spawn no está bloqueada
      if (this.mapManager && !this.mapManager.isWalkable(mapId, x, y)) {
        console.error(`❌ No se puede spawnear ${npcType.name} en (${x}, ${y}) - tile bloqueado`);
        return null;
      }
      
      // Generar ID único para la instancia
      const instanceId = `npc_${npcTypeId}_${uuidv4()}`;
      
      // Crear instancia en BD
      const instance = await NPCInstance.create({
        npcTypeId,
        npcRef: npcType._id,
        instanceId,
        position: {
          x,
          y,
          map: mapId,
          heading: npcType.appearance.heading || 3
        },
        spawnPosition: {
          x,
          y,
          map: mapId
        },
        state: {
          isAlive: true,
          hp: npcType.stats.maxHp,
          maxHp: npcType.stats.maxHp,
          isMoving: false,
          isInCombat: false
        },
        target: {
          type: 'none',
          id: null
        },
        damageDealt: []
      });
      
      // Guardar en memoria para acceso rápido
      this.activeNPCs.set(instanceId, {
        instance,
        npcType,
        lastMovement: Date.now(),
        lastAttack: 0
      });
      
      // Broadcast a jugadores en el mapa
      this.io.to(mapId).emit('npc_spawned', {
        instanceId,
        npcTypeId,
        name: npcType.name,
        position: { x, y, map: mapId },
        appearance: npcType.appearance,
        stats: {
          hp: npcType.stats.maxHp,
          maxHp: npcType.stats.maxHp,
          level: npcType.stats.level
        },
        behavior: npcType.behavior,
        isAlive: true
      });
      
      // Iniciar movimiento si el NPC se mueve
      if (npcType.behavior.movement !== 'static') {
        this.startNPCMovement(instanceId);
      }
      
      // Iniciar AI si es hostil
      if (npcType.behavior.hostile) {
        this.startNPCAI(instanceId);
      }
      
      console.log(`✨ NPC spawneado: ${npcType.name} (${instanceId}) en ${mapId} (${x}, ${y})`);
      
      return instanceId;
      
    } catch (error) {
      console.error('❌ Error al spawnear NPC:', error);
      return null;
    }
  }

  // ==================== MOVEMENT SYSTEM ====================

  startNPCMovement(instanceId) {
    const npcData = this.activeNPCs.get(instanceId);
    if (!npcData) return;
    
    const { npcType } = npcData;
    const movementSpeed = npcType.behavior.movementSpeed || 2000;
    
    // Limpiar timer anterior si existe
    if (this.movementTimers.has(instanceId)) {
      clearInterval(this.movementTimers.get(instanceId));
    }
    
    // Crear nuevo timer
    const timer = setInterval(async () => {
      await this.moveNPC(instanceId);
    }, movementSpeed);
    
    this.movementTimers.set(instanceId, timer);
  }

  async moveNPC(instanceId) {
    const npcData = this.activeNPCs.get(instanceId);
    if (!npcData) return;
    
    const { instance, npcType } = npcData;
    
    // No moverse si está muerto o en combate
    if (!instance.state.isAlive || instance.state.isInCombat) {
      return;
    }
    
    const { movement } = npcType.behavior;
    
    if (movement === 'random') {
      await this.randomMovement(instanceId);
    } else if (movement === 'patrol') {
      await this.patrolMovement(instanceId);
    }
  }

  async randomMovement(instanceId) {
    const npcData = this.activeNPCs.get(instanceId);
    if (!npcData) return;
    
    const { instance } = npcData;
    const { x, y, map } = instance.position;
    
    // Movimiento aleatorio en 4 direcciones
    const directions = [
      { dx: 0, dy: -1, heading: 1 }, // Norte
      { dx: 1, dy: 0, heading: 2 },  // Este
      { dx: 0, dy: 1, heading: 3 },  // Sur
      { dx: -1, dy: 0, heading: 4 }  // Oeste
    ];
    
    const dir = directions[Math.floor(Math.random() * directions.length)];
    const newX = x + dir.dx;
    const newY = y + dir.dy;
    
    // Validar colisión con el mapa (tiles bloqueados)
    if (this.mapManager && !this.mapManager.isWalkable(map, newX, newY)) {
      return;
    }
    
    // Validar colisión con otros NPCs
    if (this.isPositionOccupiedByNPC(newX, newY, map, instanceId)) {
      return;
    }
    
    // Validar colisión con jugadores
    if (this.isPositionOccupiedByPlayer(newX, newY, map)) {
      return;
    }
    
    // Actualizar posición
    instance.position.x = newX;
    instance.position.y = newY;
    instance.position.heading = dir.heading;
    instance.lastMovement = Date.now();
    
    // Guardar sin bloquear (no await para evitar ParallelSaveError y DocumentNotFoundError)
    instance.save().catch(err => {
      // Silenciar errores comunes que no son críticos
      if (err.name !== 'ParallelSaveError' && err.name !== 'DocumentNotFoundError') {
        console.error('Error guardando movimiento de NPC:', err);
      }
    });
    
    // Actualizar en memoria
    npcData.lastMovement = Date.now();
    
    // Broadcast movimiento
    this.io.to(map).emit('npc_moved', {
      instanceId,
      position: {
        x: newX,
        y: newY,
        map,
        heading: dir.heading
      }
    });
  }

  async patrolMovement(instanceId) {
    // TODO: Implementar movimiento de patrulla
    // Por ahora usar movimiento aleatorio
    await this.randomMovement(instanceId);
  }

  // ==================== AI & COMBAT SYSTEM ====================

  startNPCAI(instanceId) {
    const npcData = this.activeNPCs.get(instanceId);
    if (!npcData) return;
    
    // Limpiar timer anterior si existe
    if (this.combatTimers.has(instanceId)) {
      clearInterval(this.combatTimers.get(instanceId));
    }
    
    // Crear nuevo timer
    const timer = setInterval(async () => {
      await this.updateNPCAI(instanceId);
    }, this.COMBAT_CHECK_INTERVAL);
    
    this.combatTimers.set(instanceId, timer);
  }

  async updateNPCAI(instanceId) {
    const npcData = this.activeNPCs.get(instanceId);
    if (!npcData) return;
    
    const { instance, npcType } = npcData;
    
    // No hacer nada si está muerto
    if (!instance.state.isAlive) {
      return;
    }
    
    // Si ya tiene un objetivo, atacarlo
    if (instance.target.type === 'player' && instance.target.id) {
      await this.attackTarget(instanceId);
      return;
    }
    
    // Buscar jugadores cercanos para atacar
    if (npcType.behavior.hostile) {
      await this.findAndAttackNearbyPlayers(instanceId);
    }
  }

  async findAndAttackNearbyPlayers(instanceId) {
    const npcData = this.activeNPCs.get(instanceId);
    if (!npcData) return;
    
    const { instance, npcType } = npcData;
    const { x, y, map } = instance.position;
    const chaseRange = npcType.behavior.chaseRange || 8;
    
    // Obtener jugadores en el mismo mapa (desde el servidor principal)
    const playersInMap = this.getPlayersInMap(map);
    
    // Buscar jugador más cercano dentro del rango
    let closestPlayer = null;
    let closestDistance = Infinity;
    
    for (const player of playersInMap) {
      // No atacar fantasmas o jugadores muertos
      if (player.isGhost || !player.isAlive || player.hp <= 0) {
        continue;
      }
      
      const dx = player.position.x - x;
      const dy = player.position.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= chaseRange && distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = player;
      }
    }
    
    // Si encontró un jugador, establecerlo como objetivo
    if (closestPlayer) {
      instance.target.type = 'player';
      instance.target.id = closestPlayer.socketId;
      instance.state.isInCombat = true;
      
      // Guardar sin bloquear
      instance.save().catch(err => {
        if (err.name !== 'ParallelSaveError' && err.name !== 'DocumentNotFoundError') {
          console.error('Error guardando objetivo de NPC:', err);
        }
      });
      
      await this.attackTarget(instanceId);
    }
  }

  async attackTarget(instanceId) {
    const npcData = this.activeNPCs.get(instanceId);
    if (!npcData) return;
    
    const { instance, npcType } = npcData;
    
    // Verificar cooldown de ataque
    const now = Date.now();
    const ATTACK_COOLDOWN = 2000; // 2 segundos
    
    if (npcData.lastAttack && (now - npcData.lastAttack) < ATTACK_COOLDOWN) {
      return;
    }
    
    // Verificar que el objetivo existe
    const target = this.getPlayer(instance.target.id);
    if (!target) {
      // Objetivo desapareció, resetear
      instance.target.type = 'none';
      instance.target.id = null;
      instance.state.isInCombat = false;
      
      // Guardar sin bloquear
      instance.save().catch(err => {
        if (err.name !== 'ParallelSaveError' && err.name !== 'DocumentNotFoundError') {
          console.error('Error guardando reset de objetivo NPC:', err);
        }
      });
      return;
    }
    
    // Verificar que el objetivo está en el mismo mapa
    if (target.map !== instance.position.map) {
      console.log(`🗺️ NPC ${npcType.name} deja de perseguir a ${target.username} (cambió de mapa)`);
      
      // Resetear objetivo
      instance.target.type = 'none';
      instance.target.id = null;
      instance.state.isInCombat = false;
      
      // Guardar sin bloquear
      instance.save().catch(err => {
        if (err.name !== 'ParallelSaveError' && err.name !== 'DocumentNotFoundError') {
          console.error('Error guardando reset de objetivo NPC:', err);
        }
      });
      return;
    }
    
    // Verificar que el objetivo sigue vivo (NO atacar fantasmas/muertos)
    if (target.isGhost || !target.isAlive || target.hp <= 0) {
      console.log(`👻 NPC ${npcType.name} deja de perseguir a ${target.username} (ahora es fantasma)`);
      
      // Resetear objetivo
      instance.target.type = 'none';
      instance.target.id = null;
      instance.state.isInCombat = false;
      
      // Guardar sin bloquear
      instance.save().catch(err => {
        if (err.name !== 'ParallelSaveError' && err.name !== 'DocumentNotFoundError') {
          console.error('Error guardando reset de objetivo NPC:', err);
        }
      });
      return;
    }
    
    // Verificar rango
    const dx = target.position.x - instance.position.x;
    const dy = target.position.y - instance.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const attackRange = npcType.behavior.attackRange || 1;
    
    if (distance > attackRange) {
      // Fuera de rango, perseguir
      await this.chaseTarget(instanceId, target);
      return;
    }
    
    // Calcular daño
    const minHit = npcType.stats.minHit || 1;
    const maxHit = npcType.stats.maxHit || 5;
    const damage = Math.floor(Math.random() * (maxHit - minHit + 1)) + minHit;
    
    // Actualizar cooldown
    npcData.lastAttack = now;
    instance.target.lastAttackTime = new Date();
    
    // Guardar sin bloquear
    instance.save().catch(err => {
      if (err.name !== 'ParallelSaveError' && err.name !== 'DocumentNotFoundError') {
        console.error('Error guardando ataque de NPC:', err);
      }
    });
    
    // Enviar evento de ataque al jugador objetivo
    this.io.to(instance.target.id).emit('npc_attacked_player', {
      instanceId,
      npcName: npcType.name,
      damage,
      timestamp: now
    });
    
    // Broadcast a espectadores
    this.io.to(instance.position.map).emit('npc_combat_action', {
      instanceId,
      npcName: npcType.name,
      targetSocketId: instance.target.id,
      targetName: target.username,
      damage
    });
    
    console.log(`⚔️ NPC ${npcType.name} atacó a ${target.username} por ${damage} de daño`);
  }

  async chaseTarget(instanceId, target) {
    const npcData = this.activeNPCs.get(instanceId);
    if (!npcData) return;
    
    const { instance, npcType } = npcData;
    const { x, y, map } = instance.position;
    
    let newX = x;
    let newY = y;
    let heading = instance.position.heading;
    
    // Verificar si este NPC puede usar pathfinding
    const canPathfind = npcType.behavior.canPathfind || false;
    
    if (canPathfind && this.mapManager) {
      // Usar pathfinding A* para encontrar el camino
      const path = this.findPath(map, x, y, target.position.x, target.position.y, instanceId);
      
      if (path && path.length > 0) {
        // Tomar el primer paso del camino
        const nextStep = path[0];
        newX = nextStep.x;
        newY = nextStep.y;
        
        // Calcular heading basado en la dirección del movimiento
        const dx = newX - x;
        const dy = newY - y;
        if (dx > 0) heading = 2; // Este
        else if (dx < 0) heading = 4; // Oeste
        else if (dy > 0) heading = 3; // Sur
        else if (dy < 0) heading = 1; // Norte
      } else {
        // No hay camino disponible, el NPC se queda en su posición
        return;
      }
    } else {
      // Movimiento simple sin pathfinding (comportamiento original)
      const dx = target.position.x - x;
      const dy = target.position.y - y;
      
      // Moverse hacia el objetivo
      if (Math.abs(dx) > Math.abs(dy)) {
        newX += dx > 0 ? 1 : -1;
        heading = dx > 0 ? 2 : 4; // Este u Oeste
      } else {
        newY += dy > 0 ? 1 : -1;
        heading = dy > 0 ? 3 : 1; // Sur o Norte
      }
      
      // Validar colisión con el mapa (tiles bloqueados)
      if (this.mapManager && !this.mapManager.isWalkable(map, newX, newY)) {
        return;
      }
      
      // Validar colisión con otros NPCs
      if (this.isPositionOccupiedByNPC(newX, newY, map, instanceId)) {
        return;
      }
      
      // Validar colisión con jugadores (SIEMPRE, sin excepciones)
      if (this.isPositionOccupiedByPlayer(newX, newY, map)) {
        return;
      }
    }
    
    // Actualizar posición
    instance.position.x = newX;
    instance.position.y = newY;
    instance.position.heading = heading;
    instance.lastMovement = Date.now();
    
    // Guardar sin bloquear (no await para evitar ParallelSaveError y DocumentNotFoundError)
    instance.save().catch(err => {
      if (err.name !== 'ParallelSaveError' && err.name !== 'DocumentNotFoundError') {
        console.error('Error guardando persecución de NPC:', err);
      }
    });
    
    // Broadcast movimiento
    this.io.to(instance.position.map).emit('npc_moved', {
      instanceId,
      position: {
        x: newX,
        y: newY,
        map: instance.position.map,
        heading
      }
    });
  }

  // ==================== DAMAGE & DEATH SYSTEM ====================

  async damageNPC(instanceId, attackerSocketId, attackerName, damage) {
    const npcData = this.activeNPCs.get(instanceId);
    if (!npcData) {
      return { success: false, reason: 'NPC no encontrado' };
    }
    
    const { instance, npcType } = npcData;
    
    // Verificar que está vivo
    if (!instance.state.isAlive) {
      return { success: false, reason: 'NPC ya está muerto' };
    }
    
    // Registrar daño
    instance.damageDealt.push({
      playerId: attackerSocketId,
      playerName: attackerName,
      damage,
      timestamp: new Date()
    });
    
    // Aplicar daño
    const oldHp = instance.state.hp;
    instance.state.hp = Math.max(0, instance.state.hp - damage);
    const died = instance.state.hp === 0;
    
    if (died) {
      instance.state.isAlive = false;
      instance.deathTime = new Date();
      
      // Programar respawn
      instance.respawnScheduled = true;
      instance.respawnAt = new Date(Date.now() + npcType.spawnConfig.respawnTime);
    } else {
      // Si es hostil y no estaba en combate, establecer al atacante como objetivo
      if (npcType.behavior.hostile && instance.target.type === 'none') {
        instance.target.type = 'player';
        instance.target.id = attackerSocketId;
        instance.state.isInCombat = true;
      }
    }
    
    await instance.save();
    
    // Broadcast cambio de HP
    this.io.to(instance.position.map).emit('npc_hp_changed', {
      instanceId,
      hp: instance.state.hp,
      maxHp: instance.state.maxHp,
      damage,
      attackerName
    });
    
    console.log(`⚔️ ${attackerName} atacó a ${npcType.name} por ${damage} de daño (HP: ${oldHp} → ${instance.state.hp})`);
    
    if (died) {
      await this.handleNPCDeath(instanceId);
    }
    
    return {
      success: true,
      died,
      newHp: instance.state.hp,
      maxHp: instance.state.maxHp
    };
  }

  async handleNPCDeath(instanceId) {
    const npcData = this.activeNPCs.get(instanceId);
    if (!npcData) return;
    
    const { instance, npcType } = npcData;
    
    console.log(`💀 NPC ${npcType.name} (${instanceId}) murió`);
    
    // Detener movimiento y AI
    this.stopNPCTimers(instanceId);
    
    // Calcular y distribuir recompensas
    const rewards = instance.calculateRewards(
      npcType.rewards.experience,
      npcType.rewards.gold
    );
    
    // Distribuir experiencia y oro a los jugadores
    console.log(`\n💰 DISTRIBUYENDO RECOMPENSAS DE ${npcType.name}:`);
    console.log(`  Total jugadores participantes: ${rewards.distribution.length}`);
    
    for (const reward of rewards.distribution) {
      console.log(`\n  Procesando recompensa para ${reward.playerName} (${reward.playerId}):`);
      console.log(`    EXP: ${reward.experience}, Oro: ${reward.gold}, Killer: ${reward.wasKiller}`);
      
      const player = this.getPlayer(reward.playerId);
      if (!player) {
        console.error(`    ❌ Jugador no encontrado en connectedPlayers`);
        continue;
      }
      
      console.log(`    ✅ Jugador encontrado: ${player.username}`);
      
      // Actualizar experiencia y oro del jugador en la BD
      console.log(`    🔄 Actualizando stats en BD...`);
      await this.updatePlayerRewards(reward.playerId, reward.experience, reward.gold);
      console.log(`    ✅ Stats actualizados en BD`);
      
      console.log(`    📤 Enviando evento npc_reward al cliente...`);
      this.io.to(reward.playerId).emit('npc_reward', {
        instanceId,
        npcName: npcType.name,
        experience: reward.experience,
        gold: reward.gold,
        wasKiller: reward.wasKiller
      });
      console.log(`    ✅ Evento npc_reward enviado`);
      
      console.log(`💰 ${reward.playerName} recibió ${reward.experience} EXP y ${reward.gold} oro (killer: ${reward.wasKiller})`);
    }
    console.log(`\n✅ RECOMPENSAS DISTRIBUIDAS\n`);
    
    // Dropear items
    await this.dropNPCLoot(instanceId);
    
    // Broadcast muerte
    this.io.to(instance.position.map).emit('npc_died', {
      instanceId,
      npcName: npcType.name,
      position: instance.position
    });
    
    // Programar respawn
    this.scheduleRespawn(instanceId);
  }

  async dropNPCLoot(instanceId) {
    const npcData = this.activeNPCs.get(instanceId);
    if (!npcData) return;
    
    const { instance, npcType } = npcData;
    const { rewards } = npcType;
    
    if (!rewards.items || rewards.items.length === 0) {
      return;
    }
    
    const droppedItems = [];
    
    // Determinar qué items se dropean
    for (const itemConfig of rewards.items) {
      const roll = Math.random();
      
      if (roll <= itemConfig.dropChance) {
        const amount = Math.floor(
          Math.random() * (itemConfig.maxAmount - itemConfig.minAmount + 1)
        ) + itemConfig.minAmount;
        
        droppedItems.push({
          itemId: itemConfig.itemId,
          amount
        });
      }
    }
    
    if (droppedItems.length > 0) {
      // Broadcast items dropeados en la posición del NPC
      this.io.to(instance.position.map).emit('npc_loot_dropped', {
        instanceId,
        position: instance.position,
        items: droppedItems
      });
      
      console.log(`📦 ${npcType.name} dropeó ${droppedItems.length} items`);
    }
  }

  // ==================== RESPAWN SYSTEM ====================

  startRespawnLoop() {
    setInterval(async () => {
      await this.checkRespawns();
    }, 5000); // Cada 5 segundos
  }

  async checkRespawns() {
    try {
      const now = new Date();
      
      // Buscar NPCs listos para respawn
      const readyToRespawn = await NPCInstance.find({
        respawnScheduled: true,
        respawnAt: { $lte: now }
      });
      
      for (const instance of readyToRespawn) {
        await this.respawnNPC(instance.instanceId);
      }
      
    } catch (error) {
      console.error('❌ Error en checkRespawns:', error);
    }
  }

  scheduleRespawn(instanceId) {
    const npcData = this.activeNPCs.get(instanceId);
    if (!npcData) return;
    
    const { npcType } = npcData;
    const respawnTime = npcType.spawnConfig.respawnTime || 15000;
    
    console.log(`⏰ ${npcType.name} respawneará en ${respawnTime / 1000} segundos`);
  }

  async respawnNPC(instanceId) {
    try {
      const instance = await NPCInstance.findOne({ instanceId });
      if (!instance) return;
      
      const npcType = await NPC.findOne({ npcTypeId: instance.npcTypeId });
      if (!npcType) return;
      
      // Resetear estado
      instance.state.isAlive = true;
      instance.state.hp = npcType.stats.maxHp;
      instance.state.maxHp = npcType.stats.maxHp;
      instance.state.isInCombat = false;
      instance.target.type = 'none';
      instance.target.id = null;
      instance.damageDealt = [];
      instance.respawnScheduled = false;
      instance.respawnAt = null;
      instance.deathTime = null;
      
      // Respawnear en posición original
      instance.position.x = instance.spawnPosition.x;
      instance.position.y = instance.spawnPosition.y;
      instance.position.heading = npcType.appearance.heading || 3;
      
      instance.spawnedAt = new Date();
      
      await instance.save();
      
      // Actualizar en memoria
      this.activeNPCs.set(instanceId, {
        instance,
        npcType,
        lastMovement: Date.now(),
        lastAttack: 0
      });
      
      // Broadcast respawn
      this.io.to(instance.position.map).emit('npc_respawned', {
        instanceId,
        npcTypeId: npcType.npcTypeId,
        name: npcType.name,
        position: {
          x: instance.position.x,
          y: instance.position.y,
          map: instance.position.map
        },
        appearance: npcType.appearance,
        stats: {
          hp: instance.state.hp,
          maxHp: instance.state.maxHp,
          level: npcType.stats.level
        },
        behavior: npcType.behavior
      });
      
      // Reiniciar timers
      if (npcType.behavior.movement !== 'static') {
        this.startNPCMovement(instanceId);
      }
      
      if (npcType.behavior.hostile) {
        this.startNPCAI(instanceId);
      }
      
      console.log(`✨ NPC respawneado: ${npcType.name} (${instanceId})`);
      
    } catch (error) {
      console.error('❌ Error al respawnear NPC:', error);
    }
  }

  // ==================== PATHFINDING SYSTEM ====================

  /**
   * Implementación del algoritmo A* para pathfinding
   * @param {string} mapId - ID del mapa
   * @param {number} startX - X inicial
   * @param {number} startY - Y inicial
   * @param {number} goalX - X destino
   * @param {number} goalY - Y destino
   * @param {string} excludeInstanceId - ID del NPC a excluir en colisiones
   * @returns {Array|null} Array de posiciones [{x, y}] o null si no hay camino
   */
  findPath(mapId, startX, startY, goalX, goalY, excludeInstanceId = null) {
    // Heurística: distancia Manhattan
    const heuristic = (x, y) => Math.abs(x - goalX) + Math.abs(y - goalY);
    
    // Nodo del algoritmo A*
    class Node {
      constructor(x, y, g, h, parent = null) {
        this.x = x;
        this.y = y;
        this.g = g; // Costo desde el inicio
        this.h = h; // Heurística al destino
        this.f = g + h; // Costo total
        this.parent = parent;
      }
    }
    
    const openSet = [new Node(startX, startY, 0, heuristic(startX, startY))];
    const closedSet = new Set();
    const visited = new Map();
    
    visited.set(`${startX},${startY}`, 0);
    
    // Limitar iteraciones para evitar bucles infinitos
    const MAX_ITERATIONS = 200;
    let iterations = 0;
    
    while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      
      // Obtener nodo con menor f
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();
      
      // ¿Llegamos al destino?
      if (current.x === goalX && current.y === goalY) {
        // Reconstruir camino
        const path = [];
        let node = current;
        while (node.parent) {
          path.unshift({ x: node.x, y: node.y });
          node = node.parent;
        }
        return path;
      }
      
      closedSet.add(`${current.x},${current.y}`);
      
      // Explorar vecinos (4 direcciones)
      const neighbors = [
        { x: current.x, y: current.y - 1 }, // Norte
        { x: current.x + 1, y: current.y }, // Este
        { x: current.x, y: current.y + 1 }, // Sur
        { x: current.x - 1, y: current.y }  // Oeste
      ];
      
      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.y}`;
        
        // Saltar si ya está en closed set
        if (closedSet.has(key)) continue;
        
        // Verificar colisiones
        const isWalkable = !this.mapManager || this.mapManager.isWalkable(mapId, neighbor.x, neighbor.y);
        const hasNPC = this.isPositionOccupiedByNPC(neighbor.x, neighbor.y, mapId, excludeInstanceId);
        const hasPlayer = this.isPositionOccupiedByPlayer(neighbor.x, neighbor.y, mapId);
        
        // Permitir el destino incluso si hay un jugador (para atacar)
        const isGoal = neighbor.x === goalX && neighbor.y === goalY;
        
        if (!isWalkable || hasNPC || (hasPlayer && !isGoal)) {
          continue;
        }
        
        const g = current.g + 1;
        const h = heuristic(neighbor.x, neighbor.y);
        
        // Si ya visitamos este nodo con mejor costo, saltar
        if (visited.has(key) && visited.get(key) <= g) {
          continue;
        }
        
        visited.set(key, g);
        openSet.push(new Node(neighbor.x, neighbor.y, g, h, current));
      }
    }
    
    // No se encontró camino
    return null;
  }

  // ==================== COLLISION DETECTION ====================

  isPositionOccupiedByNPC(x, y, mapId, excludeInstanceId = null) {
    for (const [instanceId, npcData] of this.activeNPCs) {
      // Excluir el NPC actual
      if (instanceId === excludeInstanceId) {
        continue;
      }
      
      const { instance } = npcData;
      
      // Solo verificar NPCs vivos en el mismo mapa
      if (instance.position.map === mapId && 
          instance.state.isAlive && 
          instance.position.x === x && 
          instance.position.y === y) {
        return true;
      }
    }
    
    return false;
  }

  isPositionOccupiedByPlayer(x, y, mapId) {
    const playersInMap = this.getPlayersInMap(mapId);
    
    for (const player of playersInMap) {
      if (player.position.x === x && player.position.y === y) {
        return true;
      }
    }
    
    return false;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Actualizar las recompensas (experiencia y oro) de un jugador
   * @param {string} playerId - Socket ID del jugador
   * @param {number} experience - Experiencia base ganada
   * @param {number} gold - Oro ganado
   */
  async updatePlayerRewards(playerId, experience, gold) {
    try {
      // Usar this.getPlayer() que está asignado desde server.js con connectedPlayers
      const player = this.getPlayer(playerId);
      
      if (!player) {
        console.error(`❌ No se pudo encontrar jugador con ID: ${playerId}`);
        return;
      }

      console.log(`  ✅ Jugador encontrado: ${player.username} (${player.characterId})`);

      // Buscar el personaje en la BD
      const character = await Character.findById(player.characterId);
      
      if (!character) {
        console.error(`❌ No se pudo encontrar personaje en BD: ${player.characterId}`);
        return;
      }

      // Aplicar modificador de clase a la experiencia
      const modifiedExp = applyClassModifier(experience, character.class);
      console.log(`  💫 EXP modificada por clase ${character.class}: ${experience} → ${modifiedExp}`);

      // Añadir oro primero
      character.stats.gold = (character.stats.gold || 0) + gold;

      // Añadir experiencia y verificar level ups
      const result = character.addExperience(modifiedExp);

      // Guardar cambios en BD
      await character.save();

      console.log(`📈 ${player.username}: +${modifiedExp} EXP (${result.currentExp}/${result.expForNext}), +${gold} oro (${character.stats.gold})`);

      // Si hubo level ups, notificar al jugador
      if (result.levelUps && result.levelUps.length > 0) {
        console.log(`\n🎉🎉🎉 ${player.username} SUBIÓ ${result.levelUps.length} NIVEL(ES)! 🎉🎉🎉`);
        
        for (const levelUp of result.levelUps) {
          console.log(`  Nivel: ${levelUp.oldLevel} → ${levelUp.newLevel}`);
          console.log(`  HP: +${levelUp.hpGained} → ${levelUp.newMaxHp} (curado a ${character.stats.hp})`);
          console.log(`  Mana: +${levelUp.manaGained} → ${levelUp.newMaxMana} (curado a ${character.stats.mana})`);
          console.log(`  Stats:`, levelUp.newStats);
        }
        
        console.log(`  EXP sobrante: ${result.currentExp}/${result.expForNext}\n`);

        // Enviar evento detallado de level up al cliente
        console.log(`  📤 Enviando evento level_up al cliente...`);
        this.io.to(playerId).emit('level_up', {
          levelsGained: result.levelUps.length,
          newLevel: result.currentLevel,
          currentExp: result.currentExp,
          expForNext: result.expForNext,
          newMaxHp: character.stats.maxHp,
          newMaxMana: character.stats.maxMana,
          newMaxStamina: character.stats.maxStamina,
          currentHp: character.stats.hp,
          currentMana: character.stats.mana,
          currentStamina: character.stats.stamina,
          newStats: result.levelUps[result.levelUps.length - 1].newStats,
          levelUpDetails: result.levelUps
        });
        console.log(`  ✅ Evento level_up enviado\n`);

        // Actualizar el nivel en connectedPlayers (ya tenemos la referencia del objeto, basta con mutarlo)
        player.level = result.currentLevel;
      }

      // Siempre enviar actualización de stats (incluso sin level up)
      this.io.to(playerId).emit('stats_update', {
        experience: result.currentExp,
        expForNext: result.expForNext,
        gold: character.stats.gold,
        level: result.currentLevel,
        hp: character.stats.hp,
        maxHp: character.stats.maxHp,
        mana: character.stats.mana,
        maxMana: character.stats.maxMana
      });

    } catch (error) {
      console.error('❌ Error al actualizar recompensas:', error);
    }
  }

  /**
   * Limpiar un jugador como objetivo de todos los NPCs
   * Se llama cuando un jugador muere o se desconecta
   */
  async clearPlayerAsTarget(socketId) {
    console.log(`\n🧹🧹🧹 LIMPIANDO ${socketId} COMO OBJETIVO DE NPCs 🧹🧹🧹`);
    console.log(`  Total NPCs activos: ${this.activeNPCs.size}`);
    
    let clearedCount = 0;
    let checkedCount = 0;
    
    for (const [instanceId, npcData] of this.activeNPCs) {
      checkedCount++;
      const { instance, npcType } = npcData;
      
      console.log(`  Revisando NPC ${checkedCount}/${this.activeNPCs.size}: ${npcType.name} (${instanceId})`);
      console.log(`    Target: type=${instance.target.type}, id=${instance.target.id}`);
      console.log(`    ¿Es el objetivo?: ${instance.target.type === 'player' && instance.target.id === socketId}`);
      
      // Si este NPC tiene al jugador como objetivo
      if (instance.target.type === 'player' && instance.target.id === socketId) {
        console.log(`    ✓✓✓ ${npcType.name} ESTABA PERSIGUIENDO - RESETEANDO`);
        
        // Resetear objetivo
        instance.target.type = 'none';
        instance.target.id = null;
        instance.state.isInCombat = false;
        
        // Actualizar en memoria también
        npcData.instance = instance;
        
        // Guardar en BD (await para asegurar que se guarda)
        try {
          await instance.save();
          console.log(`    ✓ Guardado en BD exitosamente`);
        } catch (err) {
          if (err.name !== 'ParallelSaveError') {
            console.error(`    ❌ Error guardando: ${err.message}`);
          }
        }
        
        clearedCount++;
      }
    }
    
    console.log(`\n📊 RESUMEN DE LIMPIEZA:`);
    console.log(`  NPCs revisados: ${checkedCount}`);
    console.log(`  NPCs limpiados: ${clearedCount}`);
    
    if (clearedCount > 0) {
      console.log(`✅✅✅ ${clearedCount} NPC(s) DEJARON DE PERSEGUIR\n`);
    } else {
      console.log(`ℹ️ Ningún NPC estaba persiguiendo a este jugador\n`);
    }
  }

  stopNPCTimers(instanceId) {
    if (this.movementTimers.has(instanceId)) {
      clearInterval(this.movementTimers.get(instanceId));
      this.movementTimers.delete(instanceId);
    }
    
    if (this.combatTimers.has(instanceId)) {
      clearInterval(this.combatTimers.get(instanceId));
      this.combatTimers.delete(instanceId);
    }
  }

  getPlayersInMap(mapId) {
    // Esta función debe ser proporcionada por el servidor principal
    // Por ahora retornamos array vacío
    return [];
  }

  getPlayer(socketId) {
    // Esta función debe ser proporcionada por el servidor principal
    // Por ahora retornamos null
    return null;
  }

  async getNPCsInMap(mapId) {
    const npcsInMap = [];
    
    for (const [instanceId, npcData] of this.activeNPCs) {
      const { instance, npcType } = npcData;
      
      if (instance.position.map === mapId && instance.state.isAlive) {
        npcsInMap.push({
          instanceId,
          npcTypeId: npcType.npcTypeId,
          name: npcType.name,
          position: instance.position,
          appearance: npcType.appearance,
          stats: {
            hp: instance.state.hp,
            maxHp: instance.state.maxHp,
            level: npcType.stats.level
          },
          behavior: npcType.behavior,
          isAlive: true
        });
      }
    }
    
    return npcsInMap;
  }

  // ==================== CLEANUP ====================

  cleanup() {
    console.log('🧹 Limpiando NPCManager...');
    
    // Detener todos los timers
    for (const [instanceId] of this.activeNPCs) {
      this.stopNPCTimers(instanceId);
    }
    
    this.activeNPCs.clear();
    this.movementTimers.clear();
    this.combatTimers.clear();
    this.respawnTimers.clear();
    
    console.log('✅ NPCManager limpiado');
  }
}

export default NPCManager;