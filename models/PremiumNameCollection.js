import mongoose from 'mongoose';

const premiumNameCollectionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  baby: { type: mongoose.Schema.Types.ObjectId, ref: 'BabyProfile' },
  parentNames: { type: String, trim: true, maxlength: 200 },
  gender: { type: String, enum: ['boy', 'girl', 'unisex'] },
  preferences: {
    style: { type: String, trim: true, maxlength: 100 },
    startingLetters: [{ type: String, uppercase: true, maxlength: 1 }],
    rashi: { type: String, trim: true },
    nakshatra: { type: String, trim: true },
    meaning: { type: String, trim: true },
    minMatchScore: { type: Number, min: 0, max: 100 }
  },
  selectedNames: [{
    name: { type: mongoose.Schema.Types.ObjectId, ref: 'BabyName', required: true },
    matchScore: { type: Number, min: 0, max: 100, required: true },
    explanation: { type: String, required: true, maxlength: 500 }
  }],
  access: { type: String, enum: ['free', 'premium'], default: 'premium' }
}, { timestamps: true });

premiumNameCollectionSchema.index({ user: 1, updatedAt: -1 });

export const PremiumNameCollection = mongoose.model('PremiumNameCollection', premiumNameCollectionSchema);
