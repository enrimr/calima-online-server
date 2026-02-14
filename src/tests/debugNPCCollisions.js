/**
 * Script de debugging para sistema de colisiones de NPCs
 * Muestra información detallada sobre tiles, colisiones y movimiento
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getInstance as getMapManager } from '../systems/MapManager.js';
import NPCManager from '../systems/NPCManager.js';
import NPC from '../models/NPC.js';

dotenv.config();

async function debugNPCCollisions() {
  console.log('\n🔍 ===== DEBUG DE COLISIONES DE NPCs =====\n');
  
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');
    
    // Inicializar MapManager
    const mapManager = getMapManager();
    await mapManager.loadAllMaps();
    console.log('✅ MapManager inicializado\n');
    
    // Mostrar información de los mapas cargados
    console.log('📋 MAPAS CARGADOS:');
    const stats = mapManager.getStats();
    console.log(`Total de mapas: ${stats.totalMaps}\n`);
    
    for (const map of stats.maps) {
      console.log(`Mapa: ${map.id}`);
      console.log(`  Nombre: ${map.name}`);
      console.log(`  Tipo: ${map.type}`);
      console.log(`  Dimensiones: ${map.dimensions.width}x${map.dimensions.height}`);
      console.log(`  Zona segura: ${map.safeZone}`);
      console.log(`  Portales: ${map.hasPortals}`);
      console.log(`  NPCs: ${map.hasNPCs}`);
      console.log(`  Enemigos: ${map.hasEnemies}\n`);
    }
    
    // Probar colisiones en un mapa específico
    const testMapId = 'newbie_city';
    console.log(`\n🗺️ PROBANDO COLISIONES EN MAPA: ${testMapId}\n`);
    
    const map = mapManager.getMap(testMapId);
    if (!map) {
      console.error(`❌ Mapa ${testMapId} no encontrado`);
      process.exit(1);
    }
    
    console.log('📊 ESTRUCTURA DEL MAPA:');
    console.log(`  Nombre: ${map.name}`);
    console.log(`  Tipo: ${map.type}`);
    console.log(`  Tiene layers: ${!!map.layers}`);
    if (map.layers) {
      console.log(`  - base: ${map.layers.base ? 'Sí' : 'No'}`);
      console.log(`  - props: ${map.layers.props ? 'Sí' : 'No'}`);
      console.log(`  - doors: ${map.layers.doors ? 'Sí' : 'No'}`);
      console.log(`  - roofs: ${map.layers.roofs ? 'Sí' : 'No'}`);
    }
    console.log('');
    
    // Probar tiles específicos
    console.log('🎯 PROBANDO TILES ESPECÍFICOS:\n');
    
    const testPositions = [
      { x: 5, y: 5, description: 'Esquina superior izquierda' },
      { x: 50, y: 50, description: 'Centro del mapa (spawn Sacerdote)' },
      { x: 15, y: 15, description: 'Spawn Goblin #1' },
      { x: 18, y: 18, description: 'Spawn Araña #1' },
      { x: 22, y: 22, description: 'Spawn Lobo #1' },
      { x: 0, y: 0, description: 'Borde del mapa' },
      { x: 99, y: 99, description: 'Esquina inferior derecha' }
    ];
    
    for (const pos of testPositions) {
      const isWalkable = mapManager.isWalkable(testMapId, pos.x, pos.y);
      
      // Obtener información del tile
      let tileInfo = 'N/A';
      if (map.layers && map.layers.base && map.layers.base[pos.y]) {
        const baseTile = map.layers.base[pos.y][pos.x];
        tileInfo = `base=${baseTile}`;
        
        if (map.layers.props && map.layers.props[pos.y] && map.layers.props[pos.y][pos.x]) {
          tileInfo += `, prop=${map.layers.props[pos.y][pos.x]}`;
        }
      }
      
      console.log(`Posición (${pos.x}, ${pos.y}) - ${pos.description}`);
      console.log(`  Caminable: ${isWalkable ? '✅ SÍ' : '❌ NO'}`);
      console.log(`  Tile: ${tileInfo}\n`);
    }
    
    // Probar con NPCs reales
    console.log('\n🎭 PROBANDO CON NPCs DE LA BASE DE DATOS:\n');
    
    const npcs = await NPC.find({ isActive: true });
    console.log(`Total de tipos de NPCs activos: ${npcs.length}\n`);
    
    for (const npcType of npcs) {
      console.log(`NPC: ${npcType.name} (ID: ${npcType.npcTypeId})`);
      console.log(`  Tipo: ${npcType.type}`);
      console.log(`  Hostil: ${npcType.behavior.hostile}`);
      console.log(`  Movimiento: ${npcType.behavior.movement}`);
      console.log(`  Pathfinding: ${npcType.behavior.canPathfind ? '✅ Habilitado' : '❌ Deshabilitado'}`);
      console.log(`  Mapas de spawn: ${npcType.spawnConfig.spawnMaps.length}`);
      
      // Verificar spawn points
      for (const mapConfig of npcType.spawnConfig.spawnMaps) {
        console.log(`\n  Mapa: ${mapConfig.mapId}`);
        console.log(`  Puntos de spawn: ${mapConfig.spawnPoints.length}`);
        
        for (let i = 0; i < Math.min(3, mapConfig.spawnPoints.length); i++) {
          const sp = mapConfig.spawnPoints[i];
          const isWalkable = mapManager.isWalkable(mapConfig.mapId, sp.x, sp.y);
          console.log(`    - (${sp.x}, ${sp.y}): ${isWalkable ? '✅ Válido' : '❌ BLOQUEADO!'}`);
        }
      }
      console.log('');
    }
    
    // Probar movimiento simulado
    console.log('\n🚶 SIMULANDO MOVIMIENTOS:\n');
    
    // Crear una posición inicial válida
    const startPos = { x: 50, y: 50 };
    console.log(`Posición inicial: (${startPos.x}, ${startPos.y})`);
    console.log(`  Walkable: ${mapManager.isWalkable(testMapId, startPos.x, startPos.y)}\n`);
    
    // Probar movimientos en todas direcciones
    const directions = [
      { name: 'Norte', dx: 0, dy: -1 },
      { name: 'Este', dx: 1, dy: 0 },
      { name: 'Sur', dx: 0, dy: 1 },
      { name: 'Oeste', dx: -1, dy: 0 }
    ];
    
    for (const dir of directions) {
      const newX = startPos.x + dir.dx;
      const newY = startPos.y + dir.dy;
      const isWalkable = mapManager.isWalkable(testMapId, newX, newY);
      
      console.log(`${dir.name} → (${newX}, ${newY}): ${isWalkable ? '✅ Puede moverse' : '❌ Bloqueado'}`);
    }
    
    // Verificar tiles bloqueados configurados
    console.log('\n🚫 TILES BLOQUEADOS CONFIGURADOS:\n');
    console.log(`Base bloqueados: [${mapManager.BLOCKED_TILES.base.join(', ')}]`);
    console.log(`Props bloqueados: [${mapManager.BLOCKED_TILES.props.join(', ')}]`);
    
    // Buscar algunos tiles bloqueados en el mapa
    console.log('\n🔍 BUSCANDO TILES BLOQUEADOS EN EL MAPA:\n');
    if (map.layers && map.layers.base) {
      let blockedFound = 0;
      let walkableFound = 0;
      
      for (let y = 0; y < Math.min(10, map.layers.base.length); y++) {
        for (let x = 0; x < Math.min(10, map.layers.base[y].length); x++) {
          const baseTile = map.layers.base[y][x];
          const isWalkable = mapManager.isWalkable(testMapId, x, y);
          
          if (!isWalkable && blockedFound < 3) {
            console.log(`  Tile bloqueado en (${x}, ${y}): base=${baseTile}`);
            blockedFound++;
          } else if (isWalkable && walkableFound < 3) {
            console.log(`  Tile caminable en (${x}, ${y}): base=${baseTile}`);
            walkableFound++;
          }
          
          if (blockedFound >= 3 && walkableFound >= 3) break;
        }
        if (blockedFound >= 3 && walkableFound >= 3) break;
      }
    }
    
    console.log('\n✅ DEBUG COMPLETADO\n');
    
  } catch (error) {
    console.error('❌ Error durante el debug:', error);
  } finally {
    process.exit(0);
  }
}

// Ejecutar debug
debugNPCCollisions();