/**
 * Vercel Serverless API: POST /api/identify
 * Receives a base64 image, sends it to Google Gemini Vision (1.5 Flash), returns object description.
 * Env: GEMINI_API_KEY
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = 'gemini-1.5-flash';

function parseJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}') + 1;
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end));
  } catch (_) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: 'Service unavailable',
      message: 'GEMINI_API_KEY is not configured.',
    });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch (_) {
    res.status(400).json({ error: 'Invalid JSON body.' });
    return;
  }

  const imageBase64 = body.image != null ? String(body.image).trim() : '';
  if (!imageBase64) {
    res.status(400).json({
      error: 'Missing image',
      message: 'Send a JSON body with an "image" field containing the base64-encoded image.',
    });
    return;
  }

  const mimeType = body.mimeType || 'image/jpeg';
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const prompt = `Analyze this image and respond with a single JSON object (no markdown, no code fence) with exactly these keys:
- object_detected: short name of the main object (e.g. "gold ring", "silver necklace").
- short_description: one short sentence describing the object.
- estimated_material: one of gold, silver, gemstone, platinum, mixed, or other if not clearly identifiable.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const imagePart = {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [imagePart, { text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
      },
    });

    const response = result.response;
    const text = response && (typeof response.text === 'function' ? response.text() : response.text);
    if (!text) {
      res.status(502).json({
        error: 'No analysis result',
        message: 'Gemini did not return a valid response.',
      });
      return;
    }

    const parsed = parseJsonFromText(text);
    if (!parsed) {
      res.status(502).json({
        error: 'Invalid analysis format',
        message: 'Could not parse structured response.',
      });
      return;
    }

    const out = {
      object_detected: parsed.object_detected != null ? String(parsed.object_detected).trim() : '',
      estimated_material: parsed.estimated_material != null ? String(parsed.estimated_material).trim().toLowerCase() : 'other',
      short_description: parsed.short_description != null ? String(parsed.short_description).trim() : '',
    };

    res.status(200).json(out);
  } catch (err) {
    console.error('identify API error:', err.message);
    res.status(502).json({
      error: 'Analysis failed',
      message: err.message || 'Could not analyze image.',
    });
  }
};
