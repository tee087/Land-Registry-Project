import nodemailer from 'nodemailer';
import env from '../config/environment.js';
const transport = env.email.host ? nodemailer.createTransport({ host: env.email.host, port: env.email.port, secure: env.email.port === 465, auth: env.email.user ? { user: env.email.user, pass: env.email.password } : undefined }) : null;
export async function sendAuthLink({ to, token, purpose }) {
  if (!transport) {
    if (env.isProduction || env.email.required) throw new Error('Email delivery is not configured');
    return;
  }
  const verify = purpose === 'email_verification';
  const link = new URL(verify ? '/verify-email' : '/reset-password', env.frontendUrl);
  link.hash = new URLSearchParams({ token }).toString();
  const text = verify
    ? `Your Land Registry email verification code is ${token}. It expires in 30 minutes.`
    : `Reset your Land Registry password using this one-time link (expires in 30 minutes): ${link.toString()}`;
  await transport.sendMail({ from: env.email.from, to, subject: verify ? 'Verify your Land Registry account' : 'Reset your Land Registry password', text });
}
