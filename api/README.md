# Jewelry AI API

Node.js backend for the AI jewelry recognition feature. It receives an image, sends it to Google Gemini (`gemini-1.5-flash-latest`), and returns structured JSON.

## Setup

1. Install dependencies:
   ```bash
   cd api
   npm install
   ```

2. Set your Gemini API key:
   ```bash
   export GEMINI_API_KEY=your_api_key_here
   ```
   Or create a `.env` file (and use `dotenv` in code if you add it) or set the variable in your hosting dashboard.

3. Run the server:
   ```bash
   npm start
   ```
   Server runs on `http://localhost:3000` by default. Use `PORT` env var to change it.

## Endpoint

- **POST** `/api/analyze-jewelry`
  - **Body (JSON):** `{ "image": "<base64 string>", "mimeType": "image/jpeg" }`
  - **Response:** JSON with `jewelry_type`, `probable_material`, `possible_stones`, `estimated_condition`, `visible_damage`, `style_description`, `short_description_for_listing`, or `{ "error": "Image could not be analyzed" }`

## Deployment

- **Heroku:** Add buildpack Node.js, set `GEMINI_API_KEY`, deploy. API base URL = `https://your-app.herokuapp.com`.
- **Vercel:** Use a serverless function (see Vercel docs for Express or convert to a single serverless function).
- **Railway / Render:** Deploy as Node app, set env vars, use the provided URL as API base.

## Shopify

In the theme editor, add the "Jewelry AI Form" section and set **API base URL** to your deployed API URL (e.g. `https://your-app.herokuapp.com`), no trailing slash.
