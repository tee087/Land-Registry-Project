import nodemailer from 'nodemailer';
import { fileURLToPath } from 'node:url';
import env from '../config/environment.js';
const transport = env.email.host ? nodemailer.createTransport({ host: env.email.host, port: env.email.port, secure: env.email.port === 465, auth: env.email.user ? { user: env.email.user, pass: env.email.password } : undefined }) : null;
const logoPath = fileURLToPath(new URL('../../assets/land-registrychain-logo.png', import.meta.url));
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export async function sendAuthLink({ to, token, purpose }) {
  if (!transport) {
    if (env.isProduction || env.email.required) throw new Error('Email delivery is not configured');
    return;
  }
  const verify = purpose === 'email_verification';
  const link = new URL(verify ? '/verify-email' : '/reset-password', env.frontendUrl);
  link.hash = new URLSearchParams({ token }).toString();
  const text = verify
    ? `Welcome to LandRegistryChain, ${to}.\n\nYour account is ready for email verification. Enter this one-time code in the verification page:\n\n${token}\n\nThe code expires in 30 minutes. Never share it with anyone.\n\nAfter verification, sign in to open your buyer or seller workspace. Registry information in this platform is for assistance and does not replace an official land search.`
    : `Reset your Land Registry password using this one-time link (expires in 30 minutes): ${link.toString()}`;
  const verificationHtml = verify ? `
    <div style="margin:0;background:#f1f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
        <div style="background:#071426;padding:22px;text-align:center">
          <img src="cid:landregistrychain-logo" alt="LandRegistryChain" width="112" style="display:block;width:112px;height:auto;max-width:100%;margin:0 auto 12px;border:0" />
          <div style="color:#ffffff;font-size:20px;font-weight:700">LandRegistryChain</div>
        </div>
        <div style="padding:30px 28px">
          <p style="margin:0 0 12px;font-size:16px">Welcome, ${escapeHtml(to)}!</p>
          <h1 style="margin:0 0 12px;font-size:23px;line-height:1.3;color:#0f172a">Verify your email address</h1>
          <p style="margin:0 0 22px;color:#475569;line-height:1.6">Use this one-time code to finish creating your account:</p>
          <div style="padding:17px 20px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;text-align:center;color:#075985;font-size:30px;font-weight:700;letter-spacing:8px">${escapeHtml(token)}</div>
          <p style="margin:18px 0 0;color:#475569;line-height:1.6">This code expires in <strong>30 minutes</strong>. Keep it private; our team will never ask you to share it.</p>
          <p style="margin:18px 0 0;color:#475569;line-height:1.6">Once verified, sign in to open your buyer or seller workspace. Registry information here is for assistance and does not replace an official land search.</p>
        </div>
        <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5">If you did not create this account, you can ignore this message.</div>
      </div>
    </div>` : undefined;
  await transport.sendMail({
    from: env.email.from,
    to,
    subject: verify ? 'Welcome to LandRegistryChain — verify your email' : 'Reset your Land Registry password',
    text,
    ...(verify ? {
      html: verificationHtml,
      attachments: [{ filename: 'LandRegistryChain-logo.png', path: logoPath, contentType: 'image/png', cid: 'landregistrychain-logo' }],
    } : {}),
  });
}

export async function sendReviewerAccessRequest({ reference, user, application }) {
  if (!transport) throw new Error('Email delivery is not configured');
  const recipient = 'watchoverlandregistry@yahoo.com';
  const type = application.applicationType === 'statutory_lcb'
    ? 'Request to verify an existing statutory Land Control Board appointment'
    : 'Request for platform county review committee access';
  const text = [
    'A county reviewer access request was submitted through LandRegistryChain.',
    '',
    `Reference: ${reference}`,
    `Applicant: ${user.fullName}`,
    `Account email: ${user.email}`,
    `Phone: ${user.phone || 'Not provided'}`,
    `County: ${application.county}`,
    `Request type: ${type}`,
    `Board / committee: ${application.boardName}`,
    `Appointing authority: ${application.appointingAuthority}`,
    `Appointment / gazette reference: ${application.appointmentReference}`,
    `Term: ${application.term}`,
    '',
    'Applicant statement:',
    application.experience,
    '',
    'No permissions were granted by this request. Review the applicant’s appointment evidence independently before making any role decision.',
    `The applicant was instructed to email supporting appointment documents to ${recipient} and quote reference ${reference}.`,
  ].join('\n');
  await transport.sendMail({
    from: env.email.from,
    to: recipient,
    replyTo: user.email,
    subject: `[${reference}] ${type} — ${application.county}`,
    text,
  });
}
