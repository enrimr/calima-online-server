/**
 * Pure WebSocket Bridge
 * Servidor WebSocket puro (compatible con Godot) que hace de puente con Socket.io
 * Puerto: 3002 (puro WebSocket)
 * Puerto: 3001 (Socket.io - ya existente)
 */

import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

export class PureWebSocketBridge {
  constructor(httpServer, io, connectedPlayers) {
    this.wss = null;
    this.httpServer = httpServer;
    this.io = io; // Socket.io instance para hacer bridge
    this.connectedPlayers = connectedPlayers; // Mapa compartido con Socket.io
    this.wsClients = new Map(); // ws connection -> player data
    
    // Puerto específico para WebSocket puro
    this.WS_PORT = process.env.PURE_WS_PORT || 3002;
  }

  /**
   * Inicializa el servidor WebSocket puro
   */
  initialize() {
    // Crear servidor WebSocket en puerto separado
    this.wss = new WebSocketServer({ 
      port: this.WS_PORT,
      // Verificar origen para seguridad
      verifyClient: (info, callback) => {
        console.log(`🔍 [WS] Verificando cliente desde: ${info.origin || 'sin origin'}`);
        // Por ahora permitir todos los orígenes
        // TODO: Validar origin en producción
        callback(true);
      }
    });

    console.log(`\n╔════════════════════════════════════════════╗`);
    console.log(`║  WebSocket Puro iniciado en puerto ${this.WS_PORT}  ║`);
    console.log(`║  Compatible con Godot WebSocketPeer       ║`);
    console.log(`║  Socket.io en puerto 3001 (web browsers)  ║`);
    console.log(`╚════════════════════════════════════════════╝\n`);

    this.wss.on('connection', (ws, req) => {
      console.log(`\n┌─────────────────────────────────────────┐`);
      console.log(`│ 🔌 NUEVA CONEXIÓN WEBSOCKET             │`);
      console.log(`├─────────────────────────────────────────┤`);
      console.log(`│ IP: ${req.socket.remoteAddress?.padEnd(30)} │`);
      console.log(`│ Puerto remoto: ${String(req.socket.remotePort).padEnd(22)} │`);
      console.log(`└─────────────────────────────────────────┘\n`);

      // Estado del cliente
      const clientData = {
        ws,
        authenticated: false,
        userId: null,
        characterId: null,
        socketId: this._generateSocketId()
      };

      this.wsClients.set(ws, clientData);

      // Enviar socket ID al cliente
      console.log(`📤 [WS ${clientData.socketId}] Enviando socket_id al cliente`);
      this._send(ws, 'socket_id', { id: clientData.socketId });

      // Manejar mensajes
      ws.on('message', (data) => {
        console.log(`📨 [WS ${clientData.socketId}] Mensaje RAW recibido (${data.length} bytes)`);
        this._handleMessage(ws, data, clientData);
      });

      // Manejar desconexión
      ws.on('close', () => {
        this._handleDisconnect(ws, clientData);
      });

      // Manejar errores
      ws.on('error', (error) => {
        console.error(`❌ [WS] Error en conexión:`, error);
      });

      // Enviar mensaje de bienvenida
      this._send(ws, 'welcome', {
        message: 'Conectado al servidor WebSocket puro de Calima Online',
        socketId: clientData.socketId
      });
    });

    console.log(`✅ WebSocket Bridge inicializado\n`);
  }

