import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { auth, db } from '../../firebase';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('buyers');
  const [pendingBuyers, setPendingBuyers] = useState([]);
  const [pendingSuppliers, setPendingSuppliers] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [buyersSnap, suppliersSnap, ordersSnap, productsSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'buyer'), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'users'), where('role', '==', 'supplier'), where('status', '==', 'pending'))),
        getDocs(collection(db, 'orders')),
        getDocs(query(collection(db, 'products'), where('status', '==', 'pending'))),
      ]);
      setPendingBuyers(buyersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPendingSuppliers(suppliersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAllOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPendingProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const approveUser = async (userId) => {
    await updateDoc(doc(db, 'users', userId), { status: 'approved' });
    fetchData();
  };

  const rejectUser = async (userId) => {
    await updateDoc(doc(db, 'users', userId), { status: 'rejected' });
    fetchData();
  };

  const approveProduct = async (productId) => {
    await updateDoc(doc(db, 'products', productId), { status: 'approved' });
    fetchData();
  };

  const rejectProduct = async (productId) => {
    await updateDoc(doc(db, 'products', productId), { status: 'rejected' });
    fetchData();
  };

  const updateOrderStatus = async (orderId, status) => {
    await updateDoc(doc(db, 'orders', orderId), { status });
    fetchData();
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const UserCard = ({ user, onApprove, onReject }) => (
    <div style={styles.card}>
      <div style={styles.cardInfo}>
        <p style={styles.firmName}>{user.firmName}</p>
        <p style={styles.detail}>GST: {user.gstNumber}</p>
        <p style={styles.detail}>Contact: {user.contactPerson}</p>
        <p style={styles.detail}>Mobile: {user.mobile}</p>
        <p style={styles.detail}>City: {user.city}, {user.state}</p>
        <p style={styles.detail}>Email: {user.email}</p>
      </div>
      <div style={styles.cardActions}>
        <button style={styles.approveBtn} onClick={() => onApprove(user.id)}>Approve</button>
        <button style={styles.rejectBtn} onClick={() => onReject(user.id)}>Reject</button>
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <h2 style={styles.logo}>Admin Panel</h2>
        <button style={activeTab === 'buyers' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('buyers')}>
          Pending Buyers ({pendingBuyers.length})
        </button>
        <button style={activeTab === 'suppliers' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('suppliers')}>
          Pending Suppliers ({pendingSuppliers.length})
        </button>
        <button style={activeTab === 'products' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('products')}>
          Pending Products ({pendingProducts.length})
        </button>
        <button style={activeTab === 'orders' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('orders')}>
          All Orders ({allOrders.length})
        </button>
        <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      <div style={styles.main}>
        {loading && <p>Loading...</p>}

        {activeTab === 'buyers' && (
          <div>
            <h2 style={styles.heading}>Pending Buyer Approvals</h2>
            {pendingBuyers.length === 0 ? <p style={styles.empty}>No pending buyers</p> :
              pendingBuyers.map(buyer => (
                <UserCard key={buyer.id} user={buyer} onApprove={approveUser} onReject={rejectUser} />
              ))
            }
          </div>
        )}

        {activeTab === 'suppliers' && (
          <div>
            <h2 style={styles.heading}>Pending Supplier Approvals</h2>
            {pendingSuppliers.length === 0 ? <p style={styles.empty}>No pending suppliers</p> :
              pendingSuppliers.map(supplier => (
                <UserCard key={supplier.id} user={supplier} onApprove={approveUser} onReject={rejectUser} />
              ))
            }
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <h2 style={styles.heading}>Pending Product Approvals</h2>
            {pendingProducts.length === 0 ? <p style={styles.empty}>No pending products</p> :
              pendingProducts.map(product => (
                <div key={product.id} style={styles.card}>
                  <div style={styles.cardInfo}>
                    {product.imageUrl && <img src={product.imageUrl} alt={product.name} style={styles.productThumb} />}
                    <p style={styles.firmName}>{product.name}</p>
                    <p style={styles.detail}>Category: {product.category}</p>
                    <p style={styles.detail}>Price: ₹{product.price}/{product.unit}</p>
                    <p style={styles.detail}>MOQ: {product.moq} {product.unit}</p>
                    <p style={styles.detail}>Supplier: {product.supplierFirm}</p>
                    {product.description && <p style={styles.detail}>Description: {product.description}</p>}
                  </div>
                  <div style={styles.cardActions}>
                    <button style={styles.approveBtn} onClick={() => approveProduct(product.id)}>Approve</button>
                    <button style={styles.rejectBtn} onClick={() => rejectProduct(product.id)}>Reject</button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <h2 style={styles.heading}>All Orders</h2>
            {allOrders.length === 0 ? <p style={styles.empty}>No orders yet</p> :
              allOrders.map(order => (
                <div key={order.id} style={styles.orderCard}>
                  <p><b>Order ID:</b> {order.id}</p>
                  <p><b>Buyer:</b> {order.buyerFirm}</p>
                  <p><b>Supplier:</b> {order.supplierFirm}</p>
                  <p><b>Items:</b> {order.items?.map(i => `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}</p>
                  <p><b>Date:</b> {order.createdAt?.toDate?.()?.toLocaleDateString()}</p>
                  <div style={styles.statusRow}>
                    <b>Status:</b>
                    <select style={styles.statusSelect} value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}>
                      <option value="Pending">Pending</option>
                      <option value="Processing">Processing</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', minHeight: '100vh', backgroundColor: '#f5f5f5' },
  sidebar: { width: '220px', backgroundColor: '#1a1a2e', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  logo: { color: 'white', marginBottom: '20px', fontSize: '18px' },
  tab: { padding: '12px', backgroundColor: 'transparent', color: '#aaa', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' },
  activeTab: { padding: '12px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' },
  logoutBtn: { marginTop: 'auto', padding: '12px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  main: { flex: 1, padding: '30px' },
  heading: { color: '#1a1a2e', marginBottom: '20px' },
  empty: { color: '#999' },
  card: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flex: 1 },
  firmName: { fontWeight: 'bold', fontSize: '16px', marginBottom: '5px', color: '#1a1a2e' },
  detail: { color: '#666', fontSize: '13px', margin: '2px 0' },
  cardActions: { display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' },
  approveBtn: { padding: '8px 16px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  rejectBtn: { padding: '8px 16px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  productThumb: { width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' },
  orderCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  statusRow: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' },
  statusSelect: { padding: '6px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' },
};

export default AdminDashboard;