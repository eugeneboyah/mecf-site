# MECF Mail Server

Node/Express backend that sends the website's form submissions through the
**Brevo HTTP API**. It deliberately does *not* use SMTP — Railway blocks
outbound port 587, so all mail goes over HTTPS to `api.brevo.com`.

## Endpoints

| Method | Route            | Used by                                  |
| ------ | ---------------- | ---------------------------------------- |
| POST   | `/api/contact`   | Contact page — "Send us a message"       |
| POST   | `/api/donate`    | Donate page — pledge form                |
| POST   | `/api/subscribe` | Newsletter signup (home, about, events)  |
| GET    | `/api/health`    | Health check / config sanity check       |

Every submission sends **two** emails: one notifying the foundation, and one
acknowledging the person who submitted. `replyTo` is set to the sender's
address, so hitting Reply in Gmail goes straight back to them.

## Setup

### 1. Create the Brevo API key

1. Log in to Brevo → **SMTP & API** → **API Keys** → **Generate a new API key**
2. Copy the key (starts with `xkeysib-`)

### 2. Verify the sender address

Brevo will not send from an unverified address.

1. Brevo → **Senders, Domains & Dedicated IPs** → **Senders** → **Add a sender**
2. Add `motherevelynchildcare@gmail.com`
3. Brevo emails that address a confirmation link — click it

### 3. Configure environment

```bash
cp .env.example .env
```

Then fill in `.env`:

```
BREVO_API_KEY=xkeysib-...your-real-key...
SENDER_EMAIL=motherevelynchildcare@gmail.com
RECIPIENT_EMAILS=siahkorha@gmail.com,motherevelynchildcare@gmail.com
PORT=3000
ALLOWED_ORIGIN=*
```

`RECIPIENT_EMAILS` is comma-separated — everyone listed receives every
form submission.

### 4. Run

```bash
npm install
npm start
```

The server also serves the static site, so `http://localhost:3000` gives you
the full website with working forms.

Check configuration at any time:

```bash
curl http://localhost:3000/api/health
```

## Deploying to Railway

```bash
railway login
railway init
railway up
```

Then in the Railway dashboard → **Variables**, add:

- `BREVO_API_KEY`
- `SENDER_EMAIL`
- `RECIPIENT_EMAILS`
- `ALLOWED_ORIGIN` — set this to your real domain once DNS is live

Railway sets `PORT` automatically; don't override it.

### Running the frontend separately

If the static site is hosted somewhere else (Netlify, Cloudflare Pages), point
it at the API by adding this **before** `js/main.js` in each HTML page:

```html
<script>window.MECF_API_BASE = 'https://your-app.up.railway.app';</script>
```

Leave it out entirely when Express serves the site itself.

## Deliverability note

Gmail publishes a strict DMARC policy. Sending "from" a `@gmail.com` address
through a third party like Brevo works, but some messages can land in spam.

Once `motherevelynchildcare.org` (or whichever domain you register) is live,
switch the sender to something like `noreply@motherevelynchildcare.org` and
authenticate the domain in Brevo (SPF + DKIM). Deliverability improves sharply.
Only `SENDER_EMAIL` needs to change — no code edits.

## Anti-spam

- **Honeypot** — a hidden `website` field on every form. Bots fill it; humans
  don't. Filled = silently accepted and discarded.
- **Rate limit** — 5 submissions per IP per 15 minutes.
- **Validation + escaping** — all input validated server-side and HTML-escaped
  before being placed in an email body.
