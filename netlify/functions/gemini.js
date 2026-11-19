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
        error: { message: 'Falta configurar GEMINI_API_KEY en Netlify.' }
      })
    };
  }

  try {
    const { parts } = JSON.parse(event.body);
    const payload = JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    });

    const models = ['gemini-3.8-flash', 'gemini-3.8-flash-lite'];
    let lastStatus = 500;
    let lastText = '';

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
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

      lastStatus = resp.status;
      lastText = text;
    }

    return {
      statusCode: lastStatus,
      headers: { 'Content-Type': 'application/json' },
      body: lastText || JSON.stringify({ error: { message: 'Sin respuesta de Gemini. Inténtalo de nuevo.' } })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
}
