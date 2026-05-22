import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  collection, getDocs, doc, updateDoc, addDoc,
  deleteDoc, query, where, orderBy, onSnapshot, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';

const SIZES = ['M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const NIGHTY_CATEGORIES = ['Nighty', 'Nighty with Dupatta'];
const STITCHED_CATEGORIES = ['Kurti', 'Co-ord Set'];
const CHUDIDAR_CATEGORY = '3pc Chudidar';

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
  const [selectedUser, setSelectedUser] = useState(null);

  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('All');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [deliveryModal, setDeliveryModal] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    billNo: '', billDate: '', transport: '', lrNo: '', lrDate: '', sizeWise: {}
  });
  const [shareModal, setShareModal] = useState(null);

  // Responsive State
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const notifRef = useRef(null);
  const adminId = auth.currentUser?.uid;
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { fetchAllData(); }, []);

  // Global ESC — saare modals band
  useEffect(() => {
    const handler = (e) => {
      if(e.key === 'Escape' || e.type === 'closeModal') {
        setSelectedUser(null);
        setEditingProduct(null);
        setDeliveryModal(null);
        setShareModal(null);
        setShowNotifications(false);
      }
    };
    window.addEventListener('closeModal', handler);
    document.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('closeModal', handler);
      document.removeEventListener('keydown', handler);
    }
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
    } catch (err) { console.error("Data fetch error:", err); }
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

  const updateUserStatus = async (userId, newStatus) => {
    await updateDoc(doc(db, 'users', userId), { status: newStatus });
    setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    if (selectedUser?.id === userId) setSelectedUser(prev => ({ ...prev, status: newStatus }));
  };

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
      await updateDoc(doc(db, 'products', editingProduct.id), {
        imageUrl: updatedUrls[0] || '',
        imageUrls: updatedUrls,
      });
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
    try {
      const imageRef = ref(storage, urlToDelete);
      await deleteObject(imageRef);
    } catch (e) { /* ignore if not in storage */ }
    await updateDoc(doc(db, 'products', editingProduct.id), {
      imageUrl: updatedUrls[0] || '',
      imageUrls: updatedUrls,
    });
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
      category: editingProduct.category,
    };
    if (editingProduct.material !== undefined) updateData.material = editingProduct.material;
    if (editingProduct.cut !== undefined) updateData.cut = editingProduct.cut;
    if (editingProduct.sizes !== undefined) updateData.sizes = editingProduct.sizes;
    if (editingProduct.productType !== undefined) updateData.productType = editingProduct.productType;
    if (editingProduct.chudidarTopMaterial !== undefined) updateData.chudidarTopMaterial = editingProduct.chudidarTopMaterial;
    if (editingProduct.chudidarBottomMaterial !== undefined) updateData.chudidarBottomMaterial = editingProduct.chudidarBottomMaterial;
    if (editingProduct.chudidarDupattaMaterial !== undefined) updateData.chudidarDupattaMaterial = editingProduct.chudidarDupattaMaterial;
    await updateDoc(doc(db, 'products', editingProduct.id), updateData);
    setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...editingProduct } : p));
    setEditingProduct(null);
  };

  const openDeliveryModal = (order) => {
    setDeliveryModal(order);
    setDeliveryStatus(order.status || 'Pending');
    const sizeWise = {};
    order.items?.forEach(item => {
      if (item.size) sizeWise[item.size] = item.quantity || 0;
    });
    setPaymentForm({
      billNo: order.billNo || '',
      billDate: order.billDate || '',
      transport: order.transport || '',
      lrNo: order.lrNo || '',
      lrDate: order.lrDate || '',
      sizeWise
    });
  };

  const saveDelivery = async () => {
    if (!deliveryModal) return;
    const needsPaymentInfo = deliveryStatus === 'Paid' || deliveryStatus === 'Part Paid';
    const updateData = {
      status: needsPaymentInfo ? (deliveryStatus === 'Paid' ? 'Delivered' : 'Processing') : deliveryStatus,
      paymentStatus: deliveryStatus === 'Paid' ? 'Cleared' : deliveryStatus === 'Part Paid' ? 'Advance Received' : deliveryModal.paymentStatus || 'Unpaid',
    };
    if (needsPaymentInfo) {
      updateData.billNo = paymentForm.billNo;
      updateData.billDate = paymentForm.billDate;
      updateData.transport = paymentForm.transport;
      updateData.lrNo = paymentForm.lrNo;
      updateData.lrDate = paymentForm.lrDate;
      updateData.sizeWisePayment = paymentForm.sizeWise;
    }
    await updateDoc(doc(db, 'orders', deliveryModal.id), updateData);
    setOrders(orders.map(o => o.id === deliveryModal.id ? { ...o, ...updateData } : o));
    setDeliveryModal(null);
  };

  const markFullPaid = async () => {
    const updateData = {
      paymentStatus: 'Cleared',
      billNo: paymentForm.billNo,
      billDate: paymentForm.billDate,
      transport: paymentForm.transport,
      lrNo: paymentForm.lrNo,
      lrDate: paymentForm.lrDate,
      sizeWisePayment: paymentForm.sizeWise,
    };
    await updateDoc(doc(db, 'orders', deliveryModal.id), updateData);
    setOrders(orders.map(o => o.id === deliveryModal.id ? { ...o, ...updateData } : o));
    setDeliveryModal(null);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const docRef = await addDoc(collection(db, 'categories'), { name: newCategoryName.trim() });
    setCategories([...categories, { id: docRef.id, name: newCategoryName.trim() }]);
    setNewCategoryName('');
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm("Delete this category?")) return;
    await deleteDoc(doc(db, 'categories', catId));
    setCategories(categories.filter(c => c.id !== catId));
  };

  const generateOrderText = (order) => {
    const items = order.items?.map(i =>
      i.sets ? `  • ${i.productName} DN${i.designNo || ''} ${i.dnNumber ? `(${i.dnNumber})` : ''} — ${i.sets} sets = ${i.pcs} pcs @ ₹${i.price}/pc`
             : `  • ${i.productName}${i.size ? ` (Size: ${i.size})` : ''} — ${i.quantity} ${i.unit} @ ₹${i.price}/pc`
    ).join('\n') || '';
    const sizeWiseText = order.sizeWisePayment
      ? '\nSize-wise:\n' + Object.entries(order.sizeWisePayment).map(([s, q]) => `  ${s}: ${q}`).join('\n') : '';
    return `
================================================================
                    JAIN AGENCY — ORDER DETAILS
================================================================
Order ID  : ${order.id}
Date      : ${order.createdAt?.toDate?.()?.toLocaleDateString() || ''}
Buyer     : ${order.buyerFirm}
Supplier  : ${order.supplierFirm}
----------------------------------------------------------------
ITEMS:
${items}
${order.nightyDetails ? `\nPacking: ${order.nightyDetails.totalSets} sets | ${order.nightyDetails.packingType} sets/bale | ${order.nightyDetails.totalBales} bale(s)` : ''}
----------------------------------------------------------------
Delivery Status : ${order.status || 'Pending'}
Payment Status  : ${order.paymentStatus || 'Unpaid'}
${order.billNo ? `Bill No   : ${order.billNo}` : ''}
${order.billDate ? `Bill Date : ${order.billDate}` : ''}
${order.transport ? `Transport : ${order.transport}` : ''}
${order.lrNo ? `LR No     : ${order.lrNo}` : ''}
${order.lrDate ? `LR Date   : ${order.lrDate}` : ''}
${sizeWiseText}
================================================================`.trim();
  };

  const downloadOrder = (order) => {
    const blob = new Blob([generateOrderText(order)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Order_${order.id.slice(0, 8)}_${order.buyerFirm}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (order) => {
    navigator.clipboard.writeText(generateOrderText(order));
    alert('Copied to clipboard!');
  };

  const shareViaApp = async (order) => {
    if (navigator.share) {
      try { await navigator.share({ title: `Order #${order.id.slice(0, 8)}`, text: generateOrderText(order) }); }
      catch (e) { }
    }
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
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const filteredUsers = users.filter(u => u.role !== 'admin').filter(u =>
    u.firmName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.mobile?.includes(userSearch) ||
    u.role?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.supplierFirm?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.material?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.status?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredOrders = orders.filter(o => {
    const matchSearch =
      o.id?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.buyerFirm?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.supplierFirm?.toLowerCase().includes(orderSearch.toLowerCase());
    const matchFilter =
      orderFilter === 'All' ? true :
      orderFilter === 'Paid' ? o.paymentStatus === 'Cleared' :
      orderFilter === 'Part Paid' ? o.paymentStatus === 'Advance Received' :
      orderFilter === 'Unpaid' ? (!o.paymentStatus || o.paymentStatus === 'Unpaid') : true;
    return matchSearch && matchFilter;
  });

  const paymentBadge = (order) => {
    if (order.paymentStatus === 'Cleared') return { label: 'Paid', bg: '#d1fae5', color: '#065f46' };
    if (order.paymentStatus === 'Advance Received') return { label: 'Part Paid', bg: '#dbeafe', color: '#1e40af' };
    return { label: 'Unpaid', bg: '#fee2e2', color: '#991b1b' };
  };

  const deliveryBadge = (order) => {
    if (order.status === 'Delivered') return { bg: '#d1fae5', color: '#065f46' };
    if (order.status === 'Cancelled') return { bg: '#fee2e2', color: '#991b1b' };
    if (order.status === 'Shipped') return { bg: '#dbeafe', color: '#1e40af' };
    if (order.status === 'Processing') return { bg: '#ede9fe', color: '#5b21b6' };
    return { bg: '#fef9c3', color: '#854d0e' };
  };

  const hasSizeItems = (order) => order.items?.some(i => i.size);
  const needsPaymentForm = deliveryStatus === 'Paid' || deliveryStatus === 'Part Paid';

  const toggleEditSize = (size) => {
    const current = editingProduct.sizes || [];
    setEditingProduct({ ...editingProduct, sizes: current.includes(size) ? current.filter(s => s !== size) : [...current, size] });
  };

  const getProductImages = (product) => {
    if (!product) return [];
    if (product.imageUrls && Array.isArray(product.imageUrls)) {
      return product.imageUrls.map(u => typeof u === 'string' ? u : u.url).filter(Boolean);
    }
    if (product.imageUrl) return [product.imageUrl];
    return [];
  };

  // Nav Items Data
  const navTabs = [
    { id: 'analytics', label: 'Dashboard', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg> },
    { id: 'users', label: 'Users', count: stats.pendingUsers, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: 'products', label: 'Products', count: stats.pendingProducts, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
    { id: 'orders', label: 'Orders', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
    { id: 'categories', label: 'Settings', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  ];

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading System Data...</div>;

  return (
    <div style={styles.container}>

      {/* ── SIDEBAR (Only visible on Desktop) ── */}
      {!isMobile && (
        <div style={styles.sidebar}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
            <h2 style={{ color: 'white', margin: '0 0 20px 0' }}>Admin Hub</h2>
            {navTabs.map(tab => (
              <button key={tab.id} style={activeTab === tab.id ? styles.activeTab : styles.tab} onClick={() => setActiveTab(tab.id)}>
                {tab.label} {tab.count > 0 && <span style={styles.sidebarBadge}>{tab.count}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── MAIN ── */}
      <div style={styles.main}>

        {/* TOP BAR */}
        <div style={styles.topBar}>
          <div>
            <span style={{ fontSize: '11px', color: '#775a19', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Jain Agency</span>
            <h1 style={{ color: '#031632', margin: 0, fontSize: '20px' }}>Admin Control</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={styles.bellWrapper} ref={notifRef}>
              <button style={styles.bellBtn} onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#031632" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {unreadCount > 0 && <span style={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
              {showNotifications && (
                <div style={styles.notifDropdown}>
                  <div style={styles.notifHeader}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Notifications</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{notifications.length} total</span>
                  </div>
                  {notifications.length === 0 ? (
                    <div style={styles.notifEmpty}>No notifications yet</div>
                  ) : (
                    <div style={styles.notifList}>
                      {notifications.slice(0, 20).map(n => (
                        <div key={n.id} style={{ ...styles.notifItem, backgroundColor: n.read ? 'white' : '#eff6ff' }}>
                          <span style={{ fontSize: '18px', marginRight: '10px' }}>{notifIcon(n.type)}</span>
                          <div style={{ flex: 1 }}>
                            <p style={styles.notifMsg}>{n.message}</p>
                            <p style={styles.notifTime}>{formatTime(n.createdAt)}</p>
                          </div>
                          {!n.read && <span style={styles.unreadDot} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Universal Logout Button */}
            <button style={styles.iconBtn} onClick={handleLogoutClick} title="Logout">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" strokeWidth="2.5"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            </button>
          </div>
        </div>

        {/* ── ANALYTICS ── */}
        {activeTab === 'analytics' && (
          <div style={styles.gridStats}>
            <div style={styles.statCard}><p style={styles.statLabel}>Total Orders</p><h2 style={styles.statValue}>{stats.totalOrders}</h2></div>
            <div style={styles.statCard}><p style={styles.statLabel}>Pending Orders</p><h2 style={{ ...styles.statValue, color: '#f59e0b' }}>{stats.pendingOrders}</h2></div>
            <div style={styles.statCard}><p style={styles.statLabel}>Processing</p><h2 style={{ ...styles.statValue, color: '#3b82f6' }}>{stats.processingOrders}</h2></div>
            <div style={styles.statCard}><p style={styles.statLabel}>Delivered</p><h2 style={{ ...styles.statValue, color: '#10b981' }}>{stats.deliveredOrders}</h2></div>
            <div style={styles.statCard}><p style={styles.statLabel}>Active Buyers</p><h2 style={styles.statValue}>{stats.activeBuyers}</h2></div>
            <div style={styles.statCard}><p style={styles.statLabel}>Active Suppliers</p><h2 style={styles.statValue}>{stats.activeSuppliers}</h2></div>
            <div style={styles.statCard}><p style={styles.statLabel}>Pending Users</p><h2 style={{ ...styles.statValue, color: '#ef4444' }}>{stats.pendingUsers}</h2></div>
            <div style={styles.statCard}><p style={styles.statLabel}>Pending Products</p><h2 style={{ ...styles.statValue, color: '#ef4444' }}>{stats.pendingProducts}</h2></div>
          </div>
        )}

        {/* ── USERS ── */}
        {activeTab === 'users' && (
          <div style={styles.card}>
            <h3>Global User Management</h3>
            <input style={{ ...styles.inputFull, marginBottom: '15px', maxWidth: '320px' }}
              placeholder="Search by firm, mobile, role..."
              value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            
            {/* Scrollable Table Wrapper */}
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Firm</th>
                    <th style={styles.th}>Role</th>
                    <th style={styles.th}>Contact</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.id} style={styles.tr}>
                      <td style={styles.td}>
                        <b style={{ cursor: 'pointer', color: '#3b82f6' }} onClick={() => setSelectedUser(user)}>{user.firmName}</b>
                      </td>
                      <td style={styles.td}>{user.role?.toUpperCase()}</td>
                      <td style={styles.td}>{user.mobile}</td>
                      <td style={styles.td}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                          backgroundColor: user.status === 'approved' ? '#d1fae5' : user.status === 'blocked' ? '#fee2e2' : '#fef9c3',
                          color: user.status === 'approved' ? '#065f46' : user.status === 'blocked' ? '#991b1b' : '#854d0e'
                        }}>{user.status || 'pending'}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {user.status !== 'approved' && <button style={styles.btnApprove} onClick={() => updateUserStatus(user.id, 'approved')}>Approve</button>}
                          {user.status !== 'pending' && <button style={styles.btnPending} onClick={() => updateUserStatus(user.id, 'pending')}>Pending</button>}
                          {user.status !== 'blocked' && <button style={styles.btnReject} onClick={() => updateUserStatus(user.id, 'blocked')}>Block</button>}
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
            <h3>Global Catalog Management</h3>
            <input style={{ ...styles.inputFull, marginBottom: '15px', maxWidth: '320px' }}
              placeholder="Search by name, category, supplier, material..."
              value={productSearch} onChange={e => setProductSearch(e.target.value)} />
            
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Product</th>
                    <th style={styles.th}>Supplier</th>
                    <th style={styles.th}>Price/MOQ</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (
                    <tr key={product.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {product.imageUrl && (
                            <img src={product.imageUrl} alt="" style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                          )}
                          <div>
                            <b style={{ fontSize: '14px' }}>{product.name}</b>
                            <br /><span style={{ fontSize: '12px', color: '#64748b' }}>{product.category}</span>
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>{product.supplierFirm}</td>
                      <td style={styles.td} style={{ whiteSpace: 'nowrap' }}>₹{product.price} / {product.moq} {product.unit}</td>
                      <td style={styles.td}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                          backgroundColor: product.status === 'approved' ? '#d1fae5' : product.status === 'delisted' ? '#fee2e2' : '#fef9c3',
                          color: product.status === 'approved' ? '#065f46' : product.status === 'delisted' ? '#991b1b' : '#854d0e'
                        }}>{product.status || 'pending'}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button style={styles.btnEdit} onClick={() => setEditingProduct({ ...product })}>Edit</button>
                          {product.status !== 'approved' && <button style={styles.btnApprove} onClick={() => updateProductStatus(product.id, 'approved')}>Live</button>}
                          {product.status !== 'pending' && <button style={styles.btnPending} onClick={() => updateProductStatus(product.id, 'pending')}>Pending</button>}
                          {product.status !== 'delisted' && <button style={styles.btnReject} onClick={() => updateProductStatus(product.id, 'delisted')}>Delist</button>}
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
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ ...styles.inputFull, maxWidth: '280px' }}
                placeholder="Search order, buyer, supplier..."
                value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
              {['All', 'Unpaid', 'Part Paid', 'Paid'].map(f => (
                <button key={f} onClick={() => setOrderFilter(f)}
                  style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                    backgroundColor: orderFilter === f ? '#1a1a2e' : '#e2e8f0',
                    color: orderFilter === f ? 'white' : '#475569' }}>
                  {f}
                </button>
              ))}
            </div>

            {filteredOrders.map(order => {
              const pb = paymentBadge(order);
              const db2 = deliveryBadge(order);
              const isExpanded = expandedOrder === order.id;
              return (
                <div key={order.id} style={styles.orderCard}>
                  <div style={styles.orderRow} onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>#{order.id.slice(0, 8)}</span>
                      <span style={{ fontSize: '13px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        B: {order.buyerFirm} &nbsp;|&nbsp; S: {order.supplierFirm}
                      </span>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>{order.createdAt?.toDate?.()?.toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: db2.bg, color: db2.color }}>{order.status || 'Pending'}</span>
                      <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: pb.bg, color: pb.color }}>{pb.label}</span>
                      <button style={styles.btnDelivery} onClick={e => { e.stopPropagation(); openDeliveryModal(order); }}>Status</button>
                      <button style={styles.btnShare} onClick={e => { e.stopPropagation(); setShareModal(order); }}>Share</button>
                      <span style={{ color: '#94a3b8', fontSize: '16px' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={styles.orderBody}>
                      <div style={{ display: 'flex', gap: '30px', fontSize: '14px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <span><b>Buyer:</b> {order.buyerFirm}</span>
                        <span><b>Supplier:</b> {order.supplierFirm}</span>
                      </div>
                      <b style={{ fontSize: '13px', color: '#475569' }}>Items:</b>
                      {order.items?.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
                          {item.photoUrl && <img src={item.photoUrl} alt="" style={{ width: '35px', height: '35px', objectFit: 'cover', borderRadius: '4px' }} />}
                          <span style={{ fontSize: '13px' }}>
                            {item.productName}
                            {item.size ? ` (Size: ${item.size})` : ''}
                            {item.designNo ? ` DN${item.designNo}` : ''}
                            {item.dnNumber ? ` (${item.dnNumber})` : ''}
                            {' — '}
                            {item.sets ? `${item.sets} sets = ${item.pcs} pcs` : `${item.quantity} ${item.unit}`}
                            {' — ₹'}{item.price}/pc
                          </span>
                        </div>
                      ))}
                      {order.nightyDetails && (
                        <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#475569' }}>
                          <b>Packing:</b> {order.nightyDetails.totalSets} sets | {order.nightyDetails.packingType} sets/bale | {order.nightyDetails.totalBales} bale(s)
                        </p>
                      )}
                      {order.billNo && (
                        <div style={{ marginTop: '10px', fontSize: '13px', color: '#475569', display: 'flex', gap: '20px', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                          {order.billNo && <span><b>Bill No:</b> {order.billNo}</span>}
                          {order.billDate && <span><b>Bill Date:</b> {order.billDate}</span>}
                          {order.transport && <span><b>Transport:</b> {order.transport}</span>}
                          {order.lrNo && <span><b>LR No:</b> {order.lrNo}</span>}
                          {order.lrDate && <span><b>LR Date:</b> {order.lrDate}</span>}
                        </div>
                      )}
                      {order.sizeWisePayment && Object.keys(order.sizeWisePayment).length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '13px', color: '#475569' }}>
                          <b>Size-wise:</b> {Object.entries(order.sizeWisePayment).map(([s, q]) => `${s}: ${q}`).join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── SYSTEM SETTINGS ── */}
        {activeTab === 'categories' && (
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ ...styles.card, flex: '1 1 300px' }}>
              <h3>Manage Categories</h3>
              <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input style={styles.inputFull} value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New Category Name" />
                <button type="submit" style={styles.btnApprove}>Add</button>
              </form>
              <ul style={{ padding: 0, listStyle: 'none' }}>
                {categories.map(cat => (
                  <li key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #eee' }}>
                    {cat.name}
                    <button style={styles.btnReject} onClick={() => handleDeleteCategory(cat.id)}>Delete</button>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ ...styles.card, flex: '1 1 300px' }}>
              <h3>System Info</h3>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5' }}>
                Warning: Deleting a category will not delete existing products in that category, but it will remove it from Supplier upload options. Ensure you notify suppliers before making structural changes.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <div style={styles.bottomNav}>
          {navTabs.map(tab => (
            <button key={tab.id} style={activeTab === tab.id ? styles.bottomNavBtnActive : styles.bottomNavBtn} onClick={() => setActiveTab(tab.id)}>
              <div style={{ position: 'relative' }}>
                {tab.icon}
                {tab.count > 0 && <span style={styles.bottomNavBadge}>{tab.count > 99 ? '99+' : tab.count}</span>}
              </div>
              <span style={{ fontSize: '10px', marginTop: '2px', fontWeight: activeTab === tab.id ? 700 : 500 }}>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── USER DETAIL MODAL ── */}
      {selectedUser && (
        <div style={styles.modalOverlay} onClick={() => setSelectedUser(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{selectedUser.firmName}</h3>
            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
              <p><b>Role:</b> {selectedUser.role?.toUpperCase()}</p>
              <p><b>GST:</b> {selectedUser.gstNumber}</p>
              <p><b>Contact:</b> {selectedUser.contactPerson}</p>
              <p><b>Mobile:</b> {selectedUser.mobile}</p>
              <p><b>Email:</b> {selectedUser.email}</p>
              <p><b>Address:</b> {selectedUser.address}, {selectedUser.city}, {selectedUser.district}, {selectedUser.state} - {selectedUser.pincode}</p>
              <p><b>Status:</b> <span style={{ fontWeight: 'bold', color: selectedUser.status === 'approved' ? '#065f46' : '#991b1b' }}>{selectedUser.status}</span></p>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
              {selectedUser.status !== 'approved' && <button style={styles.btnApprove} onClick={() => updateUserStatus(selectedUser.id, 'approved')}>Approve</button>}
              {selectedUser.status !== 'pending' && <button style={styles.btnPending} onClick={() => updateUserStatus(selectedUser.id, 'pending')}>Pending</button>}
              {selectedUser.status !== 'blocked' && <button style={styles.btnReject} onClick={() => updateUserStatus(selectedUser.id, 'blocked')}>Block</button>}
              <button style={styles.btnEdit} onClick={() => setSelectedUser(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCT EDIT MODAL ── */}
      {editingProduct && (
        <div style={styles.modalOverlay} onClick={() => setEditingProduct(null)}>
          <div style={{ ...styles.modal, maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit — {editingProduct.name}</h3>

            {/* Images */}
            <label style={styles.label}>Photos</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {getProductImages(editingProduct).map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={url} alt="" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '6px' }} />
                  <button onClick={() => handleDeleteProductImage(url)}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              ))}
            </div>
            <input type="file" accept="image/*" multiple style={styles.inputFull}
              onChange={e => handleProductImageUpload(e.target.files)} />
            {uploadingImage && <p style={{ color: '#f59e0b', fontSize: '12px' }}>Uploading...</p>}

            <label style={styles.label}>Product Name</label>
            <input style={styles.inputFull} value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} />

            <label style={styles.label}>Category</label>
            <select style={styles.inputFull} value={editingProduct.category} onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={styles.label}>Price (₹)</label>
                <input style={styles.inputFull} type="number" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>MOQ</label>
                <input style={styles.inputFull} type="number" value={editingProduct.moq} onChange={e => setEditingProduct({ ...editingProduct, moq: e.target.value })} />
              </div>
            </div>

            <label style={styles.label}>Unit</label>
            <select style={styles.inputFull} value={editingProduct.unit} onChange={e => setEditingProduct({ ...editingProduct, unit: e.target.value })}>
              <option value="sets">Sets</option>
              <option value="pieces">Pieces</option>
              <option value="meters">Meters</option>
              <option value="kg">KG</option>
              <option value="yards">Yards</option>
            </select>

            <label style={styles.label}>Description</label>
            <textarea style={{ ...styles.inputFull, height: '60px' }} value={editingProduct.description || ''} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} />

            {NIGHTY_CATEGORIES.includes(editingProduct.category) && (
              <>
                <label style={styles.label}>Cut</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['2/70', '2/90', '3/20'].map(cut => (
                    <button key={cut} type="button"
                      style={{ padding: '6px 14px', border: '2px solid', borderColor: editingProduct.cut === cut ? '#1a1a2e' : '#ddd', borderRadius: '6px', cursor: 'pointer', backgroundColor: editingProduct.cut === cut ? '#1a1a2e' : 'white', color: editingProduct.cut === cut ? 'white' : '#333' }}
                      onClick={() => setEditingProduct({ ...editingProduct, cut })}>
                      {cut}
                    </button>
                  ))}
                </div>
              </>
            )}

            {(STITCHED_CATEGORIES.includes(editingProduct.category) || editingProduct.category === CHUDIDAR_CATEGORY) && (
              <>
                <label style={styles.label}>Material</label>
                <input style={styles.inputFull} value={editingProduct.material || ''} onChange={e => setEditingProduct({ ...editingProduct, material: e.target.value })} placeholder="Material" />
                <label style={styles.label}>Sizes</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {SIZES.map(size => (
                    <button key={size} type="button"
                      style={{ padding: '5px 10px', border: '2px solid', borderColor: (editingProduct.sizes || []).includes(size) ? '#e63946' : '#ddd', borderRadius: '6px', cursor: 'pointer', backgroundColor: (editingProduct.sizes || []).includes(size) ? '#e63946' : 'white', color: (editingProduct.sizes || []).includes(size) ? 'white' : '#333', fontSize: '13px' }}
                      onClick={() => toggleEditSize(size)}>
                      {size}
                    </button>
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

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={styles.btnApprove} onClick={saveProductEdit} disabled={uploadingImage}>Save Changes</button>
              <button style={styles.btnEdit} onClick={() => setEditingProduct(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELIVERY / PAYMENT STATUS MODAL ── */}
      {deliveryModal && (
        <div style={styles.modalOverlay} onClick={() => setDeliveryModal(null)}>
          <div style={{ ...styles.modal, maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Update Status — #{deliveryModal.id.slice(0, 8)}</h3>

            <label style={styles.label}>Delivery / Payment Status</label>
            <select style={styles.inputFull} value={deliveryStatus} onChange={e => setDeliveryStatus(e.target.value)}>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Paid">Paid</option>
              <option value="Part Paid">Part Paid</option>
            </select>

            {needsPaymentForm && (
              <div style={{ marginTop: '15px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: 'bold', fontSize: '13px', color: '#475569' }}>Payment Details</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={styles.label}>Bill No</label>
                    <input style={styles.inputFull} value={paymentForm.billNo} onChange={e => setPaymentForm({ ...paymentForm, billNo: e.target.value })} placeholder="Bill No" />
                  </div>
                  <div>
                    <label style={styles.label}>Bill Date</label>
                    <input style={styles.inputFull} type="date" value={paymentForm.billDate} onChange={e => setPaymentForm({ ...paymentForm, billDate: e.target.value })} />
                  </div>
                  <div>
                    <label style={styles.label}>Transport</label>
                    <input style={styles.inputFull} value={paymentForm.transport} onChange={e => setPaymentForm({ ...paymentForm, transport: e.target.value })} placeholder="Transport name" />
                  </div>
                  <div>
                    <label style={styles.label}>LR No</label>
                    <input style={styles.inputFull} value={paymentForm.lrNo} onChange={e => setPaymentForm({ ...paymentForm, lrNo: e.target.value })} placeholder="LR No" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={styles.label}>LR Date</label>
                    <input style={{ ...styles.inputFull, maxWidth: '200px' }} type="date" value={paymentForm.lrDate} onChange={e => setPaymentForm({ ...paymentForm, lrDate: e.target.value })} />
                  </div>
                </div>

                {hasSizeItems(deliveryModal) && (
                  <div style={{ marginTop: '12px' }}>
                    <label style={styles.label}>Size-wise Quantity</label>
                    {deliveryModal.items?.filter(i => i.size).map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '13px' }}>{item.productName} — Size {item.size}</span>
                        <input type="number"
                          style={{ width: '80px', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                          value={paymentForm.sizeWise[item.size] ?? item.quantity}
                          onChange={e => setPaymentForm({ ...paymentForm, sizeWise: { ...paymentForm.sizeWise, [item.size]: e.target.value } })}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {deliveryStatus === 'Part Paid' && (
                  <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fffbeb', borderRadius: '6px', border: '1px solid #fcd34d' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#92400e' }}>Mark as completely paid?</p>
                    <button style={{ ...styles.btnApprove, fontSize: '13px' }} onClick={markFullPaid}>✓ Mark Full Paid</button>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={styles.btnApprove} onClick={saveDelivery}>Save</button>
              <button style={styles.btnEdit} onClick={() => setDeliveryModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHARE MODAL ── */}
      {shareModal && (
        <div style={styles.modalOverlay} onClick={() => setShareModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Share Order #{shareModal.id.slice(0, 8)}</h3>
            <p style={{ color: '#64748b', fontSize: '14px' }}>Choose how to share:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              <button style={{ ...styles.btnApprove, padding: '12px', fontSize: '14px' }} onClick={() => { downloadOrder(shareModal); setShareModal(null); }}>
                📥 Download as File
              </button>
              <button style={{ ...styles.btnEdit, padding: '12px', fontSize: '14px' }} onClick={() => { copyToClipboard(shareModal); setShareModal(null); }}>
                📋 Copy to Clipboard
              </button>
              {navigator.share && (
                <button style={{ ...styles.btnDelivery, padding: '12px', fontSize: '14px' }} onClick={() => { shareViaApp(shareModal); setShareModal(null); }}>
                  📤 Share via App (WhatsApp etc.)
                </button>
              )}
              <button style={{ ...styles.btnReject, padding: '12px', fontSize: '14px' }} onClick={() => setShareModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  container: { display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', overflow: 'hidden' },
  sidebar: { width: '220px', backgroundColor: '#031632', padding: '20px', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', boxSizing: 'border-box' },
  tab: { padding: '12px 15px', backgroundColor: 'transparent', color: '#94a3b8', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '14px', marginBottom: '4px', display: 'block', width: '100%' },
  activeTab: { padding: '12px 15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', display: 'block', width: '100%' },
  sidebarBadge: { backgroundColor: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold', borderRadius: '10px', padding: '2px 6px', marginLeft: '6px' },
  main: { flex: 1, padding: '20px', overflowY: 'auto', paddingBottom: '80px' }, // Bottom padding added for mobile nav
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', backgroundColor: 'white', padding: '15px 20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  iconBtn: { width: '40px', height: '40px', borderRadius: '50%', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  bellWrapper: { position: 'relative' },
  bellBtn: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold', borderRadius: '10px', padding: '2px 5px', minWidth: '16px', textAlign: 'center' },
  notifDropdown: { position: 'absolute', top: '50px', right: 0, width: '300px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', zIndex: 1000, overflow: 'hidden', border: '1px solid #e2e8f0' },
  notifHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' },
  notifList: { maxHeight: '350px', overflowY: 'auto' },
  notifEmpty: { padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' },
  notifItem: { display: 'flex', alignItems: 'flex-start', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' },
  notifMsg: { margin: 0, fontSize: '13px', color: '#1e293b', lineHeight: '1.4' },
  notifTime: { margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' },
  unreadDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '4px', flexShrink: 0 },
  gridStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' },
  statCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  statLabel: { margin: 0, color: '#64748b', fontSize: '13px' },
  statValue: { margin: '10px 0 0 0', color: '#0f172a', fontSize: '24px' },
  card: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  tableWrapper: { overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }, // Added for Responsive Tables
  table: { width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
  th: { padding: '12px', borderBottom: '2px solid #e2e8f0', color: '#475569' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px', color: '#1e293b' },
  orderCard: { backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '8px', overflow: 'hidden' },
  orderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', gap: '10px', flexWrap: 'wrap' },
  orderBody: { padding: '12px 16px 16px', borderTop: '1px solid #f1f5f9', backgroundColor: '#fafafa' },
  btnApprove: { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' },
  btnPending: { backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' },
  btnReject: { backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' },
  btnEdit: { backgroundColor: '#6366f1', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' },
  btnDelivery: { backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  btnShare: { backgroundColor: '#8b5cf6', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modal: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '420px', boxShadow: '0 20px 25px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' },
  label: { fontSize: '12px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px', marginTop: '10px' },
  inputFull: { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%', boxSizing: 'border-box', fontSize: '14px' },
  
  // Mobile Bottom Nav Styles
  bottomNav: { position: 'fixed', bottom: 0, left: 0, width: '100%', display: 'flex', backgroundColor: 'white', borderTop: '1px solid #e2e8f0', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -2px 10px rgba(0,0,0,0.05)' },
  bottomNavBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0', border: 'none', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer', minHeight: '56px' },
  bottomNavBtnActive: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0', border: 'none', backgroundColor: 'transparent', color: '#031632', cursor: 'pointer', minHeight: '56px' },
  bottomNavBadge: { position: 'absolute', top: '-4px', right: '-8px', backgroundColor: '#ef4444', color: 'white', fontSize: '9px', fontWeight: 700, borderRadius: '20px', padding: '1px 5px', minWidth: '14px', textAlign: 'center' },
};

export default AdminDashboard;