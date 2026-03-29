import { getAuth } from 'firebase/auth';

// api-dru uses /api/v1 prefix globally
const API_BASE_URL = 'https://api-dru.onrender.com/api/v1';

/**
 * Centralized client for triggering push notifications via the backend.
 *
 * Each method maps 1:1 to a backend trigger endpoint.
 * All calls are fire-and-forget safe — errors are logged, never thrown.
 */
export const MobileNotificationService = {

  /** Get an auth token, or null if not signed in. */
  async _getToken(): Promise<string | null> {
    const user = getAuth().currentUser;
    if (!user) {
      console.warn('MobileNotificationService: user not authenticated');
      return null;
    }
    return user.getIdToken();
  },

  /** POST helper — fire-and-forget, logs errors. */
  async _post(path: string, body: Record<string, unknown>): Promise<void> {
    const token = await this._getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.error(`MobileNotificationService ${path} failed:`, await res.text());
      }
    } catch (error) {
      console.error(`MobileNotificationService ${path} error:`, error);
    }
  },

  /**
   * Notify parents that a class has been finished.
   */
  async notifyClassFinished(classId: string, teacherName: string) {
    await this._post('/notifications/class-finished', { classId, teacherName });
  },

  /**
   * Notify parents about their child's attendance status.
   *
   * @param classId - Firestore class document ID
   * @param className - Human-readable class name (optional, resolved server-side)
   * @param students - Array of { studentId, studentName, status } records
   */
  async notifyAttendanceMarked(
    classId: string,
    students: Array<{ studentId: string; studentName: string; status: 'present' | 'absent' | 'late' }>,
    className?: string,
  ) {
    await this._post('/notifications/attendance-marked', { classId, className, students });
  },
};
