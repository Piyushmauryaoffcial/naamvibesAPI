import express from 'express';
import { listUsers, updateUserByAdmin } from '../controllers/authController.js';
import { protect, protectAdmin } from '../middleware/auth.js';
import { listAllBabies } from '../controllers/babyController.js';
import { listAllSearchHistory } from '../controllers/searchHistoryController.js';
import { listPremiumCollections, listPremiumCollectionRequests } from '../controllers/premiumNameController.js';

const router = express.Router();
router.use(protect, protectAdmin);
router.get('/users', listUsers);
router.put('/users/:id', updateUserByAdmin);
router.get('/babies', listAllBabies);
router.get('/search-history', listAllSearchHistory);
router.get('/premium-names', listPremiumCollections);
router.get('/premium-name-requests', listPremiumCollectionRequests);
export default router;
