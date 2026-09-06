import express from 'express';
import { protect } from '../middleware/auth.js';
import { createBaby, deleteBaby, getBaby, listBabies, updateBaby } from '../controllers/babyController.js';

const router = express.Router();

router.use(protect);
router.get('/', listBabies);
router.post('/', createBaby);
router.get('/:id', getBaby);
router.put('/:id', updateBaby);
router.delete('/:id', deleteBaby);

export default router;
