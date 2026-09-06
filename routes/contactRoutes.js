import express from 'express';
import { submitContactMessage, listContactLeads, getContactCaptcha } from '../controllers/contactController.js';
import { protect, protectAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', submitContactMessage);
router.get('/captcha', getContactCaptcha);
router.get('/', protect, protectAdmin, listContactLeads);

export default router;
