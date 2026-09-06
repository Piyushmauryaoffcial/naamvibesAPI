import express from 'express';
import { protect } from '../middleware/auth.js';
import { downloadPremiumPdf, generatePremiumCollection, getPremiumCollection, savePremiumName, listPublicPremiumCollections, getPublicPremiumCollection, requestPublicPremiumPdf } from '../controllers/premiumNameController.js';

const router = express.Router();
router.get('/collections', listPublicPremiumCollections);
router.get('/collections/:slug', getPublicPremiumCollection);
router.post('/collections/:slug/request', requestPublicPremiumPdf);
router.use(protect);
router.get('/', getPremiumCollection);
router.post('/generate', generatePremiumCollection);
router.get('/pdf', downloadPremiumPdf);
router.post('/:nameId/save', savePremiumName);

export default router;
