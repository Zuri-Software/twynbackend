import { getActiveDeviceTokens } from './userService';
const apnsService = require('./apns-service');

// APNs payload structure
interface ApnsPayload {
  aps: {
    alert: {
      title: string;
      body: string;
    };
    badge?: number;
    sound?: string;
    'content-available'?: number;
  };
  type?: string;
  generationId?: string;
}

export interface NotificationMessage {
  title: string;
  body: string;
  type?: string;
  data?: Record<string, any>;
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  
  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  private constructor() {
    console.log('[Push] ✅ PushNotificationService initialized with APNs integration');
  }

  async sendToUser(userId: string, message: NotificationMessage): Promise<void> {
    try {
      console.log(`[Push] Sending notification to user ${userId}: ${message.title}`);
      
      // Get user's active device tokens
      const deviceTokens = await getActiveDeviceTokens(userId);
      
      if (deviceTokens.length === 0) {
        console.log(`[Push] ⚠️ No active device tokens found for user ${userId}`);
        return;
      }

      console.log(`[Push] Found ${deviceTokens.length} device tokens for user ${userId}`);

      // Send to each device
      for (const device of deviceTokens) {
        if (device.platform === 'ios') {
          await this.sendToiOS(device.token, message);
        } else if (device.platform === 'android') {
          await this.sendToAndroid(device.token, message);
        }
      }
    } catch (error) {
      console.error(`[Push] ❌ Failed to send notification to user ${userId}:`, error);
    }
  }

  private async sendToiOS(deviceToken: string, message: NotificationMessage): Promise<void> {
    try {
      // Use our integrated APNs service
      const payload = {
        title: message.title,
        body: message.body,
        data: {
          ...message.data,
          type: message.type
        }
      };

      const result = await apnsService.sendNotification(deviceToken, payload);
      
      if (result.success) {
        console.log(`[Push] [iOS] ✅ Sent via APNs service to device ${deviceToken.substring(0, 10)}...`);
      } else {
        console.log(`[Push] [iOS] ❌ APNs service failed for device ${deviceToken.substring(0, 10)}...: ${result.error}`);
      }
    } catch (error) {
      console.error(`[Push] [iOS] ❌ Error sending via APNs service to device ${deviceToken.substring(0, 10)}...:`, error);
    }
  }

  private async sendToAndroid(deviceToken: string, message: NotificationMessage): Promise<void> {
    // TODO: Implement Firebase Cloud Messaging (FCM) for Android
    console.log(`[Push] [Android] Would send to device ${deviceToken.substring(0, 10)}...: ${message.title} - ${message.body}`);
    console.log(`[Push] [Android] TODO: Implement FCM for Android push notifications`);
  }

  async shutdown(): Promise<void> {
    apnsService.shutdown();
    console.log('[Push] APNs service shut down');
  }

  // Convenient methods for specific notification types
  async sendTrainingCompletedNotification(userId: string, modelData: { modelId: string, modelName: string }): Promise<void> {
    try {
      const deviceTokens = await getActiveDeviceTokens(userId);
      
      for (const device of deviceTokens) {
        if (device.platform === 'ios') {
          await apnsService.sendTrainingCompletedNotification(device.token, modelData);
        }
      }
    } catch (error) {
      console.error(`[Push] ❌ Failed to send training completed notification to user ${userId}:`, error);
    }
  }

  async sendGenerationCompletedNotification(userId: string, generationData: { generationId: string, imageCount: number, presetName: string }): Promise<void> {
    try {
      const deviceTokens = await getActiveDeviceTokens(userId);
      
      for (const device of deviceTokens) {
        if (device.platform === 'ios') {
          await apnsService.sendGenerationCompletedNotification(device.token, generationData);
        }
      }
    } catch (error) {
      console.error(`[Push] ❌ Failed to send generation completed notification to user ${userId}:`, error);
    }
  }

  async sendGenerationFailedNotification(userId: string, errorData: { generationId: string, errorMessage: string }): Promise<void> {
    try {
      const deviceTokens = await getActiveDeviceTokens(userId);
      
      for (const device of deviceTokens) {
        if (device.platform === 'ios') {
          await apnsService.sendGenerationFailedNotification(device.token, errorData);
        }
      }
    } catch (error) {
      console.error(`[Push] ❌ Failed to send generation failed notification to user ${userId}:`, error);
    }
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();