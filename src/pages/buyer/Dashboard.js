import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import ProductDesigns from './ProductDesigns';
import { notifyNewOrder } from '../../utils/notifications';

const NIGHTY_CATEGORIES = ['Nighty', 'Nighty with Dupatta'];

function ProfileEdit({ userProfile, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(userProfile);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await updateDoc(doc(db, 'users', userProfile.uid), {
      firmName: form.firmName, contactPerson: form.contactPerson, mobile: form.mobile,
      address: form.address, city: form.city, district: form.district, state: form.state, pincode: form.pincode,
    });
    setLoading(false);
    setEditing(false);
    onSave();
  };

  if (!editing) {
    return (
      <div style={styles.profileCard}>
        <p><b>Firm Name:</b> {userProfile.firmName}</p>
        <p><b>GST:</b> {userProfile.gstNumber}</p>
        <p><b>Contact:</b> {userProfile.contactPerson}</p>
        <p><b>Mobile:</b> {userProfile.mobile}</p>
        <p><b>Address:</b> {userProfile.address}</p>
        <p><b>City:</b> {userProfile.city}</p>
        <p><b>District:</b> {userProfile.district}</p>
        <p><b>State:</b> {userProfile.state}</p>
        <p><b>Pincode:</b> {userProfile.pincode}</p>
        <button style={styles.editBtn} onClick={() => setEditing(true)}>Edit Profile</button>
      </div>
    );
  }

  return (
    <div style={styles.profileCard}>
      <input style={styles.input} value={form.firmName} onChange={e => setForm({...form, firmName: e.target.value})} placeholder="Firm Name" />
      <input style={styles.input} value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})} placeholder="Contact Person" />
      <input style={styles.input} value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} placeholder="Mobile" />
      <input style={styles.input} value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Address" />
      <input style={styles.input} value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="City" />
      <input style={styles.input} value={form.district} onChange={e => setForm({...form, district: e.target.value})} placeholder="District" />
      <input style={styles.input} value={form.state} onChange={e => setForm({...form, state: e.target.value})} placeholder="State" />
      <input style={styles.input} value={form.pincode} onChange={e => setForm({...form, pincode: e.target.value})} placeholder="Pincode" />
      <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
        <button style={styles.editBtn} onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        <button style={{...styles.editBtn, backgroundColor:'#999'}} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

