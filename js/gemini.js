/**
 * ============================================================
 * NATURE DISPATCH TMS — Gemini AI Module
 * ============================================================
 * • Parses Rate Con PDFs using Google Gemini Vision API
 * • Round-robin model fallback: tries multiple models on quota errors
 * • Extracts load data (load #, broker, stops, revenue, dates…)
 * • Creates loads automatically from extracted data
 * ============================================================
 */

const Gemini = (() => {

  const STORAGE_KEY = 'nd_gemini_key';

  // ── Round-robin model list (ordered by priority / capability) ──
  // On quota error the module automatically tries the next model.
  const MODELS = [
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash-preview-04-17',
    'gemini-2.5-pro',
    'gemini-3.1-flash-lite-preview-06-06',
  ];

  // Track which model index to start with (persisted per session)
  let _modelIndex = 0;

  /** Get the API key from localStorage */
  function getApiKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  /**
   * Convert a File object to a base64-encoded string (without the data URI prefix).
   * @param {File} file
   * @returns {Promise<string>}
   */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Determine if an error is a quota / rate-limit error that warrants
   * trying the next model in the round-robin list.
   */
  function _isQuotaError(status, errBody) {
    if (status === 429) return true;
    const msg = (errBody?.error?.message || '').toLowerCase();
    return msg.includes('quota') || msg.includes('rate') || msg.includes('resource has been exhausted');
  }

  /**
   * Call Gemini generateContent for a specific model.
   * @returns {Promise<Response>}
   */
  function _callModel(modelName, apiKey, requestBody) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  }

  /**
   * Send a PDF to Gemini to extract Rate Con data.
   * Implements round-robin fallback across MODELS on quota errors.
   *
   * @param {File} file – PDF File object
   * @returns {Promise<Object>} – Parsed load data
   */
  async function parseRateCon(file) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Gemini API key not configured. Go to Settings → Integrations to add it.');

    const base64Data = await fileToBase64(file);
    const mimeType = file.type || 'application/pdf';

    const prompt = `You are a freight/trucking expert. Analyze this Rate Confirmation (Rate Con) document and extract ALL the following information. Return ONLY a valid JSON object with NO markdown formatting, NO code blocks, NO backticks - just the raw JSON.

The JSON must follow this exact structure:
{
  "load_number": "string or null",
  "broker_name": "string or null",
  "broker_mc": "string or null",
  "broker_phone": "string or null",
  "broker_email": "string or null",
  "revenue": number or null,
  "weight": "string or null",
  "commodity": "string or null",
  "equipment_type": "string or null",
  "special_instructions": "string or null",
  "stops": [
    {
      "type": "Pickup" or "Delivery",
      "company_name": "string or null",
      "address": "full address string",
      "city": "string",
      "state": "string (2-letter code)",
      "zip": "string",
      "date": "YYYY-MM-DD or null",
      "time": "HH:MM or null",
      "reference": "string or null",
      "notes": "string or null"
    }
  ],
  "notes": "any other important details from the rate con"
}

Rules:
- Extract every pickup and delivery stop you can find.
- Revenue should be a NUMBER (no $ sign, no commas).
- Dates must be ISO format YYYY-MM-DD.
- If a field is not found in the document, set it to null.
- Some rate cons list "shipper" = Pickup and "consignee/receiver" = Delivery.
- Combine address components (street, city, state, zip) into the "address" field as a full address.
- Be thorough - check all pages of the document.

Return ONLY the JSON, nothing else.`;

    const requestBody = {
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          { text: prompt }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      }
    };

    // ── Round-robin: try each model starting from _modelIndex ───
    const errors = [];
    for (let attempt = 0; attempt < MODELS.length; attempt++) {
      const idx = (_modelIndex + attempt) % MODELS.length;
      const model = MODELS[idx];
      console.log(`[Gemini] Trying model: ${model} (attempt ${attempt + 1}/${MODELS.length})`);

      try {
        const res = await _callModel(model, apiKey, requestBody);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (_isQuotaError(res.status, errData)) {
            const msg = errData?.error?.message || `HTTP ${res.status}`;
            console.warn(`[Gemini] ${model} quota exceeded, rotating… (${msg})`);
            errors.push(`${model}: ${msg}`);
            continue; // try next model
          }
          // Non-quota error → throw immediately
          const msg = errData?.error?.message || `HTTP ${res.status}`;
          throw new Error(`Gemini API error (${model}): ${msg}`);
        }

        // Success → advance the robin index so next call starts with this model
        _modelIndex = idx;

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Gemini returned an empty response. The PDF may be unreadable.');

        // Parse JSON from the response
        let cleaned = text.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
        }

        try {
          const parsed = JSON.parse(cleaned);
          console.log(`[Gemini] ✓ Success with model: ${model}`);
          return parsed;
        } catch (parseErr) {
          console.error('[Gemini] Raw response:', text);
          throw new Error('Failed to parse AI response. The model returned invalid JSON.');
        }

      } catch (err) {
        // If it was already thrown as a non-quota error, re-throw
        if (!err.message.includes('quota exceeded, rotating')) throw err;
      }
    }

    // All models exhausted
    throw new Error(
      `All Gemini models hit quota limits. Tried: ${MODELS.join(', ')}.\n` +
      `Details:\n${errors.join('\n')}\n\n` +
      `Please wait a few minutes or check your billing at https://ai.google.dev/`
    );
  }

  return { getApiKey, parseRateCon, MODELS };
})();
