/**
 * Expo Push Service for Twyn App
 * 
 * This service handles sending push notifications to devices using Expo's push service.
 * Works with Expo push tokens (format: ExponentPushToken[...])
 */

const { Expo } = require('expo-server-sdk');

class ExpoPushService {
  constructor() {
    this.expo = new Expo();
    console.log('[Expo Push] Service initialized successfully');
  }

  /**
   * Check if a token is a valid Expo push token
   * @param {string} token - The push token to validate
   * @returns {boolean} - True if valid Expo token
   */
  isExpoToken(token) {
    return Expo.isExpoPushToken(token);
  }

  /**
   * Send a push notification to a single device
   * 
   * @param {string} to - Expo push token
   * @param {Object} payload - Notification payload
   * @param {string} payload.title - Notification title
   * @param {string} payload.body - Notification body
   * @param {Object} payload.data - Custom data
   */
  async sendNotification(to, payload) {
    try {
      // Validate the token
      if (!Expo.isExpoPushToken(to)) {
        console.error('[Expo Push] ❌ Invalid Expo push token:', to.substring(0, 20) + '...');
        return { success: false, error: 'Invalid Expo push token' };
      }

      // Construct the message
      const message = {
        to,
        sound: payload.sound || 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        categoryId: payload.category,
        channelId: 'default',
      };

      // Add badge if specified
      if (payload.badge !== undefined) {
        message.badge = payload.badge;
      }

      console.log('[Expo Push] 📤 Sending notification to:', to.substring(0, 30) + '...');
      console.log('[Expo Push] 📤 Message:', JSON.stringify(message, null, 2));

      // Send the notification
      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('[Expo Push] ❌ Error sending notification chunk:', error);
          return { success: false, error: error.message };
        }
      }

      // Check if notification was accepted
      const ticket = tickets[0];
      if (ticket.status === 'ok') {
        console.log('[Expo Push] ✅ Notification sent successfully, ID:', ticket.id);
        return { success: true, id: ticket.id };
      } else {
        console.error('[Expo Push] ❌ Notification failed:', ticket.message);
        return { success: false, error: ticket.message };
      }

    } catch (error) {
      console.error('[Expo Push] ❌ Error sending notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send training completion notification
   * 
   * @param {string} to - Expo push token
   * @param {Object} data - Training data
   */
  async sendTrainingCompletedNotification(to, data) {
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

    return await this.sendNotification(to, payload);
  }

  /**
   * Send generation completion notification
   * 
   * @param {string} to - Expo push token
   * @param {Object} data - Generation data
   */
  async sendGenerationCompletedNotification(to, data) {
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

    return await this.sendNotification(to, payload);
  }

  /**
   * Send generation failed notification
   * 
   * @param {string} to - Expo push token
   * @param {Object} data - Generation failure data
   */
  async sendGenerationFailedNotification(to, data) {
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

    return await this.sendNotification(to, payload);
  }

  /**
   * Process notification receipts (optional - for tracking delivery)
   * 
   * @param {string[]} receiptIds - Array of receipt IDs to check
   */
  async getReceipts(receiptIds) {
    try {
      const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
      const receipts = {};

      for (const chunk of receiptIdChunks) {
        try {
          const chunkReceipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
          Object.assign(receipts, chunkReceipts);
        } catch (error) {
          console.error('[Expo Push] ❌ Error getting receipts:', error);
        }
      }

      return receipts;
    } catch (error) {
      console.error('[Expo Push] ❌ Error processing receipts:', error);
      return {};
    }
  }
}

module.exports = new ExpoPushService();