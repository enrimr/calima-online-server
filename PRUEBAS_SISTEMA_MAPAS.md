# Guía de Pruebas - Sistema de Mapas y Colisiones

Esta guía te ayudará a verificar que el sistema de validación de mapas está funcionando correctamente.

## 🧪 Método 1: Logs del Servidor (Más Fácil)

### 1. Inicia el servidor
```bash
cd calima-online-server
npm start
```

### 2. Busca estos logs al iniciar
```
✅ MapManager inicializado correctamente
[MapManager] Total de mapas cargados: 17
```

### 3. Cuando te muevas en el juego, verás:
```bash
# Movimiento válido (no verás log especial, solo acepta)

# Movimiento rechazado (verás esto):
🚫 Movimiento rechazado para [TuUsuario]: Posición bloqueada
🚫 Movimiento rechazado para [TuUsuario]: Movimiento inválido: debe ser a una casilla adyacente
```

## 🎮 Método 2: Pruebas en el Juego

### 1. Inicia servidor y cliente
```bash
# Terminal 1 - Servidor
cd calima-online-server
npm start

# Terminal 2 - Cliente (si usas Live Server)
# O simplemente abre index.html en el navegador
```

### 2. Crea un personaje y entra al juego

### 3. Prueba estos escenarios:

#### ✅ Escenario 1: Caminar por zona válida
1. Muévete por el centro del mapa (terreno normal)
2. **Resultado esperado**: Te mueves sin problemas

#### ❌ Escenario 2: Intentar caminar al agua
1. Busca tiles azules (agua, tile tipo 8)
2. Intenta caminar hacia ellos
3. **Resultado esperado**: NO te mueves, el servidor rechaza el movimiento

#### ❌ Escenario 3: Intentar atravesar árboles
1. Busca árboles/obstáculos en el mapa (props tipo 2 o 3)
2. Intenta caminar hacia ellos
3. **Resultado esperado**: NO te mueves, colisión bloqueada

#### ❌ Escenario 4: Intentar salir del mapa
1. Muévete hacia los bordes del mapa (tile tipo 8)
2. **Resultado esperado**: El servidor te bloquea en los límites

## 🔬 Método 3: Script de Pruebas Automatizado

He creado un script que puedes ejecutar para probar el MapManager directamente:

```bash
cd calima-online-server
node src/tests/testMapManager.js
```

Este script probará:
- ✅ Carga de mapas
- ✅ Detección de tiles bloqueados
- ✅ Validación de movimientos
- ✅ Detección de portales
- ✅ Búsqueda de posiciones caminables

## 🐛 Método 4: Consola del Navegador (DevTools)

### 1. Abre el juego en Chrome/Firefox
### 2. Abre DevTools (F12)
### 3. Ve a la pestaña Console
### 4. Muévete por el juego

### 5. Busca mensajes como:
```javascript
// Si el servidor rechaza un movimiento:
"Movimiento rechazado: Posición bloqueada"

// El cliente debería recibir:
socket.on('movement_rejected', ...)
```

## 📊 Método 5: Verificación Manual con Curl

Puedes probar que el servidor está validando sin siquiera abrir el cliente:

### 1. El servidor debe estar corriendo

### 2. Los logs del servidor mostrarán validaciones cuando un jugador se mueva

## 🎯 Casos de Prueba Específicos

### Test 1: Validar Movimiento Normal
```
Mapa: training_fields
Posición actual: (10, 10)
Movimiento a: (11, 10)
Resultado esperado: ✅ VÁLIDO (movimiento adyacente a tile caminable)
```

### Test 2: Bloquear Movimiento a Agua
```
Mapa: training_fields
Posición actual: (7, 0)
Movimiento a: (8, 0) <- Borde agua (tile 8)
Resultado esperado: ❌ RECHAZADO "Posición bloqueada"
```

### Test 3: Bloquear Teleport
```
Mapa: training_fields
Posición actual: (10, 10)
Movimiento a: (50, 50)
Resultado esperado: ❌ RECHAZADO "Movimiento inválido: debe ser a una casilla adyacente"
```

