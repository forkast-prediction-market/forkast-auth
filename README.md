## Forkast Auth – Key Generator

Single-page app that lets a Forkast wallet owner mint API credentials (L1 signature) and manage keys (L2 HMAC) against `https://clob.forka.st`. Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, wagmi, and Supabase.

### Stack

- Next.js 14 App Router, React 19, Tailwind CSS
- wagmi (EIP-712 signing) + MetaMask / injected wallets
- Supabase JS SDK for optional email capture
- Web Crypto HMAC for L2 auth

### Required environment variables

Configure these before running locally or deploying to Vercel:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_FORKAST_BASE_URL` | Forkast auth API base (default `https://clob.forka.st`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon service key |
| `NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID` | Reown / WalletConnect v2 project id (enables QR wallets) |
| `NEXT_PUBLIC_APP_URL` | Public base URL of this app (used for WalletConnect metadata) |
| `NEXT_PUBLIC_APP_ICON` | Absolute URL to an app icon (WalletConnect metadata) |

Use `.env.example` as a starting point and create a `.env.local` file (Next.js automatically loads it):

```bash
NEXT_PUBLIC_FORKAST_BASE_URL=https://clob.forka.st
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID=...
NEXT_PUBLIC_APP_URL=https://auth.forka.st
NEXT_PUBLIC_APP_ICON=https://auth.forka.st/forkast-logo.svg
```

### Supabase schema

Apply the SQL migration in `supabase/migrations/0001_key_emails.sql` to create the anonymous insert-only table used to store `{ api_key, email }` pairs:

```bash
supabase db push
```

(Alternatively, run the file contents in the Supabase SQL editor.)

### Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and connect a Polygon (Mainnet 137 or Amoy 80002) wallet. The generate flow will:

1. Step 1 (modal): collect an optional email + advanced nonce.
2. Step 2 (modal): connect via injected wallets or Reown (WalletConnect v2), switch to Polygon 137/80002 if needed, and sign the EIP-712 `ClobAuthDomain` payload.
3. `POST /auth/api-key` with the L1 signature headers, return the trio, and copy helpers for `.env`.
4. If an email was provided, store `{ api_key, email }` in Supabase.
5. Manage keys (list / revoke) via L2 HMAC signing (`timestamp + method + path(+query) + body`).

### Deploying

Deploy to Vercel as a standard Next.js project. Set the environment variables above in the Vercel dashboard and (optionally) run the Supabase migration via CI before first deployment.
