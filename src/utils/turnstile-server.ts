interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Allow local/dev use when Turnstile is not configured.
  if (!secret) {
    return { success: true };
  }

  if (!token || !token.trim()) {
    return { success: false, error: 'Please complete the security verification.' };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  if (remoteIp && remoteIp !== 'unknown') {
    body.append('remoteip', remoteIp);
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    return { success: false, error: 'Security verification failed. Please try again.' };
  }

  const data = (await response.json()) as TurnstileVerifyResponse;
  if (!data.success) {
    return {
      success: false,
      error: data['error-codes']?.length
        ? `Security verification failed (${data['error-codes'][0]}).`
        : 'Security verification failed. Please retry.',
    };
  }

  return { success: true };
}
