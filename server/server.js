/**
 * Mother Evelyn Child-Care Foundation — Mail Server
 * ------------------------------------------------
 * Uses the Brevo HTTP API (NOT SMTP) because Railway blocks
 * outbound port 587. All mail goes over HTTPS to api.brevo.com.
 *
 * Handles three forms:
 *   POST /api/contact     — Contact page "Send us a message"
 *   POST /api/donate      — Donate page pledge form
 *   POST /api/subscribe   — Newsletter signup (all pages)
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

/* ─────────────────────────────────────────────
   Config
   ───────────────────────────────────────────── */
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

// Verified sender in Brevo (must be confirmed in the Brevo dashboard)
const SENDER = {
  name: 'Mother Evelyn Child-Care Foundation',
  email: process.env.SENDER_EMAIL || 'noreply@motherevelynchildcare.org',
};

// Where enquiries land
const RECIPIENTS = (process.env.RECIPIENT_EMAILS || 'info@motherevelynchildcare.org')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean)
  .map((email) => ({ email }));

/* ─────────────────────────────────────────────
   Middleware
   ───────────────────────────────────────────── */
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// Serve the static site from the parent folder
app.use(express.static(path.join(__dirname, '..')));

// Basic abuse protection: 5 submissions per IP per 15 min
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many submissions. Please try again in a few minutes.' },
});

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */
const escapeHtml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

/**
 * Send an email through the Brevo HTTP API.
 * Uses global fetch (Node 18+). No SMTP, no port 587.
 */
