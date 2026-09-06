import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import { BabyName } from '../models/BabyName.js';
import { BabyProfile } from '../models/BabyProfile.js';
import { PremiumNameCollection } from '../models/PremiumNameCollection.js';
import { generatePremiumBabyNames } from '../services/geminiService.js';
import { PremiumCollectionRequest } from '../models/PremiumCollectionRequest.js';

const cleanLetters = value => [...new Set(String(value || '').toUpperCase().split(/[\s,]+/).map(letter => letter.trim()).filter(letter => /^[A-Z]$/.test(letter)))];

const profilePreferences = async (user, babyId) => {
  if (!babyId) return null;
  if (!mongoose.isValidObjectId(babyId)) {
    const error = new Error('Invalid baby profile');
    error.statusCode = 400;
    throw error;
  }
  const profile = await BabyProfile.findOne({ _id: babyId, user: user._id });
  if (!profile) {
    const error = new Error('Baby profile not found');
    error.statusCode = 404;
    throw error;
  }
  return profile;
};

const scoreName = (name, preferences) => {
  let score = 72;
  if (preferences.gender && name.gender === preferences.gender) score += 10;
  if (preferences.startingLetters?.includes(name.startingLetter?.toUpperCase())) score += 7;
  if (preferences.rashi && name.astrology?.rashi?.en?.toLowerCase() === preferences.rashi.toLowerCase()) score += 5;
  if (preferences.nakshatra && name.astrology?.nakshatra?.toLowerCase().includes(preferences.nakshatra.toLowerCase())) score += 4;
  if (preferences.meaning && name.meaning?.toLowerCase().includes(preferences.meaning.toLowerCase())) score += 2;
  if (preferences.style && /modern/i.test(preferences.style) && name.name.length <= 7) score += 2;
  return Math.min(score, 99);
};

const explainName = (name, preferences, aiReason = '') => {
  if (aiReason) return aiReason;
  const reasons = [];
  if (preferences.startingLetters?.includes(name.startingLetter?.toUpperCase())) reasons.push(`starts with ${name.startingLetter}`);
  if (preferences.gender && name.gender === preferences.gender) reasons.push(`matches your ${preferences.gender} preference`);
  if (preferences.rashi && name.astrology?.rashi?.en?.toLowerCase() === preferences.rashi.toLowerCase()) reasons.push('aligns with the selected Rashi');
  if (preferences.style) reasons.push(`${preferences.style.toLowerCase()} naming style`);
  return reasons.length ? `Selected because it ${reasons.join(' and ')}.` : 'Selected for its meaning, cultural roots and balanced name profile.';
};

const serializeCollection = collection => ({
  ...collection.toObject(),
  selectedNames: collection.selectedNames.map(item => ({
    ...item.toObject(),
    name: item.name
  }))
});

const collectionDefinitions = {
  'leo-rashi': { title: '50 Premium Baby Names for Leo (Singh) Rashi', description: 'Confident, radiant names aligned with Singh Rashi traditions.', rashi: 'Leo', gender: '', style: 'Modern + Traditional' },
  'boy-names': { title: '50 Premium Indian Boy Names', description: 'Strong, meaningful and timeless names for boys.', rashi: '', gender: 'boy', style: 'Modern Indian' },
  'girl-names': { title: '50 Premium Indian Girl Names', description: 'Graceful, meaningful and beautiful names for girls.', rashi: '', gender: 'girl', style: 'Modern Indian' },
  'sanskrit-names': { title: '50 Premium Sanskrit Names', description: 'Rooted Sanskrit names with enduring meaning and cultural depth.', rashi: '', gender: '', style: 'Sanskrit' }
};

const getDefinition = slug => collectionDefinitions[slug] || null;

