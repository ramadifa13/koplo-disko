# Koplo Disko Management System

## Development

1. Copy `.env.example` to `.env.local` and fill the Supabase URL and publishable key.
2. Apply every migration in `supabase/migrations` in filename order.
3. Run `npm ci` and `npm run dev`.

## Access model

- `owner` and `manager` have the same application features.
- `owner` is the protected recovery administrator. Only an owner can create or modify another owner, and the final active owner cannot be disabled.
- `member` only receives personal assignments, fees, payouts, and permitted documents.
- Organizational positions such as Manager, MC, DJ, and Soundman are stored separately in `positions`; changing a position never changes application access.

## Invite function secrets

Deploy `supabase/functions/invite-member` with these server-side secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS`: comma-separated exact origins, for example `https://app.example.com,http://localhost:5173`
- `ALLOWED_REDIRECT_URLS`: comma-separated exact password setup URLs

Never expose the service-role key through Vite environment variables.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
npm run test:e2e
supabase test db
```

Setelah schema lokal berubah, jalankan `npm run db:types` untuk memperbarui tipe
TypeScript Supabase. Perintah ini memerlukan Supabase CLI dan stack lokal yang
sedang aktif.

The GitHub Actions quality gate runs these checks for every push and pull request.
