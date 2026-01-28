import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Middleware para proteger rutas
export const protect = async (req, res, next) => {
  try {
    let token;

    // Verificar si el token existe en headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Token no proporcionado'
      });
    }

    try {
      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Buscar usuario
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'No autorizado - Usuario no encontrado'
        });
      }

      // Verificar que el usuario esté activo
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Cuenta desactivada'
        });
      }

      // Verificar si está baneado
      if (user.isBannedCheck()) {
        return res.status(403).json({
          success: false,
          message: 'Cuenta baneada'
        });
      }

      // Añadir usuario a la request
      req.user = { userId: user._id, username: user.username, role: user.role };
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Token inválido'
      });
    }
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({
      success: false,
      message: 'Error en autenticación'
    });
  }
};

// Middleware para roles específicos
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción'
      });
    }

    next();
  };
};

// Middleware para verificar ownership de personaje
export const checkCharacterOwnership = async (req, res, next) => {
  try {
    const Character = (await import('../models/Character.js')).default;
    
    const character = await Character.findById(req.params.id);

    if (!character) {
      return res.status(404).json({
        success: false,
        message: 'Personaje no encontrado'
      });
    }

    // Verificar que el personaje pertenezca al usuario o que sea admin
    if (character.userId.toString() !== req.user.userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para acceder a este personaje'
      });
    }

    next();
  } catch (error) {
    console.error('Error al verificar ownership:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar permisos'
    });
  }
};