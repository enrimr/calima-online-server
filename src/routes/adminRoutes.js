import express from 'express';
import { getGameStats, getUsers, banUser } from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas de admin requieren autenticación
router.use(protect);

// GET /api/admin/stats - Obtener estadísticas del juego
router.get('/stats', getGameStats);

// GET /api/admin/users - Obtener lista de usuarios (solo admin)
router.get('/users', getUsers);

// POST /api/admin/users/:userId/ban - Banear/desbanear usuario (solo admin)
router.post('/users/:userId/ban', banUser);

export default router;