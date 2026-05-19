import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  collection, getDocs, doc, updateDoc, addDoc,
  deleteDoc, query, where, orderBy, onSnapshot, writeBatch
} from 'firebase/firestore';
import { auth, db } from '../../firebase';

const SIZES = ['M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('analytics');

  // Data States
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);

  // Notification States
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  // UI States
  const [loading, setLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Current admin's userId — auth se milta hai
  const adminId = auth.currentUser?.uid;

  const navigate = useNavigate();

  // ── Data fetch ──────────────────────────────────────────
  useEffect(() => {
    fetchAllData();
  }, []);

  // ── Real-time notification listener ─────────────────────
  useEffect(() => {
    if (!adminId) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', adminId),
      orderBy('createdAt', 'desc')
    );

    // onSnapshot = real-time, naya notification aate hi update hoga
    const unsubscribe = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsubscribe(); // cleanup on unmount
  }, [adminId]);

  // ── Close dropdown on outside click ─────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
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
    } catch (err) {
      console.error("Data fetch error:", err);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  // ── Mark all notifications as read ──────────────────────
  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    // writeBatch = ek saath saare update, multiple writes se bachao
    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
    // onSnapshot automatically state update kar dega
  };

  // ── ACTIONS ─────────────────────────────────────────────

  const updateUserStatus = async (userId, newStatus) => {
    await updateDoc(doc(db, 'users', userId), { status: newStatus });
    setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
  };

  const updateProductStatus = async (productId, newStatus) => {
    await updateDoc(doc(db, 'products', productId), { status: newStatus });
    setProducts(products.map(p => p.id === productId ? { ...p, status: newStatus } : p));
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  const updatePaymentStatus = async (orderId, paymentStatus) => {
    await updateDoc(doc(db, 'orders', orderId), { paymentStatus });
    setOrders(orders.map(o => o.id === orderId ? { ...o, paymentStatus } : o));
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

  // ── DERIVED STATS ────────────────────────────────────────
  const stats = {
    totalSales: orders.reduce((sum, o) => {
      const orderTotal = o.items?.reduce((s, i) => s + (i.price * (i.sets || i.quantity || 1)), 0) || 0;
      return sum + orderTotal;
    }, 0),
    pendingOrders: orders.filter(o => o.status === 'Pending').length,
    activeBuyers: users.filter(u => u.role === 'buyer' && u.status === 'approved').length,
    activeSuppliers: users.filter(u => u.role === 'supplier' && u.status === 'approved').length,
    pendingProducts: products.filter(p => p.status === 'pending').length
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Notification icon per type ───────────────────────────
  const notifIcon = (type) => {
    if (type === 'new_order') return '🛒';
    if (type === 'new_product') return '📦';
    if (type === 'new_user') return '👤';
    return '🔔';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading System Data...</div>;

  return (
    <div style={styles.container}>
      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <h2 style={{ color: 'white', margin: '0 0 20px 0' }}>Admin Hub</h2>

        <button style={activeTab === 'analytics' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('analytics')}>Dashboard</button>
        <button style={activeTab === 'users' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('users')}>Users Control</button>
        <button style={activeTab === 'products' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('products')}>
          Products Control {stats.pendingProducts > 0 && `(${stats.pendingProducts})`}
        </button>
        <button style={activeTab === 'orders' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('orders')}>Orders & Ledger</button>
        <button style={activeTab === 'categories' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('categories')}>System Settings</button>

        <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      {/* MAIN CONTENT */}
      <div style={styles.main}>

        {/* TOP BAR with Bell */}
        <div style={styles.topBar}>
          <h1 style={{ color: '#1a1a2e', margin: 0 }}>Jain Agency Control Panel</h1>

          {/* NOTIFICATION BELL */}
          <div style={styles.bellWrapper} ref={notifRef}>
            <button style={styles.bellBtn} onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}>
              🔔
              {unreadCount > 0 && (
                <span style={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>

            {/* DROPDOWN */}
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
        </div>

        {/* 1. ANALYTICS DASHBOARD */}
        {activeTab === 'analytics' && (
          <div>
            <div style={styles.gridStats}>
              <div style={styles.statCard}>
                <p style={styles.statLabel}>Total Platform Volume (Est.)</p>
                <h2 style={styles.statValue}>₹{stats.totalSales.toLocaleString()}</h2>
              </div>
              <div style={styles.statCard}>
                <p style={styles.statLabel}>Pending Orders</p>
                <h2 style={styles.statValue}>{stats.pendingOrders}</h2>
              </div>
              <div style={styles.statCard}>
                <p style={styles.statLabel}>Active Buyers</p>
                <h2 style={styles.statValue}>{stats.activeBuyers}</h2>
              </div>
              <div style={styles.statCard}>
                <p style={styles.statLabel}>Active Suppliers</p>
                <h2 style={styles.statValue}>{stats.activeSuppliers}</h2>
              </div>
            </div>
          </div>
        )}

        {/* 2. USERS CONTROL */}
        {activeTab === 'users' && (
          <div style={styles.card}>
            <h3>Global User Management</h3>
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
                {users.filter(u => u.role !== 'admin').map(user => (
                  <tr key={user.id} style={styles.tr}>
                    <td style={styles.td}><b>{user.firmName}</b></td>
                    <td style={styles.td}>{user.role?.toUpperCase()}</td>
                    <td style={styles.td}>{user.mobile}</td>
                    <td style={styles.td}>{user.status || 'pending'}</td>
                    <td style={styles.td}>
                      {user.status !== 'approved' && <button style={styles.btnApprove} onClick={() => updateUserStatus(user.id, 'approved')}>Approve</button>}
                      {user.status !== 'blocked' && <button style={styles.btnReject} onClick={() => updateUserStatus(user.id, 'blocked')}>Block</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. PRODUCTS CONTROL */}
        {activeTab === 'products' && (
          <div style={styles.card}>
            <h3>Global Catalog Management</h3>
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
                {products.map(product => (
                  <tr key={product.id} style={styles.tr}>
                    <td style={styles.td}>
                      <b>{product.name}</b><br /><span style={{ fontSize: '12px' }}>{product.category}</span>
                    </td>
                    <td style={styles.td}>{product.supplierFirm}</td>
                    <td style={styles.td}>₹{product.price} / {product.moq} {product.unit}</td>
                    <td style={styles.td}>{product.status || 'pending'}</td>
                    <td style={styles.td}>
                      {product.status !== 'approved' && <button style={styles.btnApprove} onClick={() => updateProductStatus(product.id, 'approved')}>Live</button>}
                      {product.status !== 'delisted' && <button style={styles.btnReject} onClick={() => updateProductStatus(product.id, 'delisted')}>Delist</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. ORDERS & LEDGER */}
        {activeTab === 'orders' && (
          <div style={styles.card}>
            <h3>Orders & Payment Ledger</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID / Date</th>
                  <th style={styles.th}>Parties</th>
                  <th style={styles.th}>Delivery Status</th>
                  <th style={styles.th}>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} style={styles.tr}>
                    <td style={styles.td}>{order.id.slice(0, 8)}...<br />{order.createdAt?.toDate?.()?.toLocaleDateString()}</td>
                    <td style={styles.td}>B: {order.buyerFirm}<br />S: {order.supplierFirm}</td>
                    <td style={styles.td}>
                      <select value={order.status || 'Pending'} onChange={(e) => updateOrderStatus(order.id, e.target.value)} style={styles.select}>
                        <option>Pending</option>
                        <option>Processing</option>
                        <option>Shipped</option>
                        <option>Delivered</option>
                        <option>Cancelled</option>
                      </select>
                    </td>
                    <td style={styles.td}>
                      <select value={order.paymentStatus || 'Unpaid'} onChange={(e) => updatePaymentStatus(order.id, e.target.value)} style={styles.select}>
                        <option>Unpaid</option>
                        <option>Advance Received</option>
                        <option>Credit (Udhaar)</option>
                        <option>Cleared</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. SYSTEM SETTINGS */}
        {activeTab === 'categories' && (
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ ...styles.card, flex: 1 }}>
              <h3>Manage Categories</h3>
              <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input
                  style={styles.input}
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="New Category Name"
                />
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
            <div style={{ ...styles.card, flex: 1 }}>
              <h3>System Info</h3>
              <p>Warning: Deleting a category will not delete existing products in that category, but it will remove it from Supplier upload options.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', minHeight: '100vh', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif' },
  sidebar: { width: '220px', backgroundColor: '#111827', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' },
  tab: { padding: '12px 15px', backgroundColor: 'transparent', color: '#94a3b8', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' },
  activeTab: { padding: '12px 15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', fontSize: '14px', fontWeight: 'bold' },
  logoutBtn: { marginTop: 'auto', padding: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  main: { flex: 1, padding: '30px', overflowY: 'auto' },

  // Top bar
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
  bellWrapper: { position: 'relative' },
  bellBtn: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '44px', height: '44px', fontSize: '20px', cursor: 'pointer', position: 'relative', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' },
  badge: { position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold', borderRadius: '10px', padding: '2px 5px', minWidth: '16px', textAlign: 'center' },

  // Notification dropdown
  notifDropdown: { position: 'absolute', top: '52px', right: 0, width: '360px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', zIndex: 1000, overflow: 'hidden', border: '1px solid #e2e8f0' },
  notifHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' },
  notifList: { maxHeight: '400px', overflowY: 'auto' },
  notifEmpty: { padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' },
  notifItem: { display: 'flex', alignItems: 'flex-start', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' },
  notifMsg: { margin: 0, fontSize: '13px', color: '#1e293b', lineHeight: '1.4' },
  notifTime: { margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' },
  unreadDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '4px', flexShrink: 0 },

  gridStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' },
  statCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  statLabel: { margin: 0, color: '#64748b', fontSize: '14px' },
  statValue: { margin: '10px 0 0 0', color: '#0f172a', fontSize: '28px' },
  card: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
  th: { padding: '12px', borderBottom: '2px solid #e2e8f0', color: '#475569' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px', color: '#1e293b' },
  btnApprove: { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' },
  btnReject: { backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' },
  select: { padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' },
  input: { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', flex: 1 }
};

export default AdminDashboard;
