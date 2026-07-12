const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let initialized = false;

const initFirebase = () => {
  if (initialized) return admin;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    console.warn('FIREBASE_SERVICE_ACCOUNT_PATH not set — push notifications disabled');
    return null;
  }

  const resolvedPath = path.resolve(serviceAccountPath);
  if (!fs.existsSync(resolvedPath)) {
    console.warn(`Firebase service account not found at ${resolvedPath} — push notifications disabled`);
    return null;
  }

  const serviceAccount = require(resolvedPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  initialized = true;
  console.log('Firebase Admin initialized');
  return admin;
};

module.exports = { initFirebase, getAdmin: () => (initialized ? admin : null) };
