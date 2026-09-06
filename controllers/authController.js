import { User } from '../models/User.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

export const register = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const name = req.body?.name || req.body?.fullName;
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' ||
        !name.trim() || !email.trim() || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Generate unique 6-character partner share code
    const partnerCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const user = await User.create({ name: name.trim(), email: normalizedEmail, password, partnerCode, approved: false });
    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, partnerCode: user.partnerCode, role: user.role, approved: user.approved }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const user = await User.findOne({ email: email?.trim().toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken(user._id);
    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, partnerCode: user.partnerCode, role: user.role, approved: user.approved }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const credential = req.body?.credential;
    if (typeof credential !== 'string' || !credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ success: false, message: 'Google sign-in is not configured' });
    }
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ success: false, message: 'Google account could not be verified' });
    }
    let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email: payload.email.toLowerCase() }] });
    if (!user) {
      user = await User.create({
        name: payload.name || payload.email.split('@')[0],
        email: payload.email.toLowerCase(),
        password: crypto.randomBytes(32).toString('hex'),
        googleId: payload.sub,
        photo: payload.picture,
        partnerCode: crypto.randomBytes(3).toString('hex').toUpperCase(),
        approved: true
      });
    } else if (!user.googleId) {
      user.googleId = payload.sub;
      if (payload.picture && !user.photo) user.photo = payload.picture;
      await user.save();
    }
    const token = signToken(user._id);
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, partnerCode: user.partnerCode, role: user.role, approved: user.approved, photo: user.photo } });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Google sign-in failed' });
  }
};

const profileFields = ['name', 'phone', 'dateOfBirth', 'gender', 'photo', 'address', 'familyDetails', 'preferences', 'settings'];

export const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  res.json({ success: true, data: user });
};

export const updateProfile = async (req, res) => {
  const updates = {};
  for (const field of profileFields) if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) updates[field] = req.body[field];
  if (updates.name !== undefined && (typeof updates.name !== 'string' || !updates.name.trim())) {
    return res.status(400).json({ success: false, message: 'name cannot be empty' });
  }
  if (updates.dateOfBirth !== undefined && Number.isNaN(Date.parse(updates.dateOfBirth))) {
    return res.status(400).json({ success: false, message: 'dateOfBirth must be a valid date' });
  }
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }).select('-password');
  res.json({ success: true, data: user });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'currentPassword and a new password of at least 6 characters are required' });
  }
  const user = await User.findById(req.user._id);
  if (!(await user.comparePassword(currentPassword))) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password changed successfully' });
};

export const listUsers = async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
  const [data, total] = await Promise.all([
    User.find().select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments()
  ]);
  res.json({ success: true, meta: { total, page, pages: Math.ceil(total / limit), limit }, data });
};

export const updateUserByAdmin = async (req, res) => {
  const allowed = ['name', 'email', 'phone', 'dateOfBirth', 'gender', 'photo', 'address', 'familyDetails', 'preferences', 'settings', 'approved', 'role'];
  const updates = {};
  for (const field of allowed) if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) updates[field] = req.body[field];
  if (updates.email) updates.email = updates.email.trim().toLowerCase();
  if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'No valid fields to update' });
  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: user });
};

export const logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

// Connect with spouse/partner via their share code
export const linkPartner = async (req, res) => {
  try {
    const partnerCode = req.body?.partnerCode?.trim().toUpperCase();
    if (!partnerCode) {
      return res.status(400).json({ success: false, message: 'partnerCode is required' });
    }
    const partner = await User.findOne({ partnerCode });

    if (!partner || partner._id.equals(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Invalid partner code' });
    }

    req.user.linkedPartner = partner._id;
    partner.linkedPartner = req.user._id;

    await req.user.save();
    await partner.save();

    res.status(200).json({ success: true, message: `Linked successfully with ${partner.name}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};  