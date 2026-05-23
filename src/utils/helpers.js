import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

export function getStatusStyle(status) {
  if (status === 'Delivered') return { bg: '#e6f4ea', color: '#1a6b3c' };
  if (status === 'Shipped' || status === 'Processing') return { bg: '#e8f0fe', color: '#1a3a8f' };
  if (status === 'Partially Dispatched') return { bg: '#fff3e0', color: '#7a5200' };
  if (status === 'Cancelled') return { bg: '#fce8e6', color: '#ba1a1a' };
  return { bg: '#f1f3f4', color: '#44474d' };
}

export async function notifySupplier(supplierId, buyerFirm) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: supplierId, 
      type: 'new_order',
      message: `New order from ${buyerFirm}`, 
      read: false, 
      createdAt: new Date(),
    });
  } catch (e) { 
    console.error('Notify error', e); 
  }
}