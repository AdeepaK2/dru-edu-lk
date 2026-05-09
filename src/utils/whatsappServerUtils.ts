export interface GreenApiResponse {
  idMessage: string;
  statusMessage: string;
}

export function formatPhoneForWhatsApp(phone: string): string {
  let cleanNumber = phone.replace(/\D/g, '');

  if (cleanNumber.startsWith('61')) {
    return `${cleanNumber}@c.us`;
  } else if (cleanNumber.startsWith('0')) {
    return `61${cleanNumber.substring(1)}@c.us`;
  } else if (cleanNumber.length === 9) {
    return `61${cleanNumber}@c.us`;
  }

  return `${cleanNumber}@c.us`;
}

export async function sendRawWhatsAppMessage(
  chatId: string,
  message: string,
): Promise<GreenApiResponse> {
  const GREEN_API_URL = process.env.GREEN_API;
  const GREEN_ID = process.env.GREEN_ID;
  const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN;

  if (!GREEN_API_URL || !GREEN_ID || !GREEN_API_TOKEN) {
    throw new Error('Green API configuration missing. Check GREEN_API, GREEN_ID, GREEN_API_TOKEN env vars.');
  }

  const url = `${GREEN_API_URL}/waInstance${GREEN_ID}/sendMessage/${GREEN_API_TOKEN}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Green API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}
