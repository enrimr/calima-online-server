import express from 'express';
import { getGameStats, getUsers, updateUser, banUser } from '../controllers/adminController.js';
import { adminUpdateCharacter } from '../controllers/characterController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas de admin requieren autenticación
router.use(protect);

// GET /api/admin/stats - Obtener estadísticas del juego
router.get('/stats', getGameStats);

// GET /api/admin/users - Obtener lista de usuarios (solo admin)
router.get('/users', getUsers);

// PUT /api/admin/users/:userId - Actualizar usuario (solo admin)
router.put('/users/:userId', updateUser);

// POST /api/admin/users/:userId/ban - Banear/desbanear usuario (solo admin)
router.post('/users/:userId/ban', banUser);

// PUT /api/admin/characters/:characterId - Actualizar personaje (solo admin)
router.put('/characters/:characterId', adminUpdateCharacter);

export default router;
