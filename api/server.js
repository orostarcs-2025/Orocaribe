/**
 * Jewelry AI Analysis API
 * POST /api/analyze-jewelry — receives image (base64), calls Gemini, returns structured JSON.
 * Model: gemini-1.5-flash-latest
 */

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn('Warning: GEMINI_API_KEY not set. Set it before calling /api/analyze-jewelry.');
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const MODEL = 'gemini-1.5-flash-latest';
const PROMPT = `Analyze the jewelry item in this image. Identify the jewelry type, probable material, visible stones, and estimate the condition based on visible wear. Return only valid JSON with exactly these keys (use empty string if unknown): jewelry_type, probable_material, possible_stones, estimated_condition, visible_damage, style_description, short_description_for_listing. No markdown, no code fence, only the JSON object.`;

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

function ensureKeys(obj) {
  const keys = [
    'jewelry_type',
    'probable_material',
    'possible_stones',
    'estimated_condition',
    'visible_damage',
    'style_description',
    'short_description_for_listing'
  ];
  const out = {};
  keys.forEach(k => { out[k] = obj && obj[k] != null ? String(obj[k]).trim() : ''; });
  return out;
}

app.post('/api/analyze-jewelry', async (req, res) => {
  try {
    const { image, mimeType } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: 'Image could not be analyzed' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Image could not be analyzed' });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: image.replace(/^data:image\/\w+;base64,/, '')
      }
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [imagePart, { text: PROMPT }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024
      }
    });

    const response = result.response;
    const text = response && (typeof response.text === 'function' ? response.text() : response.text);
    if (!text) {
      return res.json({ error: 'Image could not be analyzed' });
    }

    const parsed = parseJsonFromText(text);
    if (!parsed) {
      return res.json({ error: 'Image could not be analyzed' });
    }

    return res.json(ensureKeys(parsed));
  } catch (err) {
    console.error('analyze-jewelry error:', err.message);
    return res.status(200).json({ error: 'Image could not be analyzed' });
  }
});

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Jewelry AI API listening on port ${PORT}. Endpoint: POST /api/analyze-jewelry`);
});
