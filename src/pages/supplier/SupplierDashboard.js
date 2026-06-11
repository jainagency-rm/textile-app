import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, writeBatch, onSnapshot, orderBy } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useWindowSize } from '../../hooks/useWindowSize';
import { notifyOrderStatusChange } from '../../utils/notifications';

import SupplierSideNav from '../../components/supplier/SupplierSideNav';
import SupplierBottomNav from '../../components/supplier/SupplierBottomNav';
import SupplierOrderCard from '../../components/supplier/SupplierOrderCard';
import AddProductWizard from '../../components/supplier/AddProductWizard';
import EditProductModal from '../../components/supplier/EditProductModal';
import SupplierProfileTab from '../../components/supplier/SupplierProfileTab';
import SupplierDashboardHome from '../../components/supplier/SupplierDashboardHome';

const D = { navy: '#031632', gold: '#775a19', bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d', textSecondary: '#44474d', borderLight: '#e7e8e9', error: '#ba1a1a', success: '#1a6b3c', warning: '#7a5200' };

function SupplierDashboard() {
  const { isMobile, isTablet } = useWindowSize();
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ['home', 'products', 'orders', 'profile'];
  const rawTab = searchParams.get('tab') || 'home';
  const activeTab = VALID_TABS.includes(rawTab) ? rawTab : 'home';
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('All');
  const [orderSort, setOrderSort] = useState('newest');
  const [editingProduct, setEditingProduct] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [supplierId, setSupplierId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);

  const notifRef = useRef(null);
  const navigate = useNavigate();
  const useSideNav = !isMobile;

  const fetchProfile = useCallback(async (uid) => {
    if (!uid) return;
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) setUserProfile(snap.data());
  }, []);

  const fetchProducts = useCallback(async (uid) => {
    if (!uid) return;
    const q = query(collection(db, 'products'), where('supplierId', '==', uid));
    const snap = await getDocs(q);
    setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, []);

  const fetchCategories = useCallback(async () => {
    const snap = await getDocs(collection(db, 'categories'));
    setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, []);

  const fetchAll = useCallback(async (uid) => {
    await Promise.all([fetchProducts(uid), fetchCategories(), fetchProfile(uid)]);
  }, [fetchProducts, fetchCategories, fetchProfile]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (user) { setSupplierId(user.uid); fetchAll(user.uid); }
      else { setSupplierId(null); }
    });
    return unsub;
  }, [fetchAll]);

  useEffect(() => {
    if (!supplierId) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', supplierId), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [supplierId]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, 'orders'),
      where('supplierId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, snap => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sorted = fetched.sort((a, b) => {
        const aNum = a.orderNumber || 0;
        const bNum = b.orderNumber || 0;
        if (bNum !== aNum) return bNum - aNum;
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });
      setOrders(sorted);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const id = sessionStorage.getItem('highlight_id');
    if (!id) return;
    if (activeTab !== 'orders' || orders.length === 0) return;
    setHighlightId(id);
    sessionStorage.removeItem('highlight_id');
    setTimeout(() => {
      document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    setTimeout(() => setHighlightId(null), 2500);
  }, [activeTab, orders]);

  useEffect(() => {
    const handleClickOutside = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (n) => {
    if (n.refId) sessionStorage.setItem('highlight_id', n.refId);
    setShowNotifications(false);
    if (n.type === 'new_order') navigate('/supplier?tab=orders');
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
    await batch.commit();
  };

  const handleApprove = async (order) => {
    await updateDoc(doc(db, 'orders', order.id), { status: 'Processing' });
    setOrders(orders.map(o => o.id === order.id ? { ...o, status: 'Processing' } : o));
    if (order.buyerId) { try { await notifyOrderStatusChange(order.buyerId, order.orderNumber, 'Processing', order.id); } catch (e) {} }
  };

  const handleReject = async (order) => {
    if (!window.confirm('Reject this order? Stock will be restored.')) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'orders', order.id), { status: 'Cancelled' });
      for (const item of order.items) {
        if (!item.productId) continue;
        const isNighty = item.cutLabel || item.sets;

        if (isNighty && item.designId && item.cutLabel) {
          // Nighty: find cut by label, then update design
          const cutsSnap = await getDocs(
            collection(db, 'products', item.productId, 'cuts')
          );
          for (const cutDoc of cutsSnap.docs) {
            if (cutDoc.data().label === item.cutLabel) {
              const dRef = doc(
                db, 'products', item.productId,
                'cuts', cutDoc.id,
                'designs', item.designId
              );
              const dSnap = await getDoc(dRef);
              if (dSnap.exists()) {
                await updateDoc(dRef, {
                  sets: (dSnap.data().sets || 0) + (item.sets || 0)
                });
              }
              break;
            }
          }
          // Restore totalSets on product
          const pRef = doc(db, 'products', item.productId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            await updateDoc(pRef, {
              totalSets: (pSnap.data().totalSets || 0) + (item.sets || 0)
            });
          }
        } else if (!isNighty && item.productId) {
          // Non-nighty: no stock to restore (piece-based)
          // No action needed
        }
      }
      await batch.commit();
      setOrders(orders.map(o => o.id === order.id ? { ...o, status: 'Cancelled' } : o));
      if (order.buyerId) { try { await notifyOrderStatusChange(order.buyerId, order.orderNumber, 'Cancelled', order.id); } catch (e) {} }
    } catch (err) { console.error('Reject error', err); }
  };

  const productGridCols = isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)';
  const pendingCount = orders.filter(o => o.status === 'Pending').length;
  const unreadCount = notifications.filter(n => !n.read).length;
  const handleLogout = () => { signOut(auth).then(() => navigate('/')); };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: D.bg, fontFamily: "'Inter', sans-serif" }}>
      {showAdd && (
        <AddProductWizard
          categories={categories}
          onDone={(rc) => { setShowAdd(false); fetchProducts(supplierId); if (rc) fetchCategories(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={(updated, shouldClose = true) => {
            setProducts(products.map(p => p.id === updated.id ? updated : p));
            if (shouldClose) setEditingProduct(null);
          }}
          onDeleted={(deletedId) => {
            setProducts(products.filter(p => p.id !== deletedId));
            setEditingProduct(null);
          }}
        />
      )}

      {useSideNav && (
        <SupplierSideNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingCount={pendingCount}
          onLogout={handleLogout}
          onAddProduct={() => setShowAdd(true)}
          isTablet={isTablet}
          userProfile={userProfile}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: D.surface, borderBottom: `1px solid ${D.borderLight}`, flexShrink: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {isMobile && <span style={{ fontSize: 10, color: D.gold, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Jain Agency</span>}
            <span style={{ fontSize: 16, fontWeight: 700, color: D.navy }}>{activeTab === 'home' ? 'Dashboard' : activeTab === 'products' ? 'Inventory' : activeTab === 'orders' ? 'Orders' : 'Profile'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isMobile && activeTab === 'products' && (
              <button onClick={() => setShowAdd(true)} style={{ padding: '7px 14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Add</button>
            )}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}
                style={{ width: 40, height: 40, borderRadius: 20, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', backgroundColor: D.error }} />}
              </button>
              {showNotifications && (
                <div style={{ position: 'absolute', top: 48, right: 0, width: 290, backgroundColor: D.surface, borderRadius: 12, boxShadow: '0 8px 24px rgba(3,22,50,0.12)', zIndex: 100, overflow: 'hidden', border: `1px solid ${D.borderLight}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${D.borderLight}`, backgroundColor: D.bg }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: D.navy }}>Notifications</span>
                    <span style={{ fontSize: 12, color: D.textSecondary }}>{notifications.length} total</span>
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', color: D.textSecondary, fontSize: 13 }}>No notifications</div>
                  ) : (
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                      {notifications.slice(0, 20).map(n => (
                        <div key={n.id} onClick={() => handleNotificationClick(n)} style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 16px', borderBottom: `1px solid ${D.borderLight}`, backgroundColor: n.read ? D.surface : '#f0f4ff', cursor: 'pointer' }}>
                          <span style={{ fontSize: 16, marginRight: 10 }}>{n.type === 'new_order' ? '🛒' : '🔔'}</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: 13, color: D.textPrimary, lineHeight: 1.4 }}>{n.message}</p>
                            <p style={{ margin: '3px 0 0', fontSize: 11, color: D.textSecondary }}>{n.createdAt?.toDate?.()?.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: D.navy, flexShrink: 0, marginTop: 4 }} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: isMobile ? 80 : 20 }}>
          {activeTab === 'home' && (
            <SupplierDashboardHome orders={orders} products={products} userProfile={userProfile} setActiveTab={setActiveTab} />
          )}

          {activeTab === 'products' && (
            products.length === 0 ? (
              <div style={{ padding: '80px 16px', textAlign: 'center' }}>
                <p style={{ color: D.textPrimary, fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>No products yet</p>
                <p style={{ color: D.textSecondary, fontSize: 13, margin: '0 0 20px' }}>Add your first product to get started</p>
                <button onClick={() => setShowAdd(true)} style={{ padding: '12px 28px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Add Product</button>
              </div>
            ) : (() => {
              const filteredProducts = products.filter(p =>
                !productSearch ||
                p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
                p.category?.toLowerCase().includes(productSearch.toLowerCase())
              );
              return (
              <>
                <div style={{ padding: '12px 16px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, backgroundColor: 'white', border: '1px solid #c5c6ce', borderRadius: 10, padding: '10px 14px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#44474d" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input
                      style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#191c1d', backgroundColor: 'transparent' }}
                      placeholder="Search products..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                    />
                    {productSearch && <button onClick={() => setProductSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#44474d', fontSize: 14 }}>✕</button>}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: productGridCols, gap: 16, padding: 16 }}>
                {filteredProducts.map(p => {
                  const isApproved = p.status === 'approved';
                  return (
                    <div key={p.id} style={{ backgroundColor: D.surface, borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(3,22,50,0.06)', border: `1px solid ${D.borderLight}` }}>
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', backgroundColor: D.bg }}>
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={D.borderLight} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          </div>
                        )}
                        <div style={{ position: 'absolute', top: 8, right: 8, backgroundColor: isApproved ? '#e6f4ea' : '#fef7e0', color: isApproved ? D.success : D.warning, padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                          {isApproved ? '✓ Live' : '⏳ Pending'}
                        </div>
                        <button onClick={() => setEditingProduct(p)} style={{ position: 'absolute', top: 8, left: 8, width: 28, height: 28, borderRadius: 8, border: 'none', backgroundColor: 'rgba(255,255,255,0.9)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      </div>
                      <div style={{ padding: '10px 12px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: D.gold, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.category || p.categoryName}</span>
                        <p style={{ margin: '3px 0 2px', fontSize: 13, fontWeight: 700, color: D.textPrimary, lineHeight: 1.3 }}>{p.name}</p>
                        {p.width && <p style={{ margin: '0 0 2px', fontSize: 11, color: D.textSecondary, fontWeight: 600 }}>Width: {p.width}</p>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                          {p.isNighty && p.cutRates ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>{Object.entries(p.cutRates).map(([cut, rate]) => `${cut}: ₹${rate}`).join(' · ')}</span>
                          ) : (
                            <span style={{ fontSize: 14, fontWeight: 700, color: D.navy }}>₹{p.price}</span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: D.textSecondary }}>{p.moq} {p.moqUnit || p.unit || 'Piece'} MOQ</span>
                      </div>
                    </div>
                  );
                })}
                </div>
              </>
              );
            })()
          )}

          {activeTab === 'orders' && (
            <div style={{ padding: '8px 16px' }}>
              {pendingCount > 0 && (
                <div style={{ backgroundColor: '#fff3e0', border: `1px solid #f59e0b`, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>⏳</span>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: D.warning }}>{pendingCount} order{pendingCount > 1 ? 's' : ''} waiting for approval</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
                {['All', 'Pending', 'Processing', 'Delivered', 'Cancelled'].map(f => (
                  <button
                    key={f}
                    onClick={() => setOrderFilter(f)}
                    style={{
                      flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: orderFilter === f ? 'none' : '1px solid #c5c6ce',
                      backgroundColor: orderFilter === f ? D.navy : 'white',
                      color: orderFilter === f ? 'white' : '#44474d',
                    }}
                  >{f}</button>
                ))}
              </div>
              <div style={{ marginBottom: 12 }}>
                <select
                  value={orderSort}
                  onChange={e => setOrderSort(e.target.value)}
                  style={{
                    padding: '8px 12px', border: '1px solid #c5c6ce',
                    borderRadius: 8, fontSize: 13, color: '#191c1d',
                    backgroundColor: 'white', cursor: 'pointer', outline: 'none'
                  }}
                >
                  <option value="newest">Order # — Newest First</option>
                  <option value="oldest">Order # — Oldest First</option>
                  <option value="buyer">Buyer Name — A to Z</option>
                  <option value="items">Item Name — A to Z</option>
                  <option value="amount">Amount — High to Low</option>
                </select>
              </div>
              {(() => {
                const displayOrders = orders
                  .filter(o => orderFilter === 'All' || o.status === orderFilter)
                  .sort((a, b) => {
                    if (orderSort === 'newest') {
                      const aNum = a.orderNumber || 0;
                      const bNum = b.orderNumber || 0;
                      if (bNum !== aNum) return bNum - aNum;
                      return (b.createdAt?.toDate?.() || new Date(0)) - (a.createdAt?.toDate?.() || new Date(0));
                    }
                    if (orderSort === 'oldest') {
                      const aNum = a.orderNumber || 0;
                      const bNum = b.orderNumber || 0;
                      if (aNum !== bNum) return aNum - bNum;
                      return (a.createdAt?.toDate?.() || new Date(0)) - (b.createdAt?.toDate?.() || new Date(0));
                    }
                    if (orderSort === 'buyer') {
                      return (a.buyerFirm || '').localeCompare(b.buyerFirm || '');
                    }
                    if (orderSort === 'items') {
                      const aItem = a.items?.[0]?.productName || '';
                      const bItem = b.items?.[0]?.productName || '';
                      return aItem.localeCompare(bItem);
                    }
                    if (orderSort === 'amount') {
                      return (b.totalAmount || 0) - (a.totalAmount || 0);
                    }
                    return 0;
                  });
                return displayOrders.length === 0 ? (
                  <div style={{ padding: '80px 0', textAlign: 'center', color: D.textSecondary }}><p style={{ fontSize: 15 }}>No orders yet</p></div>
                ) : (
                  displayOrders.map(order => (
                    <SupplierOrderCard key={order.id} order={order} onApprove={handleApprove} onReject={handleReject} highlightId={highlightId} />
                  ))
                );
              })()}
            </div>
          )}

          {activeTab === 'profile' && (
            userProfile
              ? <SupplierProfileTab userProfile={userProfile} fetchProfile={fetchProfile} />
              : <div style={{ padding: 40, textAlign: 'center', color: '#44474d' }}>Loading profile...</div>
          )}
        </div>

        {isMobile && <SupplierBottomNav activeTab={activeTab} setActiveTab={setActiveTab} pendingCount={pendingCount} />}
      </div>
    </div>
  );
}

export default SupplierDashboard;