/**
 * Centralized environment configuration.
 *
 * Import typed config objects from here instead of accessing process.env directly.
 * Add new env vars here when introducing them to the codebase.
 */

function require(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const appConfig = {
  siteUrl:
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  nodeEnv: optional('NODE_ENV', 'development'),
  cronSecret: optional('CRON_SECRET'),
} as const;

export const smtpConfig = {
  connectionUri: optional('SMTP_CONNECTION_URI'),
  host: optional('SMTP_HOST', 'smtp.gmail.com'),
  port: parseInt(optional('SMTP_PORT', '465'), 10),
  user: optional('SMTP_USER'),
  password: optional('SMTP_PASSWORD'),
  fromEmail: optional('SMTP_FROM_EMAIL') || optional('SMTP_USER'),
  fromName: optional('SMTP_FROM_NAME', 'Dr U Education'),
} as const;

export const greenApiConfig = {
  apiUrl: optional('GREEN_API'),
  mediaApiUrl: optional('MEDIA_API'),
  instanceId: optional('GREEN_ID'),
  token: optional('GREEN_API_TOKEN'),
} as const;

export const stripeConfig = {
  secretKey: optional('STRIPE_SECRET_KEY'),
  webhookSecret: optional('STRIPE_WEBHOOK_SECRET'),
  publishableKey: optional('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
} as const;
