import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';

const CATEGORIES = ['Cotton', 'Silk', 'Synthetic', 'Linen', 'Wool', 'Denim', 'Polyester', 'Other'];

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

function SupplierDashboard() {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [productForm, setProductForm] = useState({
    name: '', category: '', price: '', moq: '', unit: 'meters', description: '', images: []
  });

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
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'products'), where('supplierId', '==', user.uid));
    const snap = await getDocs(q);
    setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchOrders = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'orders'), where('supplierId', '==', user.uid));
    const snap = await getDocs(q);
    setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = auth.currentUser;
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const freshProfile = userSnap.data();

      const imageUrls = [];
      for (const image of productForm.images) {
        const imageRef = ref(storage, `products/${user.uid}/${Date.now()}_${image.name}`);
        await uploadBytes(imageRef, image);
        const url = await getDownloadURL(imageRef);
        imageUrls.push(url);
      }

      await addDoc(collection(db, 'products'), {
        name: productForm.name,
        category: productForm.category,
        price: Number(productForm.price),
        moq: Number(productForm.moq),
        unit: productForm.unit,
        description: productForm.description,
        imageUrl: imageUrls[0] || '',
        imageUrls: imageUrls,
        supplierId: user.uid,
        supplierFirm: freshProfile?.firmName || '',
        status: 'pending',
        createdAt: new Date(),
      });
      setProductForm({ name: '', category: '', price: '', moq: '', unit: 'meters', description: '', images: [] });
      setActiveTab('products');
      fetchProducts();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const deleteProduct = async (productId) => {
    if (window.confirm('Delete this product?')) {
      await deleteDoc(doc(db, 'products', productId));
      fetchProducts();
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <h2 style={styles.logo}>Supplier Panel</h2>
        {userProfile && <p style={styles.firmName}>{userProfile.firmName}</p>}
        <button style={activeTab === 'products' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('products')}>My Products</button>
        <button style={activeTab === 'addProduct' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('addProduct')}>Add Product</button>
        <button style={activeTab === 'orders' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('orders')}>Orders ({orders.length})</button>
        <button style={activeTab === 'profile' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('profile')}>My Profile</button>
        <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      <div style={styles.main}>

        {activeTab === 'products' && (
          <div>
            <h2 style={styles.heading}>My Products</h2>
            {products.length === 0 ? <p style={styles.empty}>No products added yet</p> :
              <div style={styles.grid}>
                {products.map(product => (
                  <div key={product.id} style={styles.productCard}>
                    {product.imageUrls && product.imageUrls.length > 0 ? (
                      <div style={styles.imageStrip}>
                        {product.imageUrls.map((url, i) => (
                          <img key={i} src={url} alt={product.name} style={styles.thumbImage} />
                        ))}
                      </div>
                    ) : product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} style={styles.productImage} />
                    ) : null}
                    <div style={styles.productInfo}>
                      <p style={styles.productName}>{product.name}</p>
                      <p style={styles.productDetail}>Category: {product.category}</p>
                      <p style={styles.productDetail}>Price: ₹{product.price}/{product.unit}</p>
                      <p style={styles.productDetail}>MOQ: {product.moq} {product.unit}</p>
                      <p style={styles.productDetail}>Supplier: {product.supplierFirm}</p>
                      <span style={product.status === 'approved' ? styles.approved : styles.pending}>
                        {product.status}
                      </span>
                    </div>
                    <button style={styles.deleteBtn} onClick={() => deleteProduct(product.id)}>Delete</button>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {activeTab === 'addProduct' && (
          <div>
            <h2 style={styles.heading}>Add New Product</h2>
            <form onSubmit={handleAddProduct} style={styles.form}>
              <select style={styles.input} value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} required>
                <option value="">Select Category</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input style={styles.input} placeholder="Product Name" value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
              <input style={styles.input} type="number" placeholder="Price (₹)" value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input style={{ ...styles.input, flex: 1 }} type="number" placeholder="MOQ" value={productForm.moq}
                  onChange={(e) => setProductForm({ ...productForm, moq: e.target.value })} required />
                <select style={{ ...styles.input, flex: 1 }} value={productForm.unit}
                  onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}>
                  <option value="meters">Meters</option>
                  <option value="kg">KG</option>
                  <option value="pieces">Pieces</option>
                  <option value="yards">Yards</option>
                </select>
              </div>
              <textarea style={{ ...styles.input, height: '80px' }} placeholder="Product Description"
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
              <div>
                <label style={styles.label}>Upload Photos (multiple allowed)</label>
                <input style={styles.input} type="file" accept="image/*" multiple
                  onChange={(e) => setProductForm({ ...productForm, images: Array.from(e.target.files) })} />
                {productForm.images.length > 0 && (
                  <p style={styles.photoCount}>{productForm.images.length} photo(s) selected</p>
                )}
              </div>
              <button style={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? 'Uploading...' : 'Submit for Approval'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <h2 style={styles.heading}>My Orders</h2>
            {orders.length === 0 ? <p style={styles.empty}>No orders yet</p> :
              orders.map(order => (
                <div key={order.id} style={styles.orderCard}>
                  <p><b>Order ID:</b> {order.id}</p>
                  <p><b>Buyer:</b> {order.buyerFirm}</p>
                  <p><b>Items:</b> {order.items?.map(i => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}</p>
                  <p><b>Status:</b> {order.status}</p>
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
  imageStrip: { display: 'flex', overflowX: 'auto', gap: '4px', padding: '4px', backgroundColor: '#f9f9f9' },
  thumbImage: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 },
  productInfo: { padding: '15px' },
  productName: { fontWeight: 'bold', fontSize: '15px', marginBottom: '5px' },
  productDetail: { color: '#666', fontSize: '13px', margin: '3px 0' },
  approved: { backgroundColor: '#d4edda', color: '#155724', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' },
  pending: { backgroundColor: '#fff3cd', color: '#856404', padding: '3px 8px', borderRadius: '4px', fontSize: '12px' },
  deleteBtn: { margin: '10px 15px 15px', padding: '6px 12px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px' },
  input: { padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  label: { fontSize: '13px', color: '#555', marginBottom: '5px', display: 'block' },
  photoCount: { fontSize: '13px', color: '#2ecc71', marginTop: '5px' },
  submitBtn: { padding: '12px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' },
  orderCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  profileCard: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', lineHeight: '2' },
  editBtn: { padding: '10px 20px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '15px' },
};

export default SupplierDashboard;