function NightyCheckout({ nightyBySupplier, onConfirm, onCancel }) {
  const [packingTypes, setPackingTypes] = useState({});
  const [error, setError] = useState('');

  const suppliers = Object.keys(nightyBySupplier);

  const handleConfirm = () => {
    let tempPackingDetails = {};
    let hasError = false;

    for (const sId of suppliers) {
      const group = nightyBySupplier[sId];
      const totalSets = group.items.reduce((sum, item) => sum + (item.sets || 0), 0);
      const pType = packingTypes[sId];

      if (!pType) {
        setError(`Please select packing type for ${group.supplierFirm}`);
        hasError = true;
        break;
      }

      const typeNum = Number(pType);
      if (totalSets % typeNum !== 0) {
        setError(`${group.supplierFirm} has ${totalSets} sets. It cannot make complete bales of ${pType}. Need multiple of ${pType}.`);
        hasError = true;
        break;
      }

      tempPackingDetails[sId] = {
        packingType: typeNum,
        totalBales: totalSets / typeNum,
        totalSets: totalSets,
        totalPcs: totalSets * (group.items[0]?.pcsPerSet || 30)
      };
    }

    if (!hasError) {
      onConfirm(tempPackingDetails);
    }
  };

  const handleSelectType = (supplierId, type) => {
    setPackingTypes({ ...packingTypes, [supplierId]: type });
    setError('');
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modal, maxWidth: '550px' }}>
        <h3 style={styles.modalTitle}>Nighty Bale Selection (Per Supplier)</h3>
        
        {suppliers.map(sId => {
          const group = nightyBySupplier[sId];
          const totalSets = group.items.reduce((sum, item) => sum + (item.sets || 0), 0);
          const currentType = packingTypes[sId];
          const isValid = currentType ? totalSets % Number(currentType) === 0 : false;

          return (
            <div key={sId} style={{ borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '15px' }}>
              <p style={{ fontWeight: 'bold', color: '#1a1a2e', margin: '0 0 5px 0' }}>{group.supplierFirm}</p>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#555' }}>Total Sets: <b>{totalSets}</b></p>
              
              <div style={styles.typeRow}>
                <button type="button" style={currentType === '8' ? styles.typeActive : styles.typeBtn}
                  onClick={() => handleSelectType(sId, '8')}>8 Sets/Bale</button>
                <button type="button" style={currentType === '10' ? styles.typeActive : styles.typeBtn}
                  onClick={() => handleSelectType(sId, '10')}>10 Sets/Bale</button>
              </div>

              {currentType && (
                <div style={styles.baleCalc}>
                  {isValid 
                    ? <p style={styles.validMsg}>✓ {totalSets / Number(currentType)} complete bale(s)</p>
                    : <p style={styles.invalidMsg}>✗ Need multiple of {currentType}. Current: {totalSets} sets</p>
                  }
                </div>
              )}
            </div>
          );
        })}

        {error && <p style={styles.errorMsg}>{error}</p>}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button style={styles.confirmBtn} onClick={handleConfirm}>Confirm & Place Orders</button>
          <button style={{ ...styles.confirmBtn, backgroundColor: '#999' }} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

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

  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  const buyerId = auth.currentUser?.uid;
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  // Real-time notification listener
  useEffect(() => {
    if (!buyerId) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', buyerId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [buyerId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
    await batch.commit();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

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

  useEffect(() => {
    if (selectedProductDetails) {
      window.history.pushState({ modalOpen: true }, '');
    }
    const handlePopState = () => {
      if (selectedProductDetails) setSelectedProductDetails(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedProductDetails]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedProductDetails) setSelectedProductDetails(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProductDetails]);

  useEffect(() => {
    fetchProfile();
    fetchProducts();
    fetchOrders();
  }, []);

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
    const searchLower = searchTerm.toLowerCase();
    const currentProductDesigns = productDesigns[product.id] || [];
    const matchesDesignNo = currentProductDesigns.some(d => {
      const dNoStr = d.designNo ? String(d.designNo).toLowerCase() : '';
      const dnNumStr = d.dnNumber ? String(d.dnNumber).toLowerCase() : '';
      return dNoStr.includes(searchLower) || dnNumStr.includes(searchLower);
    });

    const matchesSearch = 
      product.name?.toLowerCase().includes(searchLower) ||
      product.category?.toLowerCase().includes(searchLower) ||
      product.supplierFirm?.toLowerCase().includes(searchLower) ||
      product.material?.toLowerCase().includes(searchLower) ||
      product.cut?.toLowerCase().includes(searchLower) ||
      product.productType?.toLowerCase().includes(searchLower) ||
      matchesDesignNo;

    const matchesMinPrice = minPrice ? Number(product.price) >= Number(minPrice) : true;
    const matchesMaxPrice = maxPrice ? Number(product.price) <= Number(maxPrice) : true;

    return matchesSearch && matchesMinPrice && matchesMaxPrice;
  });

  const addDesignToCart = (product, design) => {
    const cartKey = `${product.id}_${design.id}`;
    const existing = cart.find(item => item.cartKey === cartKey);
    const pcsPerSet = product.category === 'Nighty with Dupatta' ? 20 : 30;
    if (existing) {
      setCart(cart.map(item => item.cartKey === cartKey ? { ...item, sets: item.sets + 1 } : item));
    } else {
      setCart([...cart, {
        cartKey, productId: product.id, designId: design.id,
        productName: product.name, designNo: design.designNo, dnNumber: design.dnNumber || '',
        photoUrl: design.photoUrl, sets: 1, availableSets: design.sets,
        price: product.price, supplierId: product.supplierId, supplierFirm: product.supplierFirm,
        category: product.category, pcsPerSet,
      }]);
    }
  };

  const removeDesignFromCart = (cartKey) => {
    setCart(cart.map(item => item.cartKey === cartKey ? { ...item, sets: Math.max(0, item.sets - 1) } : item)
      .filter(item => item.sets > 0 || item.quantity));
  };

  const addSizesToCart = (product) => {
    let newCartItems = [...cart];
    Object.keys(sizeQuantities).forEach(size => {
      const qty = Number(sizeQuantities[size]);
      if (qty > 0) {
        const cartKey = `${product.id}_${size}`;
        const existingIdx = newCartItems.findIndex(item => item.cartKey === cartKey);
        if (existingIdx > -1) {
          newCartItems[existingIdx].quantity += qty;
        } else {
          newCartItems.push({
            cartKey, productId: product.id, productName: product.name,
            quantity: qty, price: product.price, unit: product.unit || 'pc',
            supplierId: product.supplierId, supplierFirm: product.supplierFirm, category: product.category,
            size: size
          });
        }
      }
    });
    setCart(newCartItems);
    setSelectedProductDetails(null);
    setSizeQuantities({});
  };

  const updateQuantity = (cartKey, quantity) => {
    setCart(cart.map(item => item.cartKey === cartKey ? { ...item, quantity: Number(quantity) } : item));
  };

  const removeFromCart = (cartKey) => setCart(cart.filter(item => item.cartKey !== cartKey));

  const nightyCart = cart.filter(item => NIGHTY_CATEGORIES.includes(item.category));
  const nonNightyCart = cart.filter(item => !NIGHTY_CATEGORIES.includes(item.category));

  const nightyBySupplier = nightyCart.reduce((acc, item) => {
    if (!acc[item.supplierId]) acc[item.supplierId] = { supplierFirm: item.supplierFirm, items: [], category: item.category };
    acc[item.supplierId].items.push(item);
    return acc;
  }, {});

  const nonNightyBySupplier = nonNightyCart.reduce((acc, item) => {
    if (!acc[item.supplierId]) acc[item.supplierId] = { supplierFirm: item.supplierFirm, items: [] };
    acc[item.supplierId].items.push(item);
    return acc;
  }, {});

  const placeOrder = async (supplierBaleDetails) => {
    setLoading(true);
    try {
      const user = auth.currentUser;

      // Admin ID fetch karo (notification ke liye)
      const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const adminId = adminSnap.docs[0]?.id;

      for (const supplierId of Object.keys(nonNightyBySupplier)) {
        const sc = nonNightyBySupplier[supplierId];
        await addDoc(collection(db, 'orders'), {
          buyerId: user.uid, buyerFirm: userProfile?.firmName || '',
          supplierId, supplierFirm: sc.supplierFirm,
          items: sc.items.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, price: i.price, unit: i.unit, size: i.size || '' })),
          status: 'Pending', createdAt: new Date(),
        });

        // Admin + supplier ko notify karo
        if (adminId) await notifyNewOrder(adminId, supplierId, userProfile?.firmName || '');
      }

      for (const supplierId of Object.keys(nightyBySupplier)) {
        const sc = nightyBySupplier[supplierId];
        const totalSets = sc.items.reduce((s, i) => s + i.sets, 0);
        const pcsPerSet = sc.items[0]?.pcsPerSet || 30;
        const currentBaleDetail = supplierBaleDetails ? supplierBaleDetails[supplierId] : null;

        await addDoc(collection(db, 'orders'), {
          buyerId: user.uid, buyerFirm: userProfile?.firmName || '',
          supplierId, supplierFirm: sc.supplierFirm,
          items: sc.items.map(i => ({
            productId: i.productId, productName: i.productName,
            designNo: i.designNo, dnNumber: i.dnNumber,
            photoUrl: i.photoUrl, sets: i.sets, pcs: i.sets * i.pcsPerSet, price: i.price,
          })),
          nightyDetails: currentBaleDetail ? {
            totalSets: currentBaleDetail.totalSets,
            totalPcs: currentBaleDetail.totalPcs,
            packingType: currentBaleDetail.packingType,
            totalBales: currentBaleDetail.totalBales,
          } : null,
          status: 'Pending', createdAt: new Date(),
        });

        // Admin + supplier ko notify karo
        if (adminId) await notifyNewOrder(adminId, supplierId, userProfile?.firmName || '');

        for (const item of sc.items) {
          const designRef = doc(db, 'products', item.productId, 'designs', item.designId);
          const designSnap = await getDoc(designRef);
          if (designSnap.exists()) {
            await updateDoc(designRef, { sets: Math.max(0, designSnap.data().sets - item.sets) });
          }
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            await updateDoc(productRef, { totalSets: Math.max(0, productSnap.data().totalSets - item.sets) });
          }
        }
      }

      setCart([]);
      setShowNightyCheckout(false);
      setOrderSuccess(true);
      fetchOrders();
      fetchProducts();
      setTimeout(() => setOrderSuccess(false), 3000);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleCheckout = () => {
    if (nightyCart.length > 0) {
      setShowNightyCheckout(true);
    } else {
      placeOrder(null);
    }
  };

  const handleNextCardDesign = (e, productId, total) => {
    e.stopPropagation();
    setCardDesignIndices(prev => ({ ...prev, [productId]: ((prev[productId] || 0) + 1) % total }));
  };

  const handlePrevCardDesign = (e, productId, total) => {
    e.stopPropagation();
    setCardDesignIndices(prev => ({ ...prev, [productId]: ((prev[productId] || 0) - 1 + total) % total }));
  };

  const getProductDesignsList = (product) => {
    const subCollection = productDesigns[product.id] || [];
    if (subCollection.length > 0) return subCollection;
    
    const arrayPhotos = product.imageUrls || product.photos || [];
    if (arrayPhotos.length > 0) {
      return arrayPhotos.map((item, idx) => {
        const imgUrl = item.photoUrl || item.url || (typeof item === 'string' ? item : product.imageUrl);
        const dNo = item.dnNumber || item.designNo || `${idx + 1}`;
        return { photoUrl: imgUrl, designNo: dNo, dnNumber: item.dnNumber || '' };
      });
    }
    
    if (product.imageUrl) return [{ photoUrl: product.imageUrl, designNo: '1' }];
    return [];
  };

  if (viewingProduct) {
    return (
      <div style={styles.container}>
        <div style={styles.sidebar}>
          <h2 style={styles.logo}>Buyer Panel</h2>
          {userProfile && <p style={styles.firmName}>{userProfile.firmName}</p>}
          <button style={styles.tab} onClick={() => { setViewingProduct(null); setActiveTab('browse'); }}>Browse Products</button>
          <button style={styles.tab} onClick={() => { setViewingProduct(null); setActiveTab('cart'); }}>
            Cart {cart.length > 0 && `(${cart.length})`}
          </button>
          <button style={styles.tab} onClick={() => { setViewingProduct(null); setActiveTab('orders'); }}>All Orders ({orders.length})</button>
          <button style={styles.tab} onClick={() => { setViewingProduct(null); setActiveTab('profile'); }}>My Profile</button>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
        <ProductDesigns
          product={viewingProduct}
          designs={productDesigns[viewingProduct.id] || []}
          cart={cart}
          onAddSet={addDesignToCart}
          onRemoveSet={removeDesignFromCart}
          onBack={() => setViewingProduct(null)}
        />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {showNightyCheckout && (
        <NightyCheckout
          nightyBySupplier={nightyBySupplier}
          onConfirm={details => placeOrder(details)}
          onCancel={() => setShowNightyCheckout(false)}
        />
      )}

      <div style={styles.sidebar}>
        <h2 style={styles.logo}>Buyer Panel</h2>
        {userProfile && <p style={styles.firmName}>{userProfile.firmName}</p>}
        <button style={activeTab === 'browse' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('browse')}>Browse Products</button>
        <button style={activeTab === 'cart' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('cart')}>
          Cart {cart.length > 0 && `(${cart.length})`}
        </button>
        <button style={activeTab === 'orders' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('orders')}>All Orders ({orders.length})</button>
        <button style={activeTab === 'profile' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('profile')}>My Profile</button>
        <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      <div style={styles.main}>
        <div style={styles.topHeader}>
          <h2 style={{ color: '#1a1a2e', margin: 0 }}>Jain Agency Marketplace</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* NOTIFICATION BELL */}
            <div style={styles.bellWrapper} ref={notifRef}>
              <button style={styles.bellBtn} onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}>
                🔔
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

            {/* CART ICON */}
            <div style={styles.cartIconContainer} onClick={() => setActiveTab('cart')}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
              {cart.length > 0 && <span style={styles.cartBadge}>{cart.length}</span>}
            </div>
          </div>
        </div>

        {activeTab === 'browse' && (
          <div>
            <div style={styles.searchFilterRow}>
              <input 
                type="text" 
                placeholder="Search by name, category, material, cut, design no..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                style={styles.searchInput}
              />
              <div style={styles.priceFilterGroup}>
                <input type="number" placeholder="Min Price" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={styles.priceInput}/>
                <span style={{ color: '#666' }}>to</span>
                <input type="number" placeholder="Max Price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={styles.priceInput}/>
              </div>
            </div>

            <div style={styles.filterRow}>
              <button style={!selectedCategory ? styles.filterActive : styles.filterBtn} onClick={() => setSelectedCategory('')}>All</button>
              {categories.map(cat => (
                <button key={cat} style={selectedCategory === cat ? styles.filterActive : styles.filterBtn} onClick={() => setSelectedCategory(cat)}>{cat}</button>
              ))}
            </div>

            {searchedAndFilteredProducts.length === 0 ? <p style={styles.empty}>No products available matching criteria</p> :
              <div style={styles.grid}>
                {searchedAndFilteredProducts.map(product => {
                  const designsList = getProductDesignsList(product);
                  const currentIdx = cardDesignIndices[product.id] || 0;
                  const currentImg = designsList[currentIdx]?.photoUrl || 'https://via.placeholder.com/200';

                  return (
                    <div 
                      key={product.id} 
                      onClick={() => {
                        setSelectedProductDetails(product);
                        setModalDesignIdx(currentIdx);
                        setSizeQuantities({});
                      }}
                      style={styles.productCard}
                    >
                      <div style={styles.cardImageContainer}>
                        <img src={currentImg} alt={product.name} style={styles.productImage} />
                        {designsList.length > 1 && (
                          <>
                            <button style={styles.cardArrowLeft} onClick={(e) => handlePrevCardDesign(e, product.id, designsList.length)}>‹</button>
                            <button style={styles.cardArrowRight} onClick={(e) => handleNextCardDesign(e, product.id, designsList.length)}>›</button>
                            <div style={styles.cardDesignBadge}>{currentIdx + 1}/{designsList.length} Designs</div>
                          </>
                        )}
                      </div>
                      <div style={styles.productInfo}>
                        <span style={styles.cardCategoryLabel}>{product.category}</span>
                        <p style={styles.productName}>{product.name}</p>
                        <p style={styles.productDetail}>Supplier: <b>{product.supplierFirm}</b></p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                          <span style={styles.cardPrice}>₹{product.price}/pc</span>
                          <span style={styles.viewDetailBadge}>Details →</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </div>
        )}

        {activeTab === 'cart' && (
          <div>
            <h2 style={styles.heading}>My Cart</h2>
            {cart.length === 0 ? <p style={styles.empty}>Cart is empty</p> : (
              <div>
                {Object.keys(nonNightyBySupplier).map(supplierId => (
                  <div key={supplierId} style={styles.supplierGroup}>
                    <h3 style={styles.supplierName}>{nonNightyBySupplier[supplierId].supplierFirm}</h3>
                    {nonNightyBySupplier[supplierId].items.map(item => (
                      <div key={item.cartKey} style={styles.cartItem}>
                        <div style={styles.cartItemInfo}>
                          <p style={styles.cartItemName}>{item.productName} {item.size && `(Size: ${item.size})`}</p>
                          <p style={styles.cartItemDetail}>₹{item.price}/pc</p>
                        </div>
                        <div style={styles.cartItemActions}>
                          <input type="number" value={item.quantity} min={1}
                            onChange={e => updateQuantity(item.cartKey, e.target.value)} style={styles.quantityInput} />
                          <p style={styles.itemTotal}>₹{(item.price * item.quantity).toLocaleString()}</p>
                          <button style={styles.removeBtn} onClick={() => removeFromCart(item.cartKey)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {Object.keys(nightyBySupplier).map(supplierId => (
                  <div key={supplierId} style={styles.supplierGroup}>
                    <h3 style={styles.supplierName}>{nightyBySupplier[supplierId].supplierFirm} — {nightyBySupplier[supplierId].category}</h3>
                    {nightyBySupplier[supplierId].items.map(item => (
                      <div key={item.cartKey} style={styles.cartItem}>
                        <img src={item.photoUrl} alt="" style={styles.cartDesignImg} />
                        <div style={styles.cartItemInfo}>
                          <p style={styles.cartItemName}>{item.productName} — DN {item.designNo}{item.dnNumber ? ` (${item.dnNumber})` : ''}</p>
                          <p style={styles.cartItemDetail}>₹{item.price}/pc | 1 set = {item.pcsPerSet} pcs</p>
                        </div>
                        <div style={styles.cartItemActions}>
                          <button style={styles.qtyBtn} onClick={() => removeDesignFromCart(item.cartKey)}>−</button>
                          <span style={styles.setsCount}>{item.sets} sets</span>
                          <button style={styles.qtyBtn} onClick={() => addDesignToCart(
                            products.find(p => p.id === item.productId),
                            { id: item.designId, designNo: item.designNo, dnNumber: item.dnNumber, photoUrl: item.photoUrl, sets: item.availableSets }
                          )}>+</button>
                          <p style={styles.itemTotal}>{item.sets * item.pcsPerSet} pcs</p>
                          <button style={styles.removeBtn} onClick={() => removeFromCart(item.cartKey)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                <div style={styles.cartSummary}>
                  {nightyCart.length > 0 && <p style={styles.nightyNote}>* Nighty bale packing will be confirmed at checkout</p>}
                  {orderSuccess && <p style={styles.successMsg}>Order placed successfully!</p>}
                  <button style={styles.placeOrderBtn} onClick={handleCheckout} disabled={loading}>
                    {loading ? 'Placing Order...' : 'Checkout'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <h2 style={styles.heading}>My Orders</h2>
            {orders.length === 0 ? <p style={styles.empty}>No orders yet</p> :
              orders.map(order => (
                <div key={order.id} style={styles.orderCard}>
                  <p><b>Order ID:</b> {order.id}</p>
                  <p><b>Supplier:</b> {order.supplierFirm}</p>
                  <div>
                    <b>Items:</b>
                    {order.items?.map((i, idx) => (
                      <div key={idx} style={styles.orderItem}>
                        {i.photoUrl && <img src={i.photoUrl} alt="" style={styles.orderDesignImg} />}
                        <span>{i.productName}{i.size ? ` (Size: ${i.size})` : ''}{i.designNo ? ` DN${i.designNo}` : ''}{i.dnNumber ? ` (${i.dnNumber})` : ''} — {i.sets ? `${i.sets} sets = ${i.pcs} pcs` : `${i.quantity} ${i.unit}`}</span>
                      </div>
                    ))}
                  </div>
                  {order.nightyDetails && (
                    <p><b>Packing:</b> {order.nightyDetails.totalSets} sets | {order.nightyDetails.packingType} sets/bale | {order.nightyDetails.totalBales} bale(s) | {order.nightyDetails.totalPcs} pcs</p>
                  )}
                  <p><b>Status:</b> <span style={styles.statusBadge}>{order.status}</span></p>
                  <p><b>Date:</b> {order.createdAt?.toDate?.()?.toLocaleDateString()}</p>
                </div>
              ))
            }
          </div>
        )}

        {activeTab === 'profile' && userProfile && (
          <div>
            <h2 style={styles.heading}>My Profile</h2>
            <ProfileEdit userProfile={userProfile} onSave={fetchProfile} />
          </div>
        )}
      </div>

      {selectedProductDetails && (
        <div style={styles.modalOverlay} onClick={() => setSelectedProductDetails(null)}>
          <div style={styles.richModal} onClick={(e) => e.stopPropagation()}>
            <button style={styles.closeModalCircle} onClick={() => setSelectedProductDetails(null)}>✕</button>
            
            <div style={styles.modalBodyLayout}>
              <div style={styles.modalBodyLeft}>
                {(() => {
                  const modalDesigns = getProductDesignsList(selectedProductDetails);
                  const activeModalImg = modalDesigns[modalDesignIdx]?.photoUrl || 'https://via.placeholder.com/300';
                  return (
                    <div style={{ position: 'relative', width: '100%', height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={activeModalImg} alt="" style={styles.modalMainImg} />
                      {modalDesigns.length > 1 && (
                        <>
                          <button style={styles.sliderArrowLeft} onClick={() => setModalDesignIdx(prev => (prev - 1 + modalDesigns.length) % modalDesigns.length)}>‹</button>
                          <button style={styles.sliderArrowRight} onClick={() => setModalDesignIdx(prev => (prev + 1) % modalDesigns.length)}>›</button>
                          <div style={styles.sliderDotBadge}>{modalDesignIdx + 1} / {modalDesigns.length}</div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div style={styles.modalBodyRight}>
                <div>
                  <span style={styles.tagCategory}>{selectedProductDetails.category}</span>
                  <h2 style={styles.modalProductTitle}>{selectedProductDetails.name}</h2>
                  <p style={styles.modalSupplierSub}>Supplier: <b>{selectedProductDetails.supplierFirm}</b></p>
                  <div style={styles.specsGrid}>
                    <p style={{ margin: 0 }}>Material: <b>{selectedProductDetails.material || 'N/A'}</b></p>
                    {selectedProductDetails.cut && selectedProductDetails.cut !== 'N/A' && selectedProductDetails.cut !== '' && (
                      <p style={{ margin: 0 }}>Cut: <b>{selectedProductDetails.cut}</b></p>
                    )}
                    <p style={{ margin: 0 }}>Rate: <b style={{ color: '#e63946' }}>₹{selectedProductDetails.price}/pc</b></p>
                    <p style={{ margin: 0 }}>Bale Size (MOQ): <b>{selectedProductDetails.moq} pcs</b></p>
                  </div>

                  {selectedProductDetails.sizes && selectedProductDetails.sizes.length > 0 && !NIGHTY_CATEGORIES.includes(selectedProductDetails.category) && (
                    <div style={{ marginBottom: '15px' }}>
                      <label style={styles.dropdownLabel}>Enter Quantities Per Size (Multiple of Bale packing):</label>
                      <div style={styles.sizeMatrixBox}>
                        {selectedProductDetails.sizes.map(size => (
                          <div key={size} style={styles.matrixRow}>
                            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#334155' }}>Size {size}:</span>
                            <input 
                              type="number" min="0" placeholder="0"
                              value={sizeQuantities[size] || ''}
                              onChange={(e) => setSizeQuantities({ ...sizeQuantities, [size]: e.target.value })}
                              style={styles.matrixSizeInput}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {(() => {
                  if (NIGHTY_CATEGORIES.includes(selectedProductDetails.category)) {
                    return (
                      <button onClick={() => { setSelectedProductDetails(null); setViewingProduct(selectedProductDetails); }} style={styles.addCartSubmitBtn}>
                        Select Design Sets & Pack Bales
                      </button>
                    );
                  }
                  const currentTotalInputQty = Object.values(sizeQuantities).reduce((sum, q) => sum + Number(q || 0), 0);
                  const supplierMoqPack = Number(selectedProductDetails.moq || 1);
                  const isValidBalePack = currentTotalInputQty > 0 && currentTotalInputQty % supplierMoqPack === 0;
                  return (
                    <div>
                      {currentTotalInputQty > 0 && !isValidBalePack && (
                        <p style={{ color: '#e63946', fontSize: '12px', margin: '0 0 8px 0', fontWeight: 'bold' }}>
                          ⚠️ Total Qty ({currentTotalInputQty} pcs) must be multiple of Bale size ({supplierMoqPack} pcs).
                        </p>
                      )}
                      <button 
                        onClick={() => addSizesToCart(selectedProductDetails)}
                        disabled={selectedProductDetails.sizes?.length > 0 && !isValidBalePack}
                        style={{ ...styles.addCartSubmitBtn, backgroundColor: (selectedProductDetails.sizes?.length > 0 && !isValidBalePack) ? '#cbd5e1' : '#1a1a2e', cursor: (selectedProductDetails.sizes?.length > 0 && !isValidBalePack) ? 'not-allowed' : 'pointer' }}
                      >
                        Add Total {currentTotalInputQty > 0 ? `(${currentTotalInputQty} pcs)` : ''} to Cart
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {(() => {
              const bottomStripDesigns = getProductDesignsList(selectedProductDetails);
              if (bottomStripDesigns.length <= 1) return null;
              return (
                <div style={styles.subDesignSection}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#1a1a2e' }}>All Catalog Prints</h4>
                  <div style={styles.subDesignRowSlider}>
                    {bottomStripDesigns.map((design, idx) => (
                      <div key={idx} onClick={() => setModalDesignIdx(idx)}
                        style={{ ...styles.miniDesignCard, border: modalDesignIdx === idx ? '2px solid #e63946' : '1px solid #e2e8f0' }}>
                        <img src={design.photoUrl} alt="" style={styles.miniDesignImg} />
                        <p style={{ margin: '5px 0 0 0', fontSize: '11px', fontWeight: 'bold' }}>DN: {design.designNo}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' },
  sidebar: { width: '220px', backgroundColor: '#1a1a2e', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', position: 'sticky', top: 0, height: '100vh', flexShrink: 0 },
  logo: { color: 'white', marginBottom: '5px', fontSize: '18px' },
  firmName: { color: '#aaa', fontSize: '12px', marginBottom: '15px' },
  tab: { padding: '12px', backgroundColor: 'transparent', color: '#aaa', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' },
  activeTab: { padding: '12px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' },
  logoutBtn: { marginTop: 'auto', padding: '12px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  main: { flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' },
  topHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '15px 25px', borderRadius: '12px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' },
  cartIconContainer: { position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '5px' },
  cartBadge: { position: 'absolute', top: '-5px', right: '-8px', backgroundColor: '#e63946', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '11px', fontWeight: 'bold' },
  bellWrapper: { position: 'relative' },
  bellBtn: { background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '44px', height: '44px', fontSize: '20px', cursor: 'pointer', position: 'relative', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' },
  badge: { position: 'absolute', top: '-4px', right: '-4px', backgroundColor: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold', borderRadius: '10px', padding: '2px 5px', minWidth: '16px', textAlign: 'center' },
  notifDropdown: { position: 'absolute', top: '52px', right: 0, width: '360px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 8px 30px rgba(0,0,0,0.15)', zIndex: 1000, overflow: 'hidden', border: '1px solid #e2e8f0' },
  notifHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' },
  notifList: { maxHeight: '400px', overflowY: 'auto' },
  notifEmpty: { padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' },
  notifItem: { display: 'flex', alignItems: 'flex-start', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' },
  notifMsg: { margin: 0, fontSize: '13px', color: '#1e293b', lineHeight: '1.4' },
  notifTime: { margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' },
  unreadDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '4px', flexShrink: 0 },
  heading: { color: '#1a1a2e', marginBottom: '20px' },
  empty: { color: '#999' },
  searchFilterRow: { display: 'flex', gap: '15px', marginBottom: '5px', flexWrap: 'wrap', alignItems: 'center' },
  searchInput: { flex: 1, minWidth: '250px', padding: '12px 15px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', backgroundColor: 'white' },
  priceFilterGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  priceInput: { width: '100px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', backgroundColor: 'white' },
  filterRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '5px' },
  filterBtn: { padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '20px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px', color: '#4a5568' },
  filterActive: { padding: '8px 16px', border: '1px solid #e63946', borderRadius: '20px', cursor: 'pointer', backgroundColor: '#e63946', color: 'white', fontSize: '13px', fontWeight: 'bold' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '25px', alignItems: 'start' },
  productCard: { backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', cursor: 'pointer', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' },
  cardImageContainer: { position: 'relative', width: '100%', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  productImage: { width: '100%', height: 'auto', maxHeight: '350px', objectFit: 'contain', display: 'block' },
  productInfo: { padding: '15px', display: 'flex', flexDirection: 'column', gap: '5px' },
  cardCategoryLabel: { fontSize: '11px', fontWeight: 'bold', color: '#718096', textTransform: 'uppercase' },
  productName: { fontWeight: 'bold', fontSize: '15px', color: '#1a202c', margin: 0 },
  productDetail: { color: '#4a5568', fontSize: '13px', margin: 0 },
  cardPrice: { fontSize: '15px', fontWeight: 'bold', color: '#2b6cb0' },
  viewDetailBadge: { fontSize: '12px', color: '#edf2f7', fontWeight: 'bold', backgroundColor: '#1a1a2e', padding: '6px 12px', borderRadius: '6px' },
  cardArrowLeft: { position: 'absolute', top: '50%', left: '8px', transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.9)', color: '#333', border: 'none', width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.15)', zIndex: 5 },
  cardArrowRight: { position: 'absolute', top: '50%', right: '8px', transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.9)', color: '#333', border: 'none', width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.15)', zIndex: 5 },
  cardDesignBadge: { position: 'absolute', bottom: '8px', left: '8px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '3px 6px', borderRadius: '4px', fontSize: '11px' },
  supplierGroup: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  supplierName: { color: '#1a1a2e', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' },
  cartItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f5f5f5' },
  cartDesignImg: { width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontWeight: 'bold', fontSize: '14px' },
  cartItemDetail: { color: '#666', fontSize: '13px' },
  cartItemActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  quantityInput: { width: '70px', padding: '6px', border: '1px solid #ddd', borderRadius: '6px', textAlign: 'center' },
  qtyBtn: { width: '28px', height: '28px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white', fontSize: '14px' },
  setsCount: { fontWeight: 'bold', minWidth: '50px', textAlign: 'center' },
  itemTotal: { fontWeight: 'bold', minWidth: '70px', textAlign: 'right', fontSize: '13px' },
  removeBtn: { padding: '6px 10px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  cartSummary: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginTop: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  nightyNote: { color: '#888', fontSize: '13px', marginBottom: '10px' },
  successMsg: { color: '#2ecc71', fontWeight: 'bold', marginBottom: '10px' },
  placeOrderBtn: { width: '100%', padding: '14px', backgroundColor: '#1a1a2e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
  orderCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  orderItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0' },
  orderDesignImg: { width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' },
  statusBadge: { backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' },
  profileCard: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', lineHeight: '2' },
  editBtn: { padding: '10px 20px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '15px' },
  input: { padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box', marginBottom: '8px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '450px' },
  modalTitle: { color: '#1a1a2e', marginBottom: '15px', fontSize: '20px' },
  baleCalc: { backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '8px', marginTop: '10px' },
  validMsg: { color: '#2ecc71', fontWeight: 'bold' },
  invalidMsg: { color: '#e63946', fontWeight: 'bold' },
  errorMsg: { color: '#e63946', fontSize: '13px', marginTop: '8px' },
  confirmBtn: { padding: '12px 24px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' },
  typeRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  typeBtn: { padding: '8px 16px', border: '2px solid #ddd', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'white', fontSize: '14px' },
  typeActive: { padding: '8px 16px', border: '2px solid #1a1a2e', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#1a1a2e', color: 'white', fontSize: '14px' },
  richModal: { backgroundColor: 'white', borderRadius: '16px', width: '90%', maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', position: 'relative', display: 'flex', flexDirection: 'column', padding: '25px', gap: '20px' },
  closeModalCircle: { position: 'absolute', top: '15px', right: '15px', border: 'none', backgroundColor: '#edf2f7', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: '#4a5568', zIndex: 10 },
  modalBodyLayout: { display: 'flex', flexWrap: 'wrap', gap: '25px' },
  modalBodyLeft: { flex: '1 1 300px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', overflow: 'hidden' },
  modalMainImg: { width: '100%', height: '100%', maxHeight: '380px', objectFit: 'contain' },
  modalBodyRight: { flex: '1 1 320px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  tagCategory: { backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'inline-block', width: 'fit-content' },
  modalProductTitle: { margin: '10px 0 5px 0', fontSize: '22px', color: '#1e293b' },
  modalSupplierSub: { margin: '0 0 15px 0', color: '#64748b', fontSize: '14px' },
  specsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px', color: '#334155' },
  dropdownLabel: { display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px', color: '#475569' },
  sizeMatrixBox: { display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' },
  matrixRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  matrixSizeInput: { width: '80px', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center', outline: 'none', fontSize: '14px', backgroundColor: 'white' },
  addCartSubmitBtn: { width: '100%', padding: '14px', backgroundColor: '#1a1a2e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
  subDesignSection: { borderTop: '1px solid #e2e8f0', paddingTop: '15px' },
  subDesignRowSlider: { display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '8px' },
  miniDesignCard: { flex: '0 0 100px', borderRadius: '8px', padding: '6px', textAlign: 'center', backgroundColor: '#f8fafc', cursor: 'pointer' },
  miniDesignImg: { width: '100%', height: '75px', objectFit: 'cover', borderRadius: '6px' },
  sliderArrowLeft: { position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold', zIndex: 5 },
  sliderArrowRight: { position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold', zIndex: 5 },
  sliderDotBadge: { position: 'absolute', bottom: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' },
};

export default BuyerDashboard;