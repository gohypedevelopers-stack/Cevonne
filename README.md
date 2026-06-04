# Cevonne

Cevonne is a Next.js 16 application with App Router pages and API routes in the same project.

## Project Structure

- `app/` contains the website pages and API route handlers.
- `server/` contains shared controller, service, and route-adapter code used by the Next.js API routes.
- `lib/` contains client and shared helpers.

## Deployment

Deploy this repository as a single Vercel project rooted at the repo root.

Do not create a separate Vercel project for `server/`. It is not a standalone backend app; it is support code for the same Next.js deployment.

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

The build runs Prisma generation automatically through the existing `postinstall` and `prebuild` scripts in [`package.json`](./package.json).
