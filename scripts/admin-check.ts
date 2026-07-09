// Diagnostic + fix for admin email/password login.
//   Inspect:  npx tsx scripts/admin-check.ts <email>
//   Set pass: npx tsx scripts/admin-check.ts <email> <newPassword>
import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.argv[2];
const newPass = process.argv[3];
if (!email) { console.error('Usage: npx tsx scripts/admin-check.ts <email> [newPassword]'); process.exit(1); }

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error('FIREBASE_SERVICE_ACCOUNT missing in .env'); process.exit(1); }
if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(raw)) });

const auth = getAuth();

(async () => {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (e: any) {
    console.error(`\n❌ No user with email "${email}" — code: ${e.code}`);
    console.error('   → account does not exist. That is why login fails.\n');
    process.exit(0);
  }

  const providers = user.providerData.map(p => p.providerId);
  const hasPassword = providers.includes('password');

  console.log('\n── Account ─────────────────────────────');
  console.log('uid          :', user.uid);
  console.log('email        :', user.email);
  console.log('disabled     :', user.disabled, user.disabled ? '  ← BLOCKS LOGIN' : '');
  console.log('emailVerified:', user.emailVerified);
  console.log('providers    :', providers.join(', ') || '(none)');
  console.log('has password :', hasPassword, hasPassword ? '' : '  ← no password credential; email/password login CANNOT work');
  console.log('────────────────────────────────────────\n');

  if (newPass) {
    await auth.updateUser(user.uid, { password: newPass, disabled: false });
    console.log(`✅ Password set for ${email} (and account enabled). Try the Sign In box now.\n`);
  } else if (!hasPassword) {
    console.log('Fix: re-run with a password to add one:');
    console.log(`   npx tsx scripts/admin-check.ts ${email} "YourNewPassword123"\n`);
  }
})();
