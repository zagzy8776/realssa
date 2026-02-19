const admin = require('firebase-admin');

let serviceAccount;
let firebaseInitialized = false;

// Try to load from environment variable first, then fall back to file
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('Loaded Firebase service account from FIREBASE_SERVICE_ACCOUNT env var');
  } catch (error) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', error.message);
  }
}

// If not loaded from env, try the JSON file
if (!serviceAccount) {
  try {
    serviceAccount = require('./firebase-service-account.json');
    console.log('Loaded Firebase service account from JSON file');
  } catch (error) {
    // Silently ignore - file may not exist in production
  }
}

// If still no service account, try individual env variables
if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
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
  console.log('Loaded Firebase service account from individual env vars');
}

// Initialize Firebase Admin only if we have credentials
if (serviceAccount && serviceAccount.project_id && serviceAccount.private_key) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    firebaseInitialized = true;
    console.log('Firebase Admin initialized successfully for project:', serviceAccount.project_id);
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error.message);
  }
} else {
  console.warn('Firebase Admin not initialized - no valid service account credentials found');
  console.warn('FCM notifications will not work. Set FIREBASE_SERVICE_ACCOUNT env var or add firebase-service-account.json');
}

// Export admin with a mock messaging() method if not initialized
if (!firebaseInitialized) {
  // Create a mock messaging object that returns errors gracefully
  const mockMessaging = {
    send: async () => {
      throw new Error('Firebase not initialized - FCM notifications disabled');
    },
    subscribeToTopic: async () => {
      throw new Error('Firebase not initialized - FCM topic subscription disabled');
    },
    unsubscribeFromTopic: async () => {
      throw new Error('Firebase not initialized - FCM topic unsubscription disabled');
    }
  };
  
  // Override the messaging method
  admin.messaging = () => mockMessaging;
}

module.exports = admin;
