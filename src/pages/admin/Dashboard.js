import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc, query, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';

const SIZES = ['M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const STITCHED_CATEGORIES = ['Kurti', 'Co-ord Set'];
const CHUDIDAR_CATEGORY = '3pc Chudidar';
const NIGHTY_CATEGORIES = ['Nighty', 'Nighty with Dupatta'];
const CUT_OPTIONS = ['2/70', '2/90', '3/20'];

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('buyers');
  const [pendingBuyers, setPendingBuyers] = useState([]);
  const [pendingSuppliers, setPendingSuppliers] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingDesigns, setEditingDesigns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { fetchData(); fetchCategories(); }, []);

  const fetchCategories = async () => {
    const snap = await getDocs(collection(db, 'categories'));
    const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cats.sort((a, b) => a.name.localeCompare(b.name));
    setCategories(cats);
  };

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

  const fetchDesigns = async (productId) => {
    const snap = await getDocs(collection(db, 'products', productId, 'designs'));
    setEditingDesigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  const toggleSize = (size) => {
    const current = editingProduct.sizes || [];
    if (current.includes(size)) {
      setEditingProduct({ ...editingProduct, sizes: current.filter(s => s !== size) });
    } else {
      setEditingProduct({ ...editingProduct, sizes: [...current, size] });
    }
  };

  const updateDesignSets = async (design, newSets) => {
    if (newSets < 0) return;
    const diff = newSets - design.sets;
    await updateDoc(doc(db, 'products', editingProduct.id, 'designs', design.id), { sets: newSets });
    const newTotal = Math.max(0, (editingProduct.totalSets || 0) + diff);
    setEditingProduct({ ...editingProduct, totalSets: newTotal });
    setEditingDesigns(editingDesigns.map(d => d.id === design.id ? { ...d, sets: newSets } : d));
  };

  const updateDesignDn = async (design, dnNumber) => {
    await updateDoc(doc(db, 'products', editingProduct.id, 'designs', design.id), { dnNumber });
    setEditingDesigns(editingDesigns.map(d => d.id === design.id ? { ...d, dnNumber } : d));
  };

  const deleteDesign = async (design) => {
    if (!window.confirm('Delete this design?')) return;
    await deleteDoc(doc(db, 'products', editingProduct.id, 'designs', design.id));
    const newTotal = Math.max(0, (editingProduct.totalSets || 0) - design.sets);
    setEditingProduct({ ...editingProduct, totalSets: newTotal });
    setEditingDesigns(editingDesigns.filter(d => d.id !== design.id));
  };

  const saveProductEdit = async () => {
    const updateData = {
      name: editingProduct.name,
      category: editingProduct.category,
      price: Number(editingProduct.price),
      moq: Number(editingProduct.moq),
      unit: editingProduct.unit,
      description: editingProduct.description || '',
      totalSets: editingProduct.totalSets || 0,
    };

    if (NIGHTY_CATEGORIES.includes(editingProduct.category)) {
      updateData.cut = editingProduct.cut;
    }
    if (STITCHED_CATEGORIES.includes(editingProduct.category)) {
      updateData.sizes = editingProduct.sizes || [];
      updateData.material = editingProduct.material || '';
    }
    if (editingProduct.category === CHUDIDAR_CATEGORY) {
      updateData.productType = editingProduct.productType || '';
      updateData.chudidarTopMaterial = editingProduct.chudidarTopMaterial || '';
      updateData.chudidarBottomMaterial = editingProduct.chudidarBottomMaterial || '';
      updateData.chudidarDupattaMaterial = editingProduct.chudidarDupattaMaterial || '';
      if (editingProduct.productType === 'stitched') {
        updateData.sizes = editingProduct.sizes || [];
      } else {
        updateData.chudidarTop = editingProduct.chudidarTop || '';
        updateData.chudidarBottom = editingProduct.chudidarBottom || '';
        updateData.chudidarDupatta = editingProduct.chudidarDupatta || '';
      }
    }

    // Save design sets to product totalSets
    if (NIGHTY_CATEGORIES.includes(editingProduct.category)) {
      const total = editingDesigns.reduce((sum, d) => sum + (d.sets || 0), 0);
      updateData.totalSets = total;
      for (const design of editingDesigns) {
        await updateDoc(doc(db, 'products', editingProduct.id, 'designs', design.id), {
          sets: design.sets,
          dnNumber: design.dnNumber || '',
        });
      }
    }

    await updateDoc(doc(db, 'products', editingProduct.id), updateData);
    setEditingProduct(null);
    setEditingDesigns([]);
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
        <button style={activeTab === 'buyers' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('buyers')}>Pending Buyers ({pendingBuyers.length})</button>
        <button style={activeTab === 'suppliers' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('suppliers')}>Pending Suppliers ({pendingSuppliers.length})</button>
        <button style={activeTab === 'products' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('products')}>Pending Products ({pendingProducts.length})</button>
        <button style={activeTab === 'orders' ? styles.activeTab : styles.tab} onClick={() => setActiveTab('orders')}>All Orders ({allOrders.length})</button>
        <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      <div style={styles.main}>
        {loading && <p>Loading...</p>}

        {activeTab === 'buyers' && (
          <div>
            <h2 style={styles.heading}>Pending Buyer Approvals</h2>
            {pendingBuyers.length === 0 ? <p style={styles.empty}>No pending buyers</p> :
              pendingBuyers.map(buyer => <UserCard key={buyer.id} user={buyer} onApprove={approveUser} onReject={rejectUser} />)
            }
          </div>
        )}

        {activeTab === 'suppliers' && (
          <div>
            <h2 style={styles.heading}>Pending Supplier Approvals</h2>
            {pendingSuppliers.length === 0 ? <p style={styles.empty}>No pending suppliers</p> :
              pendingSuppliers.map(supplier => <UserCard key={supplier.id} user={supplier} onApprove={approveUser} onReject={rejectUser} />)
            }
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <h2 style={styles.heading}>Pending Product Approvals</h2>
            {pendingProducts.length === 0 ? <p style={styles.empty}>No pending products</p> :
              pendingProducts.map(product => (
                <div key={product.id} style={styles.productCard}>
                  {editingProduct?.id === product.id ? (
                    <div style={styles.editForm}>
                      <h3 style={{ marginBottom: '15px', color: '#1a1a2e' }}>Edit Product</h3>

                      <select style={styles.input} value={editingProduct.category}
                        onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value, productType: '', sizes: [] })}>
                        {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                      </select>

                      <input style={styles.input} placeholder="Product Name" value={editingProduct.name}
                        onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} />

                      <input style={styles.input} type="number" placeholder="Price (₹)" value={editingProduct.price}
                        onChange={e => setEditingProduct({ ...editingProduct, price: e.target.value })} />

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input style={{ ...styles.input, flex: 1 }} type="number" placeholder="MOQ" value={editingProduct.moq}
                          onChange={e => setEditingProduct({ ...editingProduct, moq: e.target.value })} />
                        <select style={{ ...styles.input, flex: 1 }} value={editingProduct.unit}
                          onChange={e => setEditingProduct({ ...editingProduct, unit: e.target.value })}>
                          <option value="sets">Sets</option>
                          <option value="pieces">Pieces</option>
                          <option value="meters">Meters</option>
                          <option value="kg">KG</option>
                          <option value="yards">Yards</option>
                        </select>
                      </div>

                      {/* Nighty */}
                      {NIGHTY_CATEGORIES.includes(editingProduct.category) && (
                        <>
                          <div>
                            <label style={styles.label}>Cut</label>
                            <div style={styles.typeRow}>
                              {CUT_OPTIONS.map(cut => (
                                <button key={cut} type="button"
                                  style={editingProduct.cut === cut ? styles.typeActive : styles.typeBtn}
                                  onClick={() => setEditingProduct({ ...editingProduct, cut })}>
                                  {cut}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label style={styles.label}>Designs — Total Sets: {editingDesigns.reduce((s, d) => s + (d.sets || 0), 0)}</label>
                            <div style={styles.photosGrid}>
                              {editingDesigns.map(design => (
                                <div key={design.id} style={styles.photoCard}>
                                  <img src={design.photoUrl} alt="" style={styles.photoCardImg} />
                                  <p style={styles.designNo}>DN {design.designNo}</p>
                                  <input
                                    type="text"
                                    placeholder="DN No."
                                    value={design.dnNumber || ''}
                                    onChange={e => updateDesignDn(design, e.target.value)}
                                    style={styles.dnInput}
                                  />
                                  <div style={styles.setsAdjust}>
                                    <button type="button" style={styles.qtyBtn} onClick={() => updateDesignSets(design, design.sets - 1)}>−</button>
                                    <span style={styles.setsNum}>{design.sets}</span>
                                    <button type="button" style={styles.qtyBtn} onClick={() => updateDesignSets(design, design.sets + 1)}>+</button>
                                  </div>
                                  <p style={styles.pcsInfo}>{design.sets * (editingProduct.category === 'Nighty' ? 30 : 20)} pcs</p>
                                  <button type="button" style={styles.deleteDesignBtn} onClick={() => deleteDesign(design)}>Delete</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Kurti / Co-ord Set */}
                      {STITCHED_CATEGORIES.includes(editingProduct.category) && (
                        <>
                          <div>
                            <label style={styles.label}>Available Sizes</label>
                            <div style={styles.sizeRow}>
                              {SIZES.map(size => (
                                <button key={size} type="button"
                                  style={(editingProduct.sizes || []).includes(size) ? styles.sizeActive : styles.sizeBtn}
                                  onClick={() => toggleSize(size)}>{size}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label style={styles.label}>Material Used</label>
                            <input style={styles.input} placeholder="Material" value={editingProduct.material || ''}
                              onChange={e => setEditingProduct({ ...editingProduct, material: e.target.value })} />
                          </div>
                        </>
                      )}

                      {/* 3pc Chudidar */}
                      {editingProduct.category === CHUDIDAR_CATEGORY && (
                        <>
                          <div>
                            <label style={styles.label}>Product Type</label>
                            <div style={styles.typeRow}>
                              <button type="button"
                                style={editingProduct.productType === 'stitched' ? styles.typeActive : styles.typeBtn}
                                onClick={() => setEditingProduct({ ...editingProduct, productType: 'stitched', sizes: [] })}>Stitched</button>
                              <button type="button"
                                style={editingProduct.productType === 'unstitched' ? styles.typeActive : styles.typeBtn}
                                onClick={() => setEditingProduct({ ...editingProduct, productType: 'unstitched', sizes: [] })}>Unstitched</button>
                            </div>
                          </div>
                          {editingProduct.productType === 'stitched' && (
                            <div>
                              <label style={styles.label}>Sizes</label>
                              <div style={styles.sizeRow}>
                                {SIZES.map(size => (
                                  <button key={size} type="button"
                                    style={(editingProduct.sizes || []).includes(size) ? styles.sizeActive : styles.sizeBtn}
                                    onClick={() => toggleSize(size)}>{size}</button>
                                ))}
                              </div>
                            </div>
                          )}
                          {editingProduct.productType === 'unstitched' && (
                            <div>
                              <label style={styles.label}>Measurements</label>
                              <input style={styles.input} placeholder="Top" value={editingProduct.chudidarTop || ''}
                                onChange={e => setEditingProduct({ ...editingProduct, chudidarTop: e.target.value })} />
                              <input style={{ ...styles.input, marginTop: '8px' }} placeholder="Bottom" value={editingProduct.chudidarBottom || ''}
                                onChange={e => setEditingProduct({ ...editingProduct, chudidarBottom: e.target.value })} />
                              <input style={{ ...styles.input, marginTop: '8px' }} placeholder="Dupatta" value={editingProduct.chudidarDupatta || ''}
                                onChange={e => setEditingProduct({ ...editingProduct, chudidarDupatta: e.target.value })} />
                            </div>
                          )}
                          {editingProduct.productType && (
                            <div>
                              <label style={styles.label}>Material Used</label>
                              <input style={styles.input} placeholder="Top material" value={editingProduct.chudidarTopMaterial || ''}
                                onChange={e => setEditingProduct({ ...editingProduct, chudidarTopMaterial: e.target.value })} />
                              <input style={{ ...styles.input, marginTop: '8px' }} placeholder="Bottom material" value={editingProduct.chudidarBottomMaterial || ''}
                                onChange={e => setEditingProduct({ ...editingProduct, chudidarBottomMaterial: e.target.value })} />
                              <input style={{ ...styles.input, marginTop: '8px' }} placeholder="Dupatta material" value={editingProduct.chudidarDupattaMaterial || ''}
                                onChange={e => setEditingProduct({ ...editingProduct, chudidarDupattaMaterial: e.target.value })} />
                            </div>
                          )}
                        </>
                      )}

                      <textarea style={{ ...styles.input, height: '70px' }} placeholder="Description"
                        value={editingProduct.description || ''}
                        onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} />

                      <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                        <button style={styles.editBtn} onClick={saveProductEdit}>Save</button>
                        <button style={styles.rejectBtn} onClick={() => { setEditingProduct(null); setEditingDesigns([]); }}>Cancel</button>
                        <button style={styles.approveBtn} onClick={async () => { await saveProductEdit(); await approveProduct(product.id); }}>Save & Approve</button>
                      </div>
                    </div>
                  ) : (
                    <div style={styles.productRow}>
                      <div style={styles.cardInfo}>
                        {product.imageUrls?.length > 0 ? (
                          <div style={styles.imageStrip}>
                            {product.imageUrls.map((url, i) => <img key={i} src={url} alt="" style={styles.thumb} />)}
                          </div>
                        ) : product.imageUrl ? <img src={product.imageUrl} alt="" style={styles.thumb} /> : null}
                        <p style={styles.firmName}>{product.name}</p>
                        <p style={styles.detail}>Category: {product.category}</p>
                        <p style={styles.detail}>Price: ₹{product.price}/{product.unit}</p>
                        <p style={styles.detail}>MOQ: {product.moq} {product.unit}</p>
                        <p style={styles.detail}>Supplier: {product.supplierFirm}</p>
                        {product.cut && <p style={styles.detail}>Cut: {product.cut}</p>}
                        {product.totalSets > 0 && <p style={styles.detail}>Total Sets: {product.totalSets}</p>}
                        {product.productType && <p style={styles.detail}>Type: {product.productType}</p>}
                        {product.material && <p style={styles.detail}>Material: {product.material}</p>}
                        {product.sizes?.length > 0 && <p style={styles.detail}>Sizes: {product.sizes.join(', ')}</p>}
                        {product.description && <p style={styles.detail}>Description: {product.description}</p>}
                      </div>
                      <div style={styles.cardActions}>
                        <button style={styles.editBtn} onClick={() => { setEditingProduct({ ...product }); fetchDesigns(product.id); }}>Edit</button>
                        <button style={styles.approveBtn} onClick={() => approveProduct(product.id)}>Approve</button>
                        <button style={styles.rejectBtn} onClick={() => rejectProduct(product.id)}>Reject</button>
                      </div>
                    </div>
                  )}
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
                  <p><b>Items:</b> {order.items?.map(i => i.sets ? `${i.productName} (${i.sets} sets = ${i.pcs} pcs)` : `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}</p>
                  {order.nightyDetails && (
                    <p><b>Nighty Packing:</b> {order.nightyDetails.totalSets} sets | {order.nightyDetails.packingType} sets/bale | {order.nightyDetails.totalBales} bale(s) | {order.nightyDetails.totalPcs} pcs</p>
                  )}
                  <p><b>Date:</b> {order.createdAt?.toDate?.()?.toLocaleDateString()}</p>
                  <div style={styles.statusRow}>
                    <b>Status:</b>
                    <select style={styles.statusSelect} value={order.status}
                      onChange={e => updateOrderStatus(order.id, e.target.value)}>
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
  productCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  productRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  editForm: { display: 'flex', flexDirection: 'column', gap: '10px' },
  cardInfo: { flex: 1 },
  firmName: { fontWeight: 'bold', fontSize: '16px', marginBottom: '5px', color: '#1a1a2e' },
  detail: { color: '#666', fontSize: '13px', margin: '2px 0' },
  cardActions: { display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' },
  approveBtn: { padding: '8px 16px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  rejectBtn: { padding: '8px 16px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  editBtn: { padding: '8px 16px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  imageStrip: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' },
  thumb: { width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' },
  orderCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  statusRow: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' },
  statusSelect: { padding: '6px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' },
  input: { padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  label: { fontSize: '13px', color: '#555', marginBottom: '5px', display: 'block' },
  typeRow: { display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' },
  typeBtn: { padding: '8px 20px', border: '2px solid #ddd', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'white', fontSize: '14px' },
  typeActive: { padding: '8px 20px', border: '2px solid #1a1a2e', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#1a1a2e', color: 'white', fontSize: '14px' },
  sizeRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '5px' },
  sizeBtn: { padding: '6px 12px', border: '2px solid #ddd', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px' },
  sizeActive: { padding: '6px 12px', border: '2px solid #e63946', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#e63946', color: 'white', fontSize: '13px' },
  photosGrid: { display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' },
  photoCard: { backgroundColor: '#f9f9f9', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '130px', border: '1px solid #eee' },
  photoCardImg: { width: '110px', height: '110px', objectFit: 'cover', borderRadius: '6px' },
  designNo: { fontSize: '12px', fontWeight: 'bold', color: '#555' },
  dnInput: { width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '11px', textAlign: 'center', boxSizing: 'border-box' },
  setsAdjust: { display: 'flex', alignItems: 'center', gap: '6px' },
  qtyBtn: { width: '26px', height: '26px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white', fontSize: '14px' },
  setsNum: { fontWeight: 'bold', fontSize: '14px', minWidth: '25px', textAlign: 'center' },
  pcsInfo: { color: '#666', fontSize: '11px' },
  deleteDesignBtn: { padding: '4px 10px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' },
};

export default AdminDashboard;