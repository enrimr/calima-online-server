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
        // Por ahora permitir todos los orígenes
        // TODO: Validar origin en producción
        callback(true);
      }
    });

    console.log(`\n🔌 WebSocket Puro iniciado en puerto ${this.WS_PORT}`);
    console.log(`   Compatible con Godot WebSocketPeer`);
    console.log(`   Socket.io en puerto 3001 (navegadores web)`);

    this.wss.on('connection', (ws, req) => {
      console.log(`🔌 [WS] Nueva conexión desde ${req.socket.remoteAddress}`);

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
      this._send(ws, 'socket_id', { id: clientData.socketId });

      // Manejar mensajes
      ws.on('message', (data) => {
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
      const message = JSON.parse(data.toString());
      const { event, data: eventData } = message;

      console.log(`📥 [WS ${clientData.socketId}] Evento: ${event}`);

      // Rutas que no requieren autenticación
      switch (event) {
        case 'authenticate':
          this._handleAuthentication(ws, eventData, clientData);
          return;
          
        case 'ping':
          this._send(ws, 'pong', { timestamp: Date.now() });
          return;
      }

      // Todas las demás rutas requieren autenticación
      if (!clientData.authenticated) {
        this._send(ws, 'error', { message: 'No autenticado. Envía "authenticate" primero.' });
        return;
      }

      // Reenviar evento a Socket.io (bridge)
      this._bridgeToSocketIO(event, eventData, clientData);

    } catch (error) {
      console.error(`❌ [WS] Error procesando mensaje:`, error);
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

    // Emitir evento en Socket.io
    console.log(`🌉 [Bridge] Reenviando ${event} desde WS a Socket.io`);
    this.io.emit(event, data); // TODO: Mejorar para eventos específicos
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