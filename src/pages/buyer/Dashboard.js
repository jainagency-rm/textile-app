import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import ProductDesigns from './ProductDesigns';

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

function NightyCheckout({ nightyCart, onConfirm, onCancel }) {
  const totalSets = nightyCart.reduce((sum, item) => sum + (item.sets || 0), 0);
  const [packingType, setPackingType] = useState('');
  const [error, setError] = useState('');
  const pcsPerSet = nightyCart[0]?.pcsPerSet || 30;

  const valid8 = totalSets % 8 === 0;
  const valid10 = totalSets % 10 === 0;

  const handleConfirm = () => {
    if (!packingType) { setError('Please select packing type'); return; }
    if (packingType === '8' && !valid8) { setError(`${totalSets} sets cannot make complete bales of 8. Need multiple of 8.`); return; }
    if (packingType === '10' && !valid10) { setError(`${totalSets} sets cannot make complete bales of 10. Need multiple of 10.`); return; }
    const totalBales = totalSets / Number(packingType);
    onConfirm({ packingType: Number(packingType), totalBales, totalSets, totalPcs: totalSets * pcsPerSet });
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <h3 style={styles.modalTitle}>Nighty Bale Selection</h3>
        <p style={styles.modalDetail}>Total Sets: <b>{totalSets}</b></p>
        <p style={styles.modalDetail}>Total Pcs: <b>{totalSets * pcsPerSet}</b></p>
        <div style={{marginTop:'15px', marginBottom:'10px'}}>
          <label style={styles.label}>Select Packing Type:</label>
          <div style={styles.typeRow}>
            <button type="button" style={packingType === '8' ? styles.typeActive : styles.typeBtn}
              onClick={() => { setPackingType('8'); setError(''); }}>8 Sets/Bale (240 pcs)</button>
            <button type="button" style={packingType === '10' ? styles.typeActive : styles.typeBtn}
              onClick={() => { setPackingType('10'); setError(''); }}>10 Sets/Bale (300 pcs)</button>
          </div>
        </div>
        {packingType && (
          <div style={styles.baleCalc}>
            {packingType === '8' && (valid8
              ? <p style={styles.validMsg}>✓ {totalSets / 8} complete bale(s) of 8 sets</p>
              : <p style={styles.invalidMsg}>✗ Need multiple of 8. Current: {totalSets} sets</p>)}
            {packingType === '10' && (valid10
              ? <p style={styles.validMsg}>✓ {totalSets / 10} complete bale(s) of 10 sets</p>
              : <p style={styles.invalidMsg}>✗ Need multiple of 10. Current: {totalSets} sets</p>)}
          </div>
        )}
        {error && <p style={styles.errorMsg}>{error}</p>}
        <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
          <button style={styles.confirmBtn} onClick={handleConfirm}>Confirm Order</button>
          <button style={{...styles.confirmBtn, backgroundColor:'#999'}} onClick={onCancel}>Cancel</button>
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
  const navigate = useNavigate();

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
      if (NIGHTY_CATEGORIES.includes(prod.category)) {
        const dSnap = await getDocs(collection(db, 'products', prod.id, 'designs'));
        designMap[prod.id] = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
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
  const filteredProducts = selectedCategory ? products.filter(p => p.category === selectedCategory) : products;

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

  const addToCart = (product) => {
    const existing = cart.find(item => item.productId === product.id && !item.designId);
    if (existing) {
      setCart(cart.map(item => item.productId === product.id && !item.designId
        ? { ...item, quantity: item.quantity + product.moq } : item));
    } else {
      setCart([...cart, {
        cartKey: product.id, productId: product.id, productName: product.name,
        quantity: product.moq, price: product.price, unit: product.unit,
        supplierId: product.supplierId, supplierFirm: product.supplierFirm, category: product.category,
      }]);
    }
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

  const handleCheckout = () => {
    if (nightyCart.length > 0) {
      setShowNightyCheckout(true);
    } else {
      placeOrder(null);
    }
  };

  const placeOrder = async (nightyDetails) => {
    setLoading(true);
    try {
      const user = auth.currentUser;

      for (const supplierId of Object.keys(nonNightyBySupplier)) {
        const sc = nonNightyBySupplier[supplierId];
        await addDoc(collection(db, 'orders'), {
          buyerId: user.uid, buyerFirm: userProfile?.firmName || '',
          supplierId, supplierFirm: sc.supplierFirm,
          items: sc.items.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, price: i.price, unit: i.unit })),
          status: 'Pending', createdAt: new Date(),
        });
      }

      for (const supplierId of Object.keys(nightyBySupplier)) {
        const sc = nightyBySupplier[supplierId];
        const totalSets = sc.items.reduce((s, i) => s + i.sets, 0);
        const pcsPerSet = sc.items[0]?.pcsPerSet || 30;

        await addDoc(collection(db, 'orders'), {
          buyerId: user.uid, buyerFirm: userProfile?.firmName || '',
          supplierId, supplierFirm: sc.supplierFirm,
          items: sc.items.map(i => ({
            productId: i.productId, productName: i.productName,
            designNo: i.designNo, dnNumber: i.dnNumber,
            photoUrl: i.photoUrl, sets: i.sets, pcs: i.sets * i.pcsPerSet, price: i.price,
          })),
          nightyDetails: nightyDetails ? {
            totalSets, totalPcs: totalSets * pcsPerSet,
            packingType: nightyDetails.packingType,
            totalBales: nightyDetails.totalBales,
          } : null,
          status: 'Pending', createdAt: new Date(),
        });

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

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };


  // If viewing a product's designs
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
          nightyCart={nightyCart}
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

        {activeTab === 'browse' && (
          <div>
            <h2 style={styles.heading}>Browse Products</h2>
            <div style={styles.filterRow}>
              <button style={!selectedCategory ? styles.filterActive : styles.filterBtn} onClick={() => setSelectedCategory('')}>All</button>
              {categories.map(cat => (
                <button key={cat} style={selectedCategory === cat ? styles.filterActive : styles.filterBtn}
                  onClick={() => setSelectedCategory(cat)}>{cat}</button>
              ))}
            </div>

            {filteredProducts.length === 0 ? <p style={styles.empty}>No products available</p> :
              <div style={styles.grid}>
                {filteredProducts.map(product => (
                  <div key={product.id} style={styles.productCard}>
                    {product.imageUrl && <img src={product.imageUrl} alt={product.name} style={styles.productImage} />}
                    <div style={styles.productInfo}>
                      <p style={styles.productName}>{product.name}</p>
                      <p style={styles.productDetail}>Category: {product.category}</p>
                      <p style={styles.productDetail}>Supplier: {product.supplierFirm}</p>
                      <p style={styles.productDetail}>Price: ₹{product.price}/set</p>
                      {product.cut && <p style={styles.productDetail}>Cut: {product.cut}</p>}
                      {NIGHTY_CATEGORIES.includes(product.category)
                        ? <p style={styles.productDetail}>Total Sets: {product.totalSets || 0}</p>
                        : <p style={styles.productDetail}>MOQ: {product.moq} {product.unit}</p>
                      }
                      {product.material && <p style={styles.productDetail}>Material: {product.material}</p>}
                      {product.sizes?.length > 0 && <p style={styles.productDetail}>Sizes: {product.sizes.join(', ')}</p>}
                      {product.productType && <p style={styles.productDetail}>Type: {product.productType}</p>}

                      {NIGHTY_CATEGORIES.includes(product.category) ? (
                        <button style={styles.viewDesignsBtn} onClick={() => setViewingProduct(product)}>
                          View Designs ({(productDesigns[product.id] || []).length})
                        </button>
                      ) : (
                        <button style={styles.addBtn} onClick={() => addToCart(product)}>Add to Cart</button>
                      )}
                    </div>
                  </div>
                ))}
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
                          <p style={styles.cartItemName}>{item.productName}</p>
                          <p style={styles.cartItemDetail}>₹{item.price}/{item.unit}</p>
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
                          <p style={styles.cartItemDetail}>₹{item.price}/set | 1 set = {item.pcsPerSet} pcs</p>
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
                    <p style={styles.nightySummary}>
                      Total: {nightyBySupplier[supplierId].items.reduce((s, i) => s + i.sets, 0)} sets = {nightyBySupplier[supplierId].items.reduce((s, i) => s + i.sets * i.pcsPerSet, 0)} pcs
                    </p>
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
                        <span>{i.productName}{i.designNo ? ` DN${i.designNo}` : ''}{i.dnNumber ? ` (${i.dnNumber})` : ''} — {i.sets ? `${i.sets} sets = ${i.pcs} pcs` : `${i.quantity} ${i.unit}`}</span>
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
    </div>
  );
}

const styles = {
  container: { display: 'flex', minHeight: '100vh', backgroundColor: '#f5f5f5' },
  sidebar: { width: '220px', backgroundColor: '#1a1a2e', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 },
  logo: { color: 'white', marginBottom: '5px', fontSize: '18px' },
  firmName: { color: '#aaa', fontSize: '12px', marginBottom: '15px' },
  tab: { padding: '12px', backgroundColor: 'transparent', color: '#aaa', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' },
  activeTab: { padding: '12px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' },
  logoutBtn: { marginTop: 'auto', padding: '12px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  main: { flex: 1, padding: '30px' },
  heading: { color: '#1a1a2e', marginBottom: '20px' },
  empty: { color: '#999' },
  filterRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' },
  filterBtn: { padding: '6px 14px', border: '1px solid #ddd', borderRadius: '20px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px' },
  filterActive: { padding: '6px 14px', border: '1px solid #e63946', borderRadius: '20px', cursor: 'pointer', backgroundColor: '#e63946', color: 'white', fontSize: '13px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' },
  productCard: { backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  productImage: { width: '100%', height: '160px', objectFit: 'cover' },
  productInfo: { padding: '15px' },
  productName: { fontWeight: 'bold', fontSize: '15px', marginBottom: '5px' },
  productDetail: { color: '#666', fontSize: '13px', margin: '3px 0' },
  viewDesignsBtn: { marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#1a1a2e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  addBtn: { marginTop: '10px', width: '100%', padding: '8px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
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
  nightySummary: { marginTop: '10px', fontWeight: 'bold', color: '#1a1a2e', fontSize: '14px' },
  cartSummary: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginTop: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'right' },
  nightyNote: { color: '#e67e22', fontSize: '13px', marginBottom: '10px' },
  successMsg: { color: '#2ecc71', marginBottom: '10px' },
  placeOrderBtn: { padding: '12px 30px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' },
  orderCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  orderItem: { display: 'flex', alignItems: 'center', gap: '8px', margin: '5px 0' },
  orderDesignImg: { width: '35px', height: '35px', objectFit: 'cover', borderRadius: '3px' },
  statusBadge: { backgroundColor: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: '4px', fontSize: '13px' },
  profileCard: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', lineHeight: '2' },
  editBtn: { padding: '10px 20px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '15px' },
  input: { padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box', marginBottom: '8px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '450px' },
  modalTitle: { color: '#1a1a2e', marginBottom: '15px', fontSize: '20px' },
  modalDetail: { color: '#555', fontSize: '15px', margin: '5px 0' },
  baleCalc: { backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '8px', marginTop: '10px' },
  validMsg: { color: '#2ecc71', fontWeight: 'bold' },
  invalidMsg: { color: '#e63946', fontWeight: 'bold' },
  errorMsg: { color: '#e63946', fontSize: '13px', marginTop: '8px' },
  confirmBtn: { padding: '12px 24px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' },
  label: { fontSize: '13px', color: '#555', marginBottom: '8px', display: 'block' },
  typeRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  typeBtn: { padding: '8px 16px', border: '2px solid #ddd', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'white', fontSize: '14px' },
  typeActive: { padding: '8px 16px', border: '2px solid #1a1a2e', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#1a1a2e', color: 'white', fontSize: '14px' },
};

export default BuyerDashboard;