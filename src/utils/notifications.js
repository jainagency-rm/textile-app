// src/utils/notifications.js
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Base function — ek notification document create karta hai
 * @param {string} userId - recipient ka Firestore user ID
 * @param {string} message - notification text
 * @param {string} type - 'new_order' | 'new_product' | 'new_user'
 */
const createNotification = async (userId, message, type) => {
  await addDoc(collection(db, 'notifications'), {
    userId,
    message,
    type,
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
 */
export const notifyNewOrder = async (adminId, supplierId, buyerFirm) => {
  const message = `New order received from ${buyerFirm}`;
  await Promise.all([
    createNotification(adminId, message, 'new_order'),
    createNotification(supplierId, message, 'new_order'),
  ]);
};

/**
 * NEW PRODUCT added by supplier —
 * Admin ko + saare approved Buyers ko notify karo
 * @param {string} adminId - admin ka userId
 * @param {string} productName - product name (for message)
 * @param {string} supplierFirm - supplier firm name (for message)
 */
export const notifyNewProduct = async (adminId, productName, supplierFirm) => {
  const message = `New product "${productName}" added by ${supplierFirm}`;

  // Saare approved buyers fetch karo
  const buyersSnap = await getDocs(
    query(collection(db, 'users'), where('role', '==', 'buyer'), where('status', '==', 'approved'))
  );

  const buyerIds = buyersSnap.docs.map(d => d.id);

  // Admin + saare buyers ko ek saath notify karo
  await Promise.all([
    createNotification(adminId, message, 'new_product'),
    ...buyerIds.map(id => createNotification(id, message, 'new_product')),
  ]);
};

/**
 * NEW USER registered (buyer ya supplier) —
 * Sirf Admin ko notify karo
 * @param {string} adminId - admin ka userId
 * @param {string} firmName - naye user ki firm name
 * @param {string} role - 'buyer' | 'supplier'
 */
export const notifyNewUser = async (adminId, firmName, role) => {
  const message = `New ${role} registered: ${firmName} — pending approval`;
  await createNotification(adminId, message, 'new_user');
};