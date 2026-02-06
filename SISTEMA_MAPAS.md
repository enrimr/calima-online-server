# Sistema de Mapas Híbrido - Calima Online

## Arquitectura

Calima Online utiliza un **sistema híbrido de mapas** que combina lo mejor de dos mundos:
- **Servidor autoritario**: El servidor tiene todos los mapas y valida movimientos
- **Cliente optimizado**: El cliente tiene mapas precargados para renderizado inmediato

## ¿Por qué esta arquitectura?

### Problema Original
Los mapas solo existían en el cliente, lo que generaba problemas:
- ❌ El servidor no podía validar colisiones
- ❌ Vulnerable a cheating (teleport hacks, noclip, etc.)
- ❌ NPCs no podían navegar correctamente
- ❌ Imposible implementar pathfinding del servidor

### Solución Híbrida
```
┌─────────────┐         ┌─────────────┐
│   CLIENTE   │         │  SERVIDOR   │
├─────────────┤         ├─────────────┤
│ Mapas JSON  │◄────────┤ Mapas JSON  │
│ (precargado)│         │ (autoridad) │
│             │         │             │
│ - Renderiza │         │ - Valida    │
│ - Muestra   │ move(x,y│ - Colisiones│
│ - Animación │─────────►   - Portales│
│             │  ✓/✗    │   - Límites │
└─────────────┘         └─────────────┘
```

## Estructura de Directorios

```
calima-online/
├── calima-online-client/
│   └── js/
│       └── world/
│           └── maps/          # 17 mapas JSON (cliente)
│               ├── training_fields.json
│               ├── newbie_city.json
│               ├── forest_outskirts_1.json
│               └── ...
│
└── calima-online-server/
    └── src/
        ├── data/
        │   └── maps/          # 17 mapas JSON (servidor)
        │       ├── training_fields.json
        │       ├── newbie_city.json
        │       └── ...
        └── systems/
            └── MapManager.js  # Sistema de validación
```

## Formato de Mapas (JSON)

Cada mapa tiene esta estructura:

```json
{
  "name": "🏞️ Campos de Entrenamiento",
  "description": "Campos abiertos para entrenar",
  "type": "field",
  "safeZone": false,
  "worldPosition": {"x": 110, "y": 100},
  "layers": {
    "base": [[8,8,8,...], [8,0,0,...], ...],  // Terreno
    "props": [[0,0,0,...], [0,0,3,...], ...], // Objetos
    "roofs": [],
    "doors": [],
    "windows": []
  },
  "portals": [
    {
      "x": 1,
      "y": 20,
      "targetMap": "newbie_city",
      "targetX": 57,
      "targetY": 20,
      "name": "Ciudad"
    }
  ],
  "npcs": [...],
  "enemies": {...},
  "playerSpawn": {"x": 5, "y": 20}
}
```

## MapManager (Servidor)

### Responsabilidades

1. **Cargar Mapas**: Lee todos los JSON al iniciar
2. **Validar Movimientos**: Verifica colisiones antes de aceptar movimientos
3. **Detectar Portales**: Identifica cuando un jugador usa un portal
4. **Proporcionar Información**: NPCs, spawn points, dimensiones, etc.

### API Principal

```javascript
// Singleton
const mapManager = getMapManager();

// Cargar mapas (al iniciar servidor)
await mapManager.loadAllMaps();

// Validar movimiento
const validation = mapManager.validateMovement(
  'training_fields', // mapa actual
  10, 20,            // posición actual (x, y)
  11, 20             // posición destino (x, y)
);

if (validation.valid) {
  // Movimiento permitido
  if (validation.portal) {
    // Hay un portal en el destino
    console.log(`Portal a: ${validation.portal.targetMap}`);
  }
} else {
  // Movimiento bloqueado
  console.log(`Razón: ${validation.reason}`);
}

// Verificar si una casilla es caminable
const walkable = mapManager.isWalkable('training_fields', 10, 20);

// Obtener spawn position
const spawn = mapManager.getSpawnPosition('newbie_city');

// Obtener dimensiones
const { width, height } = mapManager.getMapDimensions('training_fields');
```

### Tiles Bloqueados

```javascript
BLOCKED_TILES = {
  base: [4, 8],  // 4=montaña, 8=agua/bordes
  props: [2, 3]  // 2,3=árboles/obstáculos
}
```

