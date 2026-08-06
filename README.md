# Web4Firm Lead Generator

A secure Next.js lead discovery workspace for finding Google Business Profile entries that do not have a website listed, qualifying them, saving promising prospects, and preparing outreach.

## What works

- Google Places API (New) business search through a server-side route
- Filters for location, minimum rating and minimum reviews
- Candidate list restricted to results without a Google Places `websiteUri`
- Lead score, saved leads, contacted status and CSV export (saved locally in the browser)
- OpenStreetMap lead map with result markers
- Claude-powered, review-first website proposal and professional sales-email drafting
- Human-reviewed email preview, copy and send flow
- Optional secure Resend server-side email send route
- Responsive B2B dashboard UI

## Required configuration

Copy `.env.example` to `.env.local` for development, then configure equivalent values in Vercel for production.

```bash
GOOGLE_MAPS_API_KEY=...
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
RESEND_API_KEY=...
SENDER_EMAIL=Web4Firm <hello@your-verified-domain.com>
```

### Google Places setup

1. Create a Google Cloud API key.
2. Enable **Places API (New)** and billing.
3. Restrict the key to only the required API and server environment.
4. Add it as `GOOGLE_MAPS_API_KEY` in Vercel.

The Google key is intentionally not exposed to the browser. Searches are routed through `/api/leads/search`.

### Claude proposal setup

Add `ANTHROPIC_API_KEY` in Vercel to enable the proposal studio. Claude runs only through the secure server-side `/api/ai/proposal` route. It produces a tailored **new website** or **website redesign** opportunity, a recommended site outline and a reviewable sales email. Nothing is sent automatically: a team member must review the copy, enter a recipient and click Send.

### Email setup

Email sends use [Resend](https://resend.com/) via `/api/email`. Add a verified sender domain and set `RESEND_API_KEY` and `SENDER_EMAIL` in Vercel. Without these variables, the dashboard remains usable but the Send Email action will explain that email is not configured.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Import the GitHub repository into Vercel.
2. Add the environment variables above in **Project Settings → Environment Variables**.
3. Deploy.

## Important note about website detection

The tool identifies businesses that **do not have a website listed in the Google Places response**. That is a strong prospecting signal but it is not a guarantee that a business has no website anywhere online. Review each lead before outreach.
