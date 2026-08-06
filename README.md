# Web4Firm Lead Generator

A secure Next.js lead discovery workspace for finding Google Business Profile entries that do not have a website listed, qualifying them, saving promising prospects, and preparing outreach.

## What works

- Google Places API (New) business search through a server-side route
- Filters for location, minimum rating and minimum reviews
- Candidate list restricted to results without a Google Places `websiteUri`
- Lead score, saved leads, contacted status and CSV export
- Supabase-backed outreach pipeline for persistent lead, proposal and email records
- OpenStreetMap lead map with result markers
- Claude-powered, review-first website proposal and professional sales-email drafting
- Human-reviewed email preview, copy and send flow
- Optional secure Resend server-side email send route
- Responsive B2B dashboard UI

## Required configuration

Copy `.env.example` to `.env.local` for development, then configure equivalent values in Vercel for production.

```bash
GOOGLE_MAPS_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
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

### Supabase CRM setup

1. Create a Supabase project.
2. Open **SQL Editor** and run [`supabase/schema.sql`](./supabase/schema.sql).
3. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
4. The new `/pipeline` page will then persist leads, proposals, sent emails and delivery/reply activity.

Keep the service role key server-side only. Use Vercel Deployment Protection or add app authentication before exposing the CRM dashboard to a broad audience.

### Claude proposal setup

Add `ANTHROPIC_API_KEY` in Vercel to enable the proposal studio. Claude runs only through the secure server-side `/api/ai/proposal` route. It produces a tailored **new website** or **website redesign** opportunity, a recommended site outline and a reviewable sales email. Nothing is sent automatically: a team member must review the copy, enter a recipient and click Send.

### Email and reply tracking setup

Email sends use [Resend](https://resend.com/) via `/api/email`. Add a verified sender domain and set `RESEND_API_KEY` and `SENDER_EMAIL` in Vercel. Each successful send is stored against the lead in Supabase.

For reply tracking, connect the shared Web4Firm Gmail/Google Workspace inbox with Google OAuth and add:

```bash
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_USER_EMAIL=hello@your-domain.com
```

The **Outreach Pipeline** page can then sync the inbox manually. It matches incoming sender addresses to outreach recipients, records a reply, updates the email/lead status to `replied`, and preserves the reply record in Supabase. Use an inbox dedicated to outreach so reply matching stays clean.

Create the refresh token using the Google OAuth scope:

```text
https://www.googleapis.com/auth/gmail.readonly
```

Use a dedicated Google Workspace outreach inbox such as `hello@your-domain.com` rather than a personal mailbox.

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
