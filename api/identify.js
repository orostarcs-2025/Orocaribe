/**
 * Vercel Serverless API: POST /api/identify
 * Recibe imagen base64 desde Shopify, llama a Gemini, devuelve campos del formulario tasador.
 * Env: GEMINI_API_KEY
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = 'gemini-2.0-flash';

const PROMPT = `Eres un experto tasador de joyería para Oro Caribe (República Dominicana).
Analiza la imagen y responde ÚNICAMENTE con un JSON válido, sin markdown ni texto adicional.
Claves requeridas (usa cadena vacía si no puedes determinarlo):
  tipoJoya           — Anillo, Cadena, Pulsera, Aretes, Dije, Reloj u Otro
  colorMetal         — Oro amarillo, Oro blanco, Oro rosa, Plata u Otro
  quilates           — 10k, 14k Nacional, 14k Italiano, 18k Nacional, 18k Italiano, 22k o 24k
  estado             — Nuevo, Excelente, Bueno, Regular o Para fundir
  desperfectos       — daños visibles o "Ninguno visible"
  descripcionPedreria — piedras o decoraciones visibles o "Sin pedrería"
  descripcionBreve   — una frase descriptiva completa de la pieza
Devuelve SOLO el objeto JSON.`;

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: PROMPT }
      ]}],
      generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
    });

    const response = result.response;
    const text = response && (typeof response.text === 'function' ? response.text() : response.text);
    if (!text) {
      res.status(502).json({ error: 'No analysis result', message: 'Gemini no devolvió respuesta.' });
      return;
    }

    const parsed = parseJsonFromText(text);
    if (!parsed) {
      res.status(502).json({ error: 'Invalid analysis format', message: 'No se pudo interpretar la respuesta.' });
      return;
    }

    const fields = ['tipoJoya','colorMetal','quilates','estado','desperfectos','descripcionPedreria','descripcionBreve'];
    const out = {};
    fields.forEach(k => { out[k] = parsed[k] != null ? String(parsed[k]).trim() : ''; });

    res.status(200).json(out);
  } catch (err) {
    console.error('identify API error:', err.message);
    res.status(502).json({
      error: 'Analysis failed',
      message: err.message || 'Could not analyze image.',
    });
  }
};
