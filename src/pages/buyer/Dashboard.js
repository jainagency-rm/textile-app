import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import ProductDesigns from './ProductDesigns';
import { notifyNewOrder } from '../../utils/notifications';

const NIGHTY_CATEGORIES = ['Nighty', 'Nighty with Dupatta'];

const D = {
  navy: '#031632', navyMid: '#1a2b48', gold: '#775a19', goldLight: '#fed488',
  bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d', textSecondary: '#44474d',
  border: '#c5c6ce', borderLight: '#e7e8e9', error: '#ba1a1a', success: '#1a6b3c',
};

// ── ProfileEdit ─────────────────────────────────────────────
function ProfileEdit({ userProfile, onSave, categories }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    ...userProfile,
    notificationPrefs: userProfile?.notificationPrefs || []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setEditing(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    await updateDoc(doc(db, 'users', userProfile.uid), {
      firmName: form.firmName, contactPerson: form.contactPerson, mobile: form.mobile,
      address: form.address, city: form.city, district: form.district, state: form.state, pincode: form.pincode,
      notificationPrefs: form.notificationPrefs
    });
    setLoading(false); setEditing(false); onSave();
  };

  const toggleCategoryPref = (cat) => {
    setForm(prev => {
      const prefs = prev.notificationPrefs || [];
      if (prefs.includes(cat)) return { ...prev, notificationPrefs: prefs.filter(p => p !== cat) };
      return { ...prev, notificationPrefs: [...prefs, cat] };
    });
  };

  if (!editing) {
    return (
      <div style={S.profileCard}>
        <div style={S.profileAvatar}>
          <span style={{ fontSize: 28, color: D.navy, fontWeight: 700 }}>{userProfile.firmName?.[0]?.toUpperCase()}</span>
        </div>
        <h3 style={{ margin: '12px 0 4px', color: D.textPrimary, fontSize: 18, fontWeight: 700 }}>{userProfile.firmName}</h3>
        <p style={{ margin: '0 0 20px', color: D.textSecondary, fontSize: 13 }}>{userProfile.email}</p>
        
        {[['GST Number', userProfile.gstNumber], ['Contact Person', userProfile.contactPerson],
          ['Mobile', userProfile.mobile], ['Address', userProfile.address],
          ['City', userProfile.city], ['District', userProfile.district],
          ['State', userProfile.state], ['Pincode', userProfile.pincode],
        ].map(([label, val]) => (
          <div key={label} style={S.profileRow}>
            <span style={S.profileLabel}>{label}</span>
            <span style={S.profileValue}>{val || '—'}</span>
          </div>
        ))}

        <div style={{ marginTop: 20, textAlign: 'left' }}>
          <span style={S.profileLabel}>Notification Preferences</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {userProfile.notificationPrefs?.length > 0 ? (
              userProfile.notificationPrefs.map(p => <span key={p} style={S.prefBadge}>{p}</span>)
            ) : (
              <span style={{ fontSize: 12, color: D.textSecondary }}>All Categories (Default)</span>
            )}
          </div>
        </div>

        <button style={{ ...S.btnPrimary, marginTop: 24 }} onClick={() => setEditing(true)}>Edit Profile</button>
      </div>
    );
  }

  return (
    <div style={S.profileCard}>
      <h3 style={{ margin: '0 0 4px', color: D.textPrimary, textAlign: 'left' }}>Edit Profile</h3>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: D.textSecondary, textAlign: 'left' }}>Press ESC to cancel</p>
      
      {[['firmName', 'Firm Name'], ['contactPerson', 'Contact Person'], ['mobile', 'Mobile'],
        ['address', 'Address'], ['city', 'City'], ['district', 'District'],
        ['state', 'State'], ['pincode', 'Pincode'],
      ].map(([key, placeholder]) => (
        <input key={key} style={S.input} value={form[key] || ''} placeholder={placeholder}
          onChange={e => setForm({ ...form, [key]: e.target.value })} />
      ))}

      <div style={{ marginTop: 16, marginBottom: 16, textAlign: 'left' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: D.navy, marginBottom: 8 }}>Product Notifications</p>
        <p style={{ fontSize: 11, color: D.textSecondary, marginBottom: 12 }}>Select categories you want updates for (Leave empty for all)</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map(cat => (
            <button key={cat} type="button" onClick={() => toggleCategoryPref(cat)}
              style={(form.notificationPrefs || []).includes(cat) ? S.chipActive : S.chip}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={S.btnPrimary} onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        <button style={S.btnGhost} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

// ── NightyCheckout ──────────────────────────────────────────
function NightyCheckout({ nightyBySupplier, onConfirm, onCancel }) {
  const [packingTypes, setPackingTypes] = useState({});
  const [error, setError] = useState('');
  const suppliers = Object.keys(nightyBySupplier);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleConfirm = () => {
    let tempPackingDetails = {}; let hasError = false;
    for (const sId of suppliers) {
      const group = nightyBySupplier[sId];
      const totalSets = group.items.reduce((sum, item) => sum + (item.sets || 0), 0);
      const pType = packingTypes[sId];
      if (!pType) { setError(`Select packing for ${group.supplierFirm}`); hasError = true; break; }
      const typeNum = Number(pType);
      if (totalSets % typeNum !== 0) { setError(`${group.supplierFirm}: ${totalSets} sets not divisible by ${pType}`); hasError = true; break; }
      tempPackingDetails[sId] = { packingType: typeNum, totalBales: totalSets / typeNum, totalSets, totalPcs: totalSets * (group.items[0]?.pcsPerSet || 30) };
    }
    if (!hasError) onConfirm(tempPackingDetails);
  };

  return (
    <div style={S.modalOverlay} onClick={onCancel}>
      <div style={S.fullModal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHandle} />
        <h3 style={S.modalHeading}>Bale Packing Selection</h3>
        {suppliers.map(sId => {
          const group = nightyBySupplier[sId];
          const totalSets = group.items.reduce((sum, i) => sum + (i.sets || 0), 0);
          const cur = packingTypes[sId];
          const isValid = cur ? totalSets % Number(cur) === 0 : false;
          return (
            <div key={sId} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${D.borderLight}` }}>
              <p style={{ fontWeight: 700, color: D.navy, margin: '0 0 4px' }}>{group.supplierFirm}</p>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: D.textSecondary }}>Total: <b>{totalSets} sets</b></p>
              <div style={{ display: 'flex', gap: 10 }}>
                {['8', '10'].map(t => (
                  <button key={t} onClick={() => { setPackingTypes({ ...packingTypes, [sId]: t }); setError(''); }}
                    style={cur === t ? S.packActive : S.packBtn}>
                    <span style={{ fontSize: 20, fontWeight: 700 }}>{t}</span>
                    <span style={{ fontSize: 11 }}>Sets/Bale</span>
                  </button>
                ))}
              </div>
              {cur && <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: isValid ? D.success : D.error }}>
                {isValid ? `✓ ${totalSets / Number(cur)} complete bale(s)` : `✗ Need multiple of ${cur}`}
              </p>}
            </div>
          );
        })}
        {error && <p style={{ color: D.error, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button style={S.btnPrimary} onClick={handleConfirm}>Confirm & Place Order</button>
        <button style={{ ...S.btnGhost, marginTop: 10 }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── OrderCard ───────────────────────────────────────────────
function OrderCard({ order }) {
  const [expanded, setExpanded] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);

  const isPaid = order.status === 'Delivered' || order.status === 'Partially Dispatched' || order.status === 'Shipped';  const totalItems = order.items?.length || 0;
  const firstItem = order.items?.[0];

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setShowDispatch(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const paymentLabel = () => {
    if (order.paymentStatus === 'Cleared') return { text: '✓ Paid', color: D.success, bg: '#e6f4ea' };
    if (order.paymentStatus === 'Advance Received') return { text: '◑ Part Paid', color: '#7a5200', bg: '#fef7e0' };
    return null;
  };
  const pLabel = paymentLabel();

  const fmtQty = (item) => {
    if (item.sets) return `${item.sets} sets = ${item.pcs} pcs`;
    const unit = (item.unit || 'pc').replace('pieces', 'pcs').replace('piece', 'pc');
    return `${item.quantity} ${unit}`;
  };

  return (
    <>
      {showDispatch && (
        <div style={S.modalOverlay} onClick={() => setShowDispatch(false)}>
          <div style={S.fullModal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHandle} />
            <h3 style={S.modalHeading}>Dispatch Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                ['Order ID', `#${order.id.slice(0, 8)}`],
                ['Bill No', order.billNo || '—'],
                ['Bill Date', order.billDate || '—'],
                ['Transport', order.transport || '—'],
                ['LR No', order.lrNo || '—'],
                ['LR Date', order.lrDate || '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                  <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 13, color: label === 'Payment' ? (order.paymentStatus === 'Cleared' ? D.success : '#7a5200') : D.textPrimary, fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{val}</span>
                </div>
              ))}
              {order.sizeWisePayment && Object.keys(order.sizeWisePayment).length > 0 && (
                <div style={{ paddingTop: 12 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: D.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Size-wise Qty</p>
                  {Object.entries(order.sizeWisePayment).map(([size, qty]) => (
                    <div key={size} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                      <span style={{ fontSize: 13, color: D.textSecondary }}>Size {size}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: D.textPrimary }}>{qty} pcs</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button style={{ ...S.btnGhost, marginTop: 20 }} onClick={() => setShowDispatch(false)}>Close</button>
          </div>
        </div>
      )}

      <div style={{ backgroundColor: D.surface, borderRadius: 12, marginBottom: 10, boxShadow: '0 1px 6px rgba(3,22,50,0.07)', overflow: 'hidden', border: `1px solid ${D.borderLight}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
          onClick={() => setExpanded(!expanded)}>
          {firstItem?.photoUrl ? (
            <img src={firstItem.photoUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: `1px solid ${D.borderLight}` }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: D.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.border} strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: D.navy }}>#{order.id.slice(0, 8)}</span>
              <span style={{ ...S.statusBadge, ...getStatusStyle(order.status), fontSize: 10, padding: '2px 7px' }}>{order.status || 'Pending'}</span>
              {pLabel && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, backgroundColor: pLabel.bg, color: pLabel.color }}>{pLabel.text}</span>}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: D.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {order.supplierFirm} · {totalItems} item{totalItems !== 1 ? 's' : ''}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: D.textSecondary }}>
              {order.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="2"
            style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        {expanded && (
          <div style={{ borderTop: `1px solid ${D.borderLight}`, padding: '10px 14px 14px', backgroundColor: '#fafbfc' }}>
            {order.items?.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                {item.photoUrl && <img src={item.photoUrl} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: D.textPrimary, fontWeight: 600 }}>{item.productName}</span>
                  {item.designNo && <span style={{ fontSize: 11, color: D.textSecondary }}> · DN{item.designNo}</span>}
                  {item.size && <span style={{ fontSize: 11, color: D.textSecondary }}> · Size {item.size}</span>}
                </div>
                <span style={{ fontSize: 11, color: D.textSecondary, flexShrink: 0, fontWeight: 500 }}>{fmtQty(item)}</span>
              </div>
            ))}
            {order.nightyDetails && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: D.textSecondary }}>
                {order.nightyDetails.totalSets} sets · {order.nightyDetails.packingType} sets/bale · <b style={{ color: D.navy }}>{order.nightyDetails.totalBales} bale(s)</b>
              </p>
            )}
            {isPaid && (
  <button style={{ ...S.btnPrimary, marginTop: 12, padding: '10px', fontSize: 13, backgroundColor: D.navyMid }}
    onClick={() => setShowDispatch(true)}>📦 View Dispatch Details</button>
)}
          </div>
        )}
      </div>
    </>
  );
}

// ── BuyerDashboard ──────────────────────────────────────────
function BuyerDashboard() {
  const [activeTab, setActiveTab] = useState('browse');
  const [products, setProducts] = useState([]);
  const [productDesigns, setProductDesigns] = useState({});
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [showNightyCheckout, setShowNightyCheckout] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewingProduct, setViewingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedProductDetails, setSelectedProductDetails] = useState(null);
  const [sizeQuantities, setSizeQuantities] = useState({});
  const [modalDesignIdx, setModalDesignIdx] = useState(0);
  const [cardDesignIndices, setCardDesignIndices] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const notifRef = useRef(null);
  const buyerId = auth.currentUser?.uid;
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      signOut(auth).then(() => navigate('/'));
    }
  };

  useEffect(() => {
    if (!buyerId) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', buyerId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubscribe();
  }, [buyerId]);

  useEffect(() => {
    const handler = () => { setSelectedProductDetails(null); setShowNotifications(false); };
    window.addEventListener('closeModal', handler);
    return () => window.removeEventListener('closeModal', handler);
  }, []);

  useEffect(() => {
    const handleClickOutside = e => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) { fetchProfile(); fetchProducts(); fetchOrders(); }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setSelectedProductDetails(null);
        setShowNotifications(false);
        setCartAdded(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  // Filter notifications based on preferences
  const filteredNotifications = notifications.filter(n => {
    if (n.type !== 'new_product') return true; 
    const prefs = userProfile?.notificationPrefs;
    if (!prefs || prefs.length === 0) return true; 
    return prefs.includes(n.category || 'General'); 
  });

  const markAllRead = async () => {
    const unread = filteredNotifications.filter(n => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
    await batch.commit();
  };

  const fetchProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) setUserProfile(snap.data());
  };

  const fetchProducts = async () => {
    const q = query(collection(db, 'products'), where('status', '==', 'approved'));
    const snap = await getDocs(q);
    const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setProducts(prods);
    const designMap = {};
    for (const prod of prods) {
      const dSnap = await getDocs(collection(db, 'products', prod.id, 'designs'));
      designMap[prod.id] = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    setProductDesigns(designMap);
  };

  const fetchOrders = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'orders'), where('buyerId', '==', user.uid));
    const snap = await getDocs(q);
    setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const categories = [...new Set(products.map(p => p.category))];
  const categoryFiltered = selectedCategory ? products.filter(p => p.category === selectedCategory) : products;
  const searchedAndFilteredProducts = categoryFiltered.filter(product => {
    const sl = searchTerm.toLowerCase();
    const designs = productDesigns[product.id] || [];
    const matchDesign = designs.some(d => String(d.designNo || '').toLowerCase().includes(sl) || String(d.dnNumber || '').toLowerCase().includes(sl));
    const matchSearch = !sl || product.name?.toLowerCase().includes(sl) || product.category?.toLowerCase().includes(sl) || product.supplierFirm?.toLowerCase().includes(sl) || product.material?.toLowerCase().includes(sl) || matchDesign;
    const matchMin = minPrice ? Number(product.price) >= Number(minPrice) : true;
    const matchMax = maxPrice ? Number(product.price) <= Number(maxPrice) : true;
    return matchSearch && matchMin && matchMax;
  });

  const getProductDesignsList = (product) => {
    const sub = productDesigns[product.id] || [];
    if (sub.length > 0) return sub;
    const arr = product.imageUrls || product.photos || [];
    if (arr.length > 0) return arr.map((item, idx) => ({
      photoUrl: item.photoUrl || item.url || (typeof item === 'string' ? item : product.imageUrl),
      designNo: item.dnNumber || item.designNo || `${idx + 1}`, dnNumber: item.dnNumber || ''
    }));
    if (product.imageUrl) return [{ photoUrl: product.imageUrl, designNo: '1' }];
    return [];
  };

  const addDesignToCart = (product, design) => {
    const cartKey = `${product.id}_${design.id}`;
    const existing = cart.find(i => i.cartKey === cartKey);
    const pcsPerSet = product.category === 'Nighty with Dupatta' ? 20 : 30;
    if (existing) setCart(cart.map(i => i.cartKey === cartKey ? { ...i, sets: i.sets + 1 } : i));
    else setCart([...cart, { cartKey, productId: product.id, designId: design.id, productName: product.name, designNo: design.designNo, dnNumber: design.dnNumber || '', photoUrl: design.photoUrl, sets: 1, availableSets: design.sets, price: product.price, supplierId: product.supplierId, supplierFirm: product.supplierFirm, category: product.category, pcsPerSet }]);
  };

  const removeDesignFromCart = (cartKey) => {
    setCart(cart.map(i => i.cartKey === cartKey ? { ...i, sets: Math.max(0, i.sets - 1) } : i).filter(i => i.sets > 0 || i.quantity));
  };

  const addSizesToCart = (product) => {
    let items = [...cart];
    Object.keys(sizeQuantities).forEach(size => {
      const qty = Number(sizeQuantities[size]);
      if (qty > 0) {
        const cartKey = `${product.id}_${size}`;
        const idx = items.findIndex(i => i.cartKey === cartKey);
        if (idx > -1) items[idx].quantity += qty;
        else items.push({ cartKey, productId: product.id, productName: product.name, quantity: qty, price: product.price, unit: product.unit || 'pc', supplierId: product.supplierId, supplierFirm: product.supplierFirm, category: product.category, size });
      }
    });
    setCart(items);
    setSizeQuantities({});
    setCartAdded(true);
  };

  const removeFromCart = (cartKey) => setCart(cart.filter(i => i.cartKey !== cartKey));
  const updateQuantity = (cartKey, qty) => setCart(cart.map(i => i.cartKey === cartKey ? { ...i, quantity: Number(qty) } : i));

  const nightyCart = cart.filter(i => NIGHTY_CATEGORIES.includes(i.category));
  const nonNightyCart = cart.filter(i => !NIGHTY_CATEGORIES.includes(i.category));
  const nightyBySupplier = nightyCart.reduce((acc, i) => {
    if (!acc[i.supplierId]) acc[i.supplierId] = { supplierFirm: i.supplierFirm, items: [], category: i.category };
    acc[i.supplierId].items.push(i); return acc;
  }, {});
  const nonNightyBySupplier = nonNightyCart.reduce((acc, i) => {
    if (!acc[i.supplierId]) acc[i.supplierId] = { supplierFirm: i.supplierFirm, items: [] };
    acc[i.supplierId].items.push(i); return acc;
  }, {});

  const cartTotal = cart.reduce((sum, i) => sum + (i.price * (i.quantity || (i.sets * (i.pcsPerSet || 30)) || 0)), 0);

  const placeOrder = async (supplierBaleDetails) => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const adminId = adminSnap.docs[0]?.id;
      for (const supplierId of Object.keys(nonNightyBySupplier)) {
        const sc = nonNightyBySupplier[supplierId];
        await addDoc(collection(db, 'orders'), { buyerId: user.uid, buyerFirm: userProfile?.firmName || '', supplierId, supplierFirm: sc.supplierFirm, items: sc.items.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, orderedQty: i.quantity, price: i.price, unit: i.unit, size: i.size || '' })), status: 'Pending', createdAt: new Date() });
        if (adminId) await notifyNewOrder(adminId, supplierId, userProfile?.firmName || '');
      }
      for (const supplierId of Object.keys(nightyBySupplier)) {
        const sc = nightyBySupplier[supplierId];
        const currentBaleDetail = supplierBaleDetails?.[supplierId] || null;
        await addDoc(collection(db, 'orders'), { buyerId: user.uid, buyerFirm: userProfile?.firmName || '', supplierId, supplierFirm: sc.supplierFirm, items: sc.items.map(i => ({ productId: i.productId, productName: i.productName, designNo: i.designNo, dnNumber: i.dnNumber, photoUrl: i.photoUrl, sets: i.sets, pcs: i.sets * i.pcsPerSet, orderedQty: i.sets, price: i.price, unit: 'Set' })), nightyDetails: currentBaleDetail ? { totalSets: currentBaleDetail.totalSets, totalPcs: currentBaleDetail.totalPcs, packingType: currentBaleDetail.packingType, totalBales: currentBaleDetail.totalBales } : null, status: 'Pending', createdAt: new Date() });
        if (adminId) await notifyNewOrder(adminId, supplierId, userProfile?.firmName || '');
        for (const item of sc.items) {
          const dRef = doc(db, 'products', item.productId, 'designs', item.designId);
          const dSnap = await getDoc(dRef);
          if (dSnap.exists()) await updateDoc(dRef, { sets: Math.max(0, dSnap.data().sets - item.sets) });
          const pRef = doc(db, 'products', item.productId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) await updateDoc(pRef, { totalSets: Math.max(0, pSnap.data().totalSets - item.sets) });
        }
      }
      setCart([]); setShowNightyCheckout(false); setOrderSuccess(true);
      fetchOrders(); fetchProducts();
      setTimeout(() => setOrderSuccess(false), 3000);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleCheckout = () => nightyCart.length > 0 ? setShowNightyCheckout(true) : placeOrder(null);
  const unreadCount = filteredNotifications.filter(n => !n.read).length;
  const totalCartItems = cart.reduce((sum, i) => sum + (i.sets || i.quantity || 0), 0);

  if (viewingProduct) {
    return (
      <div style={S.appShell}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setViewingProduct(null)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <span style={S.topBarTitle}>{viewingProduct.name}</span>
          <div style={{ width: 40 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>
          <ProductDesigns product={viewingProduct} designs={productDesigns[viewingProduct.id] || []} cart={cart} onAddSet={addDesignToCart} onRemoveSet={removeDesignFromCart} onBack={() => setViewingProduct(null)} />
        </div>
        <BottomNav activeTab={activeTab} setActiveTab={t => { setViewingProduct(null); setActiveTab(t); }} cartCount={totalCartItems} />
      </div>
    );
  }

  return (
    <div style={S.appShell}>
      {showNightyCheckout && <NightyCheckout nightyBySupplier={nightyBySupplier} onConfirm={placeOrder} onCancel={() => setShowNightyCheckout(false)} />}

      {/* TOP BAR */}
      <div style={S.topBar}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 11, color: D.gold, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Jain Agency</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: D.navy, lineHeight: 1.2 }}>
            {activeTab === 'browse' ? 'Marketplace' : activeTab === 'cart' ? 'My Cart' : activeTab === 'orders' ? 'My Orders' : 'Profile'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeTab === 'browse' && (
            <button style={S.iconBtn} onClick={() => setShowSearch(!showSearch)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </button>
          )}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button style={S.iconBtn} onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {unreadCount > 0 && <span style={S.notifBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
            {showNotifications && (
              <div style={S.notifDropdown}>
                <div style={S.notifDropHead}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: D.navy }}>Notifications</span>
                  <span style={{ fontSize: 12, color: D.textSecondary }}>{filteredNotifications.length} total</span>
                </div>
                {filteredNotifications.length === 0 ? (
                  <div style={{ padding: '30px 16px', textAlign: 'center', color: D.textSecondary, fontSize: 13 }}>No notifications yet</div>
                ) : (
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {filteredNotifications.slice(0, 20).map(n => (
                      <div key={n.id} style={{ ...S.notifItem, backgroundColor: n.read ? D.surface : '#f0f4ff' }}>
                        <span style={{ fontSize: 16, marginRight: 10 }}>{n.type === 'new_product' ? '📦' : '🔔'}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 13, color: D.textPrimary, lineHeight: 1.4 }}>{n.message}</p>
                          <p style={{ margin: '3px 0 0', fontSize: 11, color: D.textSecondary }}>
                            {n.createdAt?.toDate?.()?.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: D.navy, flexShrink: 0 }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Universal Power Off Button */}
          <button style={S.iconBtn} onClick={handleLogoutClick} title="Logout">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2.5"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={S.mainContent}>

        {/* BROWSE TAB */}
        {activeTab === 'browse' && (
          <div>
            {showSearch && (
              <div style={{ padding: '0 16px 12px' }}>
                <div style={S.searchBox}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input autoFocus style={S.searchInput} placeholder="Search products, designs, suppliers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  {searchTerm && <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: D.textSecondary }} onClick={() => setSearchTerm('')}>✕</button>}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input style={{ ...S.priceInput, flex: 1 }} type="number" placeholder="Min ₹" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
                  <span style={{ color: D.textSecondary, alignSelf: 'center' }}>—</span>
                  <input style={{ ...S.priceInput, flex: 1 }} type="number" placeholder="Max ₹" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
                </div>
              </div>
            )}
            <div style={S.chipRow}>
              <button style={!selectedCategory ? S.chipActive : S.chip} onClick={() => setSelectedCategory('')}>All</button>
              {categories.map(cat => <button key={cat} style={selectedCategory === cat ? S.chipActive : S.chip} onClick={() => setSelectedCategory(cat)}>{cat}</button>)}
            </div>
            {searchedAndFilteredProducts.length === 0 ? (
              <div style={{ padding: '60px 16px', textAlign: 'center', color: D.textSecondary }}><p style={{ fontSize: 15 }}>No products found</p></div>
            ) : (
              <div style={S.productGrid}>
                {searchedAndFilteredProducts.map(product => {
                  const designs = getProductDesignsList(product);
                  const idx = cardDesignIndices[product.id] || 0;
                  const img = designs[idx]?.photoUrl || 'https://via.placeholder.com/200';
                  return (
                    <div key={product.id} style={S.productCard}
                      onClick={() => { setSelectedProductDetails(product); setModalDesignIdx(idx); setSizeQuantities({}); setCartAdded(false); }}>
                      <div style={S.cardImgWrap}>
                        <img src={img} alt={product.name} style={S.cardImg} />
                        {designs.length > 1 && (
                          <>
                            <button style={S.cardArrow('left')} onClick={e => { e.stopPropagation(); setCardDesignIndices(p => ({ ...p, [product.id]: ((p[product.id] || 0) - 1 + designs.length) % designs.length })); }}>‹</button>
                            <button style={S.cardArrow('right')} onClick={e => { e.stopPropagation(); setCardDesignIndices(p => ({ ...p, [product.id]: ((p[product.id] || 0) + 1) % designs.length })); }}>›</button>
                            <div style={S.designCountBadge}>{idx + 1}/{designs.length}</div>
                          </>
                        )}
                      </div>
                      <div style={S.cardInfo}>
                        <span style={S.cardCategory}>{product.category}</span>
                        <p style={S.cardName}>{product.name}</p>
                        <p style={S.cardSupplier}>{product.supplierFirm}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                          <span style={S.cardPrice}>₹{product.price}<span style={{ fontSize: 11, fontWeight: 400, color: D.textSecondary }}>/pc</span></span>
                          <span style={S.detailsTag}>View →</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CART TAB */}
        {activeTab === 'cart' && (
          <div style={{ padding: '12px 16px' }}>
            {cart.length === 0 ? (
              <div style={{ padding: '80px 0', textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: '#e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                </div>
                <p style={{ color: D.textPrimary, fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>Your cart is empty</p>
                <p style={{ color: D.textSecondary, fontSize: 13, margin: '0 0 24px' }}>Browse products and add items to your cart</p>
                <button style={{ ...S.btnPrimary, width: 'auto', padding: '12px 28px', margin: '0 auto' }} onClick={() => setActiveTab('browse')}>Browse Products</button>
              </div>
            ) : (
              <>
                <div style={{ backgroundColor: D.navy, borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Cart Total</p>
                    <p style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 800, color: 'white' }}>₹{cartTotal.toLocaleString('en-IN')}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{totalCartItems} items</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: D.goldLight }}>{cart.length} product{cart.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {Object.keys(nonNightyBySupplier).map(sid => (
                  <div key={sid} style={S.supplierSection}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: D.navy }}>{nonNightyBySupplier[sid].supplierFirm?.[0]?.toUpperCase()}</span>
                      </div>
                      <span style={S.supplierLabel}>{nonNightyBySupplier[sid].supplierFirm}</span>
                    </div>
                    {nonNightyBySupplier[sid].items.map(item => (
                      <div key={item.cartKey} style={{ ...S.cartItem, padding: '12px 0' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: D.textPrimary }}>{item.productName}</p>
                            {item.size && <span style={S.sizeBadge}>{item.size}</span>}
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: D.textSecondary }}>₹{item.price}/pc · Total: <b style={{ color: D.navy }}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</b></p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${D.border}`, borderRadius: 8, overflow: 'hidden' }}>
                            <button style={{ width: 32, height: 36, border: 'none', backgroundColor: D.bg, cursor: 'pointer', fontSize: 16, color: D.navy, fontWeight: 700 }}
                              onClick={() => { if (item.quantity <= 1) removeFromCart(item.cartKey); else updateQuantity(item.cartKey, item.quantity - 1); }}>−</button>
                            <input type="number" min={1} value={item.quantity} onChange={e => updateQuantity(item.cartKey, e.target.value)}
                              style={{ width: 44, height: 36, border: 'none', textAlign: 'center', fontSize: 13, fontWeight: 700, color: D.navy, backgroundColor: D.surface, outline: 'none' }} />
                            <button style={{ width: 32, height: 36, border: 'none', backgroundColor: D.bg, cursor: 'pointer', fontSize: 16, color: D.navy, fontWeight: 700 }}
                              onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}>+</button>
                          </div>
                          <button style={{ width: 30, height: 30, borderRadius: 8, border: 'none', backgroundColor: '#fce8e6', color: D.error, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => removeFromCart(item.cartKey)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {Object.keys(nightyBySupplier).map(sid => (
                  <div key={sid} style={S.supplierSection}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: D.navy }}>{nightyBySupplier[sid].supplierFirm?.[0]?.toUpperCase()}</span>
                      </div>
                      <span style={S.supplierLabel}>{nightyBySupplier[sid].supplierFirm}</span>
                      <span style={{ fontSize: 10, color: D.gold, fontWeight: 600, backgroundColor: '#fef7e0', padding: '2px 7px', borderRadius: 10 }}>{nightyBySupplier[sid].category}</span>
                    </div>
                    {nightyBySupplier[sid].items.map(item => (
                      <div key={item.cartKey} style={{ ...S.cartItem, padding: '10px 0' }}>
                        <img src={item.photoUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: `1px solid ${D.borderLight}` }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 13, color: D.textPrimary }}>{item.productName}</p>
                          <p style={{ margin: 0, fontSize: 12, color: D.textSecondary }}>DN {item.designNo}{item.dnNumber ? ` (${item.dnNumber})` : ''} · {item.pcsPerSet} pcs/set</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button style={{ width: 30, height: 30, borderRadius: '50%', border: `1.5px solid ${D.border}`, backgroundColor: D.surface, cursor: 'pointer', fontSize: 16, fontWeight: 700, color: D.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => removeDesignFromCart(item.cartKey)}>−</button>
                          <span style={{ fontSize: 15, fontWeight: 800, minWidth: 24, textAlign: 'center', color: D.navy }}>{item.sets}</span>
                          <button style={{ width: 30, height: 30, borderRadius: '50%', border: `1.5px solid ${D.border}`, backgroundColor: D.surface, cursor: 'pointer', fontSize: 16, fontWeight: 700, color: D.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => addDesignToCart(products.find(p => p.id === item.productId), { id: item.designId, designNo: item.designNo, dnNumber: item.dnNumber, photoUrl: item.photoUrl, sets: item.availableSets })}>+</button>
                          <button style={{ width: 30, height: 30, borderRadius: 8, border: 'none', backgroundColor: '#fce8e6', color: D.error, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => removeFromCart(item.cartKey)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                <div style={{ padding: '8px 0 100px' }}>
                  {nightyCart.length > 0 && (
                    <p style={{ fontSize: 12, color: D.textSecondary, marginBottom: 12, padding: '10px 14px', backgroundColor: '#f0f4ff', borderRadius: 8, border: `1px solid #c5d0f0` }}>
                      📦 Bale packing details will be confirmed at checkout
                    </p>
                  )}
                  {orderSuccess && (
                    <div style={{ backgroundColor: '#e6f4ea', borderRadius: 10, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>✓</span>
                      <p style={{ margin: 0, color: D.success, fontWeight: 700, fontSize: 14 }}>Order placed successfully!</p>
                    </div>
                  )}
                  <button style={S.btnPrimary} onClick={handleCheckout} disabled={loading}>
                    {loading ? 'Placing Order...' : `Proceed to Checkout · ₹${cartTotal.toLocaleString('en-IN')}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div style={{ padding: '8px 16px' }}>
            {orders.length === 0 ? (
              <div style={{ padding: '80px 0', textAlign: 'center', color: D.textSecondary }}><p style={{ fontSize: 15 }}>No orders yet</p></div>
            ) : orders.map(order => <OrderCard key={order.id} order={order} />)}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && userProfile && (
          <div style={{ padding: '0 16px 80px' }}>
            <ProfileEdit userProfile={userProfile} onSave={fetchProfile} categories={categories} />
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} cartCount={totalCartItems} />

      {/* PRODUCT DETAIL MODAL */}
      {selectedProductDetails && (
        <div style={S.modalOverlay} onClick={() => { setSelectedProductDetails(null); setCartAdded(false); }}>
          <div style={S.productModal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHandle} />
            <button style={S.modalClose} onClick={() => { setSelectedProductDetails(null); setCartAdded(false); }}>✕</button>
            {(() => {
              const designs = getProductDesignsList(selectedProductDetails);
              const img = designs[modalDesignIdx]?.photoUrl || 'https://via.placeholder.com/300';
              return (
                <div style={{ position: 'relative', width: '100%', aspectRatio: '4/5', backgroundColor: D.bg, overflow: 'hidden' }}>
                  <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {designs.length > 1 && (
                    <>
                      <button style={S.slideArrow('left')} onClick={() => setModalDesignIdx(p => (p - 1 + designs.length) % designs.length)}>‹</button>
                      <button style={S.slideArrow('right')} onClick={() => setModalDesignIdx(p => (p + 1) % designs.length)}>›</button>
                      <div style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '3px 8px', borderRadius: 20, fontSize: 11 }}>{modalDesignIdx + 1}/{designs.length}</div>
                    </>
                  )}
                </div>
              );
            })()}
            <div style={{ padding: 16, overflowY: 'auto' }}>
              <span style={S.modalCategory}>{selectedProductDetails.category}</span>
              <h2 style={{ margin: '6px 0 4px', fontSize: 20, fontWeight: 700, color: D.navy }}>{selectedProductDetails.name}</h2>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: D.textSecondary }}>{selectedProductDetails.supplierFirm}</p>
              <div style={S.specsRow}>
                <div style={S.specItem}><span style={S.specLabel}>Rate</span><span style={S.specValue}>₹{selectedProductDetails.price}/pc</span></div>
                <div style={S.specItem}><span style={S.specLabel}>MOQ</span><span style={S.specValue}>{selectedProductDetails.moq} pcs</span></div>
                {selectedProductDetails.material && <div style={S.specItem}><span style={S.specLabel}>Material</span><span style={S.specValue}>{selectedProductDetails.material}</span></div>}
                {selectedProductDetails.cut && <div style={S.specItem}><span style={S.specLabel}>Cut</span><span style={S.specValue}>{selectedProductDetails.cut}</span></div>}
              </div>
              {selectedProductDetails.sizes?.length > 0 && !NIGHTY_CATEGORIES.includes(selectedProductDetails.category) && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: D.navy, margin: '0 0 10px' }}>Qty per Size <span style={{ fontWeight: 400, color: D.textSecondary }}>(multiple of {selectedProductDetails.moq})</span></p>
                  {selectedProductDetails.sizes.map(size => (
                    <div key={size} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: D.textPrimary }}>Size {size}</span>
                      <input type="number" min="0" placeholder="0" value={sizeQuantities[size] || ''}
                        onChange={e => { setSizeQuantities({ ...sizeQuantities, [size]: e.target.value }); setCartAdded(false); }}
                        style={{ width: 80, padding: '6px 10px', border: `1px solid ${D.border}`, borderRadius: 6, textAlign: 'center', fontSize: 14 }} />
                    </div>
                  ))}
                </div>
              )}
              {(() => {
                const designs = getProductDesignsList(selectedProductDetails);
                if (designs.length <= 1) return null;
                return (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: D.textSecondary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Designs</p>
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                      {designs.map((d, idx) => (
                        <div key={idx} onClick={() => setModalDesignIdx(idx)} style={{ flexShrink: 0, width: 64, cursor: 'pointer', borderRadius: 6, overflow: 'hidden', border: `2px solid ${modalDesignIdx === idx ? D.gold : D.borderLight}` }}>
                          <img src={d.photoUrl} alt="" style={{ width: '100%', height: 64, objectFit: 'cover' }} />
                          <p style={{ margin: 0, fontSize: 10, textAlign: 'center', padding: '2px 0', color: D.textSecondary }}>DN{d.designNo}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {NIGHTY_CATEGORIES.includes(selectedProductDetails.category) ? (
                <button style={S.btnPrimary} onClick={() => { setSelectedProductDetails(null); setViewingProduct(selectedProductDetails); }}>
                  Select Designs & Bales
                </button>
              ) : (() => {
                const total = Object.values(sizeQuantities).reduce((s, q) => s + Number(q || 0), 0);
                const moq = Number(selectedProductDetails.moq || 1);
                const valid = total > 0 && total % moq === 0;

                if (cartAdded) {
                  return (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ ...S.btnGhost, flex: 1 }} onClick={() => setCartAdded(false)}>+ Add More</button>
                      <button style={{ ...S.btnPrimary, flex: 1, backgroundColor: D.gold }}
                        onClick={() => { setSelectedProductDetails(null); setCartAdded(false); setActiveTab('cart'); }}>
                        Go to Cart →
                      </button>
                    </div>
                  );
                }
                return (
                  <>
                    {total > 0 && !valid && <p style={{ fontSize: 12, color: D.error, margin: '0 0 8px', fontWeight: 600 }}>⚠ Total {total} pcs must be multiple of {moq}</p>}
                    <button style={{ ...S.btnPrimary, backgroundColor: (selectedProductDetails.sizes?.length > 0 && !valid) ? D.border : D.navy }}
                      onClick={() => addSizesToCart(selectedProductDetails)}
                      disabled={selectedProductDetails.sizes?.length > 0 && !valid}>
                      Add to Cart {total > 0 ? `(${total} pcs)` : ''}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BottomNav ───────────────────────────────────────────────
function BottomNav({ activeTab, setActiveTab, cartCount }) {
  const tabs = [
    { id: 'browse', label: 'Home', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { id: 'orders', label: 'Orders', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
    { id: 'cart', label: 'Cart', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
    { id: 'profile', label: 'Profile', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ];
  return (
    <div style={S.bottomNav}>
      {tabs.map(tab => (
        <button key={tab.id} style={{ ...S.navBtn, color: activeTab === tab.id ? D.navy : D.textSecondary }} onClick={() => setActiveTab(tab.id)}>
          <div style={{ position: 'relative' }}>
            {React.cloneElement(tab.icon, { stroke: activeTab === tab.id ? D.navy : D.textSecondary, strokeWidth: activeTab === tab.id ? 2.5 : 1.8 })}
            {tab.id === 'cart' && cartCount > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -8, backgroundColor: D.gold, color: 'white', fontSize: 9, fontWeight: 700, borderRadius: 20, padding: '1px 5px', minWidth: 14, textAlign: 'center' }}>{cartCount > 99 ? '99+' : cartCount}</span>
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: activeTab === tab.id ? 700 : 500, marginTop: 2 }}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

function getStatusStyle(status) {
  if (status === 'Delivered') return { backgroundColor: '#e6f4ea', color: '#1a6b3c' };
  if (status === 'Shipped') return { backgroundColor: '#e8f0fe', color: '#1a3a8f' };
  if (status === 'Processing') return { backgroundColor: '#fef7e0', color: '#7a5200' };
  if (status === 'Cancelled') return { backgroundColor: '#fce8e6', color: '#ba1a1a' };
  return { backgroundColor: '#f1f3f4', color: '#44474d' };
}

const S = {
  // RESPONSIVE UPDATE: Removed maxWidth: 480, set width/height to 100% to fit wrapper
  appShell: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: D.bg, fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: D.surface, borderBottom: `1px solid ${D.borderLight}`, flexShrink: 0, zIndex: 10 },
  topBarTitle: { fontSize: 16, fontWeight: 700, color: D.navy },
  mainContent: { flex: 1, overflowY: 'auto', paddingBottom: 80 },
  backBtn: { width: 36, height: 36, borderRadius: 8, border: `1px solid ${D.borderLight}`, backgroundColor: D.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.navy },
  iconBtn: { width: 40, height: 40, borderRadius: 20, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notifBadge: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', backgroundColor: D.error },
  notifDropdown: { position: 'absolute', top: 48, right: 0, width: 300, backgroundColor: D.surface, borderRadius: 12, boxShadow: '0 8px 24px rgba(3,22,50,0.12)', zIndex: 100, overflow: 'hidden', border: `1px solid ${D.borderLight}` },
  notifDropHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${D.borderLight}`, backgroundColor: D.bg },
  notifItem: { display: 'flex', alignItems: 'flex-start', padding: '12px 16px', borderBottom: `1px solid ${D.borderLight}` },
  searchBox: { display: 'flex', alignItems: 'center', gap: 10, backgroundColor: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: '10px 14px' },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: 14, color: D.textPrimary, backgroundColor: 'transparent' },
  priceInput: { padding: '8px 12px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 13, color: D.textPrimary, outline: 'none', backgroundColor: D.surface },
  chipRow: { display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 16px', scrollbarWidth: 'none' },
  chip: { flexShrink: 0, padding: '7px 14px', border: `1px solid ${D.border}`, borderRadius: 20, backgroundColor: D.surface, fontSize: 13, color: D.textSecondary, cursor: 'pointer', whiteSpace: 'nowrap' },
  chipActive: { flexShrink: 0, padding: '7px 14px', border: `1px solid ${D.navy}`, borderRadius: 20, backgroundColor: D.navy, fontSize: 13, color: 'white', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 },
  
  // RESPONSIVE UPDATE: Dynamic grid sizing instead of fixed columns
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, padding: '0 16px 16px' },
  
  productCard: { backgroundColor: D.surface, borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(3,22,50,0.06)', cursor: 'pointer', border: `1px solid ${D.borderLight}` },
  cardImgWrap: { position: 'relative', width: '100%', aspectRatio: '3/4', backgroundColor: D.bg, overflow: 'hidden' },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  cardArrow: (side) => ({ position: 'absolute', top: '50%', [side]: 6, transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.9)', border: 'none', width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }),
  designCountBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(3,22,50,0.7)', color: 'white', padding: '2px 6px', borderRadius: 10, fontSize: 10 },
  cardInfo: { padding: '10px 10px 12px' },
  cardCategory: { fontSize: 10, fontWeight: 600, color: D.gold, textTransform: 'uppercase', letterSpacing: '0.06em' },
  cardName: { margin: '3px 0 2px', fontSize: 13, fontWeight: 700, color: D.textPrimary, lineHeight: 1.3 },
  cardSupplier: { margin: 0, fontSize: 11, color: D.textSecondary },
  cardPrice: { fontSize: 14, fontWeight: 700, color: D.navy },
  detailsTag: { fontSize: 11, color: D.surface, backgroundColor: D.navy, padding: '4px 8px', borderRadius: 4, fontWeight: 600 },
  supplierSection: { backgroundColor: D.surface, borderRadius: 12, padding: '14px 14px 4px', marginBottom: 12, boxShadow: '0 1px 6px rgba(3,22,50,0.06)', border: `1px solid ${D.borderLight}` },
  supplierLabel: { margin: 0, fontSize: 12, fontWeight: 700, color: D.navy, textTransform: 'uppercase', letterSpacing: '0.05em' },
  cartItem: { display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${D.borderLight}` },
  sizeBadge: { backgroundColor: '#e8edf5', border: 'none', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700, color: D.navy },
  qtyInput: { width: 60, padding: '6px 4px', border: `1px solid ${D.border}`, borderRadius: 6, textAlign: 'center', fontSize: 13 },
  qtyCircleBtn: { width: 28, height: 28, borderRadius: '50%', border: `1px solid ${D.border}`, backgroundColor: D.surface, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  removeBtn: { width: 28, height: 28, borderRadius: 6, border: 'none', backgroundColor: '#fce8e6', color: D.error, cursor: 'pointer', fontSize: 12, fontWeight: 700 },
  statusBadge: { padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  profileCard: { backgroundColor: D.surface, borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(3,22,50,0.06)', textAlign: 'center', marginTop: 8 },
  profileAvatar: { width: 64, height: 64, borderRadius: '50%', backgroundColor: '#e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' },
  profileRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${D.borderLight}`, textAlign: 'left' },
  profileLabel: { fontSize: 12, color: D.textSecondary, fontWeight: 500 },
  profileValue: { fontSize: 13, color: D.textPrimary, fontWeight: 600, textAlign: 'right', maxWidth: '60%' },
  prefBadge: { backgroundColor: D.navyMid, color: 'white', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 },
  input: { display: 'block', width: '100%', padding: '11px 14px', border: `1px solid ${D.border}`, borderRadius: 8, fontSize: 14, color: D.textPrimary, outline: 'none', boxSizing: 'border-box', marginBottom: 10, backgroundColor: D.surface },
  btnPrimary: { display: 'block', width: '100%', padding: '14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em' },
  btnGhost: { display: 'block', width: '100%', padding: '13px', backgroundColor: 'transparent', color: D.navy, border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  
  // RESPONSIVE UPDATE: Removed maxWidth from BottomNav so it spans the wrapper
  bottomNav: { position: 'fixed', bottom: 0, width: '100%', display: 'flex', backgroundColor: D.surface, borderTop: `1px solid ${D.borderLight}`, zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)' },
  navBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', minHeight: 56 },
  
  // RESPONSIVE UPDATE: Center modals on larger screens
  modalOverlay: { position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(3,22,50,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fullModal: { backgroundColor: D.surface, borderRadius: '16px', padding: '12px 16px 32px', width: '90%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  productModal: { backgroundColor: D.surface, borderRadius: '16px', width: '90%', maxWidth: 600, maxHeight: '88vh', overflowY: 'auto', position: 'relative' },
  
  modalHandle: { width: 36, height: 4, backgroundColor: D.border, borderRadius: 2, margin: '8px auto 12px' },
  modalHeading: { margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: D.navy },
  modalClose: { position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.9)', cursor: 'pointer', fontSize: 13, fontWeight: 700, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalCategory: { fontSize: 11, fontWeight: 600, color: D.gold, textTransform: 'uppercase', letterSpacing: '0.06em' },
  specsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, backgroundColor: D.bg, padding: 12, borderRadius: 8, marginBottom: 14 },
  specItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  specLabel: { fontSize: 11, color: D.textSecondary, fontWeight: 500 },
  specValue: { fontSize: 14, fontWeight: 700, color: D.navy },
  packActive: { flex: 1, padding: '14px 10px', backgroundColor: D.navy, color: 'white', border: `2px solid ${D.navy}`, borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  packBtn: { flex: 1, padding: '14px 10px', backgroundColor: D.surface, color: D.navy, border: `2px solid ${D.border}`, borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  slideArrow: (side) => ({ position: 'absolute', top: '50%', [side]: 10, transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.85)', border: 'none', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }),
};

export default BuyerDashboard;