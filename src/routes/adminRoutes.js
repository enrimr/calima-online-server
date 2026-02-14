import express from 'express';
import { getGameStats, getUsers, updateUser, banUser, getAllCharacters, updateCharacter, getActiveNPCs, regenerateNPCInstances } from '../controllers/adminController.js';
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

// GET /api/admin/characters - Obtener todos los personajes (solo admin/moderator)
router.get('/characters', getAllCharacters);

// PUT /api/admin/characters/:characterId - Actualizar personaje (solo admin/moderator)
router.put('/characters/:characterId', updateCharacter);

// GET /api/admin/npcs - Obtener lista de NPCs activos (solo admin/moderator)
router.get('/npcs', getActiveNPCs);

export default router;
