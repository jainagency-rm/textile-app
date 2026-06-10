import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc, orderBy, onSnapshot, writeBatch, runTransaction } from 'firebase/firestore';
import { auth, db } from '../../../firebase';
import { notifyNewOrder } from '../../../utils/notifications';
import { useWindowSize } from '../../../hooks/useWindowSize';
import { NIGHTY_CATEGORIES } from '../../../constants/product';

export function useBuyerDashboard() {
  const { isMobile, isTablet } = useWindowSize();

  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ['browse', 'cart', 'orders', 'profile'];
  const rawTab = searchParams.get('tab') || 'browse';
  const activeTab = VALID_TABS.includes(rawTab) ? rawTab : 'browse';
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
  const [previousTab, setPreviousTab] = useState('browse');
  const [products, setProducts] = useState([]);
  const [productDesigns, setProductDesigns] = useState({});
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [showNightyCheckout, setShowNightyCheckout] = useState(false);
  const [showTransportCheckout, setShowTransportCheckout] = useState(false);
  const [tempNightyDetails, setTempNightyDetails] = useState(null);
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
  const [isAddingMore, setIsAddingMore] = useState(false);
  const [nightyDesigns, setNightyDesigns] = useState({});

  const notifRef = useRef(null);
  const buyerId = auth.currentUser?.uid;
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    signOut(auth).then(() => navigate('/'));
  };

  useEffect(() => {
    if (selectedProductDetails) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedProductDetails]);

  // ✅ FIX Bug 1: Reset orderSuccess when cart tab mounts fresh
  useEffect(() => {
    if (activeTab === 'cart' && cart.length > 0) {
      setOrderSuccess(false);
    }
  }, [activeTab, cart.length]);

  useEffect(() => {
    if (!buyerId) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', buyerId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubscribe();
  }, [buyerId]);

  useEffect(() => {
    const handleClickOutside = e => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let ordersUnsubscribe = () => {};
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchProfile();
        fetchProducts();
        ordersUnsubscribe = fetchOrders();
      }
    });
    return () => {
      unsubscribe();
      ordersUnsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setSelectedProductDetails(null);
        setShowNotifications(false);
        setCartAdded(false);
        setIsAddingMore(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

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
    const nightyDesignMap = {};

    const nightyProds = prods.filter(p => NIGHTY_CATEGORIES.includes(p.category));
    const nonNightyProds = prods.filter(p => !NIGHTY_CATEGORIES.includes(p.category));

    // Non-nighty: all products fetch designs in parallel
    await Promise.all(nonNightyProds.map(async (prod) => {
      const dSnap = await getDocs(collection(db, 'products', prod.id, 'designs'));
      designMap[prod.id] = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }));

    // Nighty: per product fetch cuts, then all cuts fetch designs in parallel
    await Promise.all(nightyProds.map(async (prod) => {
      const cutsSnap = await getDocs(collection(db, 'products', prod.id, 'cuts'));
      const allDesigns = [];
      await Promise.all(cutsSnap.docs.map(async (cutDoc) => {
        const cutData = cutDoc.data();
        const designsSnap = await getDocs(collection(db, 'products', prod.id, 'cuts', cutDoc.id, 'designs'));
        designsSnap.docs.forEach(d => {
          allDesigns.push({ id: d.id, cutId: cutDoc.id, cutLabel: cutData.label, cutRate: cutData.rate, ...d.data() });
        });
      }));
      nightyDesignMap[prod.id] = allDesigns;
      designMap[prod.id] = allDesigns;
    }));

    setProductDesigns(designMap);
    setNightyDesigns(nightyDesignMap);
  };

  const fetchOrders = () => {
    const user = auth.currentUser;
    if (!user) return () => {};
    const q = query(collection(db, 'orders'), where('buyerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  };

  const categories = [...new Set(products.map(p => p.category))];
  const categoryFiltered = useMemo(() => selectedCategory ? products.filter(p => p.category === selectedCategory) : products, [products, selectedCategory]);
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
    if (existing) {
      setCart(cart.map(i => i.cartKey === cartKey ? { ...i, sets: i.sets + 1 } : i));
    } else {
      setCart([...cart, {
        cartKey, productId: product.id, designId: design.id,
        productName: product.name, designNo: design.designNo,
        dnNumber: design.dnNumber || '', photoUrl: design.photoUrl,
        sets: 1, availableSets: design.sets, price: product.price,
        supplierId: product.supplierId, supplierFirm: product.supplierFirm,
        category: product.category, pcsPerSet,
        cutLabel: design.cutLabel || '', cutRate: design.cutRate || product.price,
        priceUnit: product.priceUnit || 'Piece', moqUnit: product.moqUnit || 'Set',
        moq: product.moq || 1,
        dispatchCity: product.dispatchCity || '',
      }]);
    }
  };

  const removeDesignFromCart = (cartKey) => setCart(
    cart.map(i => i.cartKey === cartKey ? { ...i, sets: Math.max(0, i.sets - 1) } : i).filter(i => i.sets > 0 || i.quantity)
  );

  const addSizesToCart = (product) => {
    let items = [...cart];
    Object.keys(sizeQuantities).forEach(size => {
      const qty = Number(sizeQuantities[size]);
      const cartKey = `${product.id}_${size}`;
      const idx = items.findIndex(i => i.cartKey === cartKey);
      if (qty > 0) {
        if (idx > -1) {
          // ✅ Replace quantity (not add) — modal shows current state
          items[idx] = { ...items[idx], quantity: qty };
        } else {
          items.push({
            cartKey, productId: product.id, productName: product.name, quantity: qty,
            price: product.price, unit: product.unit || 'pc',
            supplierId: product.supplierId, supplierFirm: product.supplierFirm,
            category: product.category, size,
            priceUnit: product.priceUnit || 'Piece',
            moqUnit: product.moqUnit || 'Piece',
            moq: product.moq || 1,
            pcsPerSet: product.pcsPerSet || null,
            dispatchCity: product.dispatchCity || '',
            photoUrl: product.imageUrl || product.photos?.[0]?.photoUrl || product.imageUrls?.[0]?.photoUrl || '',
          });
        }
      } else if (qty === 0 && idx > -1) {
        // ✅ If set to 0, remove from cart
        items = items.filter(i => i.cartKey !== cartKey);
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

  // ✅ FIX: Price calculation
  const cartTotal = useMemo(() => cart.reduce((sum, i) => {
    if (i.sets) {
      const pcs = i.sets * (i.pcsPerSet || 30);
      return sum + (i.cutRate || i.price) * pcs;
    }
    if (i.moqUnit === 'Set' && i.pcsPerSet) {
      return sum + i.price * i.quantity * i.pcsPerSet;
    }
    return sum + i.price * (i.quantity || 0);
  }, 0), [cart]);

  // ✅ MOQ validation
  const nonNightyByProduct = useMemo(() => nonNightyCart.reduce((acc, item) => {
    if (!acc[item.productId]) acc[item.productId] = { moq: item.moq || 0, moqUnit: item.moqUnit, productName: item.productName, totalQty: 0 };
    acc[item.productId].totalQty += item.quantity || 0;
    return acc;
  }, {}), [nonNightyCart]);

  const moqViolations = Object.values(nonNightyByProduct).filter(p => {
    if (!p.moq) return false;
    return p.totalQty < Number(p.moq) || p.totalQty % Number(p.moq) !== 0;
  });

  const nightyMoqViolations = Object.entries(nightyBySupplier).filter(([, group]) => {
    const totalSets = group.items.reduce((s, i) => s + (i.sets || 0), 0);
    const moq = group.items[0]?.moq || 0;
    return moq > 0 && totalSets < moq;
  });

  const cartHasMoqError = moqViolations.length > 0 || nightyMoqViolations.length > 0;

  const handleCheckout = () => {
    if (!cart || cart.length === 0) return alert("Your cart is empty!");
    const hasNighty = cart.some(item => NIGHTY_CATEGORIES.includes(item.category));
    if (hasNighty) {
      setShowNightyCheckout(true);
    } else {
      setShowTransportCheckout(true);
    }
  };

  const handleNightyConfirm = (packingDetails) => {
    setTempNightyDetails(packingDetails);
    setShowNightyCheckout(false);
    setShowTransportCheckout(true);
  };

  const placeOrder = async (transportSelections) => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User session not found.");

      let orderNumber = null;
      try {
        const counterRef = doc(db, 'counters', 'orderCounter');
        await runTransaction(db, async (transaction) => {
          const counterSnap = await transaction.get(counterRef);
          const newNumber = (counterSnap.data()?.lastNumber || 0) + 1;
          transaction.set(counterRef, { lastNumber: newNumber }, { merge: true });
          orderNumber = newNumber;
        });
      } catch (err) {
        console.warn('Counter fetch failed:', err);
      }

      let adminId = null;
      try {
        const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
        adminId = adminSnap.docs[0]?.id;
      } catch (err) { console.warn("Could not fetch admin ID"); }

      // ✅ FIX Bug 4.1: Filter out corrupt/empty transporter entries on save
      let updatedTransporters = [...(userProfile?.transporters || [])].filter(
        t => t && t.name && t.name.trim() !== '' && t.name !== '0'
      );
      let hasNewTransporters = false;

      if (transportSelections) {
        Object.values(transportSelections).forEach(t => {
          if (!t || !t.name || t.name.trim() === '') return;
          // ✅ Only save if user explicitly checked "save for future"
          if (!t._saveToProfile) return;
          const alreadyExists = updatedTransporters.find(saved =>
            saved.name?.toLowerCase().trim() === t.name?.toLowerCase().trim() &&
            saved.city?.toLowerCase().trim() === t.city?.toLowerCase().trim()
          );
          if (!alreadyExists) {
            // strip internal flag before saving to Firestore
            const { _saveToProfile, ...cleanT } = t;
            updatedTransporters.push(cleanT);
            hasNewTransporters = true;
          }
        });

        if (hasNewTransporters) {
          await updateDoc(doc(db, 'users', user.uid), { transporters: updatedTransporters });
          await fetchProfile();
          // Also add new transporters to master Firestore collection
          await Promise.all(
            Object.values(transportSelections || {})
              .filter(t => t?._saveToProfile && t?.name?.trim())
              .map(t => addDoc(collection(db, 'transporters'), { name: t.name.trim().toUpperCase() }).catch(() => {}))
          );
        }
      }

      const groupedNighty = {};
      const groupedNonNighty = {};
      cart.forEach(item => {
        const isNighty = NIGHTY_CATEGORIES.includes(item.category);
        if (isNighty) {
          if (!groupedNighty[item.supplierId]) groupedNighty[item.supplierId] = { supplierFirm: item.supplierFirm, items: [] };
          groupedNighty[item.supplierId].items.push(item);
        } else {
          if (!groupedNonNighty[item.supplierId]) groupedNonNighty[item.supplierId] = { supplierFirm: item.supplierFirm, items: [] };
          groupedNonNighty[item.supplierId].items.push(item);
        }
      });

      for (const supplierId of Object.keys(groupedNonNighty)) {
        const sc = groupedNonNighty[supplierId];
        const orderRef = await addDoc(collection(db, 'orders'), {
          orderNumber: orderNumber,
          buyerId: user.uid, buyerFirm: userProfile?.firmName || 'Unknown Firm',
          supplierId: supplierId || 'Unknown', supplierFirm: sc.supplierFirm || 'Unknown Supplier',
          transportDetails: transportSelections?.[supplierId]
            ? {
                name: transportSelections[supplierId].name,
                gst: transportSelections[supplierId].gst || '',
                phone: transportSelections[supplierId].phone || '',
                deliveryAddress: transportSelections[supplierId].deliveryAddress || '',
              }
            : null,
          items: sc.items.map(i => ({
            productId: i.productId || '', productName: i.productName || 'Unknown Product',
            quantity: i.quantity || i.orderedQty || 1, orderedQty: i.quantity || i.orderedQty || 1,
            price: i.price || 0, unit: i.moqUnit || i.priceUnit || i.unit || 'Piece',
            moqUnit: i.moqUnit || 'Piece',
            pcsPerSet: i.pcsPerSet || null,
            size: i.size || '', category: i.category || '',
            photoUrl: i.photoUrl || ''
          })),
          totalAmount: sc.items.reduce((sum, i) => {
            if (i.moqUnit === 'Set' && i.pcsPerSet) return sum + i.price * i.quantity * i.pcsPerSet;
            return sum + i.price * (i.quantity || 0);
          }, 0),
          status: 'Pending', createdAt: new Date()
        });
        if (adminId) { try { await notifyNewOrder(adminId, supplierId, userProfile?.firmName || '', orderRef.id); } catch (e) {} }
      }

      for (const supplierId of Object.keys(groupedNighty)) {
        const sc = groupedNighty[supplierId];
        const currentBaleDetail = tempNightyDetails ? tempNightyDetails[supplierId] : null;
        const orderRef = await addDoc(collection(db, 'orders'), {
          orderNumber: orderNumber,
          buyerId: user.uid, buyerFirm: userProfile?.firmName || 'Unknown Firm',
          supplierId: supplierId || 'Unknown', supplierFirm: sc.supplierFirm || 'Unknown Supplier',
          transportDetails: transportSelections?.[supplierId] || null,
          items: sc.items.map(i => ({
            productId: i.productId || '', productName: i.productName || 'Unknown Product',
            designNo: i.designNo || '', dnNumber: i.dnNumber || '', photoUrl: i.photoUrl || '',
            sets: i.sets || i.orderedQty || 1, pcs: (i.sets || i.orderedQty || 1) * (i.pcsPerSet || 30),
            orderedQty: i.sets || i.orderedQty || 1, price: i.cutRate || i.price || 0,
            unit: i.moqUnit || 'Set', cutLabel: i.cutLabel || '', category: i.category || ''
          })),
          nightyDetails: currentBaleDetail ? {
            totalSets: currentBaleDetail.totalSets || 0, totalPcs: currentBaleDetail.totalPcs || 0,
            packingType: currentBaleDetail.packingType || 8, totalBales: currentBaleDetail.totalBales || 0,
            looseSets: currentBaleDetail.looseSets || 0
          } : null,
          totalAmount: sc.items.reduce((sum, i) => {
            return sum + (i.cutRate || i.price) * (i.sets || 0) * (i.pcsPerSet || 30);
          }, 0),
          status: 'Pending', createdAt: new Date()
        });
        if (adminId) { try { await notifyNewOrder(adminId, supplierId, userProfile?.firmName || '', orderRef.id); } catch (e) {} }

        try {
          for (const item of sc.items) {
            if (item.designId && item.cutLabel) {
              const cutsSnap = await getDocs(collection(db, 'products', item.productId, 'cuts'));
              for (const cutDoc of cutsSnap.docs) {
                if (cutDoc.data().label === item.cutLabel) {
                  const dRef = doc(db, 'products', item.productId, 'cuts', cutDoc.id, 'designs', item.designId);
                  const dSnap = await getDoc(dRef);
                  if (dSnap.exists()) await updateDoc(dRef, { sets: Math.max(0, dSnap.data().sets - item.sets) });
                  break;
                }
              }
            }
            const pRef = doc(db, 'products', item.productId);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) await updateDoc(pRef, { totalSets: Math.max(0, (pSnap.data().totalSets || 0) - item.sets) });
          }
        } catch (stockErr) { console.warn("Stock skip:", stockErr); }
      }

      setCart([]);
      setShowNightyCheckout(false);
      setShowTransportCheckout(false);
      setTempNightyDetails(null);
      setOrderSuccess(true);

    } catch (err) { alert("Error placing order: " + err.message); }
    setLoading(false);
  };

  const handleCancelOrder = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: 'Cancelled' });
      setOrders(prevOrders => prevOrders.map(o => o.id === orderId ? { ...o, status: 'Cancelled' } : o));
    } catch (error) { console.error("Error cancelling order:", error); alert("Failed to cancel order."); }
  };

  const handleReorder = (order) => {
    let newCart = [...cart];
    let itemsAdded = 0;
    order.items.forEach(item => {
      const activeProduct = products.find(p => p.id === item.productId);
      if (activeProduct) {
        const isNighty = NIGHTY_CATEGORIES.includes(activeProduct.category);
        if (isNighty) {
          const cartKey = `${item.productId}_reorder_${item.designNo}_${Date.now()}`;
          newCart.push({
            cartKey, productId: item.productId, productName: item.productName,
            designNo: item.designNo || '', dnNumber: item.dnNumber || '', photoUrl: item.photoUrl || '',
            sets: item.sets || item.orderedQty || 1, price: activeProduct.price,
            supplierId: order.supplierId, supplierFirm: order.supplierFirm, category: activeProduct.category,
            pcsPerSet: activeProduct.category === 'Nighty with Dupatta' ? 20 : 30,
            cutLabel: item.cutLabel || '', priceUnit: activeProduct.priceUnit || 'Piece', moqUnit: activeProduct.moqUnit || 'Set'
          });
        } else {
          const cartKey = `${item.productId}_${item.size || 'reorder'}`;
          const existingIdx = newCart.findIndex(i => i.cartKey === cartKey);
          if (existingIdx > -1) {
            newCart[existingIdx].quantity += (item.quantity || item.orderedQty || 1);
          } else {
            newCart.push({
              cartKey, productId: item.productId, productName: item.productName,
              quantity: item.quantity || item.orderedQty || 1, price: activeProduct.price,
              unit: item.unit || 'pc', supplierId: order.supplierId, supplierFirm: order.supplierFirm,
              category: activeProduct.category, size: item.size || '',
              priceUnit: activeProduct.priceUnit || 'Piece', moqUnit: activeProduct.moqUnit || 'Piece',
              moq: activeProduct.moq || 1,
              pcsPerSet: activeProduct.pcsPerSet || null,
              photoUrl: item.photoUrl || '',
            });
          }
        }
        itemsAdded++;
      }
    });
    if (itemsAdded > 0) { setCart(newCart); setPreviousTab(activeTab); setActiveTab('cart'); }
    else { alert("These products are no longer available."); }
  };

  const handleEditOrder = async (order) => {
    if (window.confirm("This will cancel the current order and move all items to your cart for editing. Proceed?")) {
      let newCart = [...cart];
      let itemsAdded = 0;
      order.items.forEach(item => {
        const activeProduct = products.find(p => p.id === item.productId);
        if (activeProduct) {
          const isNighty = NIGHTY_CATEGORIES.includes(activeProduct.category);
          if (isNighty) {
            const cartKey = `${item.productId}_edit_${item.designNo}_${Date.now()}`;
            newCart.push({
              cartKey, productId: item.productId, productName: item.productName,
              designNo: item.designNo || '', dnNumber: item.dnNumber || '', photoUrl: item.photoUrl || '',
              sets: item.sets || item.orderedQty || 1, price: activeProduct.price,
              supplierId: order.supplierId, supplierFirm: order.supplierFirm, category: activeProduct.category,
              pcsPerSet: activeProduct.category === 'Nighty with Dupatta' ? 20 : 30,
              cutLabel: item.cutLabel || '', priceUnit: activeProduct.priceUnit || 'Piece', moqUnit: activeProduct.moqUnit || 'Set'
            });
          } else {
            const cartKey = `${item.productId}_${item.size || 'edit'}`;
            newCart.push({
              cartKey, productId: item.productId, productName: item.productName,
              quantity: item.quantity || item.orderedQty || 1, price: activeProduct.price,
              unit: item.unit || 'pc', supplierId: order.supplierId, supplierFirm: order.supplierFirm,
              category: activeProduct.category, size: item.size || '',
              priceUnit: activeProduct.priceUnit || 'Piece', moqUnit: activeProduct.moqUnit || 'Piece',
              moq: activeProduct.moq || 1,
              pcsPerSet: activeProduct.pcsPerSet || null,
              photoUrl: item.photoUrl || '',
            });
          }
          itemsAdded++;
        }
      });
      if (itemsAdded > 0) {
        try {
          await updateDoc(doc(db, 'orders', order.id), { status: 'Cancelled' });
          setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Cancelled' } : o));
          setCart(newCart); setPreviousTab(activeTab); setActiveTab('cart');
        } catch (error) { console.error(error); alert("Failed to move to cart."); }
      } else { alert("Products no longer available."); }
    }
  };

  const unreadCount = filteredNotifications.filter(n => !n.read).length;
  const totalCartItems = cart.reduce((sum, i) => sum + (i.sets || i.quantity || 0), 0);
  const productGridCols = isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)';
  const useSideNav = !isMobile;

  // ✅ FIX Bug 4.1: Filter corrupt entries before passing to TransportCheckout
  const cleanSavedTransporters = (userProfile?.transporters || []).filter(
    t => t && t.name && t.name.trim() !== '' && t.name !== '0'
  );

  // ✅ Include dispatchCity — comes from product data via cart item
  const cartSuppliers = Array.from(new Set(cart.map(i => i.supplierId))).map(id => {
    const item = cart.find(i => i.supplierId === id);
    return {
      id,
      firmName: item?.supplierFirm || 'Unknown Supplier',
      dispatchCity: item?.dispatchCity || '',
    };
  });

  return {
    // window size
    isMobile, isTablet,
    // state
    activeTab, setActiveTab,
    previousTab, setPreviousTab,
    products,
    productDesigns,
    orders,
    cart, setCart,
    userProfile,
    loading,
    orderSuccess, setOrderSuccess,
    showNightyCheckout, setShowNightyCheckout,
    showTransportCheckout, setShowTransportCheckout,
    tempNightyDetails,
    selectedCategory, setSelectedCategory,
    viewingProduct, setViewingProduct,
    searchTerm, setSearchTerm,
    minPrice, setMinPrice,
    maxPrice, setMaxPrice,
    selectedProductDetails, setSelectedProductDetails,
    sizeQuantities, setSizeQuantities,
    modalDesignIdx, setModalDesignIdx,
    cardDesignIndices, setCardDesignIndices,
    showNotifications, setShowNotifications,
    showSearch, setShowSearch,
    cartAdded, setCartAdded,
    isAddingMore, setIsAddingMore,
    nightyDesigns,
    // refs
    notifRef,
    // derived
    filteredNotifications,
    unreadCount,
    categories,
    searchedAndFilteredProducts,
    nightyCart,
    nonNightyCart,
    nightyBySupplier,
    nonNightyBySupplier,
    cartTotal,
    nonNightyByProduct,
    moqViolations,
    nightyMoqViolations,
    cartHasMoqError,
    totalCartItems,
    productGridCols,
    useSideNav,
    cleanSavedTransporters,
    cartSuppliers,
    // functions
    handleLogoutClick,
    fetchProfile,
    markAllRead,
    getProductDesignsList,
    addDesignToCart,
    removeDesignFromCart,
    addSizesToCart,
    removeFromCart,
    updateQuantity,
    handleCheckout,
    handleNightyConfirm,
    placeOrder,
    handleCancelOrder,
    handleReorder,
    handleEditOrder,
  };
}
