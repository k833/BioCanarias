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
    let textPrompt = '';
    let imageDataUrl = null;
    let hasAudio = false;

    for (const p of parts || []) {
      if (p.text) textPrompt += (textPrompt ? '\n' : '') + p.text;
      if (p.inline_data?.mime_type?.startsWith('image/')) {
        imageDataUrl = `data:${p.inline_data.mime_type};base64,${p.inline_data.data}`;
      }
      if (p.inline_data?.mime_type?.startsWith('audio/')) {
        hasAudio = true;
      }
    }

    if (hasAudio) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: { message: 'El modo rápido con Groq funciona con Foto, Descripción y Quiz de rasgos (no con audio).' }
        })
      };
    }

    const model = imageDataUrl
      ? 'meta-llama/llama-4-scout-17b-16e-instruct'
      : 'llama-3.3-70b-versatile';

    const userContent = imageDataUrl
      ? [
          { type: 'text', text: textPrompt },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      : textPrompt;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: userContent }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 900
      })
    });

    clearTimeout(timeoutId);
    const data = await resp.json();

    if (!resp.ok) {
      const msg = data?.error?.message || `Error ${resp.status} en Groq`;
      return {
        statusCode: resp.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: { message: msg } })
      };
    }

    const replyText = data.choices?.[0]?.message?.content || '{}';

    // Devolvemos el mismo formato que espera index.html
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: replyText }] } }]
      })
    };
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? 'El servidor tardó demasiado. Inténtalo de nuevo.'
      : err.message;
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: msg } })
    };
  }
}
