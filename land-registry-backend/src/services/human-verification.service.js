import env from '../config/environment.js';
import { AppError } from '../utils/responseHandler.js';

export async function verifyHuman(token, action) {
  if (env.isTest || (!env.isProduction && !env.turnstile.secretKey)) return;
  if (!env.turnstile.secretKey) {
    throw new AppError('Human verification is not configured. Please try again later.', 503, 'HUMAN_VERIFICATION_UNAVAILABLE');
  }
  if (typeof token !== 'string' || token.length < 1 || token.length > 2048) {
    throw new AppError('Complete the human verification check and try again.', 422, 'HUMAN_VERIFICATION_REQUIRED');
  }

  let result;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: env.turnstile.secretKey, response: token }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Siteverify returned ${response.status}`);
    result = await response.json();
  } catch (error) {
    console.error(`[security] Turnstile validation unavailable: ${error.message}`);
    throw new AppError('Human verification is temporarily unavailable. Please try again.', 503, 'HUMAN_VERIFICATION_UNAVAILABLE');
  }

  const hostnameAllowed = env.turnstile.hostnames.length === 0 || env.turnstile.hostnames.includes(result.hostname);
  if (!result.success || result.action !== action || !hostnameAllowed) {
    throw new AppError('Human verification failed or expired. Please complete it again.', 422, 'HUMAN_VERIFICATION_FAILED');
  }
}
