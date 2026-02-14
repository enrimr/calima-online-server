# Testing WebSocket Connection - Godot to Server

## 🧪 Guía de Testing para WebSocket Bridge

### Fecha: 14/02/2026

---

## 📋 Pre-requisitos

1. ✅ Servidor con logs detallados implementados
2. ✅ Puerto 3002 disponible
3. ✅ MongoDB corriendo
4. ✅ Godot 4.6 instalado

---

## 🚀 Paso 1: Iniciar Servidor

```bash
cd calima-online-server
npm run dev
```

### Logs Esperados

```
╔════════════════════════════════════════════╗
║  WebSocket Puro iniciado en puerto 3002    ║
║  Compatible con Godot WebSocketPeer        ║
║  Socket.io en puerto 3001 (web browsers)   ║
╚════════════════════════════════════════════╝

✅ WebSocket Bridge inicializado

🚀 Servidor Calima Online iniciado
📡 Puerto: 3001
```

Si ves esto → ✅ Servidor OK

---

## 🎮 Paso 2: Ejecutar Godot

```
1. Abrir Godot 4.6
2. Cargar proyecto: calima-online-steam
3. Presionar F5 (Run)
```

### En Consola de Godot

Deberías ver:
```
✅ SocketClient inicializado
🔌 Conectándose a WebSocket puro en puerto 3002
   (Socket.io en puerto 3001 para navegadores web)
```

---

## 🔍 Paso 3: Verificar Conexión en Servidor

### Cuando Godot se conecta

En la consola del servidor verás:

```
🔍 [WS] Verificando cliente desde: sin origin

┌─────────────────────────────────────────┐
│ 🔌 NUEVA CONEXIÓN WEBSOCKET             │
├─────────────────────────────────────────┤
│ IP: ::ffff:127.0.0.1                    │
│ Puerto remoto: 54321                     │
└─────────────────────────────────────────┘

📤 [WS ws-abc123def456] Enviando socket_id al cliente
📤 [WS] Enviado: socket_id (45 bytes)
📤 [WS] Enviado: welcome (120 bytes)
```

✅ Si ves estos logs → **Conexión establecida**

❌ Si NO ves nada → Problema de conexión

---

## 📨 Paso 4: Verificar Mensajes

### Cuando Godot envía un mensaje

En servidor verás:

```
📨 [WS ws-abc123] Mensaje RAW recibido (87 bytes)

┌─ Mensaje WebSocket ─────────────────────
│ ID: ws-abc123
│ Raw: {"event":"ping","data":{}}
│ Evento parseado: ping
│ Data keys: ninguna
└──────────────────────────────────────────

🏓 [WS ws-abc123] → Ping recibido, enviando pong
📤 [WS] Enviado: pong (52 bytes)
```

✅ Esto significa que los mensajes están llegando

---

## 🔐 Paso 5: Test de Autenticación

### En Godot, enviar:

```gdscript
SocketClient.emit_message("authenticate", {
    "token": "tu_jwt_token_aqui",
    "characterId": "character_id_aqui"
})
```

### En Servidor verás:

```
📨 [WS ws-abc123] Mensaje RAW recibido (245 bytes)

┌─ Mensaje WebSocket ─────────────────────
│ ID: ws-abc123
│ Raw: {"event":"authenticate","data":{"token":"eyJ...","characterId":"abc"}}
│ Evento parseado: authenticate
│ Data keys: token, characterId
└──────────────────────────────────────────

🔐 [WS ws-abc123] → Procesando autenticación
✅ [WS ws-abc123] Autenticado: userId=123, charId=abc
📤 [WS] Enviado: authenticated (65 bytes)
```

✅ Si ves "Autenticado" → **Auth OK**
❌ Si ves error JWT → Token inválido

---

## 🎯 Paso 6: Test de Join Game

### Enviar desde Godot:

```gdscript
SocketClient.emit_message("join_game", {
    "characterId": "tu_character_id"
})
```

### En Servidor verás:

```
📨 [WS ws-abc123] Mensaje RAW recibido (87 bytes)

┌─ Mensaje WebSocket ─────────────────────
│ ID: ws-abc123
│ Raw: {"event":"join_game","data":{"characterId":"abc"}}
│ Evento parseado: join_game
│ Data keys: characterId
└──────────────────────────────────────────

🌉 [WS ws-abc123] → Reenviando evento 'join_game' al bridge
🌉 [Bridge] Reenviando join_game desde WS a Socket.io
```

✅ Mensaje bridgeado a Socket.io

---

## ❌ Problemas Comunes

### Problema 1: No hay logs de conexión

