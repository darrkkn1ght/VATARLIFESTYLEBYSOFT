# VATAR LIFESTYLE BY SOFT

> **More Than A Game. A Lifestyle. A Community. A Legacy.**

Frontend web application built with React, TypeScript, Vite, Tailwind CSS, React Router, Framer Motion, Lucide React, and Supabase.

---

## Local Development

### Prerequisites

- Node.js 20+ and npm
- A configured Supabase project (see [supabase/README.md](supabase/README.md))

### Setup

1. Install dependencies:
   ```bash
   npm ci
   ```
2. Create a local `.env` file from `.env.example`:
   ```env
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
   > `.env` is excluded from Git via `.gitignore`. Never commit `.env` or expose a Supabase `service_role` key in frontend code.
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

---

## Official Deployment — Render Static Sites

**Render Static Sites** is the official hosting platform for VATAR LIFESTYLE BY SOFT.

### Option 1: Deploy via Render Blueprint (`render.yaml`)

This repository includes a preconfigured [`render.yaml`](render.yaml) Blueprint at the project root.

1. Sign in to [Render](https://render.com) and select **New + → Blueprint**.
2. Connect the existing GitHub repository (`main` branch).
3. Render will automatically read `render.yaml` with:
   - **Runtime:** Static Site
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
   - **SPA Rewrite Rule:** `/*` → `/index.html`
4. Supply the required environment variables when prompted (see below).

### Option 2: Manual Render Static Site Setup

If creating the service manually in Render (**New + → Static Site**):

| Setting | Value |
| --- | --- |
| **Branch** | `main` |
| **Build Command** | `npm ci && npm run build` |
| **Publish Directory** | `dist` |

Under **Redirects / Rewrites**, add the SPA fallback rule so client-side React Router paths resolve cleanly on refresh:

| Source | Destination | Action |
| --- | --- | --- |
| `/*` | `/index.html` | `Rewrite` |

### Required Render Environment Variables

Configure these in **Render Dashboard → Service → Environment**:

| Key | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase project URL (`https://<project-ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase public anon / publishable key |

> **Security:** Only add public client keys (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) to Render. Never add a `service_role` key or database password to frontend environment variables.

### Post-Deployment Supabase Configuration

After your Render URL is live, add it to **Supabase Dashboard → Authentication → URL Configuration**:
- **Site URL:** `https://<your-render-site>.onrender.com`
- **Redirect URLs:** `https://<your-render-site>.onrender.com/login`
