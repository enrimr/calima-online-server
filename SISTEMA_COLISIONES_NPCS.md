# Sistema de Colisiones de NPCs con Elementos del Mapa

## Descripción General

Este documento describe el sistema de detección de colisiones implementado para los NPCs del servidor, que ahora incluye colisiones con elementos del mapa (tiles bloqueados), además de las colisiones con jugadores y otros NPCs.

## Componentes del Sistema

### 1. MapManager - Detección de Colisiones de Mapa

El `MapManager` ahora incluye métodos para verificar si una posición está bloqueada:

#### `isPositionBlocked(mapNumber, x, y)`
- Verifica si una posición específica en un mapa está bloqueada
- Retorna `true` si:
  - La posición está fuera de los límites del mapa
  - El tile tiene la propiedad `blocked: true`
  - El mapa no existe
- Retorna `false` si la posición es válida y no está bloqueada

#### `canMoveTo(mapNumber, x, y)`
- Método de conveniencia que retorna `true` si una posición es válida para movimiento
- Es el inverso de `isPositionBlocked()`

### 2. NPCManager - Movimiento con Colisiones

El `NPCManager` ha sido actualizado para respetar las colisiones con el mapa:

#### `moveNPC(npcId, direction)`
Ahora verifica en orden:
1. **Colisión con mapa**: Usa `mapManager.canMoveTo()` para verificar si el tile destino está bloqueado
2. **Colisión con NPCs**: Verifica si hay otro NPC en la posición destino
3. Solo si ambas verificaciones pasan, el NPC se mueve

#### `moveNPCRandomly(npcId)`
- Mejorado para intentar todas las direcciones en orden aleatorio
- Si todas las direcciones están bloqueadas, el NPC permanece en su posición
- Más eficiente que el algoritmo anterior

#### `spawnNPC(npcData, x, y, mapNumber)`
Ahora verifica:
1. **Tile bloqueado**: No permite spawn en tiles bloqueados
2. **Colisión con NPCs**: No permite spawn donde ya hay otro NPC
3. Solo spawna si ambas condiciones se cumplen

#### `findValidSpawnPosition(mapNumber, maxAttempts = 100)`
- Nuevo método para encontrar una posición válida aleatoria en un mapa
- Intenta hasta `maxAttempts` veces encontrar una posición que:
  - No esté bloqueada
  - No tenga otro NPC
- Útil para spawn dinámico de NPCs

## Criterios de Colisión

### Tipos de Colisiones Detectadas

1. **Límites del Mapa**
   - Coordenadas X o Y negativas
   - Coordenadas X >= ancho del mapa
   - Coordenadas Y >= alto del mapa

2. **Tiles Bloqueados**
   - Tiles con propiedad `blocked: true` en el JSON del mapa
   - Representa obstáculos como paredes, agua, árboles, etc.

3. **Colisión con NPCs**
   - Dos NPCs no pueden ocupar la misma posición
   - Verificado antes de permitir movimiento

4. **Colisión con Jugadores**
   - Los NPCs también verifican colisiones con jugadores (implementación existente)

## Estructura de Datos del Mapa

Los mapas deben tener la siguiente estructura para que las colisiones funcionen:

```json
{
  "width": 100,
  "height": 100,
  "tiles": [
    [
      {
        "blocked": false,
        "graphic": 1,
        ...
      },
      {
        "blocked": true,
        "graphic": 5,
        ...
      }
    ]
  ]
}
```

La propiedad `blocked` determina si un NPC puede moverse a ese tile.

## Flujo de Movimiento de NPC

```
1. NPC decide moverse (AI o comando)
   ↓
2. Calcular nueva posición (x, y) según dirección
   ↓
3. ¿Posición está bloqueada en el mapa?
   SÍ → Cancelar movimiento
   NO ↓
4. ¿Hay otro NPC en esa posición?
   SÍ → Cancelar movimiento
   NO ↓
5. ¿Hay un jugador en esa posición?
   SÍ → Cancelar movimiento (o iniciar combate)
   NO ↓
6. Mover NPC a nueva posición
   ↓
7. Actualizar heading/dirección
   ↓
8. Broadcast nuevo estado a clientes
```

