import { getAuth } from 'firebase/auth';

// Configuration for Mobile API
// Default to production API if not specified
// Note: api-dru-mobile uses /api/v1 prefix globally
const API_BASE_URL = 'https://api-dru.vercel.app/api/v1';

export const MobileNotificationService = {
  /**
   * Notify parents that a class has been finished
   */
  async notifyClassFinished(classId: string, teacherName: string) {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        console.warn('⚠️ Cannot send notification: User not authenticated');
        return;
      }

      const token = await user.getIdToken();
      console.log('🔔 Sending class finished notification...');

      const response = await fetch(`${API_BASE_URL}/notifications/class-finished`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          classId,
          teacherName
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to send class finished notification:', errorText);
      } else {
        console.log('✅ Notification sent to parents successfully');
      }
    } catch (error) {
      console.error('❌ Error sending mobile notification:', error);
    }
  }
};
