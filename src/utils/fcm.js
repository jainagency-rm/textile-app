import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { messaging } from '../firebase';
import { db } from '../firebase';

const VAPID_KEY = process.env.REACT_APP_FCM_VAPID_KEY;

export async function requestFCMPermission(userId) {
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      await updateDoc(doc(db, 'users', userId), { fcmToken: token });
      return token;
    }
  } catch (err) {
    console.error('FCM permission error:', err);
  }
  return null;
}

export function onForegroundMessage(callback) {
  return onMessage(messaging, callback);
}
