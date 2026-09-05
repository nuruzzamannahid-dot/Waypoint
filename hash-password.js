// Usage: node scripts/hash-password.js "yourNewPassword"
// Prints a bcrypt hash you can paste into a Turso SQL UPDATE — see README
// "Changing a password" section.
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.js "yourNewPassword"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
console.log(hash);
