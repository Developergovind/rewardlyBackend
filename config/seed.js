require('dotenv').config();
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Settings = require('../models/Settings');

const seedOnStartup = async () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@rewardly.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const adminName = process.env.ADMIN_NAME || 'Super Admin';

  const existingAdmin = await Admin.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    await Admin.create({
      email: adminEmail,
      password: hashedPassword,
      name: adminName,
    });
    console.log(`Default admin seeded: ${adminEmail}`);
  }

  const existingSettings = await Settings.findOne();
  if (!existingSettings) {
    await Settings.create({});
    console.log('Default settings document created');
  }
};

module.exports = seedOnStartup;
