const Admin = require('../models/Admin');

/**
 * Seed the default admin account if it doesn't already exist.
 * Reads credentials from environment variables to avoid hardcoding secrets.
 */
const seedAdmin = async () => {
  try {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      console.warn('⚠️  ADMIN_USERNAME or ADMIN_PASSWORD not set in .env — skipping seed.');
      return;
    }

    // Check if admin already exists (parameterized query — safe from injection)
    const existingAdmin = await Admin.findOne({ username: adminUsername });

    if (existingAdmin) {
      console.log(`ℹ️  Admin "${adminUsername}" already exists — skipping seed.`);
      return;
    }

    // Create the admin (password is hashed automatically by the pre-save hook)
    await Admin.create({
      username: adminUsername,
      password: adminPassword,
      role: 'superadmin',
    });

    console.log(`✅ Admin "${adminUsername}" seeded successfully.`);
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
  }
};

module.exports = seedAdmin;
