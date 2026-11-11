import bcrypt from 'bcryptjs';
import env from '../src/config/environment.js';
import { sequelize } from '../src/config/database.js';
import User from '../src/models/User.js';
import { issueAuthLink } from '../src/modules/auth/auth.service.js';

async function main() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD for this one-time command.');
  }
  if (ADMIN_PASSWORD.length < 10 || !/[a-z]/.test(ADMIN_PASSWORD) || !/[A-Z]/.test(ADMIN_PASSWORD) || !/[0-9]/.test(ADMIN_PASSWORD)) {
    throw new Error('Admin password must be at least 10 characters and include uppercase, lowercase and a number.');
  }
  await sequelize.authenticate();
  const existingAdmin = await User.unscoped().findOne({ where: { role: 'administrator' } });
  if (existingAdmin) throw new Error('An administrator already exists. Refusing to create another bootstrap administrator.');
  const existingEmail = await User.unscoped().findOne({ where: { email: ADMIN_EMAIL.trim().toLowerCase() } });
  if (existingEmail) throw new Error('That email address is already registered.');
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, env.auth.bcryptRounds);
  const admin = await User.create({ fullName: ADMIN_NAME.trim(), email: ADMIN_EMAIL.trim().toLowerCase(), passwordHash, role: 'administrator', status: env.email.required ? 'pending' : 'active' });
  if (env.email.required && !(await issueAuthLink(admin, 'email_verification'))) {
    throw new Error('Administrator created pending verification, but email was not sent. Fix SMTP and request a verification resend.');
  }
  console.log(`Administrator created: ${admin.email} (id ${admin.id}). Remove ADMIN_PASSWORD from your shell environment now.`);
}

main().catch((error) => {
  console.error(`[admin:create] ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await sequelize.close();
});
