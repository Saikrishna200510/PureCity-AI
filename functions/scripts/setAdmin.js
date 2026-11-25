/**
 * Bootstrap script to securely grant administrator role to a user via Firebase Admin SDK.
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json node scripts/setAdmin.js user@example.com
 */
const admin = require('firebase-admin');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/setAdmin.js <user-email>');
    process.exit(1);
  }

  admin.initializeApp();
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  await admin.firestore().collection('users').doc(user.uid).set(
    {
      role: 'admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`Successfully granted admin privileges to ${email} (uid: ${user.uid})`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error setting admin role:', err);
  process.exit(1);
});
