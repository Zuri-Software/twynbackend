/**
 * Apple Push Notification service (APNs) Configuration
 * 
 * This file contains the configuration needed for your backend to send
 * push notifications to iOS devices using APNs.
 */

const path = require('path');

const APNs_CONFIG = {
  // APNs Authentication Key Information
  keyId: '4AAZ6C3UBJ',                    // Key ID from Apple Developer Console
  teamId: 'FZ8VKA8QJN',                   // Team ID from Apple Developer Console
  bundleId: 'com.dhruvnashdesai.twyn',    // Your app's bundle identifier
  
  // Path to your .p8 key file
  keyPath: path.join(__dirname, 'AuthKey_4AAZ6C3UBJ.p8'),
  
  // APNs Environment
  production: false,  // Set to true for production builds, false for development
  
  // Topic (should match your bundle ID)
  topic: 'com.dhruvnashdesai.twyn',
  
  // Default notification settings
  defaultSettings: {
    sound: 'default',
    badge: 1,
    contentAvailable: true,
    category: 'TWYN_NOTIFICATION'
  }
};

module.exports = APNs_CONFIG;