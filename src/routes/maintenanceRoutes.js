import express from 'express';
import {
  seedNPCs,
  cleanDeadNPCs,
  respawnAllNPCs,
  resetNPCSystem,
  reviveAllCharacters,
  getServerStats
} from '../controllers/maintenanceController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación y rol de admin
router.use(protect);
router.use(authorize('admin'));

// Rutas de mantenimiento
router.get('/server-stats', getServerStats);
router.post('/seed-npcs', seedNPCs);
router.post('/clean-dead-npcs', cleanDeadNPCs);
router.post('/respawn-all-npcs', respawnAllNPCs);
router.post('/reset-npc-system', resetNPCSystem);
router.post('/revive-all-characters', reviveAllCharacters);

export default router;