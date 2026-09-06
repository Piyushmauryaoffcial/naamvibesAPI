import { BabyName } from '../models/BabyName.js';
import { User } from '../models/User.js';
import { generateGeminiBabyNames, blendParentNames } from '../services/geminiService.js';
import mongoose from 'mongoose';

const sampleNames = (query, limit = 8) => BabyName.aggregate([{ $match: query }, { $sample: { size: limit } }]);

export const suggestWithAI = async (req, res) => {
  try {
    const { gender, rashi, startingLetter, deity, theme, count } = req.body || {};
    const generated = await generateGeminiBabyNames({ gender, rashi, startingLetter, deity, theme, count });
    const seen = new Set();
    const names = generated.filter(item => {
      const key = item.name?.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(item => ({ ...item, isAiGenerated: true }));
    res.status(200).json({ success: true, source: 'ai', data: names });
  } catch (error) {
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      const fallback = [
        { name: 'Aarav', devanagari: 'आरव', meaning: 'Peaceful and wise', gender: req.body?.gender || 'unisex', startingLetter: 'A' },
        { name: 'Vedika', devanagari: 'वेदिका', meaning: 'Full of knowledge', gender: req.body?.gender || 'unisex', startingLetter: 'V' },
        { name: 'Ishani', devanagari: 'ईशानी', meaning: 'Goddess Durga', gender: req.body?.gender || 'unisex', startingLetter: 'I' }
      ].slice(0, Math.min(Number(req.body?.count) || 3, 3)).map(item => ({ ...item, isAiGenerated: true }));
      return res.status(200).json({ success: true, source: 'fallback', data: fallback });
    }
    res.status(500).json({ success: false, message: 'AI suggestion failed', error: error.message });
  }
};

export const getPersonalizedRecommendations = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    const favoriteIds = user.favorites.map(item => item._id);
    const preferredGender = user.favorites[0]?.gender;
    const preferredRashi = user.favorites[0]?.astrology?.rashi?.en;
    const filter = { _id: { $nin: favoriteIds } };
    if (preferredGender) filter.gender = preferredGender;
    if (preferredRashi) filter['astrology.rashi.en'] = preferredRashi;
    let data = await BabyName.find(filter).sort({ name: 1 }).limit(12);
    if (data.length < 6) data = await BabyName.find({ _id: { $nin: favoriteIds } }).limit(12);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to load recommendations', error: error.message });
  }
};

export const getCompatibilityScore = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.nameIds) ? req.body.nameIds : [];
    if (ids.length !== 2 || ids.some(id => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: 'Exactly two valid nameIds are required' });
    }
    const names = await BabyName.find({ _id: { $in: ids } });
    if (names.length !== 2) return res.status(404).json({ success: false, message: 'Both names must exist' });
    const [first, second] = names;
    let score = 40;
    if (first.gender === second.gender || first.gender === 'unisex' || second.gender === 'unisex') score += 15;
    if (first.astrology?.rashi?.en === second.astrology?.rashi?.en) score += 20;
    if (first.astrology?.nakshatra === second.astrology?.nakshatra) score += 15;
    const firstDeities = first.attributes?.deities || [];
    const secondDeities = new Set(second.attributes?.deities || []);
    if (firstDeities.some(deity => secondDeities.has(deity))) score += 10;
    res.status(200).json({ success: true, data: { score: Math.min(score, 100), names: [first, second] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to calculate compatibility', error: error.message });
  }
};

export const browseAlphabet = async (req, res) => {
  const letter = String(req.query.letter || '').trim();
  if (!/^[a-z]$/i.test(letter)) return res.status(400).json({ success: false, message: 'letter must be A-Z' });
  const data = await BabyName.find({ startingLetter: new RegExp(`^${letter}`, 'i') }).sort({ name: 1 }).limit(100);
  res.json({ success: true, data });
};

export const popularNames = async (req, res) => {
  const data = await User.aggregate([
    { $unwind: '$favorites' },
    { $group: { _id: '$favorites', favoriteCount: { $sum: 1 } } },
    { $sort: { favoriteCount: -1 } },
    { $limit: 12 },
    { $lookup: { from: 'babynames', localField: '_id', foreignField: '_id', as: 'name' } },
    { $unwind: '$name' },
    { $replaceRoot: { newRoot: { $mergeObjects: ['$name', { favoriteCount: '$favoriteCount' }] } } }
  ]);
  res.json({ success: true, data });
};

export const nameOfTheDay = async (req, res) => {
  const count = await BabyName.countDocuments();
  if (!count) return res.json({ success: true, data: null });
  const day = Math.floor(Date.now() / 86400000);
  const [data] = await BabyName.find().sort({ _id: 1 }).skip(day % count).limit(1);
  res.json({ success: true, data });
};

export const randomNames = async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 6, 1), 20);
  res.json({ success: true, data: await sampleNames({}, limit) });
};