  /**
   * Maneja mensajes recibidos del cliente WebSocket
   */
  _handleMessage(ws, data, clientData) {
    try {
      const rawMessage = data.toString();
      console.log(`\n┌─ Mensaje WebSocket ─────────────────────`);
      console.log(`│ ID: ${clientData.socketId}`);
      console.log(`│ Raw: ${rawMessage.substring(0, 100)}${rawMessage.length > 100 ? '...' : ''}`);
      
      const message = JSON.parse(rawMessage);
      const { event, data: eventData } = message;

      console.log(`│ Evento parseado: ${event}`);
      console.log(`│ Data keys: ${Object.keys(eventData || {}).join(', ') || 'ninguna'}`);
      console.log(`└──────────────────────────────────────────\n`);

      // Rutas que no requieren autenticación
      switch (event) {
        case 'authenticate':
          console.log(`🔐 [WS ${clientData.socketId}] → Procesando autenticación`);
          this._handleAuthentication(ws, eventData, clientData);
          return;
          
        case 'ping':
          console.log(`🏓 [WS ${clientData.socketId}] → Ping recibido, enviando pong`);
          this._send(ws, 'pong', { timestamp: Date.now() });
          return;
      }

      // El chat NO requiere autenticación JWT (solo conexión WebSocket)
      // Otros eventos sí requieren autenticación
      const eventsWithoutAuth = ['chat_message', 'join_game', 'player_move'];
      
      if (!eventsWithoutAuth.includes(event) && !clientData.authenticated) {
        console.log(`🚫 [WS ${clientData.socketId}] → Rechazado: No autenticado`);
        this._send(ws, 'error', { message: 'No autenticado. Envía "authenticate" primero.' });
        return;
      }

      // Reenviar evento a Socket.io (bridge)
      console.log(`🌉 [WS ${clientData.socketId}] → Reenviando evento '${event}' al bridge`);
      this._bridgeToSocketIO(event, eventData, clientData);

    } catch (error) {
      console.error(`\n❌❌❌ ERROR PROCESANDO MENSAJE ❌❌❌`);
      console.error(`   Socket ID: ${clientData.socketId}`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack:`, error.stack);
      console.error(`   Data raw: ${data.toString().substring(0, 200)}`);
      this._send(ws, 'error', { message: 'Error al procesar mensaje' });
    }
  }

  /**
   * Autentica un cliente WebSocket
   */
  async _handleAuthentication(ws, data, clientData) {
    try {
      const { token, characterId } = data;

      if (!token || !characterId) {
        this._send(ws, 'error', { message: 'Token y characterId requeridos' });
        return;
      }

      // Verificar token JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      clientData.userId = decoded.userId;
      clientData.characterId = characterId;
      clientData.authenticated = true;

      console.log(`✅ [WS ${clientData.socketId}] Autenticado: userId=${clientData.userId}, charId=${characterId}`);

      // Enviar confirmación
      this._send(ws, 'authenticated', {
        success: true,
        socketId: clientData.socketId
      });

    } catch (error) {
      console.error(`❌ [WS] Error en autenticación:`, error);
      this._send(ws, 'error', { message: 'Autenticación fallida' });
    }
  }

  /**
   * Hace de puente entre WebSocket puro y Socket.io
   */
  _bridgeToSocketIO(event, data, clientData) {
    console.log(`🌉 [Bridge] Procesando evento '${event}' para bridgear a Socket.io`);
    
    // Para eventos de chat, intentar obtener el jugador pero usar fallback si no existe
    let player = this.connectedPlayers.get(clientData.socketId);
    
    // Si no hay jugador en connectedPlayers, usar datos básicos del WebSocket
    if (!player) {
      console.warn(`⚠️ [Bridge] Jugador no en connectedPlayers, usando datos básicos del WebSocket`);
      player = {
        socketId: clientData.socketId,
        username: `Jugador-${clientData.socketId.substring(0, 8)}`,
        map: 'default'
      };
    }
    
    // Crear un objeto "socket" simulado para Socket.io
    const fakeSocket = {
      id: clientData.socketId,
      userId: clientData.userId,
      handshake: { auth: { token: 'from-ws' } },
      emit: (event, data) => {
        // Reenviar respuesta al cliente WebSocket
        this._send(clientData.ws, event, data);
      },
      to: (room) => ({
        emit: (event, data) => {
          // Broadcast a socket.io room
          this.io.to(room).emit(event, data);
        }
      }),
      join: (room) => {
        // Simular unión a room
        console.log(`🏠 [WS ${clientData.socketId}] Unido a room: ${room}`);
      },
      leave: (room) => {
        // Simular salida de room
        console.log(`🚪 [WS ${clientData.socketId}] Salió de room: ${room}`);
      }
    };

    // Manejar eventos específicos correctamente
    if (event === 'chat_message') {
      console.log(`💬 [Bridge] Procesando mensaje de chat de ${player.username}: ${data.message?.substring(0, 50)}`);
      
      // Estructura del mensaje de chat con información del jugador
      const chatMessage = {
        socketId: clientData.socketId,
        username: player.username,
        message: data.message,
        type: data.type || 'global',
        timestamp: Date.now()
      };
      
      // Broadcast a todos (Socket.io + WebSocket)
      console.log(`📢 [Bridge] Broadcasting mensaje global: ${player.username}: ${data.message}`);
      this.io.emit('chat_message', chatMessage);
      
      // También enviar a otros clientes WebSocket
      this.broadcast('chat_message', chatMessage, clientData.socketId);
      
      console.log(`✅ [Bridge] Mensaje de chat bridgeado exitosamente`);
    } else {
      // Para otros eventos, usar lógica general
      console.log(`🌉 [Bridge] Reenviando ${event} a Socket.io (genérico)`);
      this.io.emit(event, data);
    }
  }

  /**
   * Maneja desconexión de cliente WebSocket
   */
  _handleDisconnect(ws, clientData) {
    console.log(`🔌 [WS ${clientData.socketId}] Desconectado`);

    // Si estaba autenticado, limpiar del mapa de jugadores
    if (clientData.authenticated && clientData.characterId) {
      const player = Array.from(this.connectedPlayers.values())
        .find(p => p.characterId === clientData.characterId);
      
      if (player) {
        // Eliminar de connectedPlayers
        for (const [socketId, p] of this.connectedPlayers) {
          if (p.characterId === clientData.characterId) {
            this.connectedPlayers.delete(socketId);
            break;
          }
        }
      }
    }

    this.wsClients.delete(ws);
  }

  /**
   * Envía un mensaje al cliente WebSocket
   */
  _send(ws, event, data) {
    if (ws.readyState === 1) { // OPEN
      const message = JSON.stringify({ event, data });
      ws.send(message);
      console.log(`📤 [WS] Enviado: ${event} (${message.length} bytes)`);
    } else {
      console.warn(`⚠️ [WS] No se pudo enviar ${event}: Socket no está abierto (estado: ${ws.readyState})`);
    }
  }

  /**
   * Genera un socket ID único (compatible con Socket.io)
   */
  _generateSocketId() {
    return 'ws-' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Broadcast a todos los clientes WebSocket
   */
  broadcast(event, data, excludeSocketId = null) {
    for (const [ws, clientData] of this.wsClients) {
      if (clientData.socketId !== excludeSocketId && clientData.authenticated) {
        this._send(ws, event, data);
      }
    }
  }

  /**
   * Envía mensaje a un cliente específico por socketId
   */
  sendToClient(socketId, event, data) {
    for (const [ws, clientData] of this.wsClients) {
      if (clientData.socketId === socketId) {
        this._send(ws, event, data);
        return true;
      }
    }
    return false;
  }

  /**
   * Cierra el servidor WebSocket
   */
  close() {
    if (this.wss) {
      this.wss.close();
      console.log('🔌 WebSocket Bridge cerrado');
    }
  }
}

export default PureWebSocketBridge;