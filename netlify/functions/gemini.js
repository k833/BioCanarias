export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: { message: 'Method Not Allowed' } }) };
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'Falta configurar GEMINI_API_KEY en las variables de entorno de Netlify.' }
      })
    };
  }

  try {
    const { parts } = JSON.parse(event.body);
    const model = 'gemini-3.8-flash';
    const payload = JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    });

    // Build candidate endpoints: AQ. keys use Vertex AI Express first, AIzaSy uses Generative Language API first
    const endpoints = apiKey.startsWith('AQ.')
      ? [
          `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
        ]
      : [
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
        ];

    let lastResp = null;
    let lastText = '';

    for (const url of endpoints) {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      const text = await resp.text();
      if (resp.ok) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: text
        };
      }
      lastResp = resp;
      lastText = text;
    }

    return {
      statusCode: lastResp ? lastResp.status : 500,
      headers: { 'Content-Type': 'application/json' },
      body: lastText || JSON.stringify({ error: { message: 'Error al conectar con Gemini.' } })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
}
