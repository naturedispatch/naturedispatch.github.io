/**
 * ============================================================
 * NATURE DISPATCH TMS — Gemini AI Module
 * ============================================================
 * • Parses Rate Con PDFs using Google Gemini Vision API
 * • Extracts load data (load #, broker, stops, revenue, dates…)
 * • Creates loads automatically from extracted data
 * ============================================================
 */

const Gemini = (() => {

  const STORAGE_KEY = 'nd_gemini_key';

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
        // result is "data:application/pdf;base64,XXXX…"
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Send a PDF to Gemini to extract Rate Con data.
   * Uses the Gemini 2.0 Flash model with inline file data.
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const body = {
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

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message || `HTTP ${res.status}`;
      throw new Error(`Gemini API error: ${msg}`);
    }

    const data = await res.json();

    // Extract text from Gemini response
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty response. The PDF may be unreadable.');

    // Parse JSON from the response (handle potential markdown wrapping)
    let cleaned = text.trim();
    // Remove markdown code block if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    try {
      return JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Gemini raw response:', text);
      throw new Error('Failed to parse AI response. The model returned invalid JSON.');
    }
  }

  return { getApiKey, parseRateCon };
})();
