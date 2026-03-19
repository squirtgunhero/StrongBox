# StrongBox App

StrongBox is a Next.js application with Prisma and Supabase integration.

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase CLI 2.75.0 or newer (required)

Why the Supabase CLI minimum version matters:

- This project is linked to a Supabase project using Postgres 17 settings.
- Older Supabase CLI versions fail to parse the local config and can break remote commands.

## Verify Tooling

Check your versions:

```bash
node -v
npm -v
supabase --version
```

If Supabase CLI is below 2.75.0, upgrade it:

```bash
brew upgrade supabase/tap/supabase
```

## Install And Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Supabase Remote Link

This repo is expected to be linked to the StrongBox Supabase project reference:

- slnhimrjljmdwjpqfgzt

Verify current link status:

```bash
supabase link status
```

If needed, relink to the expected project:

```bash
supabase link --project-ref slnhimrjljmdwjpqfgzt
```

Then verify remote connectivity:

```bash
supabase migration list
```
