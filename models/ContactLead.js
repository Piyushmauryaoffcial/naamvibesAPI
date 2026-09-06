import mongoose from 'mongoose';

const contactLeadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  subject: { type: String, trim: true, maxlength: 200 },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new', index: true }
}, { timestamps: true });

export const ContactLead = mongoose.model('ContactLead', contactLeadSchema);