export const nameCategories = async (req, res) => {
  const [rashis, religions, categories] = await Promise.all([
    BabyName.distinct('astrology.rashi.en'),
    BabyName.distinct('religion'),
    BabyName.distinct('categories')
  ]);
  res.json({ success: true, data: { rashis, religions, categories } });
};

export const listNames = async (req, res) => {
  try {
    const { gender, rashi, nakshatra, color, deity, numerology, search, religion, category, origin, meaning, startingLetter } = req.query;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};

    if (gender) filter.gender = gender.toLowerCase();
    if (rashi) {
      const rashiPattern = new RegExp(`^${String(rashi).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      filter.$or = [
        { 'astrology.rashi.en': rashiPattern },
        { 'astrology.rashi.hi': rashiPattern }
      ];
    }
    if (nakshatra) filter['astrology.nakshatra'] = new RegExp(String(nakshatra), 'i');
    if (color) filter['attributes.luckyColors'] = new RegExp(String(color), 'i');
    if (deity) filter['attributes.deities'] = new RegExp(String(deity), 'i');
    if (religion) filter.religion = new RegExp(String(religion), 'i');
    if (category) filter.categories = new RegExp(String(category), 'i');
    if (origin) filter.origin = new RegExp(String(origin), 'i');
    if (meaning) filter.meaning = new RegExp(String(meaning), 'i');
    if (startingLetter) filter.startingLetter = String(startingLetter).trim().slice(0, 1).toUpperCase();
    if (req.query.minLength || req.query.maxLength) {
      filter.$expr = { $and: [
        ...(req.query.minLength ? [{ $gte: [{ $strLenCP: '$name' }, Number(req.query.minLength)] }] : []),
        ...(req.query.maxLength ? [{ $lte: [{ $strLenCP: '$name' }, Number(req.query.maxLength)] }] : [])
      ] };
    }
    if (numerology) {
      const number = Number(numerology);
      if (!Number.isInteger(number) || number < 1 || number > 9) {
        return res.status(400).json({ success: false, message: 'numerology must be an integer from 1 to 9' });
      }
      filter['attributes.numerologyNumber'] = number;
    }
    if (req.query.year) {
      const year = Number(req.query.year);
      if (!Number.isInteger(year) || year < 1900 || year > 2200) {
        return res.status(400).json({ success: false, message: 'year must be between 1900 and 2200' });
      }
      filter.recommendationYear = year;
    }
    if (req.query.month) {
      const month = Number(req.query.month);
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({ success: false, message: 'month must be an integer from 1 to 12' });
      }
      filter.recommendationMonth = month;
    }
    if (search) filter.$text = { $search: String(search) };

    const sortBy = { popular: { popularityScore: -1 }, unique: { popularityScore: 1 }, latest: { createdAt: -1 }, az: { name: 1 } }[req.query.sortBy] || { name: 1 };
    let [total, data] = await Promise.all([
      BabyName.countDocuments(filter),
      BabyName.find(filter).sort(search ? { score: { $meta: 'textScore' } } : sortBy)
        .skip((page - 1) * limit).limit(limit)
    ]);

    let aiFallback = false;
    if (search && total === 0) {
      const generated = await generateGeminiBabyNames({
        gender,
        rashi,
        theme: String(search),
        count: limit,
        year: req.query.year ? Number(req.query.year) : undefined,
        month: req.query.month ? Number(req.query.month) : undefined
      });
      const seen = new Set();
      const generatedNames = generated.map((item) => item.name?.trim()).filter(Boolean);
      const existingGenerated = await BabyName.find({ name: { $in: generatedNames } })
        .select('name').collation({ locale: 'en', strength: 2 });
      const existingNames = new Set(existingGenerated.map((item) => item.name.toLowerCase()));
      data = generated.filter((item) => {
        const key = item.name?.trim().toLowerCase();
        if (!key || seen.has(key) || existingNames.has(key)) return false;
        seen.add(key);
        return true;
      }).map((item) => ({
        ...item,
        isAiGenerated: true,
        recommendationYear: req.query.year ? Number(req.query.year) : undefined,
        recommendationMonth: req.query.month ? Number(req.query.month) : undefined
      }));
      total = data.length;
      aiFallback = true;
    }
    res.status(200).json({
      success: true,
      meta: { total, page, pages: Math.ceil(total / limit), limit },
      data,
      ...(aiFallback ? { source: 'ai-fallback', message: 'No matching database names found; generated genuine suggestions with AI' } : {})
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to fetch names', error: error.message });
  }
};

export const getNameById = async (req, res) => {
  try {
    const identifier = decodeURIComponent(req.params.id);
    const name = mongoose.isValidObjectId(identifier)
      ? await BabyName.findById(identifier)
      : await BabyName.findOne({
        name: new RegExp(`^${identifier.split('-').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[ -]+')}$`, 'i')
      });
    if (!name) return res.status(404).json({ success: false, message: 'Name not found' });
    res.status(200).json({ success: true, data: name });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to fetch name', error: error.message });
  }
};