const collectionNames = async definition => {
  const filter = {};
  if (definition.gender) filter.gender = definition.gender;
  if (definition.rashi) filter['astrology.rashi.en'] = new RegExp(`^${definition.rashi}$`, 'i');
  if (definition.style === 'Sanskrit') filter.origin = /^Sanskrit$/i;
  let names = await BabyName.find(filter).sort({ popularityScore: -1, name: 1 }).limit(50);
  if (names.length < 50 && !definition.rashi) {
    names = await BabyName.find(definition.gender ? { gender: definition.gender } : {}).sort({ popularityScore: -1, name: 1 }).limit(50);
  }
  return names;
};

export const listPublicPremiumCollections = async (req, res) => {
  const data = await Promise.all(Object.entries(collectionDefinitions).map(async ([slug, definition]) => ({ slug, ...definition, count: await BabyName.countDocuments(definition.rashi ? { 'astrology.rashi.en': new RegExp(`^${definition.rashi}$`, 'i') } : definition.gender ? { gender: definition.gender } : definition.style === 'Sanskrit' ? { origin: /^Sanskrit$/i } : {}) })));
  res.json({ success: true, data });
};

export const getPublicPremiumCollection = async (req, res) => {
  const definition = getDefinition(req.params.slug);
  if (!definition) return res.status(404).json({ success: false, message: 'Premium collection not found' });
  const names = await collectionNames(definition);
  res.json({ success: true, data: { slug: req.params.slug, ...definition, names } });
};

