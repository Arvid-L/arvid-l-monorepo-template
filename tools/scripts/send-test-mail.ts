import { createTransport } from 'nodemailer';
import { config } from 'dotenv';
import { resolve } from 'path';

// Sends one test mail through the configured SMTP settings.
// Usage: pnpm run mail:test you@somewhere.com
// Reads SMTP_* / MAIL_FROM from the environment; falls back to
// .env.production (never committed) so it works from a fresh checkout.
if (!process.env.SMTP_HOST) {
  config({ path: resolve(__dirname, '../../.env.production') });
}

const to = process.argv[2];
if (!to) {
  console.error('Usage: pnpm run mail:test <recipient>');
  process.exit(1);
}
if (!process.env.SMTP_HOST) {
  console.error(
    'SMTP_HOST not set (env or .env.production) — nothing to test.',
  );
  process.exit(1);
}

const transporter = createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    : undefined,
});

transporter
  .sendMail({
    from: process.env.MAIL_FROM ?? 'noreply@localhost',
    to,
    subject: 'SMTP test mail',
    text: `SMTP settings work. Sent via ${process.env.SMTP_HOST}.`,
  })
  .then((info) => {
    console.log(`✓ Test mail sent to ${to} (${info.messageId})`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Sending failed:', error.message);
    process.exit(1);
  });
