import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';

function ProfileEdit({ userProfile, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(userProfile);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await updateDoc(doc(db, 'users', userProfile.uid), {
      firmName: form.firmName,
      contactPerson: form.contactPerson,
      mobile: form.mobile,
      address: form.address,
      city: form.city,
      district: form.district,
      state: form.state,
      pincode: form.pincode,
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

function BuyerDashboard() {
  const [activeTab, setActiveTab] = useState('browse');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
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
    setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchOrders = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'orders'), where('buyerId', '==', user.uid));
    const snap = await getDocs(q);
    setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id
        ? { ...item, quantity: item.quantity + product.moq }
        : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: product.moq }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    setCart(cart.map(item => item.id === productId ? { ...item, quantity: Number(quantity) } : item));
  };

  const cartBySupplier = cart.reduce((acc, item) => {
    if (!acc[item.supplierId]) {
      acc[item.supplierId] = { supplierFirm: item.supplierFirm, items: [] };
    }
    acc[item.supplierId].items.push(item);
    return acc;
  }, {});

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const user = auth.currentUser;
      for (const supplierId of Object.keys(cartBySupplier)) {
        const supplierCart = cartBySupplier[supplierId];
        await addDoc(collection(db, 'orders'), {
          buyerId: user.uid,
          buyerFirm: userProfile?.firmName || '',
          supplierId,
          supplierFirm: supplierCart.supplierFirm,
          items: supplierCart.items.map(item => ({
            productId: item.id,
            productName: item.name,
            quantity: item.quantity,
            price: item.price,
            unit: item.unit,
          })),
          status: 'Pending',
          createdAt: new Date(),
        });
      }
      setCart([]);
      setOrderSuccess(true);
      fetchOrders();
      setTimeout(() => setOrderSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div style={styles.container}>
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
            {products.length === 0 ? <p style={styles.empty}>No products available</p> :
              <div style={styles.grid}>
                {products.map(product => (
                  <div key={product.id} style={styles.productCard}>
                    {product.imageUrl && <img src={product.imageUrl} alt={product.name} style={styles.productImage} />}
                    <div style={styles.productInfo}>
                      <p style={styles.productName}>{product.name}</p>
                      <p style={styles.productDetail}>Category: {product.category}</p>
                      <p style={styles.productDetail}>Supplier: {product.supplierFirm}</p>
                      <p style={styles.productDetail}>Price: ₹{product.price}/{product.unit}</p>
                      <p style={styles.productDetail}>MOQ: {product.moq} {product.unit}</p>
                      <button style={styles.addBtn} onClick={() => addToCart(product)}>Add to Cart</button>
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
                {Object.keys(cartBySupplier).map(supplierId => (
                  <div key={supplierId} style={styles.supplierGroup}>
                    <h3 style={styles.supplierName}>{cartBySupplier[supplierId].supplierFirm}</h3>
                    {cartBySupplier[supplierId].items.map(item => (
                      <div key={item.id} style={styles.cartItem}>
                        <div style={styles.cartItemInfo}>
                          <p style={styles.cartItemName}>{item.name}</p>
                          <p style={styles.cartItemDetail}>₹{item.price}/{item.unit} | MOQ: {item.moq} {item.unit}</p>
                        </div>
                        <div style={styles.cartItemActions}>
                          <input type="number" value={item.quantity} min={item.moq} step={item.moq}
                            onChange={(e) => updateQuantity(item.id, e.target.value)}
                            style={styles.quantityInput} />
                          <p style={styles.itemTotal}>₹{(item.price * item.quantity).toLocaleString()}</p>
                          <button style={styles.removeBtn} onClick={() => removeFromCart(item.id)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={styles.cartSummary}>
                  <p style={styles.totalText}>
                    Total: ₹{cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString()}
                  </p>
                  {orderSuccess && <p style={styles.successMsg}>Order placed successfully!</p>}
                  <button style={styles.placeOrderBtn} onClick={placeOrder} disabled={loading}>
                    {loading ? 'Placing Order...' : 'Place Order'}
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
                  <p><b>Items:</b> {order.items?.map(i => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}</p>
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
  sidebar: { width: '220px', backgroundColor: '#1a1a2e', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  logo: { color: 'white', marginBottom: '5px', fontSize: '18px' },
  firmName: { color: '#aaa', fontSize: '12px', marginBottom: '15px' },
  tab: { padding: '12px', backgroundColor: 'transparent', color: '#aaa', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' },
  activeTab: { padding: '12px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' },
  logoutBtn: { marginTop: 'auto', padding: '12px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  main: { flex: 1, padding: '30px' },
  heading: { color: '#1a1a2e', marginBottom: '20px' },
  empty: { color: '#999' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' },
  productCard: { backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  productImage: { width: '100%', height: '160px', objectFit: 'cover' },
  productInfo: { padding: '15px' },
  productName: { fontWeight: 'bold', fontSize: '15px', marginBottom: '5px' },
  productDetail: { color: '#666', fontSize: '13px', margin: '3px 0' },
  addBtn: { marginTop: '10px', width: '100%', padding: '8px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  supplierGroup: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  supplierName: { color: '#1a1a2e', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' },
  cartItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f5f5f5' },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontWeight: 'bold', fontSize: '14px' },
  cartItemDetail: { color: '#666', fontSize: '13px' },
  cartItemActions: { display: 'flex', alignItems: 'center', gap: '10px' },
  quantityInput: { width: '80px', padding: '6px', border: '1px solid #ddd', borderRadius: '6px', textAlign: 'center' },
  itemTotal: { fontWeight: 'bold', minWidth: '80px', textAlign: 'right' },
  removeBtn: { padding: '6px 10px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  cartSummary: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginTop: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'right' },
  totalText: { fontSize: '20px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '15px' },
  successMsg: { color: '#2ecc71', marginBottom: '10px' },
  placeOrderBtn: { padding: '12px 30px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' },
  orderCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  statusBadge: { backgroundColor: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: '4px', fontSize: '13px' },
  profileCard: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', lineHeight: '2' },
  editBtn: { padding: '10px 20px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '15px' },
  input: { padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box', marginBottom: '8px' },
};

export default BuyerDashboard;