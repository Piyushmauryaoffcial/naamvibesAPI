import mongoose from 'mongoose';

const premiumCollectionRequestSchema = new mongoose.Schema({
  collectionSlug: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true, maxlength: 30 },
  babyName: { type: String, trim: true, maxlength: 120 },
  notes: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true });

export const PremiumCollectionRequest = mongoose.model('PremiumCollectionRequest', premiumCollectionRequestSchema);
