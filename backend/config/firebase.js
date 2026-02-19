const admin = require('firebase-admin');

let serviceAccount;

// Try to load from environment variable first, then fall back to file
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (error) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', error);
  }
}

// If not loaded from env, try the JSON file
if (!serviceAccount) {
  try {
    serviceAccount = require('./firebase-service-account.json');
  } catch (error) {
    console.error('Error loading firebase-service-account.json:', error);
  }
}

// If still no service account, try individual env variables
if (!serviceAccount && process.env.FIREBASE_PROJECT_ID) {
  serviceAccount = {
    type: process.env.FIREBASE_TYPE || 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
    token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  };
}

// Initialize Firebase Admin
if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'realssa-news',
  });
  console.log('Firebase Admin initialized successfully');
} else {
  console.error('Failed to initialize Firebase Admin: No service account credentials found');
  // Initialize without credentials for development (will fail on FCM operations)
  admin.initializeApp({
    projectId: 'realssa-news',
  });
}

module.exports = admin;
