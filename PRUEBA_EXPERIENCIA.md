# Guía de Prueba - Sistema de Experiencia

## Pasos para Probar

### 1. Reiniciar el Servidor
```bash
cd calima-online-server
npm run dev
```

Verifica en los logs:
```
✅ MapManager inicializado correctamente
✅ MapManager asignado a NPCManager
✅ NPCManager inicializado correctamente
✨ NPC spawneado: Goblin (npc_1_xxx) en newbie_city (15, 15)
✨ NPC spawneado: Araña Gigante (npc_2_xxx) en newbie_city (18, 18)
✨ NPC spawneado: Lobo Salvaje (npc_3_xxx) en training_fields (18, 22)
```

### 2. Abrir Cliente
1. Acceder a `http://localhost:8080` (o tu URL del cliente)
2. Hacer login en modo online
3. Seleccionar personaje

### 3. Atacar un NPC

**En Consola del Navegador (F12):**
Busca estos logs al atacar:
```
⚔️ Atacando NPC syncedNPC en (x, y)...
⚔️ EVENTO attack_npc_result recibido: { success: true, damage: X, ... }
```

**En Consola del Servidor:**
Busca estos logs:
```
⚔️ [TuNombre] atacó a Goblin por X de daño (HP: 50 → Y)
```

### 4. Matar el NPC

Sigue atacando hasta que el NPC muera.

**En Consola del Servidor (CRÍTICO):**
```
💀 NPC Goblin (npc_1_xxx) murió

💰 DISTRIBUYENDO RECOMPENSAS DE Goblin:
  Total jugadores participantes: 1

  Procesando recompensa para TuNombre (socketId):
    EXP: 50, Oro: 10, Killer: true
    ✅ Jugador encontrado: TuNombre
    🔄 Actualizando stats en BD...
    📈 TuNombre: +50 EXP (50), +10 oro (10)
    ✅ Stats actualizados en BD
    📤 Enviando evento npc_reward al cliente...
    ✅ Evento npc_reward enviado

💰 TuNombre recibió 50 EXP y 10 oro (killer: true)

✅ RECOMPENSAS DISTRIBUIDAS
```

**En Consola del Navegador (CRÍTICO):**
```
💰💰💰 EVENTO npc_reward RECIBIDO 💰💰💰
  Datos completos: { npcName: "Goblin", experience: 50, gold: 10, wasKiller: true }
  NPC: Goblin
  EXP: 50
  Oro: 10
  Killer: true
  ✅ Añadiendo 50 EXP al mensaje
  ✅ Añadiendo 10 oro al mensaje
  📝 Mensaje final: 💰 Has recibido 50 EXP y 10 oro (¡Golpe final!)
  🔄 Actualizando gameState.player...
    EXP: 0 → 50
    Oro: 0 → 10
  🔄 Actualizando UI...
  ✅ npc_reward procesado completamente
```

**En el Chat del Juego:**
```
💰 Has recibido 50 EXP y 10 oro (¡Golpe final!)
```

### 5. Verificar en la UI

Después de recibir la recompensa, deberías ver en la UI:
- **EXP:** Aumenta de 0 a 50 (o el valor correspondiente)
- **Oro:** Aumenta en la cantidad recibida

## Si NO Ves Experiencia

### Verificar en Servidor:

1. **¿Se está llamando updatePlayerRewards?**
   - Busca en logs: `📈 [TuNombre]: +X EXP`
   - Si NO aparece → El método no se está llamando

2. **¿El jugador existe en connectedPlayers?**
   - Busca: `❌ No se pudo encontrar jugador`
   - Si aparece → Problema de sincronización de jugadores

3. **¿Se encuentra el personaje en BD?**
   - Busca: `❌ No se pudo encontrar personaje`
   - Si aparece → Problema con characterId

### Verificar en Cliente:

1. **¿Se recibe el evento npc_reward?**
   - Abre consola del navegador (F12)
   - Busca: `💰💰💰 EVENTO npc_reward RECIBIDO`
   - Si NO aparece → Problema de Socket.io

2. **¿El listener está registrado?**
   - En consola ejecuta: `socketClient.socket.listeners('npc_reward')`
   - Debería mostrar al menos 1 listener

3. **¿gameState.player existe?**
   - En consola ejecuta: `gameState.player`
   - Verifica que tenga las propiedades `experience` y `gold`

## Valores Esperados

**Goblin (Nivel 1):**
- Si lo matas solo: 50 EXP total (25 + 25 killer)
- Si lo atacan 2 jugadores (50/50 daño): 
  - Jugador A: 25 EXP (50% daño)
  - Jugador B: 25 EXP (50% daño) + 25 EXP (killer) = 50 EXP

**Araña Gigante (Nivel 3):**
- Si la matas solo: 120 EXP total (60 + 60 killer)

**Lobo Salvaje (Nivel 2):**
- Si lo matas solo: 80 EXP total (40 + 40 killer)

## Comandos Útiles

**Ver jugador en BD (MongoDB):**
```javascript
db.characters.findOne({ name: "TuNombre" }, { "stats.experience": 1, "stats.gold": 1, "stats.level": 1 })
```

**Ver NPCs activos:**
```javascript
db.npcinstances.find({ "state.isAlive": true }).count()
```

## Troubleshooting

Si después de seguir estos pasos NO ves logs:

1. **Reinicia completamente el servidor** (Ctrl+C y npm run dev)
2. **Limpia la BD de instancias**: El servidor lo hace al iniciar
3. **Verifica que hay NPCs spawneados**: Deberías verlos en el juego como círculos rojos
4. **Asegúrate de estar en modo online**: El sistema solo funciona online

## Contacto

Si el problema persiste, copia:
1. Logs completos del servidor al atacar/matar NPC
2. Logs completos de la consola del navegador
3. Screenshot de la UI mostrando stats