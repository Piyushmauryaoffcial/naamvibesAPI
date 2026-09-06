import express from 'express';
import { listUsers, updateUserByAdmin } from '../controllers/authController.js';
import { protect, protectAdmin } from '../middleware/auth.js';
import { listAllBabies } from '../controllers/babyController.js';
import { listAllSearchHistory } from '../controllers/searchHistoryController.js';

const router = express.Router();
router.use(protect, protectAdmin);
router.get('/users', listUsers);
router.put('/users/:id', updateUserByAdmin);
router.get('/babies', listAllBabies);
router.get('/search-history', listAllSearchHistory);
export default router;
