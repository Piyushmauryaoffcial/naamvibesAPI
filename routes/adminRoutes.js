import express from 'express';
import { listUsers, updateUserByAdmin } from '../controllers/authController.js';
import { protect, protectAdmin } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, protectAdmin);
router.get('/users', listUsers);
router.put('/users/:id', updateUserByAdmin);
export default router;
