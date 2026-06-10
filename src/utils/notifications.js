// src/utils/notifications.js
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Base function — ek notification document create karta hai
 * @param {string} userId - recipient ka Firestore user ID
 * @param {string} message - notification text
 * @param {string} type - 'new_order' | 'new_product' | 'new_user' | 'order_status'
 * @param {string} [refId] - related document ka ID (orderId / productId / new user ka uid)
 */
const createNotification = async (userId, message, type, refId) => {
  await addDoc(collection(db, 'notifications'), {
    userId,
    message,
    type,
    refId: refId || null,
    read: false,
    createdAt: serverTimestamp(),
  });
};

/**
 * NEW ORDER placed —
 * Admin ko + concerned Supplier ko notify karo
 * @param {string} adminId - admin ka userId
 * @param {string} supplierId - supplier ka userId
 * @param {string} buyerFirm - buyer firm name (for message)
 * @param {string} orderId - newly created order ka Firestore doc ID
 */
export const notifyNewOrder = async (adminId, supplierId, buyerFirm, orderId) => {
  const message = `New order received from ${buyerFirm}`;
  await Promise.all([
    createNotification(adminId, message, 'new_order', orderId),
    createNotification(supplierId, message, 'new_order', orderId),
  ]);
};

/**
 * NEW PRODUCT added by supplier —
 * Admin ko + saare approved Buyers ko notify karo
 * @param {string} adminId - admin ka userId
 * @param {string} productName - product name (for message)
 * @param {string} supplierFirm - supplier firm name (for message)
 * @param {string} productId - newly created product ka Firestore doc ID
 */
export const notifyNewProduct = async (adminId, productName, supplierFirm, productId) => {
  const message = `New product "${productName}" added by ${supplierFirm}`;

  // Saare approved buyers fetch karo
  const buyersSnap = await getDocs(
    query(collection(db, 'users'), where('role', '==', 'buyer'), where('status', '==', 'approved'))
  );

  const buyerIds = buyersSnap.docs.map(d => d.id);

  // Admin + saare buyers ko ek saath notify karo
  await Promise.all([
    createNotification(adminId, message, 'new_product', productId),
    ...buyerIds.map(id => createNotification(id, message, 'new_product', productId)),
  ]);
};

/**
 * NEW USER registered (buyer ya supplier) —
 * Sirf Admin ko notify karo
 * @param {string} adminId - admin ka userId
 * @param {string} firmName - naye user ki firm name
 * @param {string} role - 'buyer' | 'supplier'
 * @param {string} uid - naye user ka Firebase Auth UID
 */
export const notifyNewUser = async (adminId, firmName, role, uid) => {
  const message = `New ${role} registered: ${firmName} — pending approval`;
  await createNotification(adminId, message, 'new_user', uid);
};

/**
 * ORDER STATUS changed —
 * Buyer ko notify karo
 * @param {string} buyerId - buyer ka userId
 * @param {string|number} orderNumber - order number (for message)
 * @param {string} newStatus - naya order status
 * @param {string} orderId - order ka Firestore doc ID
 */
export const notifyOrderStatusChange = async (buyerId, orderNumber, newStatus, orderId) => {
  const message = `Order #${orderNumber} status updated to ${newStatus}`;
  await createNotification(buyerId, message, 'order_status', orderId);
};
