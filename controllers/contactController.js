import nodemailer from 'nodemailer';

const recipient = process.env.CONTACT_EMAIL || 'piyushmaurya117@gmail.com';

export const submitContactMessage = async (req, res) => {
  const { name, email, subject, message } = req.body || {};

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ message: 'Name, email, and message are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return res.status(503).json({ message: 'Contact email service is not configured.' });
  }

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
    text: `Name: ${name.trim()}\nEmail: ${email.trim()}\nSubject: ${subject?.trim() || 'Not provided'}\n\n${message.trim()}`
  });

  return res.status(200).json({ message: 'Your message has been sent successfully.' });
};
