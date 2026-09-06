import express from 'express';
import { getBirthChartAndNames } from '../controllers/astroController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/calculate-birth-names', protect, getBirthChartAndNames);

export default router;