export const createName = async (req, res) => {
  try {
    const nameData = req.body || {};
    if (!nameData.name || !nameData.meaning || !nameData.gender || !nameData.startingLetter ||
        !nameData.astrology?.rashi?.en || !nameData.astrology?.rashi?.hi) {
      return res.status(400).json({ success: false, message: 'name, meaning, gender, startingLetter, and astrology.rashi are required' });
    }
    const duplicate = await BabyName.findOne({ name: nameData.name.trim() }).collation({ locale: 'en', strength: 2 });
    if (duplicate) return res.status(409).json({ success: false, message: 'A name with this spelling already exists' });
    const name = await BabyName.create({ ...nameData, name: nameData.name.trim(), isAiGenerated: false });
    res.status(201).json({ success: true, data: name });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to create name', error: error.message });
  }
};

export const updateName = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Name not found' });
    if (req.body?.name) {
      const duplicate = await BabyName.findOne({
        name: req.body.name.trim(), _id: { $ne: req.params.id }
      }).collation({ locale: 'en', strength: 2 });
      if (duplicate) return res.status(409).json({ success: false, message: 'A name with this spelling already exists' });
    }
    const name = await BabyName.findByIdAndUpdate(req.params.id, req.body || {}, { new: true, runValidators: true });
    if (!name) return res.status(404).json({ success: false, message: 'Name not found' });
    res.status(200).json({ success: true, data: name });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to update name', error: error.message });
  }
};

export const deleteName = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Name not found' });
    const name = await BabyName.findByIdAndDelete(req.params.id);
    if (!name) return res.status(404).json({ success: false, message: 'Name not found' });
    await User.updateMany({ favorites: name._id }, { $pull: { favorites: name._id } });
    res.status(200).json({ success: true, message: 'Name deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to delete name', error: error.message });
  }
};

// AI Name Generator Endpoint
export const generateWithAI = async (req, res) => {
  try {
    const { gender, rashi, startingLetter, deity, theme, count, year, month } = req.body || {};
    const normalizedYear = year === undefined ? undefined : Number(year);
    const normalizedMonth = month === undefined ? undefined : Number(month);
    if (normalizedYear !== undefined && (!Number.isInteger(normalizedYear) || normalizedYear < 1900 || normalizedYear > 2200)) {
      return res.status(400).json({ success: false, message: 'year must be between 1900 and 2200' });
    }
    if (normalizedMonth !== undefined && (!Number.isInteger(normalizedMonth) || normalizedMonth < 1 || normalizedMonth > 12)) {
      return res.status(400).json({ success: false, message: 'month must be an integer from 1 to 12' });
    }
    const generated = await generateGeminiBabyNames({
      gender, rashi, startingLetter, deity, theme, count, year: normalizedYear, month: normalizedMonth
    });
    const uniqueGenerated = [];
    const seen = new Set();
    for (const item of generated) {
      const key = item.name?.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uniqueGenerated.push({
        ...item,
        name: item.name.trim(),
        recommendationYear: normalizedYear,
        recommendationMonth: normalizedMonth,
        isAiGenerated: true
      });
    }
    const existing = await BabyName.find({
      name: { $in: uniqueGenerated.map(item => item.name) }
    }).select('name').collation({ locale: 'en', strength: 2 });
    const existingNames = new Set(existing.map(item => item.name.toLowerCase()));
    const newNames = uniqueGenerated.filter(item => !existingNames.has(item.name.toLowerCase()));

    // Save generated names to DB for caching and global availability
    try {
      await BabyName.insertMany(newNames, { ordered: false });
    } catch (cacheError) {
      console.warn('Unable to cache generated names:', cacheError.message);
    }

    // Even when every suggestion is already cached, return the generated records
    // so clients always receive usable names rather than an empty success payload.
    res.status(200).json({ success: true, source: 'ai', data: newNames.length ? newNames : uniqueGenerated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'AI Generation Failed', error: error.message });
  }
};

