import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  googleId: { type: String, unique: true, sparse: true, index: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  approved: { type: Boolean, default: false, index: true },
  phone: { type: String, trim: true },
  dateOfBirth: { type: Date },
  gender: { type: String, trim: true },
  photo: { type: String, trim: true },
  address: {
    street: String, city: String, state: String, postalCode: String, country: String
  },
  familyDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  partnerCode: { type: String, unique: true, sparse: true }, // For couple pairing
  linkedPartner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BabyName' }]
  ,shortlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BabyName' }]
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export const User = mongoose.model('User', userSchema);