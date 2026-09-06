import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { ContactLead } from '../models/ContactLead.js';

const recipient = process.env.CONTACT_EMAIL || 'piyushmaurya117@gmail.com';

export const getContactCaptcha = async (req, res) => {
  const first = Math.floor(Math.random() * 8) + 2;
  const second = Math.floor(Math.random() * 8) + 2;
  const token = jwt.sign({ answer: first + second }, process.env.JWT_SECRET, { expiresIn: '10m' });
  return res.json({ question: `What is ${first} + ${second}?`, token });
};

export const submitContactMessage = async (req, res) => {
  const { name, email, phone, subject, message, captchaAnswer, captchaToken } = req.body || {};

  if (!name?.trim() || !email?.trim() || !phone?.trim() || !message?.trim()) {
    return res.status(400).json({ message: 'Name, email, phone, and message are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  let captcha;
  try {
    captcha = jwt.verify(captchaToken, process.env.JWT_SECRET);
  } catch {
    return res.status(400).json({ message: 'Captcha expired. Please refresh and try again.' });
  }
  if (String(captchaAnswer).trim() !== String(captcha.answer)) {
    return res.status(400).json({ message: 'Captcha answer is incorrect.' });
  }

  const lead = await ContactLead.create({
    name, email, phone, subject, message
  });

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient,
      replyTo: email.trim(),
      subject: `[Naam Vibes Contact] ${subject?.trim() || 'New message'}`,
      text: `Name: ${name.trim()}\nEmail: ${email.trim()}\nPhone: ${phone.trim()}\nSubject: ${subject?.trim() || 'Not provided'}\n\n${message.trim()}`
    });
  }

  return res.status(201).json({ message: 'Your message has been sent successfully.', data: lead });
};

export const listContactLeads = async (req, res) => {
  const leads = await ContactLead.find().sort({ createdAt: -1 }).lean();
  return res.json({ data: leads });
};
