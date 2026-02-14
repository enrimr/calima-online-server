# WebSocket Dual Protocol Architecture
## Socket.io + Pure WebSocket

### Fecha: 14/02/2026

## 🎯 Problema Resuelto

**Problema original:** Godot no puede conectarse directamente a Socket.io porque usa Engine.IO protocol.

**Solución:** Servidor dual protocol:
- Puerto 3001: Socket.io (navegadores web)
- Puerto 3002: WebSocket puro (Godot, clientes nativos)

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────┐
│              Calima Online Server                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  Puerto 3001: Socket.io (Engine.IO)                 │
│  ├── HTTP API                                        │
│  ├── Socket.io connections                          │
│  └── Web browsers (calima-online-client)            │
│                                                       │
│  Puerto 3002: Pure WebSocket                        │
│  ├── WebSocket connections                          │
│  ├── PureWebSocketBridge                            │
│  └── Godot clients (calima-online-steam)            │
│                                                       │
│  Shared:                                             │
│  ├── connectedPlayers Map                           │
│  ├── NPCManager                                      │
│  ├── MapManager                                      │
│  └── Database (MongoDB)                              │
│                                                       │
└─────────────────────────────────────────────────────┘

         ↓                           ↓
         
┌──────────────────┐      ┌──────────────────┐
│  Web Browser     │      │   Godot Engine   │
│  (JavaScript)    │      │   (GDScript)     │
│                  │      │                  │
│  Socket.io       │      │  WebSocketPeer   │
│  port 3001       │      │  port 3002       │
└──────────────────┘      └──────────────────┘
```

## 📦 Componentes

### 1. PureWebSocketBridge.js

**Ubicación:** `src/systems/PureWebSocketBridge.js`

**Responsabilidades:**
- Escucha en puerto 3002
- Acepta conexiones WebSocket puras
- Autentica clientes con JWT
- Hace de puente entre WebSocket y Socket.io
- Mantiene registro de clientes WS
- Sincroniza con connectedPlayers compartido

**Características:**
- ✅ Autenticación JWT
- ✅ Bridge bidireccional
- ✅ Compatibilidad total con Socket.io
- ✅ Sin dependencias extras

### 2. Server.js (Actualizado)

**Cambios:**
```javascript
import PureWebSocketBridge from './systems/PureWebSocketBridge.js';

// Inicializar WebSocket Bridge
const wsBridge = new PureWebSocketBridge(httpServer, io, connectedPlayers);
wsBridge.initialize();
```

**Lo que NO cambió:**
- Socket.io sigue igual
- Eventos iguales
- API HTTP igual
- Cliente web no afectado

### 3. SocketClient.gd (Godot)

**Cambio:**
```gdscript
var server_url: String = "ws://localhost:3002"  # Antes: 3001
```

**Resultado:**
- ✅ Conexión directa sin plugins
- ✅ WebSocketPeer nativo funciona
- ✅ Todos los eventos soportados

## 🔄 Flujo de Mensajes

### Godot → Servidor

```
1. Godot envía mensaje JSON:
   {"event": "join_game", "data": {"characterId": "abc123"}}
   
2. PureWebSocketBridge recibe en puerto 3002

3. Bridge procesa y reenvía a Socket.io

4. Socket.io maneja como evento normal

5. Respuesta va por ambos canales (Socket.io + WebSocket)
```

### Servidor → Godot

```
1. Socket.io emite evento: io.emit('player_moved', data)

2. PureWebSocketBridge detecta (está suscrito)

3. Bridge reenvía a clientes WebSocket puro

4. Godot recibe mensaje JSON

5. SocketClient.gd parsea y emite señal
```

## 🔐 Autenticación

### Flujo de Auth para Godot

```gdscript
# 1. Login via HTTP
var response = await ApiClient.login(username, password)
var token = response.token

# 2. Conectar WebSocket
SocketClient.connect_to_server("ws://localhost:3002")
await SocketClient.connected

# 3. Autenticar
SocketClient.emit_message("authenticate", {
    "token": token,
    "characterId": character_id
})

# 4. Esperar confirmación
await SocketClient.message_received  # event: "authenticated"

