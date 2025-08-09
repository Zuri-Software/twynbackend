import { getActiveDeviceTokens } from './userService';

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
  private apnProvider: any;
  
  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  private constructor() {
    this.initializeAPNs();
  }

  private async initializeAPNs() {
    try {
      // Check if we have APNs credentials configured
      const apnKeyId = process.env.APN_KEY_ID;
      const apnTeamId = process.env.APN_TEAM_ID;
      const apnKeyPath = process.env.APN_KEY_PATH;
      const apnBundleId = process.env.APN_BUNDLE_ID;

      if (!apnKeyId || !apnTeamId || !apnKeyPath || !apnBundleId) {
        console.log('[Push] ⚠️ APNs credentials not configured. Push notifications will be logged only.');
        console.log('[Push] Required env vars: APN_KEY_ID, APN_TEAM_ID, APN_KEY_PATH, APN_BUNDLE_ID');
        return;
      }

      // Import node-apn only if credentials are available
      const apn = require('node-apn');
      
      const options = {
        token: {
          key: apnKeyPath,
          keyId: apnKeyId,
          teamId: apnTeamId,
        },
        production: process.env.NODE_ENV === 'production',
      };

      this.apnProvider = new apn.Provider(options);
      console.log(`[Push] ✅ APNs initialized for ${process.env.NODE_ENV === 'production' ? 'production' : 'development'}`);
    } catch (error) {
      console.error('[Push] ❌ Failed to initialize APNs:', error);
      console.log('[Push] Push notifications will be logged only');
    }
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
      if (!this.apnProvider) {
        console.log(`[Push] [iOS] Would send to device ${deviceToken.substring(0, 10)}...: ${message.title} - ${message.body}`);
        return;
      }

      const apn = require('node-apn');
      const notification = new apn.Notification();
      
      notification.alert = {
        title: message.title,
        body: message.body,
      };
      notification.badge = 1;
      notification.sound = 'default';
      notification.topic = process.env.APN_BUNDLE_ID;
      
      // Add custom data
      if (message.type) {
        notification.payload.type = message.type;
      }
      if (message.data) {
        Object.assign(notification.payload, message.data);
      }

      const result = await this.apnProvider.send(notification, deviceToken);
      
      if (result.sent.length > 0) {
        console.log(`[Push] [iOS] ✅ Sent to device ${deviceToken.substring(0, 10)}...`);
      } else {
        console.log(`[Push] [iOS] ❌ Failed to send to device ${deviceToken.substring(0, 10)}...`);
        if (result.failed.length > 0) {
          console.log(`[Push] [iOS] Error:`, result.failed[0].error);
        }
      }
    } catch (error) {
      console.error(`[Push] [iOS] ❌ Error sending to device ${deviceToken.substring(0, 10)}...:`, error);
    }
  }

  private async sendToAndroid(deviceToken: string, message: NotificationMessage): Promise<void> {
    // TODO: Implement Firebase Cloud Messaging (FCM) for Android
    console.log(`[Push] [Android] Would send to device ${deviceToken.substring(0, 10)}...: ${message.title} - ${message.body}`);
    console.log(`[Push] [Android] TODO: Implement FCM for Android push notifications`);
  }

  async shutdown(): Promise<void> {
    if (this.apnProvider) {
      this.apnProvider.shutdown();
      console.log('[Push] APNs provider shut down');
    }
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();