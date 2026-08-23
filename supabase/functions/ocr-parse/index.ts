/**
 * OCR proxy — keeps OCR.Space API key on the server (Supabase secret).
 * Mobile sends base64 image; function returns extracted text.
 */

const OCR_ENDPOINT = 'https://api.ocr.space/parse/image';

type OcrParseRequest = {
  /** Health-check / connectivity probe (no image). */
  test?: boolean;
  base64Image?: string;
  mimeType?: string;
};

type OcrParseResponse = {
  success: boolean;
  message?: string;
  text?: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const json = (payload: OcrParseResponse, status = 200): Response =>
  new Response(JSON.stringify(payload), { status, headers: corsHeaders });

const getOcrApiKey = (): string | null => {
  const key = Deno.env.get('OCR_SPACE_API_KEY')?.trim();
  return key || null;
};

const callOcrSpace = async (params: URLSearchParams): Promise<OcrParseResponse> => {
  const response = await fetch(OCR_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errBody = (await response.json()) as { ErrorMessage?: string; error?: { errorDetail?: string } };
      detail = errBody?.error?.errorDetail || errBody?.ErrorMessage || detail;
    } catch {
      // ignore
    }
    return { success: false, message: detail };
  }

  const data = (await response.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string;
    ParsedResults?: Array<{ ParsedText?: string }>;
  };

  if (data.IsErroredOnProcessing) {
    return { success: false, message: data.ErrorMessage || 'OCR processing error' };
  }

  const parsedText = data.ParsedResults?.[0]?.ParsedText;
  if (!parsedText || !parsedText.trim()) {
    return { success: false, message: 'No text extracted from image' };
  }

  return { success: true, text: parsedText, message: 'OK' };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ success: false, message: 'Method not allowed' }, 405);
  }

  const apiKey = getOcrApiKey();
  if (!apiKey) {
    return json(
      {
        success: false,
        message: 'OCR_SPACE_API_KEY is not configured on Supabase Edge Functions.',
      },
      500,
    );
  }

  let body: OcrParseRequest;
  try {
    body = (await req.json()) as OcrParseRequest;
  } catch {
    return json({ success: false, message: 'Invalid JSON body' }, 400);
  }

  if (body.test === true) {
    const params = new URLSearchParams();
    params.append('apikey', apiKey);
    params.append('url', 'https://api.ocr.space/screenshot');
    const result = await callOcrSpace(params);
    if (!result.success) {
      return json({ success: false, message: result.message || 'OCR connectivity test failed' }, 502);
    }
    return json({
      success: true,
      message: 'OCR proxy reachable (OCR.Space OK)',
      text: result.text ?? null,
    });
  }

  const rawBase64 = typeof body.base64Image === 'string' ? body.base64Image.trim() : '';
  if (!rawBase64) {
    return json({ success: false, message: 'base64Image is required' }, 400);
  }

  const mimeType =
    typeof body.mimeType === 'string' && body.mimeType.trim() ? body.mimeType.trim() : 'image/jpeg';

  let cleanBase64 = rawBase64;
  if (rawBase64.includes('data:')) {
    const commaIdx = rawBase64.indexOf(',');
    cleanBase64 = commaIdx >= 0 ? rawBase64.slice(commaIdx + 1) : rawBase64;
  }

  if (cleanBase64.length < 100) {
    return json({ success: false, message: 'Image payload too small' }, 400);
  }

  const params = new URLSearchParams();
  params.append('apikey', apiKey);
  params.append('base64image', `data:${mimeType};base64,${cleanBase64}`);
  params.append('language', 'eng');
  params.append('isoverlayrequired', 'false');

  const result = await callOcrSpace(params);
  if (!result.success) {
    return json({ success: false, message: result.message || 'OCR failed' }, 502);
  }

  return json({ success: true, text: result.text ?? null, message: 'OK' });
});
