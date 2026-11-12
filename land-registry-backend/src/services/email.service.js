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
