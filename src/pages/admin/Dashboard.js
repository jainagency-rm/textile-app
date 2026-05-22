import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  collection, getDocs, doc, getDoc, updateDoc, addDoc,
  deleteDoc, query, where, orderBy, onSnapshot, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';

const SIZES = ['M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const NIGHTY_CATEGORIES = ['Nighty', 'Nighty with Dupatta'];
const STITCHED_CATEGORIES = ['Kurti', 'Co-ord Set'];
const CHUDIDAR_CATEGORY = '3pc Chudidar';
const UNITS = ['Piece','Set','Dozen','Meter','KG','Yard','Roll','Bale','Bundle','Box','Carton'];

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [selectedUser, setSelectedUser] = useState(null);

  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('All');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [deliveryModal, setDeliveryModal] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [shippingForm, setShippingForm] = useState({
    billNo: '', billDate: '', transport: '', lrNo: '', lrDate: '', dispatchItems: []
  });

  // Shipment edit state
  const [editingShipment, setEditingShipment] = useState(null); // { orderid, shipmentIdx, data }
  const [editingCategory, setEditingCategory] = useState(null); // { id, name, template }
  const [editShipmentForm, setEditShipmentForm] = useState(null);

  const [shareModal, setShareModal] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const notifRef = useRef(null);
  const adminId = auth.currentUser?.uid;
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' || e.type === 'closeModal') {
        setSelectedUser(null); setEditingProduct(null); setDeliveryModal(null);
        setShareModal(null); setShowNotifications(false); setEditingShipment(null);
      }
    };
    window.addEventListener('closeModal', handler);
    document.addEventListener('keydown', handler);
    return () => { window.removeEventListener('closeModal', handler); document.removeEventListener('keydown', handler); };
  }, []);

  useEffect(() => {
    if (!adminId) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', adminId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [adminId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [usersSnap, productsSnap, ordersSnap, catsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'categories'))
      ]);
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCategories(catsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error('Data fetch error:', err); }
    setLoading(false);
  };

  const handleLogoutClick = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      signOut(auth).then(() => navigate('/'));
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
    await batch.commit();
  };

  // ── User Actions ─────────────────────────────────────────
  const updateUserStatus = async (userId, newStatus) => {
    await updateDoc(doc(db, 'users', userId), { status: newStatus });
    setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    if (selectedUser?.id === userId) setSelectedUser(prev => ({ ...prev, status: newStatus }));
  };

  const handleSaveUserEdit = async () => {
    if (!selectedUser) return;
    await updateDoc(doc(db, 'users', selectedUser.id), {
      firmName: selectedUser.firmName || '',
      city: selectedUser.city || '',
      state: selectedUser.state || '',
      mobile: selectedUser.mobile || '',
      contactPerson: selectedUser.contactPerson || '',
      gstNumber: selectedUser.gstNumber || ''
    });
    setUsers(users.map(u => u.id === selectedUser.id ? selectedUser : u));
    setSelectedUser(null);
  };

  const handleDeleteUser = async (user) => {
    const role = user.role || 'user';
    const msg = role === 'supplier'
      ? `Delete supplier "${user.firmName}"? This will permanently delete their account, all products, and all orders.`
      : `Delete buyer "${user.firmName}"? This will permanently delete their account and all their orders.`;

    if (!window.confirm(msg)) return;

    setLoading(true);
    try {
      const batch = writeBatch(db);

      if (role === 'supplier') {
        // Delete supplier's products
        const prodSnap = await getDocs(query(collection(db, 'products'), where('supplierId', '==', user.id)));
        prodSnap.docs.forEach(d => batch.delete(doc(db, 'products', d.id)));

        // Delete supplier's orders
        const orderSnap = await getDocs(query(collection(db, 'orders'), where('supplierId', '==', user.id)));
        orderSnap.docs.forEach(d => batch.delete(doc(db, 'orders', d.id)));
      }

      if (role === 'buyer') {
        // Delete buyer's orders
        const orderSnap = await getDocs(query(collection(db, 'orders'), where('buyerId', '==', user.id)));
        orderSnap.docs.forEach(d => batch.delete(doc(db, 'orders', d.id)));
      }

      // Delete user document
      batch.delete(doc(db, 'users', user.id));
      await batch.commit();

      setUsers(users.filter(u => u.id !== user.id));
      await fetchAllData(); // refresh orders + products too
    } catch (err) {
      console.error('Delete user error:', err);
      alert('Error deleting user. Try again.');
    }
    setLoading(false);
  };

  // ── Product Actions ───────────────────────────────────────
  const updateProductStatus = async (productId, newStatus) => {
    await updateDoc(doc(db, 'products', productId), { status: newStatus });
    setProducts(products.map(p => p.id === productId ? { ...p, status: newStatus } : p));
  };

  const handleProductImageUpload = async (files) => {
    if (!editingProduct || !files.length) return;
    setUploadingImage(true);
    try {
      const newUrls = [];
      for (const file of Array.from(files).slice(0, 10)) {
        const imageRef = ref(storage, `products/admin/${editingProduct.id}/${Date.now()}_${file.name}`);
        await uploadBytes(imageRef, file);
        const url = await getDownloadURL(imageRef);
        newUrls.push(url);
      }
      const existingUrls = editingProduct.imageUrls
        ? editingProduct.imageUrls.map(u => typeof u === 'string' ? u : u.url).filter(Boolean)
        : editingProduct.imageUrl ? [editingProduct.imageUrl] : [];
      const updatedUrls = [...existingUrls, ...newUrls];
      await updateDoc(doc(db, 'products', editingProduct.id), { imageUrl: updatedUrls[0] || '', imageUrls: updatedUrls });
      setEditingProduct(prev => ({ ...prev, imageUrl: updatedUrls[0], imageUrls: updatedUrls }));
      setProducts(products.map(p => p.id === editingProduct.id ? { ...p, imageUrl: updatedUrls[0], imageUrls: updatedUrls } : p));
    } catch (err) { console.error('Image upload error:', err); }
    setUploadingImage(false);
  };

  const handleDeleteProductImage = async (urlToDelete) => {
    if (!editingProduct) return;
    const existingUrls = editingProduct.imageUrls
      ? editingProduct.imageUrls.map(u => typeof u === 'string' ? u : u.url).filter(Boolean)
      : editingProduct.imageUrl ? [editingProduct.imageUrl] : [];
    const updatedUrls = existingUrls.filter(u => u !== urlToDelete);
    try { await deleteObject(ref(storage, urlToDelete)); } catch (e) { }
    await updateDoc(doc(db, 'products', editingProduct.id), { imageUrl: updatedUrls[0] || '', imageUrls: updatedUrls });
    setEditingProduct(prev => ({ ...prev, imageUrl: updatedUrls[0] || '', imageUrls: updatedUrls }));
    setProducts(products.map(p => p.id === editingProduct.id ? { ...p, imageUrl: updatedUrls[0] || '', imageUrls: updatedUrls } : p));
  };

  const saveProductEdit = async () => {
    if (!editingProduct) return;
    const updateData = {
      name: editingProduct.name,
      price: Number(editingProduct.price),
      moq: Number(editingProduct.moq),
      unit: editingProduct.unit,
      description: editingProduct.description || '',
      category: editingProduct.category
    };
    if (editingProduct.material !== undefined) updateData.material = editingProduct.material;
    if (editingProduct.cut !== undefined) updateData.cut = editingProduct.cut;
    if (editingProduct.sizes !== undefined) updateData.sizes = editingProduct.sizes;
    if (editingProduct.chudidarTopMaterial !== undefined) updateData.chudidarTopMaterial = editingProduct.chudidarTopMaterial;
    if (editingProduct.chudidarBottomMaterial !== undefined) updateData.chudidarBottomMaterial = editingProduct.chudidarBottomMaterial;
    if (editingProduct.chudidarDupattaMaterial !== undefined) updateData.chudidarDupattaMaterial = editingProduct.chudidarDupattaMaterial;
    await updateDoc(doc(db, 'products', editingProduct.id), updateData);
    setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...editingProduct } : p));
    setEditingProduct(null);
  };

  // ── Order Actions ─────────────────────────────────────────
  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Permanently delete this order? This cannot be undone.')) return;
    await deleteDoc(doc(db, 'orders', orderId));
    setOrders(orders.filter(o => o.id !== orderId));
  };

  // ── Bill No duplicate check ───────────────────────────────
  const isBillNoDuplicate = (billNo, supplierId, excludeOrderId = null, excludeShipmentIdx = null) => {
  if (!billNo || !billNo.trim()) return false;
  const trimmed = billNo.trim();
  for (const o of orders) {
    if (o.supplierId !== supplierId) continue;
    const shipments = o.shipments || [];
    for (let sIdx = 0; sIdx < shipments.length; sIdx++) {
      // Skip current shipment being edited
      if (o.id === excludeOrderId && sIdx === excludeShipmentIdx) continue;
      if (shipments[sIdx].billNo && shipments[sIdx].billNo.trim() === trimmed) return true;
    }
  }
  return false;
};

  // ── Open Delivery Modal ───────────────────────────────────
  const openDeliveryModal = (order) => {
    setDeliveryModal(order);
    setDeliveryStatus(order.status || 'Pending');
    const pastShipments = order.shipments || [];
    const dispatchItems = (order.items || []).map((item, itemIdx) => {
  const ordered = Number(item.orderedQty || item.quantity || item.sets || 0);
  let previouslyDispatched = 0;
  pastShipments.forEach(ship => {
    const matchedItem = ship.items?.[itemIdx];
    if (matchedItem) previouslyDispatched += Number(matchedItem.qty || 0);
  });
      return {
        ...item,
        orderedQty: ordered,
        previouslyDispatched,
        dispatchingNow: 0,
        unit: item.unit || (item.sets ? 'Set' : 'Piece')
      };
    });
    setShippingForm({ billNo: '', billDate: '', transport: '', lrNo: '', lrDate: '', dispatchItems });
  };

  // ── Save Delivery ─────────────────────────────────────────
  const saveDelivery = async () => {
    if (!deliveryModal) return;

    let finalStatus = deliveryStatus;

    if (deliveryStatus === 'Shipped') {
      // Bill No duplicate check
      const isDuplicate = isBillNoDuplicate(shippingForm.billNo, deliveryModal.supplierId, deliveryModal.id, null);
      if (isDuplicate) {
        alert(`Bill No "${shippingForm.billNo}" already exists for this supplier. Use a different bill number.`);
        return;
      }

      const isAnythingDispatched = shippingForm.dispatchItems.some(i => Number(i.dispatchingNow) > 0);
      let newShipments = [...(deliveryModal.shipments || [])];

      if (isAnythingDispatched) {
        newShipments.push({
          billNo: shippingForm.billNo,
          billDate: shippingForm.billDate,
          transport: shippingForm.transport,
          lrNo: shippingForm.lrNo,
          lrDate: shippingForm.lrDate,
          dispatchedAt: new Date().toISOString(),
          items: shippingForm.dispatchItems
  .filter(i => Number(i.dispatchingNow) > 0)
  .map((i, filterIdx) => ({
    itemIdx: shippingForm.dispatchItems.indexOf(i),
    productName: i.productName,
    size: i.size || '',
    qty: Number(i.dispatchingNow),
    unit: i.unit || 'Piece'
  }))
        });
      }

      // Recalculate dispatched qtys from all shipments
      const updatedItems = (deliveryModal.items || []).map((item, itemIdx) => {
  let totalDispatched = 0;
  newShipments.forEach(ship => {
    const match = ship.items?.find(si => si.itemIdx === itemIdx);
    if (match) totalDispatched += Number(match.qty || 0);
  });
  return { ...item, dispatchedQty: totalDispatched };
});

      const orderedQtys = updatedItems.map(i => Number(i.orderedQty || i.quantity || i.sets || 0));
      const dispatchedQtys = updatedItems.map(i => i.dispatchedQty);
      const allDelivered = dispatchedQtys.every((d, idx) => d >= orderedQtys[idx]);
      const anyDispatched = dispatchedQtys.some(d => d > 0);

      if (anyDispatched) {
        finalStatus = allDelivered ? 'Delivered' : 'Partially Dispatched';
      }

      const updateData = {
        status: finalStatus,
        shipments: newShipments,
        items: updatedItems.map(({ previouslyDispatched, dispatchingNow, ...rest }) => rest)
      };

      await updateDoc(doc(db, 'orders', deliveryModal.id), updateData);
      setOrders(orders.map(o => o.id === deliveryModal.id ? { ...o, ...updateData } : o));
    } else {
      // Non-shipped status update
      await updateDoc(doc(db, 'orders', deliveryModal.id), { status: finalStatus });
      setOrders(orders.map(o => o.id === deliveryModal.id ? { ...o, status: finalStatus } : o));
    }

    setDeliveryModal(null);
  };

  // ── Edit Shipment ─────────────────────────────────────────
  const openEditShipment = (order, shipmentIdx) => {
    const ship = order.shipments[shipmentIdx];
    setEditingShipment({ orderId: order.id, shipmentIdx, supplierId: order.supplierId });
    setEditShipmentForm({
      billNo: ship.billNo || '',
      billDate: ship.billDate || '',
      transport: ship.transport || '',
      lrNo: ship.lrNo || '',
      lrDate: ship.lrDate || '',
      items: ship.items ? ship.items.map(i => ({ ...i })) : []
    });
  };
  const deleteShipment = async (order, shipmentIdx) => {
  if (!window.confirm(`Delete Dispatch ${shipmentIdx + 1}? This cannot be undone.`)) return;

  const orderSnap = await getDoc(doc(db, 'orders', order.id));
  if (!orderSnap.exists()) return;
  const freshOrder = { id: orderSnap.id, ...orderSnap.data() };

  const newShipments = freshOrder.shipments.filter((_, idx) => idx !== shipmentIdx);

  // Recalculate dispatchedQty from remaining shipments
  const updatedItems = (freshOrder.items || []).map((item, itemIdx) => {
    let totalDispatched = 0;
    newShipments.forEach(ship => {
      (ship.items || []).forEach((si, siIdx) => {
if (siIdx === itemIdx) {
  totalDispatched += Number(si.qty || 0);
}
});
    });
    const { previouslyDispatched, dispatchingNow, ...rest } = item;
    return { ...rest, dispatchedQty: totalDispatched };
  });

  // Auto status
  const anyDispatched = updatedItems.some(i => (i.dispatchedQty || 0) > 0);
  const allDelivered = updatedItems.every(i =>
    (i.dispatchedQty || 0) >= Number(i.orderedQty || i.quantity || i.sets || 0)
  );
  const newStatus = !anyDispatched
    ? 'Pending'
    : allDelivered ? 'Delivered' : 'Partially Dispatched';

  const updateData = { shipments: newShipments, items: updatedItems, status: newStatus };
  await updateDoc(doc(db, 'orders', order.id), updateData);
  setOrders(orders.map(o => o.id === order.id ? { ...o, ...updateData } : o));
  setExpandedOrder(null);
  setTimeout(() => setExpandedOrder(order.id), 50);
};
  const saveEditShipment = async () => {
  if (!editingShipment || !editShipmentForm) return;
  const { orderId, shipmentIdx, supplierId } = editingShipment;
  const orderSnap = await getDoc(doc(db, 'orders', orderId));
if (!orderSnap.exists()) return;
const order = { id: orderSnap.id, ...orderSnap.data() };


  // Bill No duplicate check — exclude current shipment
  const isDuplicate = isBillNoDuplicate(editShipmentForm.billNo, supplierId, orderId, shipmentIdx);
  if (isDuplicate) {
    alert(`Bill No "${editShipmentForm.billNo}" already exists for this supplier.`);
    return;
  }

  // Replace edited shipment in array
  const newShipments = order.shipments.map((s, idx) =>
  idx === shipmentIdx
    ? {
        ...s,
        billNo: editShipmentForm.billNo,
        billDate: editShipmentForm.billDate,
        transport: editShipmentForm.transport,
        lrNo: editShipmentForm.lrNo,
        lrDate: editShipmentForm.lrDate,
        items: editShipmentForm.items.map((item, iIdx) => ({
          ...item,
          itemIdx: iIdx,
        }))
      }
    : s
);

  // Recalculate dispatchedQty for each item from ALL shipments
  const updatedItems = (order.items || []).map((item, itemIdx) => {
    let totalDispatched = 0;
    newShipments.forEach(ship => {
      (ship.items || []).forEach((si, siIdx) => {
  if (siIdx === itemIdx) {
    totalDispatched += Number(si.qty || 0);
  }
});
    });
    const { previouslyDispatched, dispatchingNow, ...rest } = item;
    return { ...rest, dispatchedQty: totalDispatched };
  });

  // Auto status
  const anyDispatched = updatedItems.some(i => (i.dispatchedQty || 0) > 0);
  const allDelivered = updatedItems.every(i =>
    (i.dispatchedQty || 0) >= Number(i.orderedQty || i.quantity || i.sets || 0)
  );
  const newStatus = !anyDispatched
    ? order.status
    : allDelivered ? 'Delivered' : 'Partially Dispatched';

  const updateData = { shipments: newShipments, items: updatedItems, status: newStatus };
  await updateDoc(doc(db, 'orders', orderId), updateData);
  setOrders(orders.map(o => o.id === orderId ? { ...o, ...updateData } : o));
  setEditingShipment(null);
  setEditShipmentForm(null);
  setExpandedOrder(null);
  setTimeout(() => setExpandedOrder(orderId), 50);
};

  // ── PDF Export ────────────────────────────────────────────
  const generateOrderPDF = async (order) => {
    // Dynamically import jspdf
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const navy = [3, 22, 50];
    const gold = [119, 90, 25];
    const gray = [100, 116, 139];
    const lightGray = [241, 245, 249];
    const W = 210, margin = 16;

    // Header bg
    pdf.setFillColor(...navy);
    pdf.rect(0, 0, W, 40, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('JAIN AGENCY', margin, 16);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(200, 200, 200);
    pdf.text('Official Order Receipt', margin, 23);

    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`Order #${order.id.slice(0, 8).toUpperCase()}`, W - margin, 16, { align: 'right' });
    pdf.setFontSize(9);
    pdf.setTextColor(200, 200, 200);
    pdf.text(order.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || new Date().toLocaleDateString('en-IN'), W - margin, 23, { align: 'right' });

    let y = 50;

    // Order info box
    pdf.setFillColor(...lightGray);
    pdf.roundedRect(margin, y, W - margin * 2, 26, 3, 3, 'F');
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...navy);
    pdf.text('Buyer:', margin + 4, y + 8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(order.buyerFirm || '—', margin + 20, y + 8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Supplier:', margin + 4, y + 18);
    pdf.setFont('helvetica', 'normal');
    pdf.text(order.supplierFirm || '—', margin + 24, y + 18);

    // Status badge
    const statusColors = {
      'Delivered': [16, 185, 129],
      'Partially Dispatched': [245, 158, 11],
      'Shipped': [59, 130, 246],
      'Processing': [139, 92, 246],
      'Cancelled': [239, 68, 68],
      'Pending': [107, 114, 128],
    };
    const sc = statusColors[order.status] || [107, 114, 128];
    pdf.setFillColor(...sc);
    pdf.roundedRect(W - margin - 42, y + 6, 42, 12, 2, 2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(order.status || 'Pending', W - margin - 21, y + 14, { align: 'center' });

    y += 34;

    // Items section
    pdf.setTextColor(...navy);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ORDER ITEMS', margin, y);
    y += 6;

    // Table header
    pdf.setFillColor(...navy);
    pdf.rect(margin, y, W - margin * 2, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Product', margin + 3, y + 5.5);
    pdf.text('Size', margin + 90, y + 5.5);
    pdf.text('Ordered', margin + 115, y + 5.5);
    pdf.text('Dispatched', margin + 140, y + 5.5);
    pdf.text('Unit', margin + 165, y + 5.5);
    y += 8;

    // Table rows
    (order.items || []).forEach((item, idx) => {
      if (idx % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, y, W - margin * 2, 7, 'F');
      }
      pdf.setTextColor(...navy);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const name = item.productName || '';
      pdf.text(name.length > 35 ? name.slice(0, 35) + '…' : name, margin + 3, y + 5);
      pdf.text(item.size || '—', margin + 90, y + 5);
      pdf.text(String(item.orderedQty || item.quantity || item.sets || 0), margin + 115, y + 5);
      pdf.setTextColor(22, 163, 74);
      pdf.text(String(item.dispatchedQty || 0), margin + 140, y + 5);
      pdf.setTextColor(...gray);
      pdf.text(item.unit || 'Piece', margin + 165, y + 5);
      y += 7;
    });

    if (order.nightyDetails) {
      y += 3;
      pdf.setTextColor(...gray);
      pdf.setFontSize(8);
      pdf.text(`Packing: ${order.nightyDetails.totalSets} sets · ${order.nightyDetails.packingType} sets/bale · ${order.nightyDetails.totalBales} bale(s)`, margin, y);
      y += 6;
    }

    // Dispatch history
    const shipments = order.shipments || [];
    if (shipments.length > 0) {
      y += 6;
      pdf.setTextColor(...navy);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DISPATCH HISTORY', margin, y);
      y += 6;

      shipments.forEach((ship, idx) => {
        if (y > 250) { pdf.addPage(); y = 20; }

        pdf.setFillColor(...lightGray);
        pdf.roundedRect(margin, y, W - margin * 2, 10, 2, 2, 'F');
        pdf.setFillColor(...navy);
        pdf.roundedRect(margin, y, 3, 10, 1, 1, 'F');
        pdf.setTextColor(...navy);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Dispatch ${idx + 1}${ship.billDate ? ` (${ship.billDate})` : ''}`, margin + 6, y + 7);
        y += 10;

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...gray);
        const details = [
          ship.billNo ? `Bill No: ${ship.billNo}` : null,
          ship.transport ? `Transport: ${ship.transport}` : null,
          ship.lrNo ? `LR No: ${ship.lrNo}` : null,
          ship.lrDate ? `LR Date: ${ship.lrDate}` : null,
        ].filter(Boolean).join('   ');
        pdf.text(details, margin + 4, y + 5);
        y += 8;

        if (ship.items?.length > 0) {
          ship.items.forEach(i => {
            pdf.setTextColor(...navy);
            pdf.setFontSize(8);
            pdf.text(`• ${i.productName}${i.size ? ` (${i.size})` : ''}: ${i.qty} ${i.unit || ''}`, margin + 6, y + 4);
            y += 6;
          });
        }
        y += 4;
      });
    }

    // Footer
    y = 285;
    pdf.setFillColor(...navy);
    pdf.rect(0, y, W, 12, 'F');
    pdf.setTextColor(200, 200, 200);
    pdf.setFontSize(8);
    pdf.text('Jain Agency — Generated by Admin', margin, y + 8);
    pdf.text(`Page 1`, W - margin, y + 8, { align: 'right' });

    pdf.save(`JainAgency_Order_${order.id.slice(0, 8)}.pdf`);
  };

  // ── Users CSV export ──────────────────────────────────────
  const exportUsersCSV = () => {
    const headers = ['Role', 'Firm Name', 'City', 'State', 'Contact Number', 'Person', 'GST No', 'Status'];
    const csvData = sortedAndFilteredUsers.map(u =>
      [u.role || '', u.firmName || '', u.city || '', u.state || '', u.mobile || '', u.contactPerson || '', u.gstNumber || '', u.status || 'pending']
        .map(v => `"${v}"`).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvData].join('\n');
    const a = document.createElement('a');
    a.setAttribute('href', encodeURI(csvContent));
    a.setAttribute('download', 'Users_Export.csv');
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ── Categories ────────────────────────────────────────────
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const docRef = await addDoc(collection(db, 'categories'), { name: newCategoryName.trim() });
    setCategories([...categories, { id: docRef.id, name: newCategoryName.trim() }]);
    setNewCategoryName('');
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Delete this category?')) return;
    await deleteDoc(doc(db, 'categories', catId));
    setCategories(categories.filter(c => c.id !== catId));
  };

  // ── Helpers ───────────────────────────────────────────────
  const toggleEditSize = (size) => {
    const current = editingProduct.sizes || [];
    setEditingProduct({ ...editingProduct, sizes: current.includes(size) ? current.filter(s => s !== size) : [...current, size] });
  };

  const getProductImages = (product) => {
    if (!product) return [];
    if (product.imageUrls && Array.isArray(product.imageUrls))
      return product.imageUrls.map(u => typeof u === 'string' ? u : u.url).filter(Boolean);
    if (product.imageUrl) return [product.imageUrl];
    return [];
  };

  const stats = {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'Pending').length,
    processingOrders: orders.filter(o => o.status === 'Processing').length,
    deliveredOrders: orders.filter(o => o.status === 'Delivered').length,
    activeBuyers: users.filter(u => u.role === 'buyer' && u.status === 'approved').length,
    activeSuppliers: users.filter(u => u.role === 'supplier' && u.status === 'approved').length,
    pendingUsers: users.filter(u => u.role !== 'admin' && u.status === 'pending').length,
    pendingProducts: products.filter(p => p.status === 'pending').length,
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const notifIcon = (type) => type === 'new_order' ? '🛒' : type === 'new_product' ? '📦' : type === 'new_user' ? '👤' : '🔔';
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return (timestamp.toDate?.() || new Date(timestamp)).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const sortedAndFilteredUsers = users
    .filter(u => u.role !== 'admin')
    .filter(u => userFilter === 'All' ? true : u.role === userFilter.toLowerCase())
    .filter(u =>
      u.firmName?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.mobile?.includes(userSearch) ||
      u.role?.toLowerCase().includes(userSearch.toLowerCase())
    )
    .sort((a, b) => (a.firmName || '').localeCompare(b.firmName || ''));

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.supplierFirm?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredOrders = orders.filter(o => {
    const matchSearch =
      o.id?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.buyerFirm?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.supplierFirm?.toLowerCase().includes(orderSearch.toLowerCase());
    const matchFilter = orderFilter === 'All' ? true : o.status === orderFilter;
    return matchSearch && matchFilter;
  });

  const deliveryBadge = (order) => {
    if (order.status === 'Delivered') return { bg: '#d1fae5', color: '#065f46' };
    if (order.status === 'Cancelled') return { bg: '#fee2e2', color: '#991b1b' };
    if (order.status === 'Shipped') return { bg: '#dbeafe', color: '#1e40af' };
    if (order.status === 'Partially Dispatched') return { bg: '#ffedd5', color: '#9a3412' };
    if (order.status === 'Processing') return { bg: '#ede9fe', color: '#5b21b6' };
    return { bg: '#fef9c3', color: '#854d0e' };
  };

  const navTabs = [
    { id: 'analytics', label: 'Dashboard', icon: '📊' },
    { id: 'users', label: 'Users', count: stats.pendingUsers, icon: '👥' },
    { id: 'products', label: 'Products', count: stats.pendingProducts, icon: '📦' },
    { id: 'orders', label: 'Orders', icon: '🛒' },
    { id: 'categories', label: 'Settings', icon: '⚙️' },
  ];

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading System Data...</div>;

  return (
    <div style={styles.container}>

      {/* Sidebar */}
      {!isMobile && (
        <div style={styles.sidebar}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
            <h2 style={{ color: 'white', margin: '0 0 20px 0', fontSize: 18 }}>Admin Hub</h2>
            {navTabs.map(tab => (
              <button key={tab.id} style={activeTab === tab.id ? styles.activeTab : styles.tab} onClick={() => setActiveTab(tab.id)}>
                <span style={{ marginRight: 8 }}>{tab.icon}</span>
                {tab.label}
                {tab.count > 0 && <span style={styles.sidebarBadge}>{tab.count}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={styles.main}>
        {/* Top Bar */}
        <div style={styles.topBar}>
          <div>
            <span style={{ fontSize: 11, color: '#775a19', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Jain Agency</span>
            <h1 style={{ color: '#031632', margin: 0, fontSize: 20 }}>Admin Control</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={styles.bellWrapper} ref={notifRef}>
              <button style={styles.bellBtn} onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#031632" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {unreadCount > 0 && <span style={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
              {showNotifications && (
                <div style={styles.notifDropdown}>
                  <div style={styles.notifHeader}><span style={{ fontWeight: 'bold', fontSize: 14 }}>Notifications</span></div>
                  {notifications.length === 0 ? <div style={styles.notifEmpty}>No notifications</div> : (
                    <div style={styles.notifList}>
                      {notifications.slice(0, 20).map(n => (
                        <div key={n.id} style={{ ...styles.notifItem, backgroundColor: n.read ? 'white' : '#eff6ff' }}>
                          <span style={{ fontSize: 18, marginRight: 10 }}>{notifIcon(n.type)}</span>
                          <div style={{ flex: 1 }}><p style={styles.notifMsg}>{n.message}</p><p style={styles.notifTime}>{formatTime(n.createdAt)}</p></div>
                          {!n.read && <span style={styles.unreadDot} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button style={styles.iconBtn} onClick={handleLogoutClick} title="Logout">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMobile && (
          <div style={{ display: 'flex', overflowX: 'auto', gap: 6, padding: '8px 12px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' }}>
            {navTabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, backgroundColor: activeTab === tab.id ? '#031632' : '#e2e8f0', color: activeTab === tab.id ? 'white' : '#475569' }}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === 'analytics' && (
          <div style={styles.gridStats}>
            {[
              { label: 'Total Orders', value: stats.totalOrders, color: '#031632' },
              { label: 'Pending Orders', value: stats.pendingOrders, color: '#f59e0b' },
              { label: 'Processing', value: stats.processingOrders, color: '#3b82f6' },
              { label: 'Delivered', value: stats.deliveredOrders, color: '#10b981' },
              { label: 'Active Buyers', value: stats.activeBuyers, color: '#8b5cf6' },
              { label: 'Active Suppliers', value: stats.activeSuppliers, color: '#ec4899' },
              { label: 'Pending Users', value: stats.pendingUsers, color: '#f59e0b' },
              { label: 'Pending Products', value: stats.pendingProducts, color: '#ef4444' },
            ].map(s => (
              <div key={s.label} style={styles.statCard}>
                <p style={styles.statLabel}>{s.label}</p>
                <h2 style={{ ...styles.statValue, color: s.color }}>{s.value}</h2>
              </div>
            ))}
          </div>
        )}

        {/* ── USERS ── */}
        {activeTab === 'users' && (
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>User Management</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ ...styles.inputFull, maxWidth: 280 }} placeholder="Search firm, mobile, role..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              {['All', 'Buyer', 'Supplier'].map(f => (
                <button key={f} onClick={() => setUserFilter(f)}
                  style={{ padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, backgroundColor: userFilter === f ? '#031632' : '#e2e8f0', color: userFilter === f ? 'white' : '#475569' }}>{f}</button>
              ))}
              <button onClick={exportUsersCSV} style={{ ...styles.btnApprove, marginLeft: 'auto' }}>⬇ Export CSV</button>
            </div>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Role', 'Firm Name', 'City', 'State', 'Mobile', 'Person', 'GST No', 'Status', 'Actions'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAndFilteredUsers.map(user => (
                    <tr key={user.id} style={styles.tr}>
                      <td style={styles.td}>{user.role?.toUpperCase()}</td>
                      <td style={styles.td}><b style={{ color: '#1e293b' }}>{user.firmName}</b></td>
                      <td style={styles.td}>{user.city}</td>
                      <td style={styles.td}>{user.state}</td>
                      <td style={styles.td}>{user.mobile}</td>
                      <td style={styles.td}>{user.contactPerson}</td>
                      <td style={styles.td}>{user.gstNumber}</td>
                      <td style={styles.td}>
                        <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, backgroundColor: user.status === 'approved' ? '#d1fae5' : user.status === 'blocked' ? '#fee2e2' : '#fef9c3', color: user.status === 'approved' ? '#065f46' : user.status === 'blocked' ? '#991b1b' : '#854d0e' }}>
                          {user.status || 'pending'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button style={styles.btnEdit} onClick={() => setSelectedUser(user)}>Edit</button>
                          {user.status !== 'approved' && <button style={styles.btnApprove} onClick={() => updateUserStatus(user.id, 'approved')}>Approve</button>}
                          {user.status !== 'blocked' && <button style={styles.btnPending} onClick={() => updateUserStatus(user.id, 'blocked')}>Block</button>}
                          <button style={{ ...styles.btnReject, backgroundColor: '#7f1d1d' }} onClick={() => handleDeleteUser(user)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PRODUCTS ── */}
        {activeTab === 'products' && (
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>Catalog Management</h3>
            <input style={{ ...styles.inputFull, marginBottom: 15, maxWidth: 320 }} placeholder="Search..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>{['Product', 'Supplier', 'Price/MOQ', 'Status', 'Actions'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (
                    <tr key={product.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {getProductImages(product).length > 0 && <img src={getProductImages(product)[0]} alt="" style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 6 }} />}
                          <span>{product.name}</span>
                        </div>
                      </td>
                      <td style={styles.td}>{product.supplierFirm}</td>
                      <td style={styles.td}>₹{product.price} / {product.moq} {product.unit}</td>
                      <td style={styles.td}>
                        <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, backgroundColor: product.status === 'approved' ? '#d1fae5' : '#fef9c3', color: product.status === 'approved' ? '#065f46' : '#854d0e' }}>
                          {product.status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={styles.btnEdit} onClick={() => setEditingProduct({ ...product })}>Edit</button>
                          {product.status !== 'approved' && <button style={styles.btnApprove} onClick={() => updateProductStatus(product.id, 'approved')}>Approve</button>}
                          {product.status !== 'pending' && <button style={styles.btnPending} onClick={() => updateProductStatus(product.id, 'pending')}>Delist</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ORDERS ── */}
        {activeTab === 'orders' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ ...styles.inputFull, maxWidth: 280 }} placeholder="Search order, buyer..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
              {['All', 'Pending', 'Processing', 'Shipped', 'Partially Dispatched', 'Delivered', 'Cancelled'].map(f => (
                <button key={f} onClick={() => setOrderFilter(f)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, backgroundColor: orderFilter === f ? '#031632' : '#e2e8f0', color: orderFilter === f ? 'white' : '#475569' }}>{f}</button>
              ))}
            </div>

            {filteredOrders.map(order => {
              const db2 = deliveryBadge(order);
              const isExpanded = expandedOrder === order.id;
              const pastShipments = order.shipments || [];

              return (
                <div key={order.id} style={styles.orderCard}>
                  <div style={styles.orderRow} onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b' }}>#{order.id.slice(0, 8)}</span>
                      <span style={{ fontSize: 13, color: '#475569' }}>B: {order.buyerFirm} | S: {order.supplierFirm}</span>
                      {order.createdAt?.toDate && (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{order.createdAt.toDate().toLocaleDateString('en-IN')}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', backgroundColor: db2.bg, color: db2.color }}>{order.status || 'Pending'}</span>
                      <button style={styles.btnDelivery} onClick={e => { e.stopPropagation(); openDeliveryModal(order); }}>Status</button>
                      <button style={{ ...styles.btnShare, backgroundColor: '#8b5cf6' }} onClick={e => { e.stopPropagation(); setShareModal(order); }}>Share</button>
                      <button style={{ ...styles.btnShare, backgroundColor: '#ef4444' }} onClick={e => { e.stopPropagation(); handleDeleteOrder(order.id); }}>Delete</button>
                      <span style={{ color: '#94a3b8', fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={styles.orderBody}>
                      {/* Items summary */}
                      {order.items?.map((item, idx) => (
                        <div key={idx} style={{ fontSize: 13, padding: '4px 0', color: '#334155' }}>
                          {item.productName}{item.size ? ` (${item.size})` : ''} —
                          Ordered: <b>{item.orderedQty || item.quantity || item.sets || 0} {item.unit || ''}</b> |
                          Dispatched: <b style={{ color: '#16a34a' }}>{item.dispatchedQty || 0}</b> |
                          Remaining: <b style={{ color: '#dc2626' }}>
                            {Math.max(0, (item.orderedQty || item.quantity || item.sets || 0) - (item.dispatchedQty || 0))}
                          </b>
                        </div>
                      ))}

                      {order.nightyDetails && (
                        <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0' }}>
                          Packing: {order.nightyDetails.totalSets} sets · {order.nightyDetails.packingType} sets/bale · {order.nightyDetails.totalBales} bale(s)
                        </p>
                      )}

                      {/* Dispatch history */}
                      {pastShipments.map((ship, idx) => (
                        <div key={idx} style={{ marginTop: 10, fontSize: 13, color: '#475569', backgroundColor: '#f1f5f9', padding: 10, borderRadius: 6, borderLeft: '3px solid #3b82f6' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>Dispatch {idx + 1}{ship.billDate ? ` (${ship.billDate})` : ''}</p>
                            <div style={{ display: 'flex', gap: 6 }}>
  <button style={{ ...styles.btnEdit, fontSize: 11, padding: '3px 10px' }}
    onClick={() => openEditShipment(order, idx)}>Edit</button>
  <button style={{ ...styles.btnReject, fontSize: 11, padding: '3px 10px' }}
    onClick={() => deleteShipment(order, idx)}>Delete</button>
</div>
                          </div>
                          <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', marginBottom: 6 }}>
                            {ship.billNo && <span><b>Bill No:</b> {ship.billNo}</span>}
                            {ship.transport && <span><b>Transport:</b> {ship.transport}</span>}
                            {ship.lrNo && <span><b>LR No:</b> {ship.lrNo}</span>}
                            {ship.lrDate && <span><b>LR Date:</b> {ship.lrDate}</span>}
                          </div>
                          {ship.items?.length > 0 && (
                            <div style={{ padding: 8, backgroundColor: 'white', borderRadius: 4 }}>
                              <b style={{ fontSize: 12, color: '#1e293b' }}>Items:</b>
                              {ship.items.map((i, iIdx) => (
                                <div key={iIdx} style={{ fontSize: 12, marginTop: 3 }}>
                                  • {i.productName}{i.size ? ` (${i.size})` : ''}: <b>{i.qty} {i.unit || ''}</b>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── CATEGORIES / SETTINGS ── */}
        {activeTab === 'categories' && (
  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
    <div style={{ ...styles.card, flex: '1 1 300px' }}>
      <h3 style={{ marginTop: 0 }}>Manage Categories</h3>
      <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input style={styles.inputFull} value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New Category Name" />
        <button type="submit" style={styles.btnApprove}>Add</button>
      </form>
      <ul style={{ padding: 0, listStyle: 'none', margin: 0 }}>
        {categories.map(cat => (
          <li key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #eee' }}>
            <div>
              <span style={{ fontSize: 14, color: '#1e293b', fontWeight: 600 }}>{cat.name}</span>
              {cat.template && (
                <span style={{ marginLeft: 8, fontSize: 11, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 7px', borderRadius: 10 }}>{cat.template}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={styles.btnEdit} onClick={() => setEditingCategory({ id: cat.id, name: cat.name, template: cat.template || 'sets' })}>Edit</button>
              <button style={styles.btnReject} onClick={() => handleDeleteCategory(cat.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
    <div style={{ ...styles.card, flex: '1 1 300px' }}>
      <h3 style={{ marginTop: 0 }}>System Info</h3>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
        Warning: Deleting a category will not delete existing products, but removes it from supplier upload options. Editing a category only affects new uploads — existing products keep their original template.
      </p>
    </div>
  </div>
)}
      </div>

      {/* ── SHARE MODAL ── */}
      {shareModal && (
        <div style={styles.modalOverlay} onClick={() => setShareModal(null)}>
          <div style={{ ...styles.modal, maxWidth: 320, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#1e293b' }}>Share Order</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>#{shareModal.id.slice(0, 8)}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button style={styles.shareMenuBtn} onClick={() => { generateOrderPDF(shareModal); setShareModal(null); }}>📄 Download PDF</button>
              {navigator.share && (
                <button style={styles.shareMenuBtn} onClick={async () => {
                  try {
                    await navigator.share({ title: `Order #${shareModal.id.slice(0, 8)}`, text: `Jain Agency Order\nBuyer: ${shareModal.buyerFirm}\nSupplier: ${shareModal.supplierFirm}\nStatus: ${shareModal.status}` });
                  } catch (e) { }
                  setShareModal(null);
                }}>📤 Share via App</button>
              )}
              <button style={{ ...styles.shareMenuBtn, backgroundColor: '#f1f5f9', border: 'none' }} onClick={() => setShareModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL ── */}
      {selectedUser && (
        <div style={styles.modalOverlay} onClick={() => setSelectedUser(null)}>
          <div style={{ ...styles.modal, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit User — {selectedUser.firmName}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={styles.label}>Firm Name</label>
                <input style={styles.inputFull} value={selectedUser.firmName || ''} onChange={e => setSelectedUser({ ...selectedUser, firmName: e.target.value })} />
              </div>
              <div><label style={styles.label}>Contact Person</label><input style={styles.inputFull} value={selectedUser.contactPerson || ''} onChange={e => setSelectedUser({ ...selectedUser, contactPerson: e.target.value })} /></div>
              <div><label style={styles.label}>Mobile</label><input style={styles.inputFull} value={selectedUser.mobile || ''} onChange={e => setSelectedUser({ ...selectedUser, mobile: e.target.value })} /></div>
              <div><label style={styles.label}>City</label><input style={styles.inputFull} value={selectedUser.city || ''} onChange={e => setSelectedUser({ ...selectedUser, city: e.target.value })} /></div>
              <div><label style={styles.label}>State</label><input style={styles.inputFull} value={selectedUser.state || ''} onChange={e => setSelectedUser({ ...selectedUser, state: e.target.value })} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={styles.label}>GST Number</label><input style={styles.inputFull} value={selectedUser.gstNumber || ''} onChange={e => setSelectedUser({ ...selectedUser, gstNumber: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={styles.btnApprove} onClick={handleSaveUserEdit}>Save Changes</button>
              <button style={styles.btnEdit} onClick={() => setSelectedUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PRODUCT MODAL ── */}
      {editingProduct && (
        <div style={styles.modalOverlay} onClick={() => setEditingProduct(null)}>
          <div style={{ ...styles.modal, maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit — {editingProduct.name}</h3>

            <label style={styles.label}>Photos</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {getProductImages(editingProduct).map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={url} alt="" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 6 }} />
                  <button onClick={() => handleDeleteProductImage(url)}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              ))}
            </div>
            <input type="file" accept="image/*" multiple style={styles.inputFull} onChange={e => handleProductImageUpload(e.target.files)} />

            <label style={styles.label}>Product Name</label>
            <input style={styles.inputFull} value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} />

            <label style={styles.label}>Category</label>
            <select style={styles.inputFull} value={editingProduct.category} onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={styles.label}>Price (₹)</label><input style={styles.inputFull} type="number" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: e.target.value })} /></div>
              <div><label style={styles.label}>MOQ</label><input style={styles.inputFull} type="number" value={editingProduct.moq} onChange={e => setEditingProduct({ ...editingProduct, moq: e.target.value })} /></div>
            </div>

            <label style={styles.label}>Unit</label>
            <select style={styles.inputFull} value={editingProduct.unit || 'Piece'} onChange={e => setEditingProduct({ ...editingProduct, unit: e.target.value })}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>

            <label style={styles.label}>Description</label>
            <textarea style={{ ...styles.inputFull, height: 60, resize: 'vertical' }} value={editingProduct.description || ''} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} />

            {NIGHTY_CATEGORIES.includes(editingProduct.category) && (
              <>
                <label style={styles.label}>Cut</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['2/70', '2/90', '3/20'].map(cut => (
                    <button key={cut} type="button"
                      style={{ padding: '6px 14px', border: '2px solid', borderColor: editingProduct.cut === cut ? '#031632' : '#ddd', borderRadius: 6, cursor: 'pointer', backgroundColor: editingProduct.cut === cut ? '#031632' : 'white', color: editingProduct.cut === cut ? 'white' : '#333' }}
                      onClick={() => setEditingProduct({ ...editingProduct, cut })}>{cut}</button>
                  ))}
                </div>
              </>
            )}

            {(STITCHED_CATEGORIES.includes(editingProduct.category) || editingProduct.category === CHUDIDAR_CATEGORY) && (
              <>
                <label style={styles.label}>Material</label>
                <input style={styles.inputFull} value={editingProduct.material || ''} onChange={e => setEditingProduct({ ...editingProduct, material: e.target.value })} />
                <label style={styles.label}>Sizes</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SIZES.map(size => (
                    <button key={size} type="button"
                      style={{ padding: '5px 10px', border: '2px solid', borderColor: (editingProduct.sizes || []).includes(size) ? '#e63946' : '#ddd', borderRadius: 6, cursor: 'pointer', backgroundColor: (editingProduct.sizes || []).includes(size) ? '#e63946' : 'white', color: (editingProduct.sizes || []).includes(size) ? 'white' : '#333', fontSize: 13 }}
                      onClick={() => toggleEditSize(size)}>{size}</button>
                  ))}
                </div>
              </>
            )}

            {editingProduct.category === CHUDIDAR_CATEGORY && (
              <>
                <label style={styles.label}>Top Material</label>
                <input style={styles.inputFull} value={editingProduct.chudidarTopMaterial || ''} onChange={e => setEditingProduct({ ...editingProduct, chudidarTopMaterial: e.target.value })} />
                <label style={styles.label}>Bottom Material</label>
                <input style={styles.inputFull} value={editingProduct.chudidarBottomMaterial || ''} onChange={e => setEditingProduct({ ...editingProduct, chudidarBottomMaterial: e.target.value })} />
                <label style={styles.label}>Dupatta Material</label>
                <input style={styles.inputFull} value={editingProduct.chudidarDupattaMaterial || ''} onChange={e => setEditingProduct({ ...editingProduct, chudidarDupattaMaterial: e.target.value })} />
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={styles.btnApprove} onClick={saveProductEdit} disabled={uploadingImage}>Save Changes</button>
              <button style={styles.btnEdit} onClick={() => setEditingProduct(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── STATUS / DELIVERY MODAL ── */}
      {deliveryModal && (
        <div style={styles.modalOverlay} onClick={() => setDeliveryModal(null)}>
          <div style={{ ...styles.modal, maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Update Order Status</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
              Buyer: <b>{deliveryModal.buyerFirm}</b> | Supplier: <b>{deliveryModal.supplierFirm}</b>
            </p>

            {/* Status dropdown — only manual statuses */}
            <label style={styles.label}>Status</label>
            <select style={styles.inputFull} value={deliveryStatus} onChange={e => setDeliveryStatus(e.target.value)}>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Shipped">Shipped (Add Dispatch)</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 12px' }}>
              Note: "Delivered" and "Partially Dispatched" are set automatically based on dispatch quantities.
            </p>

            {/* Shipping form — only when Shipped selected */}
            {deliveryStatus === 'Shipped' && (
              <div style={{ marginTop: 12, backgroundColor: '#f8fafc', padding: 16, borderRadius: 10 }}>
                <p style={{ margin: '0 0 12px', fontWeight: 'bold', fontSize: 13, color: '#1e293b' }}>New Dispatch Details</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={styles.label}>Bill No *</label>
                    <input placeholder="Bill No" style={styles.inputFull} value={shippingForm.billNo} onChange={e => setShippingForm({ ...shippingForm, billNo: e.target.value })} />
                  </div>
                  <div>
                    <label style={styles.label}>Bill Date</label>
                    <input type="date" style={styles.inputFull} value={shippingForm.billDate} onChange={e => setShippingForm({ ...shippingForm, billDate: e.target.value })} />
                  </div>
                  <div>
                    <label style={styles.label}>Transport</label>
                    <input placeholder="Transport" style={styles.inputFull} value={shippingForm.transport} onChange={e => setShippingForm({ ...shippingForm, transport: e.target.value })} />
                  </div>
                  <div>
                    <label style={styles.label}>LR No</label>
                    <input placeholder="LR No" style={styles.inputFull} value={shippingForm.lrNo} onChange={e => setShippingForm({ ...shippingForm, lrNo: e.target.value })} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={styles.label}>LR Date</label>
                    <input type="date" style={{ ...styles.inputFull, maxWidth: 200 }} value={shippingForm.lrDate} onChange={e => setShippingForm({ ...shippingForm, lrDate: e.target.value })} />
                  </div>
                </div>

                {/* Dispatch quantities */}
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', margin: '0 0 10px' }}>Quantity to Dispatch Now</p>
                  {shippingForm.dispatchItems.map((item, idx) => {
                    const remaining = item.orderedQty - item.previouslyDispatched;
                    return (
                      <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center', opacity: remaining <= 0 ? 0.5 : 1, backgroundColor: remaining <= 0 ? '#f1f5f9' : 'white', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                            {item.productName}{item.size ? ` (${item.size})` : ''}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            Ordered: <b>{item.orderedQty} {item.unit}</b> | Prev Dispatched: <b style={{ color: '#16a34a' }}>{item.previouslyDispatched}</b> | Remaining: <b style={{ color: remaining <= 0 ? '#94a3b8' : '#dc2626' }}>{remaining}</b>
                          </div>
                        </div>
                        <div>
                          <label style={{ ...styles.label, marginBottom: 2 }}>Now</label>
                          <input type="number" min="0" max={remaining}
                            value={item.dispatchingNow}
                            disabled={remaining <= 0}
                            style={{ width: 72, padding: '7px', borderRadius: 6, border: '1px solid #d1d5db', backgroundColor: remaining <= 0 ? '#e2e8f0' : 'white', textAlign: 'center', fontSize: 14 }}
                            onChange={e => {
                              let val = Math.max(0, Math.min(Number(e.target.value), remaining));
                              const updated = [...shippingForm.dispatchItems];
                              updated[idx] = { ...updated[idx], dispatchingNow: val };
                              setShippingForm({ ...shippingForm, dispatchItems: updated });
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={styles.btnApprove} onClick={saveDelivery}>Save</button>
              <button style={styles.btnEdit} onClick={() => setDeliveryModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT SHIPMENT MODAL ── */}
      {editingShipment && editShipmentForm && (
        <div style={styles.modalOverlay} onClick={() => { setEditingShipment(null); setEditShipmentForm(null); }}>
          <div style={{ ...styles.modal, maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit Dispatch {editingShipment.shipmentIdx + 1}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={styles.label}>Bill No *</label>
                <input style={styles.inputFull} value={editShipmentForm.billNo} onChange={e => setEditShipmentForm({ ...editShipmentForm, billNo: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>Bill Date</label>
                <input type="date" style={styles.inputFull} value={editShipmentForm.billDate} onChange={e => setEditShipmentForm({ ...editShipmentForm, billDate: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>Transport</label>
                <input style={styles.inputFull} value={editShipmentForm.transport} onChange={e => setEditShipmentForm({ ...editShipmentForm, transport: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>LR No</label>
                <input style={styles.inputFull} value={editShipmentForm.lrNo} onChange={e => setEditShipmentForm({ ...editShipmentForm, lrNo: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={styles.label}>LR Date</label>
                <input type="date" style={{ ...styles.inputFull, maxWidth: 200 }} value={editShipmentForm.lrDate} onChange={e => setEditShipmentForm({ ...editShipmentForm, lrDate: e.target.value })} />
              </div>
            </div>

            {/* Edit item quantities */}
            <div style={{ marginTop: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', margin: '0 0 10px' }}>Items in this Dispatch</p>
              {editShipmentForm.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ flex: 1, fontSize: 13, color: '#1e293b', fontWeight: 600 }}>
                    {item.productName}{item.size ? ` (${item.size})` : ''}
                  </div>
                  <div>
                    <label style={{ ...styles.label, marginBottom: 2 }}>Qty</label>
                    <input type="number" min="0" value={item.qty}
                      style={{ width: 72, padding: 7, borderRadius: 6, border: '1px solid #d1d5db', textAlign: 'center', fontSize: 14 }}
                      onChange={e => {
                        const updated = editShipmentForm.items.map((it, i) =>
                          i === idx ? { ...it, qty: Number(e.target.value) } : it
                        );
                        setEditShipmentForm({ ...editShipmentForm, items: updated });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={styles.btnApprove} onClick={saveEditShipment}>Save Changes</button>
              <button style={styles.btnEdit} onClick={() => { setEditingShipment(null); setEditShipmentForm(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {editingCategory && (
  <div style={styles.modalOverlay} onClick={() => setEditingCategory(null)}>
    <div style={{ ...styles.modal, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
      <h3 style={{ marginTop: 0 }}>Edit Category</h3>

      <label style={styles.label}>Category Name *</label>
      <input
        style={styles.inputFull}
        value={editingCategory.name}
        onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
        placeholder="Category Name"
      />

      <label style={{ ...styles.label, marginTop: 16 }}>Behavior Template *</label>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px' }}>
        Note: Changing template only affects new products — existing products are not changed.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { id: 'sets', label: 'Fixed Sets', desc: 'e.g. Nighty, Lingerie', icon: '📦' },
          { id: 'stitched', label: 'Stitched Garments', desc: 'e.g. Kurti, Dress', icon: '👕' },
          { id: 'unstitched', label: 'Unstitched Suits', desc: 'e.g. 3pc Chudidar', icon: '🧵' },
          { id: 'running', label: 'Running Fabric', desc: 'e.g. Thaan, Lump', icon: '📜' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setEditingCategory({ ...editingCategory, template: t.id })}
            style={{
              padding: '12px 10px', border: '2px solid',
              borderColor: editingCategory.template === t.id ? '#031632' : '#e2e8f0',
              borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              backgroundColor: editingCategory.template === t.id ? '#031632' : 'white',
              color: editingCategory.template === t.id ? 'white' : '#1e293b',
            }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{t.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          style={styles.btnApprove}
          disabled={!editingCategory.name.trim()}
          onClick={async () => {
            if (!editingCategory.name.trim()) return;
            await updateDoc(doc(db, 'categories', editingCategory.id), {
              name: editingCategory.name.trim(),
              template: editingCategory.template,
            });
            setCategories(categories.map(c =>
              c.id === editingCategory.id
                ? { ...c, name: editingCategory.name.trim(), template: editingCategory.template }
                : c
            ));
            setEditingCategory(null);
          }}>
          Save Changes
        </button>
        <button style={styles.btnEdit} onClick={() => setEditingCategory(null)}>Cancel</button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}

const styles = {
  container: { display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' },
  sidebar: { width: 220, backgroundColor: '#031632', padding: 20, display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', boxSizing: 'border-box' },
  tab: { padding: '11px 14px', backgroundColor: 'transparent', color: '#94a3b8', border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left', fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', width: '100%' },
  activeTab: { padding: '11px 14px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 'bold', marginBottom: 4, display: 'flex', alignItems: 'center', width: '100%' },
  sidebarBadge: { backgroundColor: '#ef4444', color: 'white', fontSize: 10, fontWeight: 'bold', borderRadius: 10, padding: '2px 6px', marginLeft: 'auto' },
  main: { flex: 1, padding: 20, overflowY: 'auto', paddingBottom: 80 },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, backgroundColor: 'white', padding: '14px 20px', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  iconBtn: { width: 40, height: 40, borderRadius: '50%', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  bellWrapper: { position: 'relative' },
  bellBtn: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', color: 'white', fontSize: 10, fontWeight: 'bold', borderRadius: 10, padding: '2px 5px', minWidth: 16, textAlign: 'center' },
  notifDropdown: { position: 'absolute', top: 50, right: 0, width: 300, backgroundColor: 'white', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', zIndex: 1000, overflow: 'hidden', border: '1px solid #e2e8f0' },
  notifHeader: { padding: '14px 16px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' },
  notifList: { maxHeight: 350, overflowY: 'auto' },
  notifEmpty: { padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 13 },
  notifItem: { display: 'flex', alignItems: 'flex-start', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' },
  notifMsg: { margin: 0, fontSize: 13, color: '#1e293b', lineHeight: 1.4 },
  notifTime: { margin: '4px 0 0', fontSize: 11, color: '#94a3b8' },
  unreadDot: { width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: 4, flexShrink: 0 },
  gridStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 },
  statCard: { backgroundColor: 'white', padding: 18, borderRadius: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  statLabel: { margin: 0, color: '#64748b', fontSize: 12 },
  statValue: { margin: '8px 0 0', color: '#0f172a', fontSize: 24 },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  tableWrapper: { overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' },
  table: { width: '100%', minWidth: 900, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 },
  th: { padding: 12, borderBottom: '2px solid #e2e8f0', color: '#475569', whiteSpace: 'nowrap', fontWeight: 700 },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: 12, color: '#334155' },
  orderCard: { backgroundColor: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 8, overflow: 'hidden' },
  orderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', gap: 10, flexWrap: 'wrap' },
  orderBody: { padding: '12px 16px 16px', borderTop: '1px solid #f1f5f9', backgroundColor: '#fafafa' },
  btnApprove: { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnPending: { backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnReject: { backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnEdit: { backgroundColor: '#64748b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnDelivery: { backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  btnShare: { backgroundColor: '#8b5cf6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  shareMenuBtn: { width: '100%', padding: 12, backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: 8, color: '#1e293b', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { backgroundColor: 'white', padding: 25, borderRadius: 16, width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' },
  label: { fontSize: 12, color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 4, marginTop: 10 },
  inputFull: { padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, width: '100%', boxSizing: 'border-box', fontSize: 14, outline: 'none' },
};

export default AdminDashboard;