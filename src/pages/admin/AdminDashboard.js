import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  collection, getDocs, doc, updateDoc, addDoc,
  deleteDoc, query, where, orderBy, onSnapshot, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useInactivityLogout } from '../../hooks/useInactivityLogout';

import AdminEditUserModal from '../../components/admin/AdminEditUserModal';
import AdminCategoryModal from '../../components/admin/AdminCategoryModal';
import AdminEditProductModal from '../../components/admin/AdminEditProductModal';
import AdminDeliveryModal from '../../components/admin/AdminDeliveryModal';
import { generateAdminOrderPDF } from '../../utils/adminPdfExport';
import { PRESET_TRANSPORTERS } from '../../constants/transport';

function AdminDashboard() {
  useInactivityLogout();
  const [activeTab, setActiveTab] = useState('analytics');
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryRequests, setCategoryRequests] = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [transporterSearch, setTransporterSearch] = useState('');
  const [editingTransporter, setEditingTransporter] = useState(null);
  const [addingTransporter, setAddingTransporter] = useState(false);
  const [newTransporterForm, setNewTransporterForm] = useState({ name: '', gst: '', phone: '' });
  const [categorySearch, setCategorySearch] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({ name: '', template: 'sets' });
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const [loading, setLoading] = useState(false);
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
  const [shippingForm, setShippingForm] = useState({ billNo: '', billDate: '', transport: '', lrNo: '', lrDate: '', dispatchItems: [] });
  const [editingCategory, setEditingCategory] = useState(null);
  const [shareModal, setShareModal] = useState(null);
  const { isMobile, isTablet } = useWindowSize();

  const adminId = auth.currentUser?.uid;
  const navigate = useNavigate();

  useEffect(() => {
    if (!adminId) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', adminId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubscribe();
  }, [adminId]);

  useEffect(() => {
    const handler = e => {
      if (notifRef.current && !notifRef.current.contains(e.target))
        setShowNotifications(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [catsSnap, transportersSnap, catRequestsSnap] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'transporters')),
        getDocs(query(collection(db, 'categoryRequests'), where('status', '==', 'pending')))
      ]);
      setCategories(catsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTransporters(transportersSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryRequests(catRequestsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error('Data fetch error:', err); }
    setLoading(false);
  };

  const handleLogoutClick = () => {
    signOut(auth).then(() => navigate('/'));
  };

  const updateUserStatus = async (userId, newStatus) => {
    await updateDoc(doc(db, 'users', userId), { status: newStatus });
    setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    if (selectedUser?.id === userId) setSelectedUser(prev => ({ ...prev, status: newStatus }));
  };

  const handleSaveUserEdit = async () => {
    if (!selectedUser) return;
    await updateDoc(doc(db, 'users', selectedUser.id), {
      firmName: selectedUser.firmName || '', city: selectedUser.city || '', state: selectedUser.state || '',
      mobile: selectedUser.mobile || '', contactPerson: selectedUser.contactPerson || '', gstNumber: selectedUser.gstNumber || ''
    });
    setUsers(users.map(u => u.id === selectedUser.id ? selectedUser : u));
    setSelectedUser(null);
  };

  const handleDeleteUser = async (user) => {
    const role = user.role || 'user';
    if (!window.confirm(`Delete ${role} "${user.firmName}"? This is permanent.`)) return;
    setLoading(true);
    try {
      const docsToDelete = [];

      if (role === 'supplier') {
        const prodSnap = await getDocs(query(collection(db, 'products'), where('supplierId', '==', user.id)));
        prodSnap.docs.forEach(d => docsToDelete.push(doc(db, 'products', d.id)));
        const orderSnap = await getDocs(query(collection(db, 'orders'), where('supplierId', '==', user.id)));
        orderSnap.docs.forEach(d => docsToDelete.push(doc(db, 'orders', d.id)));
      }
      if (role === 'buyer') {
        const orderSnap = await getDocs(query(collection(db, 'orders'), where('buyerId', '==', user.id)));
        orderSnap.docs.forEach(d => docsToDelete.push(doc(db, 'orders', d.id)));
      }
      docsToDelete.push(doc(db, 'users', user.id));

      // Chunk into 499 to stay under Firestore 500 limit
      const chunkSize = 499;
      for (let i = 0; i < docsToDelete.length; i += chunkSize) {
        const chunk = docsToDelete.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
      }

      setUsers(users.filter(u => u.id !== user.id));
      await fetchAllData();
    } catch (err) { console.error('Delete user error:', err); alert('Delete failed: ' + err.message); }
    setLoading(false);
  };

  const updateProductStatus = async (productId, newStatus) => {
    await updateDoc(doc(db, 'products', productId), { status: newStatus });
    setProducts(products.map(p => p.id === productId ? { ...p, status: newStatus } : p));
  };

  const handleRejectProduct = async (productId) => {
    if (!window.confirm('Reject this product?')) return;
    try {
      await updateDoc(doc(db, 'products', productId), { status: 'rejected' });
    } catch (err) {
      alert('Failed to reject product: ' + err.message);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Permanently delete this product? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (err) {
      alert('Failed to delete product: ' + err.message);
    }
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
    } catch (err) { console.error('Upload error:', err); }
    setUploadingImage(false);
  };

  const handleDeleteProductImage = async (urlToDelete) => {
    if (!editingProduct) return;
    const existingUrls = editingProduct.imageUrls
      ? editingProduct.imageUrls.map(u => typeof u === 'string' ? u : u.url).filter(Boolean)
      : editingProduct.imageUrl ? [editingProduct.imageUrl] : [];
    const updatedUrls = existingUrls.filter(u => u !== urlToDelete);
    try { await deleteObject(ref(storage, urlToDelete)); } catch (e) {}
    await updateDoc(doc(db, 'products', editingProduct.id), { imageUrl: updatedUrls[0] || '', imageUrls: updatedUrls });
    setEditingProduct(prev => ({ ...prev, imageUrl: updatedUrls[0] || '', imageUrls: updatedUrls }));
    setProducts(products.map(p => p.id === editingProduct.id ? { ...p, imageUrl: updatedUrls[0] || '', imageUrls: updatedUrls } : p));
  };

  const saveProductEdit = async () => {
    if (!editingProduct) return;
    const updateData = {
      name: editingProduct.name, price: Number(editingProduct.price), moq: Number(editingProduct.moq),
      unit: editingProduct.unit, description: editingProduct.description || '', category: editingProduct.category
    };
    if (editingProduct.material !== undefined) updateData.material = editingProduct.material;
    if (editingProduct.cut !== undefined) updateData.cut = editingProduct.cut;
    if (editingProduct.sizes !== undefined) updateData.sizes = editingProduct.sizes;
    await updateDoc(doc(db, 'products', editingProduct.id), updateData);
    setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...editingProduct } : p));
    setEditingProduct(null);
  };

  const isBillNoDuplicate = (billNo, supplierId, excludeOrderId = null, excludeShipmentIdx = null) => {
    if (!billNo || !billNo.trim()) return false;
    const trimmed = billNo.trim();
    for (const o of orders) {
      if (o.supplierId !== supplierId) continue;
      const shipments = o.shipments || [];
      for (let sIdx = 0; sIdx < shipments.length; sIdx++) {
        if (o.id === excludeOrderId && sIdx === excludeShipmentIdx) continue;
        if (shipments[sIdx].billNo && shipments[sIdx].billNo.trim() === trimmed) return true;
      }
    }
    return false;
  };

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
      return { ...item, orderedQty: ordered, previouslyDispatched, dispatchingNow: 0, unit: item.sets ? 'Set' : (item.moqUnit || item.unit || 'Piece') };
    });
    const today = new Date().toLocaleDateString('en-CA');
    const transport = order.transportDetails?.name || '';
    setShippingForm({ billNo: '', billDate: today, transport, lrNo: '', lrDate: today, dispatchItems });
  };

  const saveDelivery = async (formData) => {
    if (!deliveryModal) return;
    const sf = formData || shippingForm;
    let finalStatus = deliveryStatus;
    if (deliveryStatus === 'Shipped') {
      const isDuplicate = isBillNoDuplicate(sf.billNo, deliveryModal.supplierId, deliveryModal.id, null);
      if (isDuplicate) { alert(`Bill No "${sf.billNo}" already exists for this supplier.`); return; }
      const isAnythingDispatched = sf.dispatchItems.some(i => Number(i.dispatchingNow) > 0);
      let newShipments = [...(deliveryModal.shipments || [])];
      if (isAnythingDispatched) {
        newShipments.push({
          billNo: sf.billNo, billDate: sf.billDate, transport: sf.transport,
          lrNo: sf.lrNo, lrDate: sf.lrDate, dispatchedAt: new Date().toISOString(),
          items: sf.dispatchItems.filter(i => Number(i.dispatchingNow) > 0).map(i => ({
            itemIdx: sf.dispatchItems.indexOf(i), productName: i.productName,
            size: i.size || '', qty: Number(i.dispatchingNow),
            unit: i.sets ? 'Set' : (i.moqUnit || i.unit || 'Piece')
          }))
        });
      }
      const updatedItems = (deliveryModal.items || []).map((item, itemIdx) => {
        let totalDispatched = 0;
        newShipments.forEach(ship => { const match = ship.items?.find(si => si.itemIdx === itemIdx); if (match) totalDispatched += Number(match.qty || 0); });
        return { ...item, dispatchedQty: totalDispatched };
      });
      const orderedQtys = updatedItems.map(i => Number(i.orderedQty || i.quantity || i.sets || 0));
      const dispatchedQtys = updatedItems.map(i => i.dispatchedQty);
      const allDelivered = dispatchedQtys.every((d, idx) => d >= orderedQtys[idx]);
      const anyDispatched = dispatchedQtys.some(d => d > 0);
      if (anyDispatched) finalStatus = allDelivered ? 'Delivered' : 'Partially Dispatched';
      const updateData = {
        status: finalStatus, shipments: newShipments,
        items: updatedItems.map(({ previouslyDispatched, dispatchingNow, ...rest }) => rest)
      };
      await updateDoc(doc(db, 'orders', deliveryModal.id), updateData);
      setOrders(orders.map(o => o.id === deliveryModal.id ? { ...o, ...updateData } : o));
    } else {
      await updateDoc(doc(db, 'orders', deliveryModal.id), { status: finalStatus });
      setOrders(orders.map(o => o.id === deliveryModal.id ? { ...o, status: finalStatus } : o));
    }
    setDeliveryModal(null);
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Permanently delete this order?')) return;
    await deleteDoc(doc(db, 'orders', orderId));
    setOrders(orders.filter(o => o.id !== orderId));
  };

  const handleLoadDefaultTransporters = async () => {
    if (!window.confirm('Load all default transporters into Firestore? This will add missing ones only.')) return;
    setLoading(true);
    try {
      const existing = transporters.map(t => t.name.toUpperCase());
      const missing = PRESET_TRANSPORTERS.filter(name => !existing.includes(name.toUpperCase()));
      await Promise.all(missing.map(name => addDoc(collection(db, 'transporters'), { name })));
      await fetchAllData();
      alert(`Added ${missing.length} transporters.`);
    } catch (err) { console.error(err); alert('Failed: ' + err.message); }
    setLoading(false);
  };

  const handleAddTransporter = async (e) => {
    e.preventDefault();
    if (!newTransporterForm.name.trim()) return;
    const upper = newTransporterForm.name.trim().toUpperCase();
    const exists = transporters.find(t => t.name.toUpperCase() === upper);
    if (exists) { alert('Already exists'); return; }
    const data = { name: upper, gst: newTransporterForm.gst.trim(), phone: newTransporterForm.phone.trim() };
    const docRef = await addDoc(collection(db, 'transporters'), data);
    setTransporters([...transporters, { id: docRef.id, ...data }].sort((a, b) => a.name.localeCompare(b.name)));
    setNewTransporterForm({ name: '', gst: '', phone: '' });
    setAddingTransporter(false);
  };

  const handleDeleteTransporter = async (id) => {
    if (!window.confirm('Delete this transporter?')) return;
    await deleteDoc(doc(db, 'transporters', id));
    setTransporters(transporters.filter(t => t.id !== id));
  };

  const handleSaveTransporterEdit = async () => {
    if (!editingTransporter || !editingTransporter.name.trim()) return;
    const data = { name: editingTransporter.name.trim().toUpperCase(), gst: editingTransporter.gst || '', phone: editingTransporter.phone || '' };
    await updateDoc(doc(db, 'transporters', editingTransporter.id), data);
    setTransporters(transporters.map(t => t.id === editingTransporter.id ? { ...t, ...data } : t).sort((a, b) => a.name.localeCompare(b.name)));
    setEditingTransporter(null);
  };

  const handleApproveCategoryRequest = async (request) => {
    const exists = categories.find(c => c.name.toLowerCase() === request.name.toLowerCase());
    if (exists) {
      await updateDoc(doc(db, 'categoryRequests', request.id), { status: 'approved' });
      setCategoryRequests(categoryRequests.filter(r => r.id !== request.id));
      alert(`"${request.name}" already exists in categories.`);
      return;
    }
    const docRef = await addDoc(collection(db, 'categories'), { name: request.name, template: request.template || 'sets' });
    await updateDoc(doc(db, 'categoryRequests', request.id), { status: 'approved' });
    setCategories([...categories, { id: docRef.id, name: request.name, template: request.template || 'sets' }].sort((a, b) => a.name.localeCompare(b.name)));
    setCategoryRequests(categoryRequests.filter(r => r.id !== request.id));
  };

  const handleRejectCategoryRequest = async (requestId) => {
    await updateDoc(doc(db, 'categoryRequests', requestId), { status: 'rejected' });
    setCategoryRequests(categoryRequests.filter(r => r.id !== requestId));
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryForm.name.trim()) return;
    const data = { name: newCategoryForm.name.trim(), template: newCategoryForm.template };
    const docRef = await addDoc(collection(db, 'categories'), data);
    setCategories([...categories, { id: docRef.id, ...data }].sort((a, b) => a.name.localeCompare(b.name)));
    setNewCategoryForm({ name: '', template: 'sets' });
    setAddingCategory(false);
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Delete this category?')) return;
    await deleteDoc(doc(db, 'categories', catId));
    setCategories(categories.filter(c => c.id !== catId));
  };

  const handleSaveCategoryEdit = async () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    await updateDoc(doc(db, 'categories', editingCategory.id), { name: editingCategory.name.trim(), template: editingCategory.template });
    setCategories(categories.map(c => c.id === editingCategory.id ? { ...c, name: editingCategory.name.trim(), template: editingCategory.template } : c));
    setEditingCategory(null);
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

  const getProductImages = (product) => {
    if (!product) return [];
    if (product.imageUrls && Array.isArray(product.imageUrls)) return product.imageUrls.map(u => typeof u === 'string' ? u : u.url).filter(Boolean);
    if (product.imageUrl) return [product.imageUrl];
    return [];
  };

  const sortedAndFilteredUsers = users
    .filter(u => u.role !== 'admin')
    .filter(u => userFilter === 'All' ? true : u.role === userFilter.toLowerCase())
    .filter(u => u.firmName?.toLowerCase().includes(userSearch.toLowerCase()) || u.mobile?.includes(userSearch) || u.role?.toLowerCase().includes(userSearch.toLowerCase()))
    .sort((a, b) => (a.firmName || '').localeCompare(b.firmName || ''));

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.supplierFirm?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const displayOrders = [...orders]
    .filter(o => !orderSearch ||
      o.buyerFirm?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.supplierFirm?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      String(o.orderNumber || '').includes(orderSearch)
    )
    .filter(o => !orderFilter || orderFilter === 'All' || o.status === orderFilter)
    .sort((a, b) => {
      const aNum = a.orderNumber || 0;
      const bNum = b.orderNumber || 0;
      if (bNum !== aNum) return bNum - aNum;
      const aTime = a.createdAt?.toDate?.() || new Date(0);
      const bTime = b.createdAt?.toDate?.() || new Date(0);
      return bTime - aTime;
    });

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
    document.body.appendChild(a); a.click(); a.remove();
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
    await batch.commit();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const navTabs = [
    { id: 'analytics', label: 'Dashboard', icon: '📊' },
    { id: 'users', label: 'Users', count: stats.pendingUsers, icon: '👥' },
    { id: 'products', label: 'Products', count: stats.pendingProducts, icon: '📦' },
    { id: 'orders', label: 'Orders', icon: '🛒' },
    { id: 'categories', label: 'Settings', icon: '⚙️', count: categoryRequests.length },
  ];

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading System Data...</div>;

  return (
    <div style={styles.container}>
      <AdminEditUserModal selectedUser={selectedUser} setSelectedUser={setSelectedUser} onSave={handleSaveUserEdit} onCancel={() => setSelectedUser(null)} />
      <AdminCategoryModal editingCategory={editingCategory} setEditingCategory={setEditingCategory} onSave={handleSaveCategoryEdit} onCancel={() => setEditingCategory(null)} />
      <AdminEditProductModal editingProduct={editingProduct} setEditingProduct={setEditingProduct} categories={categories} uploadingImage={uploadingImage} onImageUpload={handleProductImageUpload} onImageDelete={handleDeleteProductImage} onSave={saveProductEdit} onCancel={() => setEditingProduct(null)} />
      <AdminDeliveryModal deliveryModal={deliveryModal} deliveryStatus={deliveryStatus} setDeliveryStatus={setDeliveryStatus} shippingForm={shippingForm} setShippingForm={setShippingForm} onSave={saveDelivery} onCancel={() => setDeliveryModal(null)} users={users} transporters={transporters} onAddTransporter={async (name) => { const upper = name.toUpperCase(); if (!transporters.find(t => t.name.toUpperCase() === upper)) { const ref = await addDoc(collection(db, 'transporters'), { name: upper }); setTransporters(prev => [...prev, { id: ref.id, name: upper }].sort((a, b) => a.name.localeCompare(b.name))); } }} />

      {shareModal && (
        <div style={styles.modalOverlay} onClick={() => setShareModal(null)}>
          <div style={{ ...styles.modal, maxWidth: 320, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#1e293b' }}>Share Order</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>{shareModal.orderNumber ? `#${shareModal.orderNumber}` : `#${shareModal.id.slice(-6).toUpperCase()}`}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button style={styles.shareMenuBtn} onClick={() => { generateAdminOrderPDF(shareModal); setShareModal(null); }}>📄 Download PDF</button>
              {navigator.share && (
                <button style={styles.shareMenuBtn} onClick={async () => {
                  try { await navigator.share({ title: `Order ${shareModal.orderNumber ? `#${shareModal.orderNumber}` : `#${shareModal.id.slice(-6).toUpperCase()}`}`, text: `Jain Agency Order\nBuyer: ${shareModal.buyerFirm}\nSupplier: ${shareModal.supplierFirm}\nStatus: ${shareModal.status}` }); } catch (e) {}
                  setShareModal(null);
                }}>📤 Share via App</button>
              )}
              <button style={{ ...styles.shareMenuBtn, backgroundColor: '#f1f5f9', border: 'none' }} onClick={() => setShareModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <div style={styles.sidebar}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
            <h2 style={{ color: 'white', margin: '0 0 20px 0', fontSize: 18 }}>Admin Hub</h2>
            {navTabs.map(tab => (
              <button key={tab.id} style={activeTab === tab.id ? styles.activeTab : styles.tab} onClick={() => setActiveTab(tab.id)}>
                <span style={{ marginRight: 8 }}>{tab.icon}</span>{tab.label}
                {tab.count > 0 && <span style={styles.sidebarBadge}>{tab.count}</span>}
              </button>
            ))}
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', width: '100%', borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 8 }} onClick={handleLogoutClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            Logout
          </button>
        </div>
      )}

      <div style={{ ...styles.main, paddingBottom: isMobile ? 80 : 20 }}>
        {/* Topbar */}
        <div style={styles.topBar}>
          <div>
            <span style={{ fontSize: 11, color: '#775a19', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Jain Agency</span>
            <h1 style={{ color: '#031632', margin: 0, fontSize: isMobile ? 16 : 20 }}>
              {navTabs.find(t => t.id === activeTab)?.label || 'Admin Control'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}
                style={{ width: 40, height: 40, borderRadius: 20, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#031632" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ba1a1a' }} />
                )}
              </button>
              {showNotifications && (
                <div style={{ position: 'absolute', top: 48, right: 0, width: 300, backgroundColor: 'white', borderRadius: 12, boxShadow: '0 8px 24px rgba(3,22,50,0.12)', zIndex: 100, overflow: 'hidden', border: '1px solid #e7e8e9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e7e8e9', backgroundColor: '#f8f9fa' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#031632' }}>Notifications</span>
                    <span style={{ fontSize: 12, color: '#44474d' }}>{notifications.length} total</span>
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '30px 16px', textAlign: 'center', color: '#44474d', fontSize: 13 }}>No notifications yet</div>
                  ) : (
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {notifications.slice(0, 20).map(n => (
                        <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 16px', borderBottom: '1px solid #e7e8e9', backgroundColor: n.read ? 'white' : '#f0f4ff' }}>
                          <span style={{ fontSize: 16, marginRight: 10 }}>
                            {n.type === 'new_order' ? '🛍️' : n.type === 'new_user' ? '👤' : '🔔'}
                          </span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 13, color: '#191c1d', lineHeight: 1.4 }}>{n.message}</p>
                            <p style={{ margin: '3px 0 0', fontSize: 11, color: '#44474d' }}>
                              {n.createdAt?.toDate?.()?.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#031632', flexShrink: 0 }} />}
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

        {/* Content */}
        {activeTab === 'analytics' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, padding: '16px' }}>
              {[
                { label: 'Total Orders', value: stats.totalOrders, color: '#031632' },
                { label: 'Pending Orders', value: stats.pendingOrders, color: '#e65100' },
                { label: 'Processing', value: stats.processingOrders, color: '#1565c0' },
                { label: 'Delivered', value: stats.deliveredOrders, color: '#1a6b3c' },
                { label: 'Active Buyers', value: stats.activeBuyers, color: '#6a1b9a' },
                { label: 'Active Suppliers', value: stats.activeSuppliers, color: '#c2185b' },
                { label: 'Pending Users', value: stats.pendingUsers, color: '#f57f17' },
                { label: 'Pending Products', value: stats.pendingProducts, color: '#ba1a1a' },
              ].map(s => (
                <div key={s.label} style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(3,22,50,0.06)', border: '1px solid #e7e8e9' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: '#44474d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                  <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</h2>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#031632' }}>Recent Orders</span>
                <button onClick={() => setActiveTab('orders')} style={{ fontSize: 12, color: '#775a19', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>View All →</button>
              </div>
              {[...orders]
                .sort((a, b) => (b.orderNumber || 0) - (a.orderNumber || 0))
                .slice(0, 5)
                .map(order => (
                  <div key={order.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e7e8e9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#031632', minWidth: 40 }}>
                        {order.orderNumber ? `#${order.orderNumber}` : `#${order.id.slice(-4).toUpperCase()}`}
                      </span>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, color: '#191c1d', fontWeight: 600 }}>{order.buyerFirm}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#44474d' }}>{order.supplierFirm}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {order.totalAmount > 0 && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#031632' }}>₹{order.totalAmount.toLocaleString('en-IN')}</span>
                      )}
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, backgroundColor: { 'Pending': '#fff3e0', 'Processing': '#e3f2fd', 'Delivered': '#e8f5e9', 'Cancelled': '#fce8e6', 'Shipped': '#f3e5f5' }[order.status] || '#f5f5f5', color: { 'Pending': '#e65100', 'Processing': '#1565c0', 'Delivered': '#1a6b3c', 'Cancelled': '#ba1a1a', 'Shipped': '#6a1b9a' }[order.status] || '#44474d' }}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))
              }
            </div>
          </>
        )}

        {activeTab === 'users' && (
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>User Management</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ ...styles.inputFull, maxWidth: 280 }} placeholder="Search..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              {['All', 'Buyer', 'Supplier'].map(f => (
                <button key={f} onClick={() => setUserFilter(f)} style={{ padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, backgroundColor: userFilter === f ? '#031632' : '#e2e8f0', color: userFilter === f ? 'white' : '#475569' }}>{f}</button>
              ))}
              <button onClick={exportUsersCSV} style={{ ...styles.btnApprove, marginLeft: 'auto' }}>⬇ Export CSV</button>
            </div>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead><tr>{['Role', 'Firm Name', 'City', 'Mobile', 'Status', 'Actions'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {sortedAndFilteredUsers.map(user => (
                    <tr key={user.id} style={styles.tr}>
                      <td style={styles.td}>{user.role?.toUpperCase()}</td>
                      <td style={styles.td}><b>{user.firmName}</b></td>
                      <td style={styles.td}>{user.city}</td>
                      <td style={styles.td}>{user.mobile}</td>
                      <td style={styles.td}>
                        <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, backgroundColor: user.status === 'approved' ? '#d1fae5' : '#fef9c3', color: user.status === 'approved' ? '#065f46' : '#854d0e' }}>{user.status}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button style={styles.btnEdit} onClick={() => setSelectedUser(user)}>Edit</button>
                          {user.status !== 'approved' && <button style={styles.btnApprove} onClick={() => updateUserStatus(user.id, 'approved')}>Approve</button>}
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

        {activeTab === 'products' && (
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>Catalog Management</h3>
            <input style={{ ...styles.inputFull, marginBottom: 15, maxWidth: 320 }} placeholder="Search..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead><tr>{['Product', 'Supplier', 'Price/MOQ', 'Status', 'Actions'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
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
                        {(() => { const pc = { approved: { bg: '#d1fae5', color: '#065f46' }, pending: { bg: '#fef9c3', color: '#854d0e' }, rejected: { bg: '#fce8e6', color: '#ba1a1a' }, 'Partially Dispatched': { bg: '#fff8e1', color: '#f57f17' } }[product.status] || { bg: '#f5f5f5', color: '#44474d' }; return <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, backgroundColor: pc.bg, color: pc.color }}>{product.status}</span>; })()}
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button style={styles.btnEdit} onClick={() => setEditingProduct({ ...product })}>Edit</button>
                          {product.status !== 'approved' && <button style={styles.btnApprove} onClick={() => updateProductStatus(product.id, 'approved')}>Approve</button>}
                          {product.status === 'pending' && (
                            <button onClick={() => handleRejectProduct(product.id)} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, backgroundColor: '#fce8e6', color: '#ba1a1a', border: '1px solid #f5c2c0', borderRadius: 6, cursor: 'pointer' }}>✕ Reject</button>
                          )}
                          <button onClick={() => handleDeleteProduct(product.id)} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, backgroundColor: '#f5f5f5', color: '#44474d', border: '1px solid #e0e0e0', borderRadius: 6, cursor: 'pointer' }}>🗑 Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ ...styles.inputFull, maxWidth: 280 }} placeholder="Search order, buyer..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['All', 'Pending', 'Processing', 'Shipped', 'Partially Dispatched', 'Delivered', 'Cancelled'].map(f => (
                  <button key={f} onClick={() => setOrderFilter(f)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, backgroundColor: orderFilter === f ? '#031632' : '#e2e8f0', color: orderFilter === f ? 'white' : '#475569' }}>{f}</button>
                ))}
              </div>
            </div>
            {displayOrders.map(order => (
              <div key={order.id} style={{ backgroundColor: 'white', borderRadius: 12, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 6px rgba(3,22,50,0.06)', border: '1px solid #e7e8e9' }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#031632' }}>
                    {order.orderNumber ? `#${order.orderNumber}` : `#${order.id.slice(-6).toUpperCase()}`}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#44474d' }}>
                      {order.createdAt?.toDate?.()?.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, backgroundColor: { 'Pending': '#fff3e0', 'Processing': '#e3f2fd', 'Delivered': '#e8f5e9', 'Cancelled': '#fce8e6', 'Shipped': '#f3e5f5', 'Partially Dispatched': '#fff8e1' }[order.status] || '#f5f5f5', color: { 'Pending': '#e65100', 'Processing': '#1565c0', 'Delivered': '#1a6b3c', 'Cancelled': '#ba1a1a', 'Shipped': '#6a1b9a', 'Partially Dispatched': '#f57f17' }[order.status] || '#44474d' }}>
                      {order.status}
                    </span>
                  </div>
                </div>
                {/* Middle row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#191c1d' }}>B: {order.buyerFirm}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#44474d' }}>
                      S: {order.supplierFirm} · {order.items?.length || 0} items{order.totalAmount > 0 ? ` · ₹${order.totalAmount.toLocaleString('en-IN')}` : ''}
                    </p>
                  </div>
                  {order.transportDetails?.name && (
                    <p style={{ margin: 0, fontSize: 12, color: '#44474d' }}>🚚 {order.transportDetails.name}</p>
                  )}
                </div>
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, backgroundColor: '#f8f9fa', color: '#031632', border: '1px solid #e7e8e9', borderRadius: 6, cursor: 'pointer' }}>
                    {expandedOrder === order.id ? 'Close' : 'Details →'}
                  </button>
                  <button onClick={() => openDeliveryModal(order)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, backgroundColor: '#031632', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Status</button>
                  <button onClick={() => setShareModal(order)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, backgroundColor: '#e8f0fe', color: '#1565c0', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Share</button>
                  <button onClick={() => handleDeleteOrder(order.id)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, backgroundColor: '#fce8e6', color: '#ba1a1a', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Delete</button>
                </div>
                {/* Expanded details */}
                {expandedOrder === order.id && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #e7e8e9', paddingTop: 12 }}>
                    {order.items?.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                        <span style={{ color: '#191c1d' }}>
                          {item.productName}{item.size ? ` · Size ${item.size}` : ''}{item.designNo ? ` · DN${item.designNo}` : ''}
                        </span>
                        <span style={{ color: '#031632', fontWeight: 600 }}>
                          {item.sets || item.quantity || item.orderedQty} {item.moqUnit || item.unit || 'Piece'} | Dispatched: <b style={{ color: '#1a6b3c' }}>{item.dispatchedQty || 0}</b>
                        </span>
                      </div>
                    ))}
                    {order.shipments?.length > 0 && (
                      <div style={{ marginTop: 10, borderTop: '1px solid #e7e8e9', paddingTop: 10 }}>
                        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#44474d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dispatch History</p>
                        {order.shipments.map((ship, sIdx) => (
                          <div key={sIdx} style={{ fontSize: 12, color: '#44474d', padding: '6px 10px', backgroundColor: '#f0fdf4', borderRadius: 6, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: '#1a6b3c' }}>Dispatch {sIdx + 1}</span>
                            {ship.billNo && ` · Bill: ${ship.billNo}`}
                            {ship.billDate && ` · Date: ${ship.billDate}`}
                            {ship.transport && ` · ${ship.transport}`}
                            {ship.lrNo && ` · LR: ${ship.lrNo}`}
                            <div style={{ marginTop: 4 }}>
                              {ship.items?.map((si, siIdx) => (
                                <span key={siIdx} style={{ marginRight: 12 }}>{si.productName}{si.size ? ` (${si.size})` : ''}: <b>{si.qty} {si.unit}</b></span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'categories' && (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {categoryRequests.length > 0 && (
              <div style={{ width: '100%', backgroundColor: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>🔔</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pending Approval</p>
                    <h3 style={{ margin: '2px 0 0', color: 'white', fontSize: 15, fontWeight: 800 }}>Category Requests ({categoryRequests.length})</h3>
                  </div>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {categoryRequests.map(req => (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', backgroundColor: '#fef9f9', borderRadius: 10, border: '1.5px solid #fecaca' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{req.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>
                          Requested by: {req.supplierFirm} · {req.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleApproveCategoryRequest(req)}
                        style={{ padding: '7px 14px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >✓ Approve</button>
                      <button
                        onClick={() => handleRejectCategoryRequest(req.id)}
                        style={{ padding: '7px 14px', backgroundColor: '#fce8e6', color: '#ef4444', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >✕ Reject</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TRANSPORTERS ── */}
            <div style={{ flex: '1 1 340px', backgroundColor: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #031632 0%, #1a2b48 100%)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Master List</p>
                  <h3 style={{ margin: '2px 0 0', color: 'white', fontSize: 16, fontWeight: 800 }}>Transporters ({transporters.length})</h3>
                </div>
                <button onClick={handleLoadDefaultTransporters} style={{ fontSize: 11, backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontWeight: 600 }}>
                  ⬇ Load Defaults
                </button>
              </div>

              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
                {!addingTransporter ? (
                  <>
                    <button
                      onClick={() => setAddingTransporter(true)}
                      style={{ width: '100%', padding: '10px', border: '1.5px dashed #cbd5e1', borderRadius: 8, backgroundColor: 'transparent', color: '#031632', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}
                    >
                      + Add New Transporter
                    </button>
                    <input
                      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#031632' }}
                      placeholder="🔍  Search transporters..."
                      value={transporterSearch || ''}
                      onChange={e => setTransporterSearch(e.target.value)}
                    />
                  </>
                ) : (
                  <form onSubmit={handleAddTransporter} style={{ backgroundColor: '#f8fafc', borderRadius: 10, padding: 14, border: '1.5px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#031632' }}>New Transporter</p>
                    <input
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8, color: '#031632' }}
                      placeholder="TRANSPORT NAME *"
                      value={newTransporterForm.name}
                      onChange={e => setNewTransporterForm({ ...newTransporterForm, name: e.target.value.toUpperCase() })}
                      autoFocus
                    />
                    <input
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8, color: '#031632' }}
                      placeholder="GST Number (Optional)"
                      value={newTransporterForm.gst}
                      onChange={e => setNewTransporterForm({ ...newTransporterForm, gst: e.target.value.toUpperCase() })}
                      maxLength={15}
                    />
                    <input
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 10, color: '#031632' }}
                      placeholder="Phone (Optional)"
                      type="tel"
                      maxLength={10}
                      value={newTransporterForm.phone}
                      onChange={e => setNewTransporterForm({ ...newTransporterForm, phone: e.target.value.replace(/\D/g, '') })}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => { setAddingTransporter(false); setNewTransporterForm({ name: '', gst: '', phone: '' }); }} style={{ flex: 1, padding: '9px', border: '1.5px solid #e2e8f0', borderRadius: 8, backgroundColor: 'white', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 8, backgroundColor: '#031632', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add Transporter</button>
                    </div>
                  </form>
                )}
              </div>

              <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 12px' }}>
                {transporters
                  .filter(t => !transporterSearch || t.name.toLowerCase().includes(transporterSearch.toLowerCase()))
                  .map(t => (
                    editingTransporter?.id === t.id ? (
                      <div key={t.id} style={{ padding: '10px', border: '1.5px solid #031632', borderRadius: 8, marginBottom: 4, backgroundColor: '#f8fafc' }}>
                        <input
                          style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, outline: 'none', marginBottom: 6, boxSizing: 'border-box' }}
                          value={editingTransporter.name}
                          onChange={e => setEditingTransporter({ ...editingTransporter, name: e.target.value.toUpperCase() })}
                          autoFocus
                          placeholder="Transport Name *"
                        />
                        <input
                          style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, outline: 'none', marginBottom: 6, boxSizing: 'border-box' }}
                          value={editingTransporter.gst || ''}
                          onChange={e => setEditingTransporter({ ...editingTransporter, gst: e.target.value.toUpperCase() })}
                          placeholder="GST (Optional)"
                          maxLength={15}
                        />
                        <input
                          style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
                          value={editingTransporter.phone || ''}
                          onChange={e => setEditingTransporter({ ...editingTransporter, phone: e.target.value.replace(/\D/g, '') })}
                          placeholder="Phone (Optional)"
                          type="tel"
                          maxLength={10}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={handleSaveTransporterEdit} style={{ flex: 1, padding: '7px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setEditingTransporter(null)} style={{ padding: '7px 10px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>✕</button>
                        </div>
                      </div>
                    ) : (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 8px', borderRadius: 8, borderBottom: '1px solid #f8fafc' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#031632' }}>{t.name[0]}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.name}</span>
                          {(t.gst || t.phone) && (
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>
                              {[t.gst, t.phone].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setEditingTransporter({ id: t.id, name: t.name, gst: t.gst || '', phone: t.phone || '' })} style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                          <button onClick={() => handleDeleteTransporter(t.id)} style={{ padding: '4px 8px', backgroundColor: '#fce8e6', color: '#ef4444', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                        </div>
                      </div>
                    )
                  ))}
              </div>
            </div>

            {/* ── CATEGORIES ── */}
            <div style={{ flex: '1 1 340px', backgroundColor: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #775a19 0%, #c49a2e 100%)', padding: '16px 20px' }}>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Master List</p>
                <h3 style={{ margin: '2px 0 0', color: 'white', fontSize: 16, fontWeight: 800 }}>Categories ({categories.length})</h3>
              </div>

              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
                {!addingCategory ? (
                  <button
                    onClick={() => setAddingCategory(true)}
                    style={{ width: '100%', padding: '10px', border: '1.5px dashed #cbd5e1', borderRadius: 8, backgroundColor: 'transparent', color: '#775a19', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Add New Category
                  </button>
                ) : (
                  <form onSubmit={handleAddCategory} style={{ backgroundColor: '#fef7e0', borderRadius: 10, padding: 14, border: '1.5px solid #f0d58c' }}>
                    <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#775a19' }}>New Category</p>
                    <input
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8, color: '#031632', backgroundColor: 'white' }}
                      placeholder="Category Name *"
                      value={newCategoryForm.name}
                      onChange={e => setNewCategoryForm({ ...newCategoryForm, name: e.target.value })}
                      autoFocus
                    />
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Template</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {[
                          { val: 'sets', label: '📦 Sets', desc: 'MOQ in Sets' },
                          { val: 'pieces', label: '🧵 Pieces', desc: 'MOQ in Pieces' },
                          { val: 'stitched', label: '✂️ Stitched', desc: 'Has sizes' },
                          { val: 'unstitched', label: '🪡 Unstitched', desc: 'No sizes' },
                          { val: 'running', label: '📏 Running', desc: 'Fabric by meter' },
                          { val: 'nighty', label: '🌙 Nighty', desc: 'Cut-based' },
                        ].map(opt => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setNewCategoryForm({ ...newCategoryForm, template: opt.val })}
                            style={{ padding: '6px 10px', border: `1.5px solid ${newCategoryForm.template === opt.val ? '#775a19' : '#e2e8f0'}`, borderRadius: 8, backgroundColor: newCategoryForm.template === opt.val ? '#775a19' : 'white', color: newCategoryForm.template === opt.val ? 'white' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            {opt.label}
                            <span style={{ display: 'block', fontSize: 10, opacity: 0.8, fontWeight: 400 }}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryForm({ name: '', template: 'sets' }); }} style={{ flex: 1, padding: '9px', border: '1.5px solid #e2e8f0', borderRadius: 8, backgroundColor: 'white', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 8, backgroundColor: '#775a19', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add Category</button>
                    </div>
                  </form>
                )}
              </div>

              <div style={{ padding: '0 20px 12px', borderBottom: '1px solid #e2e8f0' }}>
                <input
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#031632' }}
                  placeholder="🔍  Search categories..."
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                />
              </div>
              <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 12px' }}>
                {[...categories]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .filter(cat => !categorySearch || cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                  .map(cat => (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 8px', borderRadius: 8, borderBottom: '1px solid #f8fafc' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#fef7e0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#775a19' }}>{cat.name[0]}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{cat.name}</span>
                      {cat.template && <span style={{ marginLeft: 8, fontSize: 10, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: 10 }}>{cat.template}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setEditingCategory({ id: cat.id, name: cat.name, template: cat.template || 'sets' })} style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleDeleteCategory(cat.id)} style={{ padding: '4px 8px', backgroundColor: '#fce8e6', color: '#ef4444', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: '#031632', display: 'flex',
          paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 50,
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          {navTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '10px 0', border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer', minHeight: 56,
                position: 'relative',
              }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: 9, marginTop: 3, fontWeight: isActive ? 700 : 400, color: isActive ? '#fed488' : 'rgba(255,255,255,0.5)' }}>
                  {tab.label}
                </span>
                {tab.count > 0 && (
                  <span style={{ position: 'absolute', top: 6, right: '15%', backgroundColor: '#ef4444', color: 'white', fontSize: 8, fontWeight: 700, borderRadius: 10, padding: '1px 4px', minWidth: 14, textAlign: 'center' }}>
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, backgroundColor: '#fed488', borderRadius: 2 }} />
                )}
              </button>
            );
          })}
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
  main: { flex: 1, padding: 20, overflowY: 'auto' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, backgroundColor: 'white', padding: '14px 20px', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  iconBtn: { width: 40, height: 40, borderRadius: '50%', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  gridStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 },
  statCard: { backgroundColor: 'white', padding: 18, borderRadius: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  statLabel: { margin: 0, color: '#64748b', fontSize: 12 },
  statValue: { margin: '8px 0 0', color: '#0f172a', fontSize: 24 },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  tableWrapper: { overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' },
  table: { width: '100%', minWidth: 700, borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 },
  th: { padding: 12, borderBottom: '2px solid #e2e8f0', color: '#475569', whiteSpace: 'nowrap', fontWeight: 700 },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: 12, color: '#334155' },
  orderCard: { backgroundColor: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 8, overflow: 'hidden' },
  orderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', gap: 10, flexWrap: 'wrap' },
  orderBody: { padding: '12px 16px 16px', borderTop: '1px solid #f1f5f9', backgroundColor: '#fafafa' },
  btnApprove: { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnReject: { backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnEdit: { backgroundColor: '#64748b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnDelivery: { backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  btnShare: { backgroundColor: '#8b5cf6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  shareMenuBtn: { width: '100%', padding: 12, backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: 8, color: '#1e293b', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { backgroundColor: 'white', padding: 25, borderRadius: 16, width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' },
  inputFull: { padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, width: '100%', boxSizing: 'border-box', fontSize: 14, outline: 'none' },
};

export default AdminDashboard;