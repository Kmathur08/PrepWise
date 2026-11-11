# PrepWise

**AI mock interviews.** Upload your resume and pick a role. An AI voice agent interviews you out loud, then scores every answer and shows where you are weak.

Built by [Kshitij Mathur](https://github.com/Kmathur08) · Portfolio: [kshitij-mathur.vercel.app](https://kshitij-mathur.vercel.app/)

## Features

- **Voice interviews:** a Vapi voice agent asks the questions and you answer by speaking, like a real interview
- **Questions from your resume:** upload your resume (PDF or Word) and the questions are generated for that role and your experience (Google Gemini)
- **Feedback after every interview:** a score for each area, strengths and what to improve
- **Dashboard:** all your past interviews and their feedback in one place
- **Accounts:** email and password sign-in with Firebase Auth; interviews and feedback stored in Firestore
- **Usage limits:** a cap on AI usage per user, so one account can't run up the bill
- Works on phones and desktops

## Tech stack

| Part | Tools |
| --- | --- |
| App | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui |
| AI | Vapi (voice agent), Google Gemini through the Vercel AI SDK, Zod |
| Data | Firebase Auth, Firestore, Firebase Admin |
| Resume parsing | Mammoth |

## Running it locally

You need Node.js 18 or newer, a Firebase project, a Vapi account and a Gemini API key.

```bash
git clone https://github.com/Kmathur08/PrepWise.git
cd PrepWise
npm install
```

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_VAPI_WEB_TOKEN=
NEXT_PUBLIC_VAPI_WORKFLOW_ID=

GOOGLE_GENERATIVE_AI_API_KEY=

NEXT_PUBLIC_BASE_URL=http://localhost:3000

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Then start it and open [http://localhost:3000](http://localhost:3000):

```bash
npm run dev
```

Deploying to Vercel: see [DEPLOYMENT.md](DEPLOYMENT.md).

## Credits

Started from the [JavaScript Mastery](https://www.youtube.com/@javascriptmastery) AI mock interview tutorial, then extended with resume-based questions, per-user AI limits and deployment setup.
