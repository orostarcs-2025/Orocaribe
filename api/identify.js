/**
 * Vercel Serverless API: POST /api/identify
 * Para el tasador Oro Caribe: recibe imagen base64, Gemini analiza la joya, devuelve campos del formulario.
 * Env: GEMINI_API_KEY
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = 'gemini-1.5-flash';

const PROMPT = `Eres un experto tasador de joyería. Analiza la imagen y responde ÚNICAMENTE con un JSON válido (sin markdown, sin texto extra) con estas claves:
- tipoJoya: uno de Anillo, Cadena, Pulsera, Aretes, Dije, Reloj, Otro
- colorMetal: Oro amarillo, Oro blanco, Oro rosa, Plata u otro
- quilates: 10k, 14k Nacional, 14k Italiano, 18k Nacional, 18k Italiano, 22k, 24k (o el más parecido)
- estado: Nuevo, Excelente, Bueno, Regular, Para fundir
- descripcionBreve: una frase corta describiendo la pieza

Responde solo el JSON.`;

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
      message: 'Envía un body JSON con el campo "image" en base64.',
    });
    return;
  }

  const mimeType = body.mimeType || 'image/jpeg';
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: PROMPT },
        ],
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    });

    const response = result.response;
    const text = response && (typeof response.text === 'function' ? response.text() : response.text);
    if (!text) {
      res.status(502).json({
        error: 'No analysis result',
        message: 'Gemini no devolvió respuesta.',
      });
      return;
    }

    const parsed = parseJsonFromText(text);
    if (!parsed) {
      res.status(502).json({
        error: 'Invalid analysis format',
        message: 'No se pudo interpretar la respuesta.',
      });
      return;
    }

    const out = {
      tipoJoya: parsed.tipoJoya != null ? String(parsed.tipoJoya).trim() : '',
      colorMetal: parsed.colorMetal != null ? String(parsed.colorMetal).trim() : '',
      quilates: parsed.quilates != null ? String(parsed.quilates).trim() : '',
      estado: parsed.estado != null ? String(parsed.estado).trim() : '',
      descripcionBreve: parsed.descripcionBreve != null ? String(parsed.descripcionBreve).trim() : '',
    };

    res.status(200).json(out);
  } catch (err) {
    console.error('identify API error:', err.message);
    res.status(502).json({
      error: 'Analysis failed',
      message: err.message || 'No se pudo analizar la imagen.',
    });
  }
};