```
Síntoma: Servidor corriendo pero no aparece log cuando Godot se conecta

Causas posibles:
1. Godot conectando al puerto incorrecto (3001 en vez de 3002)
2. Firewall bloqueando puerto 3002
3. Servidor no inició correctamente

Solución:
- Verificar en SocketClient.gd: server_url = "ws://localhost:3002"
- Verificar puerto con: netstat -an | grep 3002
- Reiniciar servidor
```

### Problema 2: Conexión pero no llegan mensajes

```
Síntoma: Ves log de conexión pero no de mensajes

Causas posibles:
1. Formato JSON incorrecto en Godot
2. Evento mal formado
3. Godot no envía correctamente

Solución:
- Revisar formato en Godot:
  {"event": "nombre_evento", "data": {}}
- Verificar que se llama socket.send_text(json)
- No socket.send() o socket.send_binary()
```

### Problema 3: Error de parsing JSON

```
Síntoma: "❌ Error al parsear mensaje JSON"

Causa: JSON mal formado

Solución en Godot:
var message = {"event": event_name, "data": event_data}
var json = JSON.stringify(message)
socket.send_text(json)  # NO send() ni send_binary()
```

---

## 🧰 Herramientas de Debug

### 1. Verificar Puerto Abierto

```bash
# macOS/Linux
netstat -an | grep 3002
# Debería mostrar: tcp4  0  0  *.3002  *.*  LISTEN

# Alternativamente
lsof -i :3002
```

### 2. Test Manual con websocat

```bash
# Instalar websocat
brew install websocat

# Conectar
websocat ws://localhost:3002

# Enviar mensaje de prueba
{"event":"ping","data":{}}

# Deberías recibir:
{"event":"pong","data":{"timestamp":1234567890}}
```

### 3. Test con curl (HTTP upgrade)

```bash
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://localhost:3002/
```

---

## 📊 Logs de Éxito

### Flujo Completo Exitoso

```
# 1. Conexión
┌─────────────────────────────────────────┐
│ 🔌 NUEVA CONEXIÓN WEBSOCKET             │
└─────────────────────────────────────────┘

# 2. Socket ID asignado
📤 [WS ws-abc123] Enviando socket_id al cliente

# 3. Mensaje recibido
📨 [WS ws-abc123] Mensaje RAW recibido (87 bytes)
┌─ Mensaje WebSocket ─────────────────────
│ Evento parseado: authenticate
└──────────────────────────────────────────

# 4. Autenticación
🔐 [WS ws-abc123] → Procesando autenticación
✅ [WS ws-abc123] Autenticado

# 5. Join game
🌉 [WS ws-abc123] → Reenviando join_game al bridge
```

Si ves esta secuencia completa → **TODO FUNCIONA** ✅

---

## 🎯 Checklist de Verificación

- [ ] Servidor inició en puerto 3002
- [ ] Godot se conectó (log de conexión visible)
- [ ] Socket ID fue asignado
- [ ] Mensajes llegan al servidor (logs visibles)
- [ ] JSON se parsea correctamente
- [ ] Autenticación funciona (si se envía)
- [ ] Bridge reenvía a Socket.io

---

## 💡 Tips

### Ver solo logs de WebSocket

```bash
cd calima-online-server
npm run dev | grep "\[WS\]"
```

### Aumentar verbosidad

Todos los logs ya están al máximo detalle. Cada mensaje muestra:
- Tamaño en bytes
- Contenido raw (primeros 100 caracteres)
- Evento parseado
- Keys del data object

### Desactivar logs para producción

Comentar los console.log en PureWebSocketBridge.js cuando ya funcione.

---

## 📞 Soporte

Si los logs no aparecen o hay errores:

1. **Verificar instalación de ws:**
   ```bash
   npm list ws
   # Debería mostrar: ws@x.x.x
   ```

2. **Verificar imports:**
   ```javascript
   import { WebSocketServer } from 'ws';
   ```

3. **Verificar que el bridge se inicializa:**
   En server.js debe estar:
   ```javascript
   const wsBridge = new PureWebSocketBridge(...);
   wsBridge.initialize();
   ```

---

## ✅ Resultado Esperado

Cuando todo funciona verás una conversación entre cliente y servidor:

```
Godot:  Conectando a ws://localhost:3002
Server: 🔌 NUEVA CONEXIÓN WEBSOCKET
Server: 📤 Enviando socket_id
Godot:  📥 Recibido socket_id: ws-abc123
Godot:  📤 Enviando ping
Server: 📨 Mensaje RAW recibido
Server: 🏓 Ping recibido
Server: 📤 Enviado: pong
Godot:  📥 Recibido pong
```

**Esto confirma:** Comunicación bidireccional funcionando ✅

---

*Logs implementados el 14 de febrero de 2026*
*Para debugging de conexión Godot-Servidor*