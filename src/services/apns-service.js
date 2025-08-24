/**
 * APNs Service for Twyn App
 * 
 * This service handles sending push notifications to iOS devices using Apple Push Notification service.
 * Requires: npm install apn
 */

const apn = require('apn');
const APNs_CONFIG = require('./apns-config');

class APNsService {
  constructor() {
    this.provider = null;
    this.initialize();
  }

  /**
   * Initialize the APNs provider
   */
  initialize() {
    try {
      const options = {
        token: {
          key: APNs_CONFIG.keyPath,
          keyId: APNs_CONFIG.keyId,
          teamId: APNs_CONFIG.teamId
        },
        production: APNs_CONFIG.production
      };

      this.provider = new apn.Provider(options);
      console.log('[APNs] Service initialized successfully');
      
      // Handle provider errors
      this.provider.on('error', (error) => {
        console.error('[APNs] Provider error:', error);
      });

    } catch (error) {
      console.error('[APNs] Failed to initialize service:', error);
    }
  }

  /**
   * Send a push notification to a single device
   * 
   * @param {string} deviceToken - iOS device token
   * @param {Object} payload - Notification payload
   * @param {string} payload.title - Notification title
   * @param {string} payload.body - Notification body
   * @param {Object} payload.data - Custom data
   */
  async sendNotification(deviceToken, payload) {
    if (!this.provider) {
      throw new Error('APNs provider not initialized');
    }

    try {
      const notification = new apn.Notification();
      
      // Set notification content
      notification.alert = {
        title: payload.title,
        body: payload.body
      };
      
      // Set notification properties
      notification.sound = payload.sound || APNs_CONFIG.defaultSettings.sound;
      notification.badge = payload.badge || APNs_CONFIG.defaultSettings.badge;
      notification.topic = APNs_CONFIG.topic;
      notification.contentAvailable = payload.contentAvailable || APNs_CONFIG.defaultSettings.contentAvailable;
      notification.category = payload.category || APNs_CONFIG.defaultSettings.category;
      
      // Add custom data
      if (payload.data) {
        notification.payload = payload.data;
      }

      // Send notification
      const result = await this.provider.send(notification, deviceToken);
      
      if (result.sent.length > 0) {
        console.log('[APNs] ✅ Notification sent successfully to device:', deviceToken.substring(0, 20) + '...');
        return { success: true, result };
      } else if (result.failed.length > 0) {
        const error = result.failed[0].error;
        console.error('[APNs] ❌ Failed to send notification:', error);
        return { success: false, error: error.reason };
      }

    } catch (error) {
      console.error('[APNs] ❌ Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send training completion notification
   * 
   * @param {string} deviceToken - iOS device token
   * @param {Object} data - Training data
   */
  async sendTrainingCompletedNotification(deviceToken, data) {
    const payload = {
      title: 'Training Complete! 🎉',
      body: `Your model "${data.modelName}" is ready to use`,
      data: {
        type: 'training_completed',
        modelId: data.modelId,
        modelName: data.modelName
      },
      category: 'TRAINING_COMPLETE'
    };

    return await this.sendNotification(deviceToken, payload);
  }

  /**
   * Send generation completion notification
   * 
   * @param {string} deviceToken - iOS device token
   * @param {Object} data - Generation data
   */
  async sendGenerationCompletedNotification(deviceToken, data) {
    const payload = {
      title: 'Images Ready! ✨',
      body: `${data.imageCount} new images generated with ${data.presetName}`,
      data: {
        type: 'generation_completed',
        generationId: data.generationId,
        imageCount: data.imageCount,
        presetName: data.presetName
      },
      category: 'GENERATION_COMPLETE'
    };

    return await this.sendNotification(deviceToken, payload);
  }

  /**
   * Send generation failed notification
   * 
   * @param {string} deviceToken - iOS device token
   * @param {Object} data - Generation failure data
   */
  async sendGenerationFailedNotification(deviceToken, data) {
    const payload = {
      title: 'Generation Failed ⚠️',
      body: data.errorMessage || 'Image generation failed. Please try again.',
      data: {
        type: 'generation_failed',
        generationId: data.generationId,
        errorMessage: data.errorMessage
      },
      category: 'GENERATION_FAILED'
    };

    return await this.sendNotification(deviceToken, payload);
  }

  /**
   * Clean up resources
   */
  shutdown() {
    if (this.provider) {
      this.provider.shutdown();
      console.log('[APNs] Service shutdown');
    }
  }
}

module.exports = new APNsService();