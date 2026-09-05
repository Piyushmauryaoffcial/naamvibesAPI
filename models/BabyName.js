import mongoose from 'mongoose';

const babyNameSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  devanagari: { type: String, trim: true },
  gender: { type: String, enum: ['boy', 'girl', 'unisex'], required: true, index: true },
  meaning: { type: String, required: true },
  startingLetter: { type: String, required: true, uppercase: true, index: true },
  astrology: {
    rashi: {
      en: { type: String, required: true }, // e.g. Aries
      hi: { type: String, required: true }  // e.g. Mesh
    },
    nakshatra: { type: String, index: true },
    pada: { type: Number, min: 1, max: 4 },
    rulingPlanet: String,
    element: String
  },
  attributes: {
    luckyColors: [{ type: String }],
    luckyNumbers: [{ type: Number }],
    numerologyNumber: { type: Number, min: 1, max: 9, index: true },
    luckyGems: [{ type: String }],
    deities: [{ type: String }]
  },
  recommendationYear: { type: Number, min: 1900, max: 2200, index: true },
  recommendationMonth: { type: Number, min: 1, max: 12, index: true },
  religion: { type: String, default: 'Hindu', index: true },
  categories: [{ type: String, index: true }],
  isAiGenerated: { type: Boolean, default: false }
  ,origin: { type: String, default: 'Sanskrit' }
  ,nickname: { type: String }
  ,pronunciation: { type: String }
  ,popularityScore: { type: Number, min: 0, max: 100, default: 50, index: true }
}, { timestamps: true });

babyNameSchema.index({ gender: 1, 'astrology.rashi.en': 1, startingLetter: 1 });
babyNameSchema.index({ gender: 1, 'attributes.luckyColors': 1 });
babyNameSchema.index({ gender: 1, 'attributes.deities': 1 });
babyNameSchema.index({ recommendationYear: 1, recommendationMonth: 1, gender: 1 });
babyNameSchema.index({ name: 'text', meaning: 'text' });

export const BabyName = mongoose.model('BabyName', babyNameSchema);