import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  collection, getDocs, doc, updateDoc, addDoc,
  deleteDoc, query, where, orderBy, onSnapshot, writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';

import AdminEditUserModal from '../../components/admin/AdminEditUserModal';
import AdminCategoryModal from '../../components/admin/AdminCategoryModal';
import AdminEditProductModal from '../../components/admin/AdminEditProductModal';
import AdminDeliveryModal from '../../components/admin/AdminDeliveryModal';
import { generateAdminOrderPDF } from '../../utils/adminPdfExport';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [notifications, setNotifications] = useState([]);
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
  const [shippingForm, setShippingForm] = useState({ billNo: '', billDate: '', transport: '', lrNo: '', lrDate: '', dispatchItems: [] });
  const [editingCategory, setEditingCategory] = useState(null);
  const [shareModal, setShareModal] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const adminId = auth.currentUser?.uid;
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!adminId) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', adminId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubscribe();
  }, [adminId]);

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [usersSnap, productsSnap, ordersSnap, catsSnap] = await Promise.all([
        getDocs(collection(db, 'users')), getDocs(collection(db, 'products')),
        getDocs(collection(db, 'orders')), getDocs(collection(db, 'categories'))
      ]);
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCategories(catsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error('Data fetch error:', err); }
    setLoading(false);
  };

  const handleLogoutClick = () => {
    if (window.confirm('Are you sure you want to logout?')) signOut(auth).then(() => navigate('/'));
  };

  // ── User Actions ──
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
      const batch = writeBatch(db);
      if (role === 'supplier') {
        const prodSnap = await getDocs(query(collection(db, 'products'), where('supplierId', '==', user.id)));
        prodSnap.docs.forEach(d => batch.delete(doc(db, 'products', d.id)));
        const orderSnap = await getDocs(query(collection(db, 'orders'), where('supplierId', '==', user.id)));
        orderSnap.docs.forEach(d => batch.delete(doc(db, 'orders', d.id)));
      }
      if (role === 'buyer') {
        const orderSnap = await getDocs(query(collection(db, 'orders'), where('buyerId', '==', user.id)));
        orderSnap.docs.forEach(d => batch.delete(doc(db, 'orders', d.id)));
      }
      batch.delete(doc(db, 'users', user.id));
      await batch.commit();
      setUsers(users.filter(u => u.id !== user.id));
      await fetchAllData();
    } catch (err) { console.error('Delete user error:', err); }
    setLoading(false);
  };

  // ── Product Actions ──
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
    if (editingProduct.chudidarTopMaterial !== undefined) updateData.chudidarTopMaterial = editingProduct.chudidarTopMaterial;
    if (editingProduct.chudidarBottomMaterial !== undefined) updateData.chudidarBottomMaterial = editingProduct.chudidarBottomMaterial;
    if (editingProduct.chudidarDupattaMaterial !== undefined) updateData.chudidarDupattaMaterial = editingProduct.chudidarDupattaMaterial;
    await updateDoc(doc(db, 'products', editingProduct.id), updateData);
    setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...editingProduct } : p));
    setEditingProduct(null);
  };

  // ── Order / Delivery Actions ──
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
      return { ...item, orderedQty: ordered, previouslyDispatched, dispatchingNow: 0, unit: item.unit || (item.sets ? 'Set' : 'Piece') };
    });
    setShippingForm({ billNo: '', billDate: '', transport: '', lrNo: '', lrDate: '', dispatchItems });
  };

  const saveDelivery = async () => {
    if (!deliveryModal) return;
    let finalStatus = deliveryStatus;
    if (deliveryStatus === 'Shipped') {
      const isDuplicate = isBillNoDuplicate(shippingForm.billNo, deliveryModal.supplierId, deliveryModal.id, null);
      if (isDuplicate) { alert(`Bill No "${shippingForm.billNo}" already exists for this supplier.`); return; }
      const isAnythingDispatched = shippingForm.dispatchItems.some(i => Number(i.dispatchingNow) > 0);
      let newShipments = [...(deliveryModal.shipments || [])];
      if (isAnythingDispatched) {
        newShipments.push({
          billNo: shippingForm.billNo, billDate: shippingForm.billDate, transport: shippingForm.transport,
          lrNo: shippingForm.lrNo, lrDate: shippingForm.lrDate, dispatchedAt: new Date().toISOString(),
          items: shippingForm.dispatchItems.filter(i => Number(i.dispatchingNow) > 0).map(i => ({
            itemIdx: shippingForm.dispatchItems.indexOf(i), productName: i.productName,
            size: i.size || '', qty: Number(i.dispatchingNow), unit: i.unit || 'Piece'
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

  // ── Categories ──
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

  const handleSaveCategoryEdit = async () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    await updateDoc(doc(db, 'categories', editingCategory.id), { name: editingCategory.name.trim(), template: editingCategory.template });
    setCategories(categories.map(c => c.id === editingCategory.id ? { ...c, name: editingCategory.name.trim(), template: editingCategory.template } : c));
    setEditingCategory(null);
  };

  // ── Data Prep ──
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

  const filteredOrders = orders.filter(o => {
    const matchSearch = o.id?.toLowerCase().includes(orderSearch.toLowerCase()) || o.buyerFirm?.toLowerCase().includes(orderSearch.toLowerCase()) || o.supplierFirm?.toLowerCase().includes(orderSearch.toLowerCase());
    const matchFilter = orderFilter === 'All' ? true : o.status === orderFilter;
    return matchSearch && matchFilter;
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

  // suppress unused warning for notifications (used in future bell icon)
  void notifications;

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
      <AdminEditUserModal selectedUser={selectedUser} setSelectedUser={setSelectedUser} onSave={handleSaveUserEdit} onCancel={() => setSelectedUser(null)} />
      <AdminCategoryModal editingCategory={editingCategory} setEditingCategory={setEditingCategory} onSave={handleSaveCategoryEdit} onCancel={() => setEditingCategory(null)} />
      <AdminEditProductModal editingProduct={editingProduct} setEditingProduct={setEditingProduct} categories={categories} uploadingImage={uploadingImage} onImageUpload={handleProductImageUpload} onImageDelete={handleDeleteProductImage} onSave={saveProductEdit} onCancel={() => setEditingProduct(null)} />
      <AdminDeliveryModal deliveryModal={deliveryModal} deliveryStatus={deliveryStatus} setDeliveryStatus={setDeliveryStatus} shippingForm={shippingForm} setShippingForm={setShippingForm} onSave={saveDelivery} onCancel={() => setDeliveryModal(null)} />

      {shareModal && (
        <div style={styles.modalOverlay} onClick={() => setShareModal(null)}>
          <div style={{ ...styles.modal, maxWidth: 320, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#1e293b' }}>Share Order</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>#{shareModal.id.slice(0, 8)}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button style={styles.shareMenuBtn} onClick={() => { generateAdminOrderPDF(shareModal); setShareModal(null); }}>📄 Download PDF</button>
              {navigator.share && (
                <button style={styles.shareMenuBtn} onClick={async () => {
                  try { await navigator.share({ title: `Order #${shareModal.id.slice(0, 8)}`, text: `Jain Agency Order\nBuyer: ${shareModal.buyerFirm}\nSupplier: ${shareModal.supplierFirm}\nStatus: ${shareModal.status}` }); } catch (e) {}
                  setShareModal(null);
                }}>📤 Share via App</button>
              )}
              <button style={{ ...styles.shareMenuBtn, backgroundColor: '#f1f5f9', border: 'none' }} onClick={() => setShareModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

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
        </div>
      )}

      <div style={styles.main}>
        <div style={styles.topBar}>
          <div>
            <span style={{ fontSize: 11, color: '#775a19', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Jain Agency</span>
            <h1 style={{ color: '#031632', margin: 0, fontSize: 20 }}>Admin Control</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={styles.iconBtn} onClick={handleLogoutClick} title="Logout">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            </button>
          </div>
        </div>

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
                        <div style={{ display: 'flex', gap: 4 }}>
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
                        <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, backgroundColor: product.status === 'approved' ? '#d1fae5' : '#fef9c3', color: product.status === 'approved' ? '#065f46' : '#854d0e' }}>{product.status}</span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={styles.btnEdit} onClick={() => setEditingProduct({ ...product })}>Edit</button>
                          {product.status !== 'approved' && <button style={styles.btnApprove} onClick={() => updateProductStatus(product.id, 'approved')}>Approve</button>}
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
              {['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(f => (
                <button key={f} onClick={() => setOrderFilter(f)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, backgroundColor: orderFilter === f ? '#031632' : '#e2e8f0', color: orderFilter === f ? 'white' : '#475569' }}>{f}</button>
              ))}
            </div>
            {filteredOrders.map(order => {
              const isExpanded = expandedOrder === order.id;
              return (
                <div key={order.id} style={styles.orderCard}>
                  <div style={styles.orderRow} onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b' }}>#{order.id.slice(0, 8)}</span>
                      <span style={{ fontSize: 13, color: '#475569' }}>B: {order.buyerFirm} | S: {order.supplierFirm}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', backgroundColor: '#fef9c3', color: '#854d0e' }}>{order.status || 'Pending'}</span>
                      <button style={styles.btnDelivery} onClick={e => { e.stopPropagation(); openDeliveryModal(order); }}>Status</button>
                      <button style={{ ...styles.btnShare, backgroundColor: '#8b5cf6' }} onClick={e => { e.stopPropagation(); setShareModal(order); }}>Share</button>
                      <button style={{ ...styles.btnShare, backgroundColor: '#ef4444' }} onClick={e => { e.stopPropagation(); handleDeleteOrder(order.id); }}>Delete</button>
                      <span style={{ color: '#94a3b8', fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={styles.orderBody}>
                      {order.items?.map((item, idx) => (
                        <div key={idx} style={{ fontSize: 13, padding: '4px 0', color: '#334155' }}>
                          {item.productName}{item.size ? ` (${item.size})` : ''} — Ordered: <b>{item.orderedQty || item.quantity || item.sets || 0} {item.unit || ''}</b> | Dispatched: <b style={{ color: '#16a34a' }}>{item.dispatchedQty || 0}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

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
                      {cat.template && <span style={{ marginLeft: 8, fontSize: 11, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 7px', borderRadius: 10 }}>{cat.template}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={styles.btnEdit} onClick={() => setEditingCategory({ id: cat.id, name: cat.name, template: cat.template || 'sets' })}>Edit</button>
                      <button style={styles.btnReject} onClick={() => handleDeleteCategory(cat.id)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
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