import { BabyProfile } from '../models/BabyProfile.js';

const allowedFields = ['name', 'dateOfBirth', 'gender', 'birthTime', 'birthPlace', 'rashi', 'nakshatra', 'notes'];

const pickFields = body => Object.fromEntries(
  allowedFields
    .filter(field => Object.prototype.hasOwnProperty.call(body || {}, field))
    .map(field => [field, body[field]])
);

const validateProfile = updates => {
  if (updates.name !== undefined && typeof updates.name !== 'string') return 'name must be a string';
  if (updates.dateOfBirth !== undefined && Number.isNaN(Date.parse(updates.dateOfBirth))) return 'dateOfBirth must be a valid date';
  if (updates.gender !== undefined && !['boy', 'girl', 'unisex'].includes(updates.gender)) return 'gender must be boy, girl, or unisex';
  if (updates.birthTime !== undefined && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(updates.birthTime)) return 'birthTime must use HH:mm format';
  return null;
};

export const listBabies = async (req, res) => {
  const data = await BabyProfile.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data });
};

export const getBaby = async (req, res) => {
  const data = await BabyProfile.findOne({ _id: req.params.id, user: req.user._id });
  if (!data) return res.status(404).json({ success: false, message: 'Baby profile not found' });
  res.json({ success: true, data });
};

export const createBaby = async (req, res) => {
  const updates = pickFields(req.body);
  const validationError = validateProfile(updates);
  if (validationError) return res.status(400).json({ success: false, message: validationError });
  const data = await BabyProfile.create({ ...updates, user: req.user._id });
  res.status(201).json({ success: true, data });
};

export const updateBaby = async (req, res) => {
  const updates = pickFields(req.body);
  if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'No valid fields to update' });
  const validationError = validateProfile(updates);
  if (validationError) return res.status(400).json({ success: false, message: validationError });
  const data = await BabyProfile.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    updates,
    { new: true, runValidators: true }
  );
  if (!data) return res.status(404).json({ success: false, message: 'Baby profile not found' });
  res.json({ success: true, data });
};

export const deleteBaby = async (req, res) => {
  const data = await BabyProfile.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!data) return res.status(404).json({ success: false, message: 'Baby profile not found' });
  res.json({ success: true, message: 'Baby profile deleted successfully' });
};

export const listAllBabies = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const [data, total] = await Promise.all([
    BabyProfile.find().populate('user', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    BabyProfile.countDocuments()
  ]);
  res.json({ success: true, meta: { total, page, pages: Math.ceil(total / limit), limit }, data });
};
