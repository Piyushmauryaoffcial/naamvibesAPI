import mongoose from 'mongoose';

const searchHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  query: { type: String, trim: true },
  filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  resultCount: { type: Number, min: 0 }
}, { timestamps: true });

searchHistorySchema.index({ user: 1, createdAt: -1 });

export const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);
