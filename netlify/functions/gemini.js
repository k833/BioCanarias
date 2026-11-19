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

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    const { parts } = JSON.parse(event.body);
    const payload = JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    });

    // Intenta el modelo principal y, si está saturado, pasa a los de respaldo
    const models = ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-2.5-flash-lite'];
    let lastResp = null;
    let lastText = '';

    for (const model of models) {
      const endpoints = apiKey.startsWith('AQ.')
        ? [
            `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
          ]
        : [
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
            `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
          ];

      for (const url of endpoints) {
        for (let attempt = 0; attempt < 2; attempt++) {
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

          // Si hay pico de demanda (503 o 429), espera 1.2 s y reintenta
          if (resp.status === 503 || resp.status === 429) {
            await sleep(1200);
            continue;
          }
          break;
        }
      }
    }

    return {
      statusCode: lastResp ? lastResp.status : 500,
      headers: { 'Content-Type': 'application/json' },
      body: lastText || JSON.stringify({ error: { message: 'Servidores saturados temporalmente. Inténtalo en unos segundos.' } })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
}
