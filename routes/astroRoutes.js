import express from 'express';
import { getBirthChartAndNames } from '../controllers/astroController.js';

const router = express.Router();

router.post('/calculate-birth-names', getBirthChartAndNames);

export default router;
