import express from 'express';
import { 
  register, 
  login, 
  getMe, 
  changePassword,
  verifyToken 
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Rutas públicas
router.post('/register', register);
router.post('/login', login);
router.get('/verify-token', verifyToken);

// Rutas protegidas
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

export default router;