## Flujo de Movimiento

### 1. Cliente Solicita Movimiento

```javascript
// Cliente: js/core/Movement.js
socket.emit('player_move', {
  x: 11,
  y: 20,
  map: 'training_fields'
});
```

### 2. Servidor Valida

```javascript
// Servidor: src/server.js
socket.on('player_move', async (data) => {
  const { x, y, map } = data;
  const player = connectedPlayers.get(socket.id);
  
  // VALIDACIÓN CON MAPMANAGER
  const validation = mapManager.validateMovement(
    player.map,
    player.position.x,
    player.position.y,
    x,
    y
  );
  
  if (!validation.valid) {
    // ❌ RECHAZAR MOVIMIENTO
    socket.emit('movement_rejected', {
      reason: validation.reason,
      correctPosition: player.position
    });
    return;
  }
  
  // ✅ ACEPTAR MOVIMIENTO
  player.position = { x, y };
  
  // Notificar a otros jugadores
  socket.to(player.map).emit('player_moved', {
    socketId: socket.id,
    position: player.position
  });
});
```

### 3. Cliente Recibe Confirmación

```javascript
// Si es rechazado
socket.on('movement_rejected', (data) => {
  console.log(`Movimiento rechazado: ${data.reason}`);
  // Corregir posición
  player.setPosition(data.correctPosition);
});
```

## Validaciones Implementadas

### ✅ Límites del Mapa
```javascript
if (x < 0 || y < 0 || x >= width || y >= height) {
  return { valid: false, reason: 'Fuera de límites' };
}
```

### ✅ Movimiento Adyacente
```javascript
const dx = Math.abs(toX - fromX);
const dy = Math.abs(toY - fromY);

if (dx > 1 || dy > 1) {
  return { valid: false, reason: 'Movimiento no adyacente' };
}
```

### ✅ Tiles Bloqueados
```javascript
// Base layer (terreno)
if (BLOCKED_TILES.base.includes(baseTile)) {
  return { valid: false, reason: 'Posición bloqueada' };
}

// Props layer (objetos)
if (BLOCKED_TILES.props.includes(propTile)) {
  return { valid: false, reason: 'Posición bloqueada' };
}
```

### ✅ Puertas
```javascript
if (doorTile > 0) {
  return { valid: false, reason: 'Puerta cerrada' };
}
```

### ✅ Portales
```javascript
const portal = mapManager.getPortalAt(mapId, x, y);
if (portal) {
  return {
    valid: true,
    portal: portal  // Cliente maneja transición
  };
}
```

## Casos de Uso

### 1. Pathfinding de NPCs

```javascript
// NPCManager puede usar MapManager para navegación
const path = findPath(startX, startY, endX, endY, mapId);

function findPath(fromX, fromY, toX, toY, mapId) {
  // A* pathfinding usando MapManager
  const neighbors = getWalkableNeighbors(fromX, fromY, mapId);
  // ...
}

function getWalkableNeighbors(x, y, mapId) {
  const neighbors = [];
  const directions = [[0,1], [1,0], [0,-1], [-1,0]];
  
  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;
    
    if (mapManager.isWalkable(mapId, nx, ny)) {
      neighbors.push({ x: nx, y: ny });
    }
  }
  
  return neighbors;
}
```

### 2. Spawn Aleatorio de Enemigos

```javascript
// Buscar posición caminable aleatoria
const spawnPos = mapManager.findRandomWalkablePosition(
  'dark_forest_north',
  100  // max intentos
);

if (spawnPos) {
  spawnEnemy('goblin', spawnPos.x, spawnPos.y);
}
```

### 3. Verificación de Zona Segura

```javascript
// Antes de permitir PvP
const isSafe = mapManager.isSafeZone(player.map);

if (isSafe) {
  return { success: false, reason: 'No se puede atacar en zona segura' };
}
```

## Mantenimiento

### Actualizar Mapas

Cuando cambies un mapa:

1. **Edita en cliente**: `calima-online-client/js/world/maps/MAPA.json`
2. **Copia a servidor**: `cp` al directorio del servidor
3. **Reinicia servidor**: Para recargar mapas