// Parents' Name Blending Feature
export const combineParentsNames = async (req, res) => {
  try {
    const { fatherName, motherName, gender } = req.body || {};
    if (!fatherName || !motherName || !gender) {
      return res.status(400).json({ success: false, message: 'fatherName, motherName, and gender are required' });
    }

    try {
      const combinations = await blendParentNames({ fatherName, motherName, gender });
      return res.status(200).json({ success: true, source: 'ai', data: combinations });
    } catch (error) {
      if (!error.message?.includes('429') && !error.message?.includes('RESOURCE_EXHAUSTED')) throw error;
      const father = fatherName.trim();
      const mother = motherName.trim();
      const combinations = [...new Set([
        `${father.slice(0, 3)}${mother.slice(-3)}`,
        `${mother.slice(0, 3)}${father.slice(-3)}`,
        `${father.slice(0, 2)}${mother.slice(0, 4)}`,
        `${mother.slice(0, 2)}${father.slice(0, 4)}`
      ].map(name => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()))].map(name => ({
        name,
        meaning: 'A unique family blend created from both parent names',
        blendOrigin: `Letters blended from ${fatherName} and ${motherName}`,
        gender
      }));
      return res.status(200).json({ success: true, source: 'fallback', data: combinations });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Toggle Shortlist/Favorite
export const toggleFavorite = async (req, res) => {
  try {
    const { nameId } = req.params;
    const user = await User.findById(req.user._id);

    if (!mongoose.isValidObjectId(nameId) || !(await BabyName.exists({ _id: nameId }))) {
      return res.status(404).json({ success: false, message: 'Name not found' });
    }
    const isFav = user.favorites.some(id => id.toString() === nameId);
    if (isFav) {
      user.favorites.pull(nameId);
    } else {
      user.favorites.push(nameId);
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: isFav ? 'Removed from shortlist' : 'Added to shortlist',
      favorites: user.favorites
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const toggleShortlist = async (req, res) => {
  try {
    const { nameId } = req.params;
    if (!mongoose.isValidObjectId(nameId) || !(await BabyName.exists({ _id: nameId }))) return res.status(404).json({ success: false, message: 'Name not found' });
    const user = await User.findById(req.user._id);
    const isSaved = user.shortlist.some(id => id.toString() === nameId);
    if (isSaved) user.shortlist.pull(nameId); else user.shortlist.push(nameId);
    await user.save();
    res.json({ success: true, message: isSaved ? 'Removed from shortlist' : 'Added to shortlist', data: await User.findById(user._id).populate('shortlist').then(item => item.shortlist) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to update shortlist', error: error.message });
  }
};

export const getShortlist = async (req, res) => {
  const user = await User.findById(req.user._id).populate('shortlist');
  res.json({ success: true, data: user.shortlist });
};

export const getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    res.status(200).json({ success: true, data: user.favorites });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to fetch favorites', error: error.message });
  }
};

// Mutual Partner Match Check (Like Tinder match for baby names)
export const getPartnerMatches = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    if (!user.linkedPartner) {
      return res.status(400).json({ success: false, message: 'No partner linked yet' });
    }

    const partner = await User.findById(user.linkedPartner).populate('favorites');

    // Find intersection of both parents' favorites
    const partnerFavIds = new Set(partner.favorites.map(f => f._id.toString()));
    const mutualMatches = user.favorites.filter(fav => partnerFavIds.has(fav._id.toString()));

    res.status(200).json({
      success: true,
      partnerName: partner.name,
      matchCount: mutualMatches.length,
      matches: mutualMatches
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};