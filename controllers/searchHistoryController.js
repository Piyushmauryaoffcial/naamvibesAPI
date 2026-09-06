import { SearchHistory } from '../models/SearchHistory.js';

export const listSearchHistory = async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100);
  const data = await SearchHistory.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(limit);
  res.json({ success: true, data });
};

export const createSearchHistory = async (req, res) => {
  const { query = '', filters = {}, resultCount } = req.body || {};
  if (typeof query !== 'string' || typeof filters !== 'object' || filters === null) {
    return res.status(400).json({ success: false, message: 'query and filters must be valid values' });
  }
  const data = await SearchHistory.create({
    user: req.user._id,
    query: query.trim(),
    filters,
    ...(resultCount === undefined ? {} : { resultCount: Number(resultCount) })
  });
  res.status(201).json({ success: true, data });
};

export const clearSearchHistory = async (req, res) => {
  await SearchHistory.deleteMany({ user: req.user._id });
  res.json({ success: true, message: 'Search history cleared successfully' });
};

export const listAllSearchHistory = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
  const [data, total] = await Promise.all([
    SearchHistory.find().populate('user', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    SearchHistory.countDocuments()
  ]);
  res.json({ success: true, meta: { total, page, pages: Math.ceil(total / limit), limit }, data });
};