### Test 4: Detectar Portal
```
Mapa: training_fields
Posición actual: (2, 20)
Movimiento a: (1, 20) <- Portal a newbie_city
Resultado esperado: ✅ VÁLIDO con portal detectado
```

## 🔍 Verificar Tiles Bloqueados

Para ver qué tiles están bloqueados en tu mapa:

### En training_fields.json:
```json
{
  "layers": {
    "base": [
      [8,8,8,...],  // 8 = agua/borde (BLOQUEADO)
      [8,0,0,...],  // 0 = terreno normal (CAMINABLE)
      [8,4,4,...],  // 4 = montaña (BLOQUEADO)
    ],
    "props": [
      [0,0,0,...],  // 0 = vacío (CAMINABLE)
      [0,2,0,...],  // 2 = árbol (BLOQUEADO)
      [0,3,0,...],  // 3 = roca (BLOQUEADO)
    ]
  }
}
```

## 🎨 Visualización de Colisiones (Opcional)

Puedes activar visualización de colisiones en el cliente agregando esta función temporal:

```javascript
// En calima-online-client/js/core/Game.js o similar
function debugDrawCollisions(map) {
  const BLOCKED_TILES = {
    base: [4, 8],
    props: [2, 3]
  };
  
  // Dibuja rectángulos rojos sobre tiles bloqueados
  for (let y = 0; y < map.layers.base.length; y++) {
    for (let x = 0; x < map.layers.base[y].length; x++) {
      const baseTile = map.layers.base[y][x];
      const propTile = map.layers.props?.[y]?.[x];
      
      if (BLOCKED_TILES.base.includes(baseTile) || 
          BLOCKED_TILES.props.includes(propTile)) {
        // Dibuja rect rojo en (x, y)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}
```

## ✅ Checklist de Verificación

Marca cada item cuando lo hayas probado:

- [ ] El servidor inicia sin errores
- [ ] Los logs muestran "17 mapas cargados"
- [ ] Puedo moverme por terreno normal
- [ ] NO puedo atravesar agua (tiles azules)
- [ ] NO puedo atravesar árboles/obstáculos
- [ ] NO puedo salir de los límites del mapa
- [ ] Los logs del servidor muestran "🚫 Movimiento rechazado" cuando intento ir a tile bloqueado
- [ ] El script de pruebas automatizado pasa todos los tests

## 🚨 Problemas Comunes

### Problema: Puedo atravesar agua/árboles
**Solución**: El servidor no está validando. Verifica:
1. ¿El servidor se inició correctamente?
2. ¿Los logs muestran "MapManager inicializado"?
3. ¿Estás conectado al servidor correcto (localhost:3000)?

### Problema: No puedo moverme a ningún lado
**Solución**: Validación demasiado estricta. Verifica:
1. Revisa los logs del servidor para ver el motivo exacto
2. Comprueba que estás en una posición inicial válida
3. Verifica que los tiles de tu posición sean caminables

### Problema: No veo logs de movimiento rechazado
**Solución**: 
1. Asegúrate de que `console.log('🚫 Movimiento rechazado...')` está en server.js
2. Verifica que estás mirando los logs del servidor (no del cliente)
3. Prueba moverse a un tile obviamente bloqueado (agua en los bordes)

## 📈 Métricas de Éxito

El sistema funciona correctamente si:
- ✅ 0% de movimientos inválidos son aceptados
- ✅ 100% de movimientos válidos son aceptados
- ✅ Todos los tiles bloqueados (4, 8, 2, 3) rechazan movimiento
- ✅ Los portales son detectados correctamente

## 🎯 Prueba Final Definitiva

**La prueba más simple:**

1. Inicia el servidor
2. Abre el juego
3. Intenta caminar directamente hacia el borde azul del mapa
4. **Si NO puedes salir del mapa** = ✅ FUNCIONA
5. **Si puedes salir del mapa** = ❌ NO FUNCIONA

¡Esta prueba de 30 segundos te dirá si el sistema está funcionando!