async function sendMail({ to, subject, html, replyTo }) {
  if (!BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not set');
  }

  const payload = {
    sender: SENDER,
    to,
    subject,
    htmlContent: html,
  };

  if (replyTo && isEmail(replyTo.email)) {
    payload.replyTo = replyTo;
  }

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Brevo ${res.status}: ${detail}`);
  }

  return res.json();
}

/** Shared branded email wrapper */
const emailShell = (title, rows, footerNote = '') => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8f6f2;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6f2;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(44,19,68,.08);">

        <tr>
          <td style="background:linear-gradient(120deg,#2c1344,#3d1a5b);padding:24px 28px;">
            <div style="color:#ffffff;font-size:19px;font-weight:bold;">Mother Evelyn Child-Care Foundation</div>
            <div style="color:#b9d6ac;font-size:12px;letter-spacing:2px;margin-top:4px;">CARE &middot; EDUCATE &middot; EMPOWER &middot; TRANSFORM</div>
          </td>
        </tr>

        <tr>
          <td style="padding:28px;">
            <h2 style="margin:0 0 18px;color:#2c1344;font-size:20px;">${title}</h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#4a3f57;">
              ${rows}
            </table>
            ${footerNote ? `<p style="margin:22px 0 0;font-size:13px;color:#6b6076;">${footerNote}</p>` : ''}
          </td>
        </tr>

        <tr>
          <td style="background:#2c1344;padding:16px 28px;color:rgba(255,255,255,.65);font-size:12px;">
            Sent from motherevelynchildcare.org &middot; Monrovia, Liberia
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

const row = (label, value) => `
  <tr>
    <td style="padding:8px 0;width:150px;vertical-align:top;color:#2c1344;font-weight:bold;">${label}</td>
    <td style="padding:8px 0;vertical-align:top;">${value}</td>
  </tr>`;

/* ─────────────────────────────────────────────
   POST /api/contact
   ───────────────────────────────────────────── */
app.post('/api/contact', formLimiter, async (req, res) => {
  try {
    const { name, email, subject, message, website } = req.body;

    // Honeypot — bots fill hidden fields, humans don't
    if (website) return res.json({ ok: true });

    if (!name || !isEmail(email) || !message) {
      return res.status(400).json({ ok: false, error: 'Please fill in your name, a valid email, and a message.' });
    }

    const topic = subject || 'General Inquiry';

    // 1. Notify the foundation
    await sendMail({
      to: RECIPIENTS,
      subject: `New enquiry: ${topic} — ${name}`,
      replyTo: { email: String(email).trim(), name: String(name).trim() },
      html: emailShell(
        'New message from the website',
        row('Name', escapeHtml(name)) +
          row('Email', `<a href="mailto:${escapeHtml(email)}" style="color:#3d1a5b;">${escapeHtml(email)}</a>`) +
          row('Subject', escapeHtml(topic)) +
          row('Message', escapeHtml(message).replace(/\n/g, '<br>')),
        'Reply directly to this email to respond to the sender.'
      ),
    });

    // 2. Auto-acknowledge the sender
    await sendMail({
      to: [{ email: String(email).trim(), name: String(name).trim() }],
      subject: 'We received your message — Mother Evelyn Child-Care Foundation',
      html: emailShell(
        `Thank you, ${escapeHtml(String(name).split(' ')[0])}`,
        `<tr><td colspan="2" style="padding:4px 0 14px;line-height:1.7;">
           Thank you for reaching out to Mother Evelyn Child-Care Foundation.
           We have received your message and a member of our team will respond within 2 business days.
         </td></tr>` +
          row('Your subject', escapeHtml(topic)) +
          row('Your message', escapeHtml(message).replace(/\n/g, '<br>')),
        'If your matter is urgent, call us on +1 (510) 437-0039.'
      ),
    });

    res.json({ ok: true, message: 'Message sent. We will be in touch shortly.' });
  } catch (err) {
    console.error('[contact]', err.message);
    res.status(500).json({ ok: false, error: 'Could not send your message right now. Please try again shortly.' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/donate
   ───────────────────────────────────────────── */
app.post('/api/donate', formLimiter, async (req, res) => {
  try {
    const { name, email, amount, frequency, fund, website } = req.body;

    if (website) return res.json({ ok: true });

    if (!name || !isEmail(email) || !amount) {
      return res.status(400).json({ ok: false, error: 'Please provide your name, a valid email, and an amount.' });
    }

    const freq = frequency === 'monthly' ? 'Monthly' : 'One-time';
    const designation = fund || 'Wherever needed most';

    // 1. Notify the foundation
    await sendMail({
      to: RECIPIENTS,
      subject: `New donation pledge: $${escapeHtml(amount)} (${freq}) — ${name}`,
      replyTo: { email: String(email).trim(), name: String(name).trim() },
      html: emailShell(
        'New donation pledge',
        row('Donor', escapeHtml(name)) +
          row('Email', `<a href="mailto:${escapeHtml(email)}" style="color:#3d1a5b;">${escapeHtml(email)}</a>`) +
          row('Amount', `<strong style="color:#c20f4d;font-size:17px;">$${escapeHtml(amount)}</strong>`) +
          row('Frequency', escapeHtml(freq)) +
          row('Directed to', escapeHtml(designation)),
        'This is a pledge notification. Follow up with the donor to arrange payment.'
      ),
    });

    // 2. Thank the donor
    await sendMail({
      to: [{ email: String(email).trim(), name: String(name).trim() }],
      subject: 'Thank you for your generosity — Mother Evelyn Child-Care Foundation',
      html: emailShell(
        `Thank you, ${escapeHtml(String(name).split(' ')[0])}`,
        `<tr><td colspan="2" style="padding:4px 0 14px;line-height:1.7;">
           Your pledge helps us feed, shelter, educate and protect vulnerable children across Liberia.
           Our team will contact you shortly with payment details.
         </td></tr>` +
          row('Amount', `<strong style="color:#c20f4d;font-size:17px;">$${escapeHtml(amount)}</strong>`) +
          row('Frequency', escapeHtml(freq)) +
          row('Directed to', escapeHtml(designation)),
        'Every child deserves a bright future. Thank you for making that possible.'
      ),
    });

    res.json({ ok: true, message: 'Thank you. We will contact you shortly with payment details.' });
  } catch (err) {
    console.error('[donate]', err.message);
    res.status(500).json({ ok: false, error: 'Could not record your pledge right now. Please try again shortly.' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/subscribe
   ───────────────────────────────────────────── */
app.post('/api/subscribe', formLimiter, async (req, res) => {
  try {
    const { email, website } = req.body;

    if (website) return res.json({ ok: true });
    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
    }

    await sendMail({
      to: RECIPIENTS,
      subject: `Newsletter signup: ${email}`,
      html: emailShell('New newsletter subscriber', row('Email', escapeHtml(email))),
    });

    await sendMail({
      to: [{ email: String(email).trim() }],
      subject: "You're subscribed — Mother Evelyn Child-Care Foundation",
      html: emailShell(
        'Welcome to our mailing list',
        `<tr><td colspan="2" style="padding:4px 0;line-height:1.7;">
           You will receive one short email a month — stories from the field, upcoming events,
           and how your support is changing lives across Liberia.
         </td></tr>`
      ),
    });

    res.json({ ok: true, message: 'Subscribed. Watch your inbox for our next update.' });
  } catch (err) {
    console.error('[subscribe]', err.message);
    res.status(500).json({ ok: false, error: 'Could not subscribe you right now. Please try again shortly.' });
  }
});

/* ─────────────────────────────────────────────
   Health check + start
   ───────────────────────────────────────────── */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'mecf-mail',
    brevoConfigured: Boolean(BREVO_API_KEY),
    sender: SENDER.email,
    recipients: RECIPIENTS.map((r) => r.email),
  });
});

app.listen(PORT, () => {
  console.log(`MECF mail server running on port ${PORT}`);
  if (!BREVO_API_KEY) console.warn('WARNING: BREVO_API_KEY is not set — email sending will fail.');
});
