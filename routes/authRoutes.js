import express from 'express';
import { register, login, googleLogin, logout, linkPartner, getProfile, updateProfile, changePassword, listUsers, updateUserByAdmin } from '../controllers/authController.js';
import { protect, protectAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/logout', protect, logout);
router.post('/link-partner', protect, linkPartner);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.get('/admin/users', protect, protectAdmin, listUsers);
router.put('/admin/users/:id', protect, protectAdmin, updateUserByAdmin);

export default router;
