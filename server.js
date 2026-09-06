import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/authRoutes.js';
import astroRoutes from './routes/astroRoutes.js';
import nameRoutes from './routes/nameRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import babyRoutes from './routes/babyRoutes.js';
import searchHistoryRoutes from './routes/searchHistoryRoutes.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/astro', astroRoutes);
app.use('/api/v1/names', nameRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/babies', babyRoutes);
app.use('/api/v1/search-history', searchHistoryRoutes);

const PORT = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!mongoUri || !/^(mongodb(?:\+srv)?:\/\/)/i.test(mongoUri)) {
  throw new Error('A valid MONGO_URI or MONGODB_URI is required in .env');
}

const ensureDefaultAdmin = async () => {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';
  const existingAdmin = await mongoose.model('User').findOne({ email });

  if (existingAdmin) {
    existingAdmin.name = 'Administrator';
    existingAdmin.password = password;
    existingAdmin.role = 'admin';
    existingAdmin.approved = true;
    await existingAdmin.save();
    return;
  }

  await mongoose.model('User').create({
    name: 'Administrator',
    email,
    password,
    role: 'admin',
    approved: true,
    partnerCode: undefined
  });
  console.log(`Default admin account ready: ${email}`);
};

const repairKnownNameGenders = async () => {
  const BabyName = mongoose.model('BabyName');
  await BabyName.updateMany({ name: { $in: ['Vedika', 'Ishani'] } }, { $set: { gender: 'girl' } });
};

const startServer = async () => {
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      bufferCommands: false
    });
    console.log('MongoDB connected successfully');
    await ensureDefaultAdmin();
    await repairKnownNameGenders();
    app.listen(PORT, '0.0.0.0', () => console.log(`Baby Names API running on http://localhost:${PORT}`));
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exitCode = 1;
  }
};

startServer();