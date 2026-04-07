# NxtExpense Auth Setup

This project uses Next.js App Router with Supabase Auth..

## Authentication Flows

- Primary: Microsoft OAuth via Supabase (`azure` provider)
- Email/password login (temporarily enabled in production for internal testing)
- Post-login redirect: `/dashboard`
- Logout redirect: `/login`

## Routes

- Public: `/login`
- Protected: `/dashboard`
- OAuth callback: `/auth/callback`

## Environment Variables

Set these in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy fallback if publishable key is not set)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_AUTH_CALLBACK_URL`
- `NEXT_PUBLIC_APP_URL`
- `ALLOW_PASSWORD_LOGIN_IN_PROD` (optional explicit override in production: `true`/`1` enables, `false`/`0` disables)

Local note: `npm start` runs with `NODE_ENV=production`. When `VERCEL_ENV` is not `production`, email/password login remains enabled by default for internal local testing.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Microsoft OAuth 404 Troubleshooting

If you see a Microsoft 404 URL that contains `/v2.0/oauth2/v2.0/authorize`, fix your Supabase Azure provider settings:

- Set **Azure Tenant URL** to `https://login.microsoftonline.com/<tenant-id>`
- Do **not** include `/v2.0` in the tenant URL
- Ensure Azure app redirect URI includes `https://acbgmixcdtfgurgbkqgh.supabase.co/auth/v1/callback`
