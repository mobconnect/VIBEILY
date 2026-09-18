# Deployment recommendations

VIBEILY is a Vite/React application with Firebase, upload and AI-related dependencies.

## Recommended architecture

Host the frontend on **Firebase Hosting** or **Cloudflare Pages**. Deploy any Express/Gemini API to **Google Cloud Run** (recommended), **Render**, **Railway**, or **Fly.io**.

Keep credentials server-side, configure CORS and rate limiting, and use Firebase Security Rules and durable storage for user data. Do not deploy the API key through `VITE_*` variables.
