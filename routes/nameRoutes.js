import express from 'express';
import {
  generateWithAI,
  combineParentsNames,
  listNames,
  getNameById,
  toggleFavorite,
  getFavorites,
  getPartnerMatches,
  createName,
  updateName,
  deleteName,
  browseAlphabet,
  popularNames,
  nameOfTheDay,
  randomNames,
  nameCategories,
  suggestWithAI,
  getPersonalizedRecommendations,
  getCompatibilityScore
  ,toggleShortlist
  ,getShortlist
} from '../controllers/nameController.js';
import { protect, protectAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/ai-generate', protect, protectAdmin, generateWithAI);
router.post('/ai-suggest', protect, suggestWithAI);
router.post('/blend-parents', protect, combineParentsNames);
router.post('/compatibility', protect, getCompatibilityScore);
router.get('/recommendations', protect, getPersonalizedRecommendations);
router.get('/alphabet', browseAlphabet);
router.get('/popular', popularNames);
router.get('/name-of-day', nameOfTheDay);
router.get('/random', randomNames);
router.get('/categories', nameCategories);
router.post('/', protect, protectAdmin, createName);
router.put('/:id', protect, protectAdmin, updateName);
router.delete('/:id', protect, protectAdmin, deleteName);
router.get('/favorites', protect, getFavorites);
router.get('/partner-matches', protect, getPartnerMatches);
router.get('/shared-shortlist', protect, getPartnerMatches);
router.get('/shortlist', protect, getShortlist);
router.post('/shortlist/:nameId', protect, toggleShortlist);
router.post('/favorite/:nameId', protect, toggleFavorite);
router.get('/:id', getNameById);
router.get('/', listNames);

export default router;