export const requestPublicPremiumPdf = async (req, res) => {
  const definition = getDefinition(req.params.slug);
  const { name, email, phone, babyName, notes } = req.body || {};
  if (!definition) return res.status(404).json({ success: false, message: 'Premium collection not found' });
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) return res.status(400).json({ success: false, message: 'Name and a valid email are required' });
  const names = await collectionNames(definition);
  await PremiumCollectionRequest.create({ collectionSlug: req.params.slug, name, email, phone, babyName, notes });
  const filename = `NaamVibes_${req.params.slug}_Premium_Collection.pdf`;
  const doc = new PDFDocument({ size: 'A4', margin: 54, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const pdfChunks = [];
  doc.on('data', chunk => pdfChunks.push(chunk));
  doc.on('end', () => res.end(Buffer.concat(pdfChunks)));
  doc.on('error', error => {
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Unable to generate PDF', error: error.message });
    else res.destroy(error);
  });
  doc.fillColor('#172033').fontSize(28).font('Helvetica-Bold').text('NaamVibes');
  doc.fillColor('#ea580c').fontSize(11).text('PREMIUM BABY NAME COLLECTION', { characterSpacing: 1.5 });
  doc.moveDown(1.5).fillColor('#172033').fontSize(22).text(definition.title);
  doc.moveDown(.5).font('Helvetica').fontSize(11).text(`Prepared for: ${name}${babyName ? ` · Baby: ${babyName}` : ''}`);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`);
  doc.moveDown(1).fillColor('#ea580c').fontSize(15).font('Helvetica-Bold').text('Curated name list');
  names.forEach((item, index) => {
    if (doc.y > 700) doc.addPage();
    doc.fillColor('#172033').fontSize(13).font('Helvetica-Bold').text(`${index + 1}. ${item.name}`);
    doc.font('Helvetica').fontSize(9).text(`Gender: ${item.gender} · Meaning: ${item.meaning || 'Not specified'} · Rashi: ${item.astrology?.rashi?.hi || item.astrology?.rashi?.en || 'Not specified'} · Nakshatra: ${item.astrology?.nakshatra || 'Not specified'} · Origin: ${item.origin || 'Not specified'}`);
    doc.moveDown(.55);
  });
  const pages = doc.bufferedPageRange();
  for (let page = pages.start; page < pages.start + pages.count; page += 1) {
    doc.switchToPage(page);
    doc.fillColor('#64748b').fontSize(8).text(`NaamVibes · Page ${page + 1} of ${pages.count}`, 54, 770, { align: 'center', width: 487 });
  }
  doc.end();
};

export const getPremiumCollection = async (req, res) => {
  const collection = await PremiumNameCollection.findOne({ user: req.user._id })
    .sort({ updatedAt: -1 })
    .populate('selectedNames.name')
    .populate('baby');
  res.json({ success: true, data: collection ? serializeCollection(collection) : null });
};

export const generatePremiumCollection = async (req, res) => {
  try {
    const { babyId, parentNames, gender, style, startingLetters, rashi, nakshatra, meaning, count = 12 } = req.body || {};
    const profile = await profilePreferences(req.user, babyId);
    const preferences = {
      gender: gender || profile?.gender || '',
      style: style || '',
      startingLetters: cleanLetters(startingLetters || req.user.preferences?.startingLetters),
      rashi: rashi || profile?.rashi || '',
      nakshatra: nakshatra || profile?.nakshatra || '',
      meaning: meaning || ''
    };
    const filter = {};
    if (preferences.gender) filter.gender = preferences.gender;
    if (preferences.rashi) filter['astrology.rashi.en'] = new RegExp(`^${String(preferences.rashi).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (preferences.nakshatra) filter['astrology.nakshatra'] = new RegExp(String(preferences.nakshatra).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (preferences.startingLetters.length) filter.startingLetter = { $in: preferences.startingLetters };
    if (preferences.meaning) filter.meaning = new RegExp(String(preferences.meaning).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const requestedCount = Math.min(Math.max(Number(count) || 12, 1), 30);
    const aiSuggestions = await generatePremiumBabyNames({
      parentNames,
      gender: preferences.gender,
      style: preferences.style,
      startingLetters: preferences.startingLetters,
      rashi: preferences.rashi,
      nakshatra: preferences.nakshatra,
      meaning: preferences.meaning,
      count: requestedCount
    });
    const aiNames = aiSuggestions.map(item => item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (aiNames.length) filter.name = { $in: aiNames.map(name => new RegExp(`^${name}$`, 'i')) };
    let names = await BabyName.find(filter).sort({ popularityScore: -1, name: 1 }).limit(requestedCount);
    if (names.length < 6) {
      const fallbackFilter = preferences.gender ? { gender: preferences.gender } : {};
      names = await BabyName.find(fallbackFilter).sort({ popularityScore: -1, name: 1 }).limit(requestedCount);
    }
    const aiReasonByName = new Map(aiSuggestions.map(item => [item.name.toLowerCase(), item.reason]));
    const selectedNames = names.map(name => ({ name: name._id, matchScore: scoreName(name, preferences), explanation: explainName(name, preferences, aiReasonByName.get(name.name.toLowerCase())) }));
    const collection = await PremiumNameCollection.findOneAndUpdate(
      { user: req.user._id },
      { user: req.user._id, baby: profile?._id, parentNames: parentNames || '', gender: preferences.gender || undefined, preferences, selectedNames },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('selectedNames.name').populate('baby');
    res.json({ success: true, data: serializeCollection(collection) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Unable to generate premium names', error: error.statusCode ? undefined : error.message });
  }
};

export const downloadPremiumPdf = async (req, res) => {
  const collection = await PremiumNameCollection.findOne({ user: req.user._id }).sort({ updatedAt: -1 }).populate('selectedNames.name').populate('baby');
  if (!collection) return res.status(404).json({ success: false, message: 'Generate a premium collection first' });
  const babyName = collection.baby?.name || 'Collection';
  const filename = `NaamVibes_Premium_Name_Collection_${babyName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  const doc = new PDFDocument({ size: 'A4', margin: 54, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const pdfChunks = [];
  doc.on('data', chunk => pdfChunks.push(chunk));
  doc.on('end', () => res.end(Buffer.concat(pdfChunks)));
  doc.on('error', error => {
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Unable to generate PDF', error: error.message });
    else res.destroy(error);
  });
  const orange = '#ea580c';
  const ink = '#172033';
  doc.fillColor(ink).fontSize(28).font('Helvetica-Bold').text('NaamVibes');
  doc.fillColor(orange).fontSize(11).text('PREMIUM BABY NAME COLLECTION', { characterSpacing: 1.5 });
  doc.moveDown(2).fillColor(ink).fontSize(24).text('Personalized Name Report');
  doc.moveDown(.8).fontSize(11).font('Helvetica').text(`Parents: ${collection.parentNames || 'Not specified'}`);
  doc.text(`Baby Gender: ${collection.gender || 'Not specified'}`);
  doc.text(`Preferred Style: ${collection.preferences?.style || 'Not specified'}`);
  doc.text(`Starting Letters: ${collection.preferences?.startingLetters?.join(', ') || 'Not specified'}`);
  doc.moveDown(2).fillColor(orange).fontSize(18).font('Helvetica-Bold').text('Your Curated Baby Names');
  doc.moveDown(.7);
  collection.selectedNames.forEach((entry, index) => {
    const name = entry.name;
    if (!name) return;
    if (doc.y > 680) doc.addPage();
    doc.roundedRect(54, doc.y, 487, 105, 8).lineWidth(1).strokeColor('#fed7aa').stroke();
    doc.fillColor(ink).fontSize(17).font('Helvetica-Bold').text(`${index + 1}. ${name.name}`, 70, doc.y + 14);
    doc.fillColor(orange).fontSize(11).text(`${entry.matchScore}% AI match`, 400, doc.y - 17, { width: 125, align: 'right' });
    doc.fillColor(ink).fontSize(10).font('Helvetica').text(`Gender: ${name.gender || 'Not specified'}   Meaning: ${name.meaning || 'Not specified'}`, 70, doc.y + 8);
    doc.text(`Rashi: ${name.astrology?.rashi?.hi || name.astrology?.rashi?.en || 'Not specified'}   Nakshatra: ${name.astrology?.nakshatra || 'Not specified'}   Starting Letter: ${name.startingLetter || 'Not specified'}`, 70, doc.y + 24);
    doc.text(`Why we recommend it: ${entry.explanation}`, 70, doc.y + 40, { width: 455 });
    doc.moveDown(5.4);
  });
  doc.addPage().fillColor(ink).fontSize(28).font('Helvetica-Bold').text('NaamVibes');
  doc.moveDown(1).fontSize(20).text('Find a name they will carry for a lifetime.');
  doc.moveDown(1).fontSize(11).font('Helvetica').text('Premium Baby Name Collection');
  doc.text(`Generated for: ${collection.baby?.name || collection.parentNames || 'your family'}`);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.fillColor('#64748b').fontSize(9).text(`NaamVibes  •  Page ${i + 1} of ${range.count}`, 54, 770, { align: 'center', width: 487 });
  }
  doc.end();
};

export const savePremiumName = async (req, res) => {
  const collection = await PremiumNameCollection.findOne({ user: req.user._id });
  if (!collection || !collection.selectedNames.some(item => String(item.name) === String(req.params.nameId))) return res.status(404).json({ success: false, message: 'Name is not in your premium collection' });
  const user = req.user;
  if (!user.favorites.some(id => String(id) === String(req.params.nameId))) {
    user.favorites.push(req.params.nameId);
    await user.save();
  }
  res.json({ success: true, message: 'Premium name saved' });
};

export const listPremiumCollections = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const [data, total] = await Promise.all([
    PremiumNameCollection.find().populate('user', 'name email').populate('baby', 'name gender').populate('selectedNames.name', 'name gender meaning astrology startingLetter').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit),
    PremiumNameCollection.countDocuments()
  ]);
  res.json({ success: true, meta: { total, page, pages: Math.ceil(total / limit), limit }, data });
};

export const listPremiumCollectionRequests = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const [data, total] = await Promise.all([
    PremiumCollectionRequest.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    PremiumCollectionRequest.countDocuments()
  ]);
  res.json({ success: true, meta: { total, page, pages: Math.ceil(total / limit), limit }, data });
};
