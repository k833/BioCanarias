export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: { message: 'Method Not Allowed' } }) };
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: 'Falta configurar GEMINI_API_KEY en Netlify.' } })
    };
  }

  try {
    const { parts } = JSON.parse(event.body);
    const model = 'gemini-3.8-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 700
        }
      })
    });

    clearTimeout(timeoutId);
    const text = await resp.text();

    if (resp.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: text
      };
    }

    let realMsg = `Error ${resp.status}`;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed[0]?.error?.message) {
        realMsg = parsed[0].error.message;
      } else if (parsed?.error?.message) {
        realMsg = parsed.error.message;
      }
    } catch {}

    return {
      statusCode: resp.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: realMsg } })
    };
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? 'Google tardó demasiado en responder. Pulsa de nuevo en unos segundos.'
      : err.message;
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: msg } })
    };
  }
}
