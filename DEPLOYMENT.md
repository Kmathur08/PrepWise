# Deploy Prepwise to Vercel (step by step)

## 1. Push code to GitHub

1. Commit your latest changes.
2. Push to a GitHub repository (main branch is fine).

## 2. Create a Vercel project

1. Go to [vercel.com](https://vercel.com) and sign in.
2. **Add New Project** → import your GitHub repo.
3. Framework: **Next.js** (auto-detected).
4. **Root directory**: leave default if your app is at the repo root.
5. Do **not** deploy yet — add environment variables first (step 3).

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

Set these for **Production** (and **Preview** if you want preview deploys to work).

### Firebase (server)

| Name | Notes |
|------|--------|
| `FIREBASE_PROJECT_ID` | From Firebase project settings |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Full private key; paste with `\n` for newlines if needed |

### Google AI (Gemini) — server only

| Name | Notes |
|------|--------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | From Google AI Studio / Gemini API. **Never** prefix with `NEXT_PUBLIC_`. |

### Vapi — prefer server-only names

| Name | Notes |
|------|--------|
| `VAPI_PUBLIC_KEY` | Same value as Vapi “public” key (what you used as `NEXT_PUBLIC_VAPI_API_KEY` before). |
| `VAPI_WORKFLOW_ID` | Your workflow id (what you used as `NEXT_PUBLIC_VAPI_WORKFLOW_ID` before). |

**Backward compatibility:** If `VAPI_PUBLIC_KEY` / `VAPI_WORKFLOW_ID` are missing, the app falls back to `NEXT_PUBLIC_VAPI_API_KEY` and `NEXT_PUBLIC_VAPI_WORKFLOW_ID` so old configs still work — but for production you should move to `VAPI_*` so keys are not baked into the client bundle.

### Optional: daily AI budget (recommended for public launch)

| Name | Example | Notes |
|------|---------|--------|
| `AI_CREDITS_PER_USER_PER_DAY` | `25` | One “credit” is consumed for: resume PDF parse (Gemini), interview question generation (Gemini), feedback narrative (Gemini), and **each voice call start** (Vapi gate). Omit or `0` = no server-side daily cap. |

## 4. Deploy

1. Click **Deploy** (or redeploy after saving env vars).
2. Wait for the build to finish. Fix any build errors shown in the Vercel log.

## 5. After deploy — required dashboard settings

### Vapi (abuse reduction)

1. Open your [Vapi](https://vapi.ai) dashboard.
2. Restrict the **public key** to your **production domain** (e.g. `your-app.vercel.app` and your custom domain).
3. This limits who can use your key even if someone copies it from the browser network tab.

### Google Cloud / Gemini

1. In Google Cloud console, set **budgets and alerts** for the billing account used by the Gemini API.
2. Optionally set **API quotas** for the Generative Language API.

### Firebase

1. Ensure **Firestore** is enabled.
2. Review **Firestore security rules** if you ever read/write Firestore from the **client** (this app mostly uses **Admin SDK** on the server; still lock down client access if you add it later).

## 6. Local development (`.env.local`)

Copy the same variables into `.env.local` in the project root (never commit this file). Restart `npm run dev` after changes.

## 7. What the app does for security (already in code)

- Resume upload API requires a **signed-in** session.
- Vapi **public key and workflow id** are returned only from `/api/vapi/config` after session check (not embedded at build time when using `VAPI_*`).
- Starting a voice call runs `/api/vapi/consume-call-credit` (session + daily credit).
- Security headers are set in `middleware.ts` (HSTS on HTTPS, `nosniff`, etc.).

## 8. If something fails

- **401 on resume or voice:** user is not signed in; sign in again.
- **429 “Daily AI usage limit”:** raise `AI_CREDITS_PER_USER_PER_DAY` or wait until the next UTC day (implementation uses calendar day in `YYYY-MM-DD`).
- **Voice “not configured”:** set `VAPI_PUBLIC_KEY` and `VAPI_WORKFLOW_ID` (or the `NEXT_PUBLIC_*` fallbacks) on Vercel and redeploy.
