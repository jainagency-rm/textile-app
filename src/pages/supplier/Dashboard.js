import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import { notifyNewProduct } from '../../utils/notifications';

const STITCHED_CATEGORIES = ['Kurti', 'Co-ord Set'];
const CHUDIDAR_CATEGORY = '3pc Chudidar';
const NIGHTY_CATEGORIES = ['Nighty', 'Nighty with Dupatta'];
const SIZES = ['M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
const CUT_OPTIONS = ['2/70', '2/90', '3/20'];

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

function SupplierDashboard() {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingDesigns, setEditingDesigns] = useState([]);
  const [editingPhotos, setEditingPhotos] = useState([]);
  const navigate = useNavigate();

  const emptyForm = {
    name: '', category: '', price: '', moq: '', unit: 'sets', description: '',
    cut: '', sizes: [], material: '', productType: '',
    chudidarTop: '', chudidarBottom: '', chudidarDupatta: '',
    chudidarTopMaterial: '', chudidarBottomMaterial: '', chudidarDupattaMaterial: '',
    photos: [],
  };
  const [productForm, setProductForm] = useState(emptyForm);

  useEffect(() => {
    fetchProfile();
    fetchProducts();
    fetchOrders();
    fetchCategories();
  }, []);

  const fetchProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) setUserProfile(snap.data());
  };

  const fetchCategories = async () => {
    const snap = await getDocs(collection(db, 'categories'));
    const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cats.sort((a, b) => a.name.localeCompare(b.name));
    setCategories(cats);
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

  const openEdit = async (product) => {
    setEditingProduct({...product});
    if (NIGHTY_CATEGORIES.includes(product.category)) {
      const snap = await getDocs(collection(db, 'products', product.id, 'designs'));
      setEditingDesigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } else {
      setEditingPhotos(product.imageUrls || (product.imageUrl ? [product.imageUrl] : []));
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    await addDoc(collection(db, 'categories'), { name: newCategory.trim() });
    setNewCategory('');
    setAddingCategory(false);
    fetchCategories();
  };

  const toggleSize = (size) => {
    const current = productForm.sizes;
    if (current.includes(size)) {
      setProductForm({ ...productForm, sizes: current.filter(s => s !== size) });
    } else {
      setProductForm({ ...productForm, sizes: [...current, size] });
    }
  };

  const toggleEditSize = (size) => {
    const current = editingProduct.sizes || [];
    if (current.includes(size)) {
      setEditingProduct({ ...editingProduct, sizes: current.filter(s => s !== size) });
    } else {
      setEditingProduct({ ...editingProduct, sizes: [...current, size] });
    }
  };

  const handlePhotoUpload = async (files) => {
    setUploading(true);
    const user = auth.currentUser;
    const newPhotos = [];
    for (const file of Array.from(files).slice(0, 20)) {
      const imageRef = ref(storage, `designs/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);
      newPhotos.push({ url, sets: 1, dnNumber: '' });
    }
    setProductForm(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos] }));
    setUploading(false);
  };

  const handleAddPhotosInEdit = async (files) => {
    setUploading(true);
    const user = auth.currentUser;
    const newUrls = [];
    for (const file of Array.from(files).slice(0, 20)) {
      const imageRef = ref(storage, `products/${user.uid}/${editingProduct.id}/${Date.now()}_${file.name}`);
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);
      newUrls.push(url);
    }
    const updatedPhotos = [...editingPhotos, ...newUrls];
    setEditingPhotos(updatedPhotos);
    await updateDoc(doc(db, 'products', editingProduct.id), {
      imageUrl: updatedPhotos[0] || '',
      imageUrls: updatedPhotos,
    });
    setUploading(false);
  };

  const handleDeletePhotoInEdit = async (url) => {
    const updatedPhotos = editingPhotos.filter(p => p !== url);
    setEditingPhotos(updatedPhotos);
    await updateDoc(doc(db, 'products', editingProduct.id), {
      imageUrl: updatedPhotos[0] || '',
      imageUrls: updatedPhotos,
    });
  };

  const handleAddNewDesignsInEdit = async (files) => {
    setUploading(true);
    const user = auth.currentUser;
    const files_arr = Array.from(files).slice(0, 20);
    const currentCount = editingDesigns.length;
    const newDesigns = [];
    let newTotal = editingProduct.totalSets || 0;

    for (let i = 0; i < files_arr.length; i++) {
      const file = files_arr[i];
      const imageRef = ref(storage, `designs/${user.uid}/${editingProduct.id}/${Date.now()}_${file.name}`);
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);
      const docRef = await addDoc(collection(db, 'products', editingProduct.id, 'designs'), {
        designNo: currentCount + i + 1,
        dnNumber: '',
        sets: 1,
        photoUrl: url,
        addedAt: new Date(),
      });
      newDesigns.push({ id: docRef.id, designNo: currentCount + i + 1, dnNumber: '', sets: 1, photoUrl: url });
      newTotal += 1;
    }

    await updateDoc(doc(db, 'products', editingProduct.id), { totalSets: newTotal });
    setEditingProduct(prev => ({ ...prev, totalSets: newTotal }));
    setEditingDesigns(prev => [...prev, ...newDesigns]);
    setUploading(false);
  };

  const updateEditDesignSets = async (design, newSets) => {
    if (newSets < 0) return;
    const diff = newSets - design.sets;
    await updateDoc(doc(db, 'products', editingProduct.id, 'designs', design.id), { sets: newSets });
    const newTotal = Math.max(0, (editingProduct.totalSets || 0) + diff);
    await updateDoc(doc(db, 'products', editingProduct.id), { totalSets: newTotal });
    setEditingProduct(prev => ({ ...prev, totalSets: newTotal }));
    setEditingDesigns(prev => prev.map(d => d.id === design.id ? { ...d, sets: newSets } : d));
  };

  const deleteEditDesign = async (design) => {
    if (!window.confirm('Delete this design?')) return;
    await deleteDoc(doc(db, 'products', editingProduct.id, 'designs', design.id));
    const newTotal = Math.max(0, (editingProduct.totalSets || 0) - design.sets);
    await updateDoc(doc(db, 'products', editingProduct.id), { totalSets: newTotal });
    setEditingProduct(prev => ({ ...prev, totalSets: newTotal }));
    setEditingDesigns(prev => prev.filter(d => d.id !== design.id));
  };

  const updatePhotoSets = (index, delta) => {
    const updated = [...productForm.photos];
    updated[index].sets = Math.max(0, updated[index].sets + delta);
    setProductForm({ ...productForm, photos: updated });
  };

  const updatePhotoDn = (index, value) => {
    const updated = [...productForm.photos];
    updated[index].dnNumber = value;
    setProductForm({ ...productForm, photos: updated });
  };

  const removePhoto = (index) => {
    const updated = productForm.photos.filter((_, i) => i !== index);
    setProductForm({ ...productForm, photos: updated });
  };

  const totalSets = productForm.photos.reduce((sum, p) => sum + p.sets, 0);
  const pcsPerSet = productForm.category === 'Nighty with Dupatta' ? 20 : 30;

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      const updateData = {
        name: editingProduct.name,
        price: Number(editingProduct.price),
        moq: Number(editingProduct.moq),
        unit: editingProduct.unit,
        description: editingProduct.description || '',
      };
      if (NIGHTY_CATEGORIES.includes(editingProduct.category)) updateData.cut = editingProduct.cut;
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
      await updateDoc(doc(db, 'products', editingProduct.id), updateData);
      setEditingProduct(null);
      setEditingDesigns([]);
      setEditingPhotos([]);
      fetchProducts();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = auth.currentUser;
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const freshProfile = userSnap.data();

      const productData = {
        name: productForm.name,
        category: productForm.category,
        price: Number(productForm.price),
        moq: Number(productForm.moq),
        unit: productForm.unit,
        description: productForm.description,
        supplierId: user.uid,
        supplierFirm: freshProfile?.firmName || '',
        status: 'pending',
        createdAt: new Date(),
        totalSets: NIGHTY_CATEGORIES.includes(productForm.category) ? totalSets : 0,
        imageUrl: productForm.photos[0]?.url || '',
        imageUrls: productForm.photos.map(p => ({
          url: p.url,
          dnNumber: p.dnNumber || ''
        })),
      };

      if (NIGHTY_CATEGORIES.includes(productForm.category)) productData.cut = productForm.cut;
      if (STITCHED_CATEGORIES.includes(productForm.category)) {
        productData.sizes = productForm.sizes;
        productData.material = productForm.material;
      }
      if (productForm.category === CHUDIDAR_CATEGORY) {
        productData.productType = productForm.productType;
        productData.chudidarTopMaterial = productForm.chudidarTopMaterial;
        productData.chudidarBottomMaterial = productForm.chudidarBottomMaterial;
        productData.chudidarDupattaMaterial = productForm.chudidarDupattaMaterial;
        if (productForm.productType === 'stitched') {
          productData.sizes = productForm.sizes;
        } else {
          productData.chudidarTop = productForm.chudidarTop;
          productData.chudidarBottom = productForm.chudidarBottom;
          productData.chudidarDupatta = productForm.chudidarDupatta;
        }
      }

      const productRef = await addDoc(collection(db, 'products'), productData);

      if (NIGHTY_CATEGORIES.includes(productForm.category)) {
        for (let i = 0; i < productForm.photos.length; i++) {
          const photo = productForm.photos[i];
          await addDoc(collection(db, 'products', productRef.id, 'designs'), {
            designNo: i + 1,
            dnNumber: photo.dnNumber || '',
            sets: photo.sets,
            photoUrl: photo.url,
            addedAt: new Date(),
          });
        }
      }

      // Admin + saare buyers ko notify karo
      const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const adminId = adminSnap.docs[0]?.id;
      if (adminId) await notifyNewProduct(adminId, productForm.name, freshProfile?.firmName || '');

      setProductForm(emptyForm);
      setActiveTab('products');
      fetchProducts();
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const deleteProduct = async (productId) => {
    if (window.confirm('Delete this product and all its designs?')) {
      const designsSnap = await getDocs(collection(db, 'products', productId, 'designs'));
      const batch = writeBatch(db);
      designsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'products', productId));
      await batch.commit();
      fetchProducts();
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const editPcsPerSet = editingProduct?.category === 'Nighty with Dupatta' ? 20 : 30;

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

        {editingProduct && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3 style={styles.modalTitle}>Edit — {editingProduct.name}</h3>
              <div style={styles.section}>
                <label style={styles.sectionTitle}>Basic Details</label>
                <input style={styles.input} placeholder="Product Name" value={editingProduct.name}
                  onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                <input style={styles.input} type="number" placeholder="Price (₹)" value={editingProduct.price}
                  onChange={e => setEditingProduct({...editingProduct, price: e.target.value})} />
                <div style={{display:'flex', gap:'10px'}}>
                  <input style={{...styles.input, flex:1}} type="number" placeholder="MOQ" value={editingProduct.moq}
                    onChange={e => setEditingProduct({...editingProduct, moq: e.target.value})} />
                  <select style={{...styles.input, flex:1}} value={editingProduct.unit}
                    onChange={e => setEditingProduct({...editingProduct, unit: e.target.value})}>
                    <option value="sets">Sets</option>
                    <option value="pieces">Pieces</option>
                    <option value="meters">Meters</option>
                    <option value="kg">KG</option>
                    <option value="yards">Yards</option>
                  </select>
                </div>
                <textarea style={{...styles.input, height:'60px'}} placeholder="Description"
                  value={editingProduct.description || ''}
                  onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
              </div>

              {NIGHTY_CATEGORIES.includes(editingProduct.category) && (
                <div style={styles.section}>
                  <label style={styles.sectionTitle}>Cut</label>
                  <div style={styles.typeRow}>
                    {CUT_OPTIONS.map(cut => (
                      <button key={cut} type="button"
                        style={editingProduct.cut === cut ? styles.typeActive : styles.typeBtn}
                        onClick={() => setEditingProduct({...editingProduct, cut})}>
                        {cut}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {STITCHED_CATEGORIES.includes(editingProduct.category) && (
                <div style={styles.section}>
                  <label style={styles.sectionTitle}>Sizes & Material</label>
                  <div style={styles.sizeRow}>
                    {SIZES.map(size => (
                      <button key={size} type="button"
                        style={(editingProduct.sizes || []).includes(size) ? styles.sizeActive : styles.sizeBtn}
                        onClick={() => toggleEditSize(size)}>{size}</button>
                    ))}
                  </div>
                  <input style={{...styles.input, marginTop:'10px'}} placeholder="Material"
                    value={editingProduct.material || ''}
                    onChange={e => setEditingProduct({...editingProduct, material: e.target.value})} />
                </div>
              )}

              {editingProduct.category === CHUDIDAR_CATEGORY && (
                <div style={styles.section}>
                  <label style={styles.sectionTitle}>Product Type & Details</label>
                  <div style={styles.typeRow}>
                    <button type="button"
                      style={editingProduct.productType === 'stitched' ? styles.typeActive : styles.typeBtn}
                      onClick={() => setEditingProduct({...editingProduct, productType: 'stitched'})}>Stitched</button>
                    <button type="button"
                      style={editingProduct.productType === 'unstitched' ? styles.typeActive : styles.typeBtn}
                      onClick={() => setEditingProduct({...editingProduct, productType: 'unstitched'})}>Unstitched</button>
                  </div>
                  {editingProduct.productType === 'stitched' && (
                    <div style={styles.sizeRow}>
                      {SIZES.map(size => (
                        <button key={size} type="button"
                          style={(editingProduct.sizes || []).includes(size) ? styles.sizeActive : styles.sizeBtn}
                          onClick={() => toggleEditSize(size)}>{size}</button>
                      ))}
                    </div>
                  )}
                  {editingProduct.productType === 'unstitched' && (
                    <>
                      <input style={styles.input} placeholder="Top measurement" value={editingProduct.chudidarTop || ''}
                        onChange={e => setEditingProduct({...editingProduct, chudidarTop: e.target.value})} />
                      <input style={{...styles.input, marginTop:'8px'}} placeholder="Bottom measurement" value={editingProduct.chudidarBottom || ''}
                        onChange={e => setEditingProduct({...editingProduct, chudidarBottom: e.target.value})} />
                      <input style={{...styles.input, marginTop:'8px'}} placeholder="Dupatta measurement" value={editingProduct.chudidarDupatta || ''}
                        onChange={e => setEditingProduct({...editingProduct, chudidarDupatta: e.target.value})} />
                    </>
                  )}
                  <input style={{...styles.input, marginTop:'8px'}} placeholder="Top material" value={editingProduct.chudidarTopMaterial || ''}
                    onChange={e => setEditingProduct({...editingProduct, chudidarTopMaterial: e.target.value})} />
                  <input style={{...styles.input, marginTop:'8px'}} placeholder="Bottom material" value={editingProduct.chudidarBottomMaterial || ''}
                    onChange={e => setEditingProduct({...editingProduct, chudidarBottomMaterial: e.target.value})} />
                  <input style={{...styles.input, marginTop:'8px'}} placeholder="Dupatta material" value={editingProduct.chudidarDupattaMaterial || ''}
                    onChange={e => setEditingProduct({...editingProduct, chudidarDupattaMaterial: e.target.value})} />
                </div>
              )}

              {!NIGHTY_CATEGORIES.includes(editingProduct.category) && (
                <div style={styles.section}>
                  <label style={styles.sectionTitle}>Photos</label>
                  <input type="file" accept="image/*" multiple style={styles.input}
                    onChange={e => handleAddPhotosInEdit(e.target.files)} />
                  {uploading && <p style={styles.uploadingText}>Uploading...</p>}
                  {editingPhotos.length > 0 && (
                    <div style={styles.editPhotoStrip}>
                      {editingPhotos.map((url, i) => (
                        <div key={i} style={styles.editPhotoItem}>
                          <img src={url} alt="" style={styles.editPhotoImg} />
                          <button type="button" style={styles.deletePhotoBtn}
                            onClick={() => handleDeletePhotoInEdit(url)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {NIGHTY_CATEGORIES.includes(editingProduct.category) && (
                <div style={styles.section}>
                  <label style={styles.sectionTitle}>Designs — Total Sets: {editingProduct.totalSets || 0}</label>
                  <div style={{marginBottom:'10px'}}>
                    <label style={styles.label}>Add New Designs</label>
                    <input type="file" accept="image/*" multiple style={styles.input}
                      onChange={e => handleAddNewDesignsInEdit(e.target.files)} />
                    {uploading && <p style={styles.uploadingText}>Uploading...</p>}
                  </div>
                  <div style={styles.photosGrid}>
                    {editingDesigns.map(design => (
                      <div key={design.id} style={styles.photoCard}>
                        <img src={design.photoUrl} alt="" style={styles.photoCardImg} />
                        <p style={styles.designNo}>DN {design.designNo}</p>
                        {design.dnNumber && <p style={styles.dnLabel}>{design.dnNumber}</p>}
                        <div style={styles.setsAdjust}>
                          <button type="button" style={styles.qtyBtn} onClick={() => updateEditDesignSets(design, design.sets - 1)}>−</button>
                          <span style={styles.setsNum}>{design.sets}</span>
                          <button type="button" style={styles.qtyBtn} onClick={() => updateEditDesignSets(design, design.sets + 1)}>+</button>
                        </div>
                        <p style={styles.pcsInfo}>{design.sets * editPcsPerSet} pcs</p>
                        <button type="button" style={styles.deleteDesignBtn} onClick={() => deleteEditDesign(design)}>Delete</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                <button style={styles.saveBtn} onClick={handleSaveEdit} disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button style={styles.cancelBtn} onClick={() => { setEditingProduct(null); setEditingDesigns([]); setEditingPhotos([]); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <h2 style={styles.heading}>My Products</h2>
            {products.length === 0 ? <p style={styles.empty}>No products added yet</p> :
              <div style={styles.grid}>
                {products.map(product => (
                  <div key={product.id} style={styles.productCard}>
                    {product.imageUrl && <img src={product.imageUrl} alt={product.name} style={styles.productImage} />}
                    <div style={styles.productInfo}>
                      <p style={styles.productName}>{product.name}</p>
                      <p style={styles.productDetail}>Category: {product.category}</p>
                      <p style={styles.productDetail}>Price: ₹{product.price}/{product.unit}</p>
                      {NIGHTY_CATEGORIES.includes(product.category) && (
                        <>
                          <p style={styles.productDetail}>Cut: {product.cut}</p>
                          <p style={styles.productDetail}>Total Sets: {product.totalSets || 0}</p>
                        </>
                      )}
                      {product.material && <p style={styles.productDetail}>Material: {product.material}</p>}
                      {product.sizes?.length > 0 && <p style={styles.productDetail}>Sizes: {product.sizes.join(', ')}</p>}
                      {product.productType && <p style={styles.productDetail}>Type: {product.productType}</p>}
                      <span style={product.status === 'approved' ? styles.approved : styles.pending}>{product.status}</span>
                    </div>
                    <div style={styles.productActions}>
                      <button style={styles.editProductBtn} onClick={() => openEdit(product)}>Edit</button>
                      <button style={styles.deleteBtn} onClick={() => deleteProduct(product.id)}>Delete</button>
                    </div>
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
              <div>
                <select style={styles.input} value={productForm.category}
                  onChange={(e) => setProductForm({ ...emptyForm, category: e.target.value })} required>
                  <option value="">Select Category</option>
                  {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                </select>
                {!addingCategory ? (
                  <button type="button" style={styles.addCatBtn} onClick={() => setAddingCategory(true)}>+ Add New Category</button>
                ) : (
                  <div style={styles.addCatRow}>
                    <input style={{...styles.input, flex:1}} placeholder="New category name" value={newCategory}
                      onChange={e => setNewCategory(e.target.value)} />
                    <button type="button" style={styles.saveCatBtn} onClick={handleAddCategory}>Save</button>
                    <button type="button" style={styles.cancelCatBtn} onClick={() => setAddingCategory(false)}>Cancel</button>
                  </div>
                )}
              </div>

              {NIGHTY_CATEGORIES.includes(productForm.category) && (
                <>
                  <div>
                    <label style={styles.label}>Cut *</label>
                    <div style={styles.typeRow}>
                      {CUT_OPTIONS.map(cut => (
                        <button key={cut} type="button"
                          style={productForm.cut === cut ? styles.typeActive : styles.typeBtn}
                          onClick={() => setProductForm({...productForm, cut})}>
                          {cut}
                        </button>
                      ))}
                    </div>
                    <p style={styles.hint}>1 set = 5 colours × {pcsPerSet / 5} pcs = {pcsPerSet} pcs</p>
                  </div>
                  <div style={styles.uploadSection}>
                    <label style={styles.label}>Upload Design Photos *</label>
                    <input type="file" accept="image/*" multiple style={styles.input}
                      onChange={e => handlePhotoUpload(e.target.files)} />
                    {uploading && <p style={styles.uploadingText}>Uploading photos...</p>}
                    {productForm.photos.length > 0 && (
                      <div style={styles.photosGrid}>
                        {productForm.photos.map((photo, index) => (
                          <div key={index} style={styles.photoCard}>
                            <img src={photo.url} alt="" style={styles.photoCardImg} />
                            <p style={styles.designNo}>DN {index + 1}</p>
                            <input type="text" placeholder="DN No. (optional)" value={photo.dnNumber || ''}
                              onChange={e => updatePhotoDn(index, e.target.value)} style={styles.dnInput} />
                            <div style={styles.setsAdjust}>
                              <button type="button" style={styles.qtyBtn} onClick={() => updatePhotoSets(index, -1)}>−</button>
                              <span style={styles.setsNum}>{photo.sets}</span>
                              <button type="button" style={styles.qtyBtn} onClick={() => updatePhotoSets(index, 1)}>+</button>
                            </div>
                            <p style={styles.pcsInfo}>{photo.sets * pcsPerSet} pcs</p>
                            <button type="button" style={styles.deleteDesignBtn} onClick={() => removePhoto(index)}>Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {productForm.photos.length > 0 && (
                      <div style={styles.totalBar}>
                        {productForm.photos.length} designs | {totalSets} sets | {totalSets * pcsPerSet} pcs
                      </div>
                    )}
                  </div>
                </>
              )}

              {STITCHED_CATEGORIES.includes(productForm.category) && (
                <>
                  <div>
                    <label style={styles.label}>Available Sizes *</label>
                    <div style={styles.sizeRow}>
                      {SIZES.map(size => (
                        <button key={size} type="button"
                          style={productForm.sizes.includes(size) ? styles.sizeActive : styles.sizeBtn}
                          onClick={() => toggleSize(size)}>{size}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={styles.label}>Material Used *</label>
                    <input style={styles.input} placeholder="e.g. Cotton, Rayon" value={productForm.material}
                      onChange={e => setProductForm({...productForm, material: e.target.value})} required />
                  </div>
                  <div>
                    <label style={styles.label}>Upload Photos (max 20)</label>
                    <input style={styles.input} type="file" accept="image/*" multiple
                      onChange={e => handlePhotoUpload(e.target.files)} />
                    {productForm.photos.length > 0 && (
                      <div style={styles.photoStrip}>
                        {productForm.photos.map((p, i) => <img key={i} src={p.url} alt="" style={styles.stripThumb} />)}
                      </div>
                    )}
                  </div>
                </>
              )}

              {productForm.category === CHUDIDAR_CATEGORY && (
                <>
                  <div>
                    <label style={styles.label}>Product Type *</label>
                    <div style={styles.typeRow}>
                      <button type="button" style={productForm.productType === 'stitched' ? styles.typeActive : styles.typeBtn}
                        onClick={() => setProductForm({...productForm, productType: 'stitched', sizes: []})}>Stitched</button>
                      <button type="button" style={productForm.productType === 'unstitched' ? styles.typeActive : styles.typeBtn}
                        onClick={() => setProductForm({...productForm, productType: 'unstitched', sizes: []})}>Unstitched</button>
                    </div>
                  </div>
                  {productForm.productType === 'stitched' && (
                    <div>
                      <label style={styles.label}>Available Sizes *</label>
                      <div style={styles.sizeRow}>
                        {SIZES.map(size => (
                          <button key={size} type="button"
                            style={productForm.sizes.includes(size) ? styles.sizeActive : styles.sizeBtn}
                            onClick={() => toggleSize(size)}>{size}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {productForm.productType === 'unstitched' && (
                    <div>
                      <label style={styles.label}>Measurements</label>
                      <input style={styles.input} placeholder="Top" value={productForm.chudidarTop}
                        onChange={e => setProductForm({...productForm, chudidarTop: e.target.value})} />
                      <input style={{...styles.input, marginTop:'8px'}} placeholder="Bottom" value={productForm.chudidarBottom}
                        onChange={e => setProductForm({...productForm, chudidarBottom: e.target.value})} />
                      <input style={{...styles.input, marginTop:'8px'}} placeholder="Dupatta" value={productForm.chudidarDupatta}
                        onChange={e => setProductForm({...productForm, chudidarDupatta: e.target.value})} />
                    </div>
                  )}
                  {productForm.productType && (
                    <div>
                      <label style={styles.label}>Material Used *</label>
                      <input style={styles.input} placeholder="Top material" value={productForm.chudidarTopMaterial}
                        onChange={e => setProductForm({...productForm, chudidarTopMaterial: e.target.value})} required />
                      <input style={{...styles.input, marginTop:'8px'}} placeholder="Bottom material" value={productForm.chudidarBottomMaterial}
                        onChange={e => setProductForm({...productForm, chudidarBottomMaterial: e.target.value})} required />
                      <input style={{...styles.input, marginTop:'8px'}} placeholder="Dupatta material" value={productForm.chudidarDupattaMaterial}
                        onChange={e => setProductForm({...productForm, chudidarDupattaMaterial: e.target.value})} required />
                    </div>
                  )}
                  <div>
                    <label style={styles.label}>Upload Photos (max 20)</label>
                    <input style={styles.input} type="file" accept="image/*" multiple
                      onChange={e => handlePhotoUpload(e.target.files)} />
                    {productForm.photos.length > 0 && (
                      <div style={styles.photoStrip}>
                        {productForm.photos.map((p, i) => <img key={i} src={p.url} alt="" style={styles.stripThumb} />)}
                      </div>
                    )}
                  </div>
                </>
              )}

              {!NIGHTY_CATEGORIES.includes(productForm.category) && !STITCHED_CATEGORIES.includes(productForm.category) && productForm.category && productForm.category !== CHUDIDAR_CATEGORY && (
                <div>
                  <label style={styles.label}>Upload Photos (max 20)</label>
                  <input style={styles.input} type="file" accept="image/*" multiple
                    onChange={e => handlePhotoUpload(e.target.files)} />
                  {productForm.photos.length > 0 && (
                    <div style={styles.photoStrip}>
                      {productForm.photos.map((p, i) => <img key={i} src={p.url} alt="" style={styles.stripThumb} />)}
                    </div>
                  )}
                </div>
              )}

              <input style={styles.input} placeholder="Product Name" value={productForm.name}
                onChange={e => setProductForm({...productForm, name: e.target.value})} required />
              <input style={styles.input} type="number" placeholder="Price (₹)" value={productForm.price}
                onChange={e => setProductForm({...productForm, price: e.target.value})} required />
              <div style={{display:'flex', gap:'10px'}}>
                <input style={{...styles.input, flex:1}} type="number" placeholder="MOQ" value={productForm.moq}
                  onChange={e => setProductForm({...productForm, moq: e.target.value})} required />
                <select style={{...styles.input, flex:1}} value={productForm.unit}
                  onChange={e => setProductForm({...productForm, unit: e.target.value})}>
                  <option value="sets">Sets</option>
                  <option value="pieces">Pieces</option>
                  <option value="meters">Meters</option>
                  <option value="kg">KG</option>
                  <option value="yards">Yards</option>
                </select>
              </div>
              <textarea style={{...styles.input, height:'80px'}} placeholder="Product Description"
                value={productForm.description}
                onChange={e => setProductForm({...productForm, description: e.target.value})} />
              <button style={styles.submitBtn} type="submit" disabled={loading || uploading}>
                {loading ? 'Saving...' : uploading ? 'Uploading...' : 'Submit for Approval'}
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
                  <p><b>Items:</b> {order.items?.map(i => i.sets ? `${i.productName} (${i.sets} sets = ${i.pcs} pcs)` : `${i.productName} (${i.quantity} ${i.unit})`).join(', ')}</p>
                  {order.nightyDetails && (
                    <p><b>Nighty:</b> {order.nightyDetails.totalSets} sets | {order.nightyDetails.packingType} sets/bale | {order.nightyDetails.totalBales} bale(s)</p>
                  )}
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
  heading: { color: '#1a1a2e', marginBottom: '10px' },
  empty: { color: '#999' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' },
  productCard: { backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  productImage: { width: '100%', height: '140px', objectFit: 'cover' },
  productInfo: { padding: '12px' },
  productName: { fontWeight: 'bold', fontSize: '15px', marginBottom: '5px' },
  productDetail: { color: '#666', fontSize: '13px', margin: '2px 0' },
  productActions: { padding: '0 12px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' },
  approved: { backgroundColor: '#d4edda', color: '#155724', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', display: 'inline-block', marginTop: '5px' },
  pending: { backgroundColor: '#fff3cd', color: '#856404', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', display: 'inline-block', marginTop: '5px' },
  editProductBtn: { padding: '7px 12px', backgroundColor: '#f39c12', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  deleteBtn: { padding: '7px 12px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
  uploadSection: { backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '10px', border: '1px solid #eee' },
  photosGrid: { display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' },
  photoCard: { backgroundColor: '#f9f9f9', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '120px', border: '1px solid #eee' },
  photoCardImg: { width: '104px', height: '104px', objectFit: 'cover', borderRadius: '6px' },
  designNo: { fontSize: '11px', fontWeight: 'bold', color: '#555' },
  dnLabel: { fontSize: '10px', color: '#888' },
  dnInput: { width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '11px', textAlign: 'center', boxSizing: 'border-box' },
  setsAdjust: { display: 'flex', alignItems: 'center', gap: '5px' },
  qtyBtn: { width: '24px', height: '24px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px' },
  setsNum: { fontWeight: 'bold', fontSize: '13px', minWidth: '22px', textAlign: 'center' },
  pcsInfo: { color: '#666', fontSize: '10px' },
  deleteDesignBtn: { padding: '3px 8px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' },
  totalBar: { backgroundColor: '#1a1a2e', color: 'white', padding: '10px 15px', borderRadius: '8px', marginTop: '10px', fontWeight: 'bold', fontSize: '14px' },
  uploadingText: { color: '#e67e22', fontSize: '13px', marginTop: '5px' },
  photoStrip: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' },
  stripThumb: { width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' },
  editPhotoStrip: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' },
  editPhotoItem: { position: 'relative' },
  editPhotoImg: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '6px' },
  deletePhotoBtn: { position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '650px' },
  input: { padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  label: { fontSize: '13px', color: '#555', marginBottom: '5px', display: 'block' },
  hint: { fontSize: '12px', color: '#999', marginTop: '4px' },
  submitBtn: { padding: '12px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' },
  orderCard: { backgroundColor: 'white', padding: '20px', borderRadius: '10px', marginBottom: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  profileCard: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', lineHeight: '2' },
  editBtn: { padding: '10px 20px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '15px' },
  addCatBtn: { marginTop: '8px', padding: '6px 12px', backgroundColor: 'transparent', color: '#e63946', border: '1px solid #e63946', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  addCatRow: { display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' },
  saveCatBtn: { padding: '10px 14px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' },
  cancelCatBtn: { padding: '10px 14px', backgroundColor: '#999', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' },
  typeRow: { display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' },
  typeBtn: { padding: '8px 20px', border: '2px solid #ddd', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'white', fontSize: '14px' },
  typeActive: { padding: '8px 20px', border: '2px solid #1a1a2e', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#1a1a2e', color: 'white', fontSize: '14px' },
  sizeRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '5px' },
  sizeBtn: { padding: '6px 12px', border: '2px solid #ddd', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px' },
  sizeActive: { padding: '6px 12px', border: '2px solid #e63946', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#e63946', color: 'white', fontSize: '13px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'white', padding: '25px', borderRadius: '12px', width: '95%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' },
  modalTitle: { color: '#1a1a2e', marginBottom: '5px', fontSize: '18px', fontWeight: 'bold' },
  section: { backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' },
  sectionTitle: { fontWeight: 'bold', color: '#1a1a2e', fontSize: '14px', borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '5px', display: 'block' },
  saveBtn: { padding: '12px 24px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' },
  cancelBtn: { padding: '12px 24px', backgroundColor: '#999', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' },
};

export default SupplierDashboard;