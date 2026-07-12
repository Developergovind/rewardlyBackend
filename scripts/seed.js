require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Settings = require('../models/Settings');
const connectDB = require('../config/db');

const seed = async () => {
  await connectDB();

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
    console.log(`Admin seeded: ${adminEmail}`);
  } else {
    console.log('Admin already exists, skipping');
  }

  const existingSettings = await Settings.findOne();
  if (!existingSettings) {
    await Settings.create({});
    console.log('Default settings document created');
  } else {
    console.log('Settings already exist, skipping');
  }

  await mongoose.disconnect();
  console.log('Seed completed');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