## Diferencias con el Cliente

El sistema ahora es coherente entre cliente y servidor:

- **Cliente**: Los NPCs respetan colisiones con tiles bloqueados
- **Servidor**: Los NPCs ahora también respetan colisiones con tiles bloqueados
- **Sincronización**: Ambos usan el mismo criterio (propiedad `blocked` del tile)

## Testing

Para probar el sistema de colisiones, ejecuta:

```bash
cd calima-online-server
node src/tests/testNPCCollisions.js
```

Este script prueba:
1. Detección de posiciones bloqueadas
2. Movimiento de NPCs con colisiones
3. Spawn en posiciones válidas
4. Búsqueda de posiciones válidas aleatorias
5. Prevención de spawn en posiciones bloqueadas

## Sistema de Pathfinding (A*)

### Descripción

Los NPCs pueden tener habilitado un sistema de pathfinding basado en el algoritmo A* que les permite encontrar caminos alrededor de obstáculos al perseguir jugadores.

### Configuración

La propiedad `canPathfind` en la configuración de behavior del NPC determina si usa pathfinding:

```javascript
behavior: {
  hostile: true,
  movement: 'chase',
  chaseRange: 10,
  canPathfind: true  // ✅ Este NPC usará pathfinding para rodear obstáculos
}
```

### Funcionamiento

**Con pathfinding habilitado:**
1. El NPC detecta un jugador en rango
2. Calcula el camino más corto usando A* evitando:
   - Tiles bloqueados (paredes, agua, etc.)
   - Otros NPCs
   - Jugadores (excepto el objetivo)
3. Sigue el camino tile por tile hacia el objetivo
4. Recalcula el camino si el jugador se mueve

**Sin pathfinding (comportamiento simple):**
1. El NPC se mueve en línea recta hacia el jugador
2. Si encuentra un obstáculo, se detiene
3. Más simple pero menos inteligente

### Ventajas del Pathfinding

- **NPCs más inteligentes**: Pueden rodear obstáculos
- **Mejor experiencia**: Los enemigos persiguen de forma más realista
- **Táctica para jugadores**: Pueden usar el terreno para escapar de NPCs sin pathfinding

### Consideraciones de Rendimiento

- El algoritmo A* tiene un límite de 200 iteraciones para evitar lag
- Solo se recalcula cuando el NPC se mueve
- El cálculo es eficiente para distancias cortas (< 15 tiles)

### Ejemplos de NPCs

- **Goblin** (canPathfind: false) - Simple, se detiene en obstáculos
- **Araña Gigante** (canPathfind: true) - Inteligente, rodea obstáculos
- **Lobo Salvaje** (canPathfind: true) - Cazador inteligente

## Optimizaciones Futuras

1. **Cache de tiles bloqueados**: Mantener un Set con posiciones bloqueadas para acceso O(1)
2. **Cache de paths**: Guardar paths calculados por un tiempo
3. **Zonas de spawn**: Definir áreas específicas para spawn de NPCs en cada mapa
4. **Colisiones dinámicas**: Tiles que se bloquean/desbloquean (puertas, eventos, etc.)

## Notas de Implementación

- Las colisiones con el mapa tienen prioridad sobre colisiones con NPCs (se verifican primero)
- Si un mapa no existe, todas las posiciones se consideran bloqueadas por seguridad
- El sistema es retrocompatible con mapas que no tienen la propiedad `blocked`
- Los tiles sin la propiedad `blocked` se consideran caminables por defecto

## Compatibilidad

- ✅ Compatible con sistema de NPCs existente
- ✅ Compatible con sistema de combate
- ✅ Compatible con sistema de mapas actual
- ✅ No requiere cambios en el cliente (ya implementado)
- ✅ No requiere cambios en la base de datos