```bash
# Desde el directorio raíz
cp calima-online-client/js/world/maps/training_fields.json \
   calima-online-server/src/data/maps/training_fields.json

# Reiniciar servidor
cd calima-online-server
npm restart
```

### Agregar Nuevo Mapa

1. Crear JSON en ambos directorios (cliente y servidor)
2. El MapManager lo cargará automáticamente al reiniciar
3. Actualizar `PreloadedMaps.js` en el cliente si es necesario

## Estadísticas

```javascript
// Obtener info de todos los mapas cargados
const stats = mapManager.getStats();

console.log(`Total mapas: ${stats.totalMaps}`);
stats.maps.forEach(map => {
  console.log(`${map.name} (${map.id})`);
  console.log(`  Dimensiones: ${map.dimensions.width}x${map.dimensions.height}`);
  console.log(`  Zona segura: ${map.safeZone ? 'Sí' : 'No'}`);
  console.log(`  Portales: ${map.hasPortals ? 'Sí' : 'No'}`);
  console.log(`  NPCs: ${map.hasNPCs ? 'Sí' : 'No'}`);
});
```

## Seguridad

### Anti-Cheating

✅ **Teleport Hacks Bloqueados**
- Servidor valida que movimiento sea adyacente
- Intento de teleport = movimiento rechazado

✅ **Noclip Bloqueados**
- Servidor verifica colisiones con tiles
- Atravesar paredes = movimiento rechazado

✅ **Speed Hacks Mitigados**
- Cooldown entre movimientos
- Rate limiting en servidor

### Logs de Seguridad

```javascript
console.log(`🚫 Movimiento rechazado para ${player.username}: ${validation.reason}`);
```

Monitorea estos logs para detectar intentos de cheating.

## Performance

### Optimizaciones

1. **Mapas en Memoria**: Cargados una vez al iniciar
2. **Lookups O(1)**: Uso de `Map()` en vez de arrays
3. **Validación Rápida**: Solo verifica tiles necesarios
4. **Sin Latencia**: Validación local en servidor

### Consumo de Memoria

- ~17 mapas × ~60KB promedio = **~1MB total**
- Insignificante para servidor Node.js

## Troubleshooting

### Problema: Mapas no se cargan

```bash
# Ver logs de inicio
[MapManager] Cargando mapas desde: /path/to/maps
[MapManager] ✓ Mapa cargado: training_fields
...
[MapManager] Total de mapas cargados: 17
```

Si no ves estos logs, verifica:
- Ruta del directorio de mapas
- Permisos de lectura
- Formato JSON válido

### Problema: Movimiento siempre rechazado

1. Verifica tiles bloqueados en `BLOCKED_TILES`
2. Comprueba que cliente y servidor usan mismo formato de mapas
3. Revisa logs del servidor para ver razón específica

### Problema: Desincronización cliente-servidor

Si el cliente muestra al jugador en una posición pero el servidor en otra:

1. El servidor SIEMPRE tiene razón
2. Cliente debe escuchar `movement_rejected` y corregir
3. Implementar reconciliación periódica:

```javascript
// Cada 5 segundos, sincronizar posición
setInterval(() => {
  socket.emit('sync_position', {
    x: player.x,
    y: player.y,
    map: player.map
  });
}, 5000);
```

## Futuras Mejoras

### Puertas Dinámicas
```javascript
// TODO: Sistema de puertas abiertas/cerradas
doorStates.set('door_id', { open: true, lockedBy: null });
```

### Colisiones Complejas
```javascript
// TODO: Polígonos de colisión para formas complejas
collisionPolygons: [
  { points: [[x1,y1], [x2,y2], ...] }
]
```

### Áreas Especiales
```javascript
// TODO: Zonas con efectos (daño, curación, etc.)
specialAreas: [
  { 
    x: 10, y: 20, width: 5, height: 5,
    effect: 'damage', value: 10
  }
]
```

## Conclusión

El sistema híbrido de mapas en Calima Online proporciona:

✅ **Seguridad**: Validación servidor-side contra cheating
✅ **Performance**: Renderizado instantáneo en cliente
✅ **Flexibilidad**: Fácil actualización de mapas
✅ **Escalabilidad**: Soporta NPCs inteligentes y pathfinding

Este es el patrón estándar usado por juegos online profesionales como World of Warcraft, League of Legends, etc.