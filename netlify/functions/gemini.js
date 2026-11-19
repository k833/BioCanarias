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
    const model = 'gemini-3.8-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });

    const text = await resp.text();

    if (resp.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: text
      };
    }

    let realMsg = `Error ${resp.status}: ${text.slice(0, 180)}`;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed[0]?.error?.message) {
        realMsg = `(${resp.status}) ${parsed[0].error.message}`;
      } else if (parsed?.error?.message) {
        realMsg = `(${resp.status}) ${parsed.error.message}`;
      }
    } catch {}

    return {
      statusCode: resp.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: realMsg } })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
}
