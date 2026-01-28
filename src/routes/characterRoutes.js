import express from 'express';
import {
  getCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  selectCharacter,
  disconnectCharacter,
  checkNameAvailability
} from '../controllers/characterController.js';
import { protect, checkCharacterOwnership } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas de personajes
router.route('/')
  .get(getCharacters)
  .post(createCharacter);

router.get('/check-name/:name', checkNameAvailability);

router.route('/:id')
  .get(getCharacter)
  .put(checkCharacterOwnership, updateCharacter)
  .delete(checkCharacterOwnership, deleteCharacter);

router.post('/:id/select', checkCharacterOwnership, selectCharacter);
router.post('/:id/disconnect', checkCharacterOwnership, disconnectCharacter);

export default router;