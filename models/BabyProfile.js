import mongoose from 'mongoose';

const babyProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, trim: true },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['boy', 'girl', 'unisex'] },
  birthTime: { type: String, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
  birthPlace: { type: String, trim: true },
  rashi: { type: String, trim: true },
  nakshatra: { type: String, trim: true },
  notes: { type: String, trim: true, maxlength: 2000 }
}, { timestamps: true });

babyProfileSchema.index({ user: 1, createdAt: -1 });

export const BabyProfile = mongoose.model('BabyProfile', babyProfileSchema);