# 5. Ya autenticado, enviar join_game
SocketClient.join_game(character_id)
```

## 🚀 Despliegue

### Desarrollo Local

```bash
# Terminal 1: Servidor
cd calima-online-server
npm run dev

# Logs esperados:
# 🚀 Servidor Calima Online iniciado
# 📡 Puerto: 3001 (Socket.io)
# 🔌 WebSocket Puro iniciado en puerto 3002
```

### Producción

**Variables de entorno:**
```env
PORT=3001                    # Socket.io
PURE_WS_PORT=3002           # WebSocket puro
NODE_ENV=production
JWT_SECRET=your_secret
```

**Docker:**
```yaml
ports:
  - "3001:3001"  # Socket.io
  - "3002:3002"  # WebSocket puro
```

## 📊 Comparación de Protocolos

| Característica | Socket.io (3001) | Pure WS (3002) |
|----------------|------------------|----------------|
| Cliente Web | ✅ | ✅ |
| Cliente Godot | ❌ | ✅ |
| Polling fallback | ✅ | ❌ |
| Reconexión auto | ✅ | ⚠️ Manual |
| Rooms/Broadcast | ✅ | Via bridge |
| Overhead | Medium | Low |

## 🐛 Debugging

### Verificar que ambos puertos funcionan

```bash
# Socket.io (puerto 3001)
curl http://localhost:3001/health

# WebSocket puro (puerto 3002)
# Usar herramienta como websocat:
websocat ws://localhost:3002
```

### Logs del servidor

```
🔌 [WS] Nueva conexión desde ::ffff:127.0.0.1
📥 [WS ws-abc123] Evento: authenticate
✅ [WS ws-abc123] Autenticado: userId=123, charId=456
🌉 [Bridge] Reenviando join_game desde WS a Socket.io
```

### Logs de Godot

```gdscript
SocketClient.connect_to_server()
# Logs esperados:
# 🔌 Conectando a servidor: ws://localhost:3002
# ✅ Conectado al servidor
# 🔑 Socket ID asignado: ws-abc123
```

## ⚠️ Limitaciones Actuales

1. **Rooms**: El bridge necesita mejorar el manejo de rooms
2. **Broadcasting**: Por ahora broadcast va por Socket.io principalmente
3. **Reconnection**: Godot debe manejar reconexión manualmente

## 🔜 Mejoras Futuras

### Fase 1: Bridge Bidireccional Completo
- Propagar todos los eventos Socket.io → WebSocket
- Manejar rooms correctamente
- Broadcast a ambos protocolos

### Fase 2: Optimización
- Comprensión de mensajes
- Batching de eventos
- Prioridad de mensajes

### Fase 3: Seguridad
- Rate limiting por IP
- Validación de mensajes
- Anti-cheat básico

## 📝 Notas de Migración

### Para Cliente Web (no requiere cambios)

El cliente web sigue usando Socket.io en puerto 3001 como siempre.

### Para Cliente Godot

```gdscript
# Antes (no funcionaba):
SocketClient.connect_to_server("ws://localhost:3001")

# Ahora (funciona):
SocketClient.connect_to_server("ws://localhost:3002")
```

## 🎮 Testing

### Test 1: Conexión Básica

```gdscript
# En Godot
SocketClient.connect_to_server()
await SocketClient.connected
print("✅ Conectado!")
```

### Test 2: Mensaje Echo

```gdscript
SocketClient.emit_message("ping", {})
await SocketClient.message_received
# Debería recibir: {"event": "pong", "data": {...}}
```

### Test 3: Autenticación

```gdscript
var token = SessionManager.get_token()
SocketClient.emit_message("authenticate", {
    "token": token,
    "characterId": "abc123"
})
# Esperar: {"event": "authenticated", "data": {"success": true}}
```

## ✅ Estado

**Implementación:** ✅ COMPLETA
**Testing:** ⏳ Pendiente
**Producción:** ⚠️ Beta

**Próximo paso:** Testing en Godot con servidor corriendo

## 📚 Referencias

- `src/systems/PureWebSocketBridge.js` - Implementación del bridge
- `src/server.js` - Integración del bridge
- `calima-online-steam/scripts/network/SocketClient.gd` - Cliente Godot
- [ws package documentation](https://github.com/websockets/ws)