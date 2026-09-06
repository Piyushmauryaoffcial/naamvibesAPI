import express from 'express';
import { protect } from '../middleware/auth.js';
import { clearSearchHistory, createSearchHistory, listSearchHistory } from '../controllers/searchHistoryController.js';

const router = express.Router();

router.use(protect);
router.get('/', listSearchHistory);
router.post('/', createSearchHistory);
router.delete('/', clearSearchHistory);

export default router;
