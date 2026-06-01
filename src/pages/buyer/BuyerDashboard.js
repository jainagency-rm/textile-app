import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { notifyNewOrder } from '../../utils/notifications';
import { useWindowSize } from '../../hooks/useWindowSize';
import { NIGHTY_CATEGORIES } from '../../constants/product';

import ProductDesigns from './ProductDesigns';
import ProfileEdit from '../../components/buyer/ProfileEdit';
import NightyCheckout from '../../components/buyer/NightyCheckout';
import TransportCheckout from '../../components/buyer/TransportCheckout';
import OrdersTab from '../../components/buyer/tabs/OrdersTab';
import SideNav from '../../components/shared/SideNav';
import BottomNav from '../../components/shared/BottomNav';

// ✅ FIX Bug 4.2: Fixed size sort order
const SIZE_ORDER = { 'XS': 0, 'S': 1, 'M': 2, 'L': 3, 'XL': 4, '2XL': 5, '3XL': 6, '4XL': 7, '5XL': 8 };
const sortSizes = (a, b) => {
  const ai = SIZE_ORDER[a] ?? 99;
  const bi = SIZE_ORDER[b] ?? 99;
  return ai !== bi ? ai - bi : a.localeCompare(b);
};

const D = {
  navy: '#031632', gold: '#775a19', goldLight: '#fed488',
  bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d', textSecondary: '#44474d',
  border: '#c5c6ce', borderLight: '#e7e8e9', error: '#ba1a1a', success: '#1a6b3c',
};

function BuyerDashboard() {
  const { isMobile, isTablet } = useWindowSize();

  const [activeTab, setActiveTab] = useState('browse');
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
    if (window.confirm('Are you sure you want to logout?')) {
      signOut(auth).then(() => navigate('/'));
    }
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
        moq: product.moq || 1, // ✅ for nighty MOQ validation
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
  // Nighty: sets × pcsPerSet × pricePerPiece (pcsPerSet from product, default 30)
  // Set-based non-nighty: sets × pcsPerSet × pricePerPiece
  // Piece-based: quantity × price
  const cartTotal = useMemo(() => cart.reduce((sum, i) => {
    if (i.sets) {
      // Nighty or set-based
      const pcs = i.sets * (i.pcsPerSet || 30);
      return sum + (i.cutRate || i.price) * pcs;
    }
    if (i.moqUnit === 'Set' && i.pcsPerSet) {
      // Non-nighty set-based product
      return sum + i.price * i.quantity * i.pcsPerSet;
    }
    // Piece-based
    return sum + i.price * (i.quantity || 0);
  }, 0), [cart]);

  // ✅ MOQ validation — non-nighty: per PRODUCT total (all sizes combined), not per size
  // Group cart items by productId, sum quantities, compare with product moq
  const nonNightyByProduct = useMemo(() => nonNightyCart.reduce((acc, item) => {
    if (!acc[item.productId]) acc[item.productId] = { moq: item.moq || 0, moqUnit: item.moqUnit, productName: item.productName, totalQty: 0 };
    acc[item.productId].totalQty += item.quantity || 0;
    return acc;
}, {}), [nonNightyCart]);
  const moqViolations = Object.values(nonNightyByProduct).filter(p => {
    if (!p.moq) return false;
    return p.totalQty < Number(p.moq) || p.totalQty % Number(p.moq) !== 0;
  });

  // Nighty: group by supplier, check total sets >= moq
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
          const newOnes = updatedTransporters.filter(t => t._saveToProfile !== false);
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
        await addDoc(collection(db, 'orders'), {
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
            price: i.price || 0, unit: i.priceUnit || i.unit || 'Piece',
            moqUnit: i.moqUnit || 'Piece',
            pcsPerSet: i.pcsPerSet || null,
            size: i.size || '', category: i.category || ''
          })),
          status: 'Pending', createdAt: new Date()
        });
        if (adminId) { try { await notifyNewOrder(adminId, supplierId, userProfile?.firmName || ''); } catch (e) {} }
      }

      for (const supplierId of Object.keys(groupedNighty)) {
        const sc = groupedNighty[supplierId];
        const currentBaleDetail = tempNightyDetails ? tempNightyDetails[supplierId] : null;
        await addDoc(collection(db, 'orders'), {
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
          status: 'Pending', createdAt: new Date()
        });
        if (adminId) { try { await notifyNewOrder(adminId, supplierId, userProfile?.firmName || ''); } catch (e) {} }

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
              priceUnit: activeProduct.priceUnit || 'Piece', moqUnit: activeProduct.moqUnit || 'Piece'
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
              priceUnit: activeProduct.priceUnit || 'Piece', moqUnit: activeProduct.moqUnit || 'Piece'
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

  const S = {
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: D.surface, borderBottom: `1px solid ${D.borderLight}`, flexShrink: 0, zIndex: 10 },
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
    productGrid: { display: 'grid', gap: 16, padding: '0 16px 16px' },
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
    btnPrimary: { display: 'block', width: '100%', padding: '14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em' },
    btnGhost: { display: 'block', width: '100%', padding: '13px', backgroundColor: 'transparent', color: D.navy, border: `1.5px solid ${D.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
    modalOverlay: { position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(3,22,50,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    productModal: { backgroundColor: D.surface, borderRadius: '16px', width: '90%', maxWidth: 600, maxHeight: '88vh', overflowY: 'auto', position: 'relative' },
    modalHandle: { width: 36, height: 4, backgroundColor: D.border, borderRadius: 2, margin: '8px auto 12px' },
    modalClose: { position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.9)', cursor: 'pointer', fontSize: 13, fontWeight: 700, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modalCategory: { fontSize: 11, fontWeight: 600, color: D.gold, textTransform: 'uppercase', letterSpacing: '0.06em' },
    specsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, backgroundColor: D.bg, padding: 12, borderRadius: 8, marginBottom: 14 },
    specItem: { display: 'flex', flexDirection: 'column', gap: 2 },
    specLabel: { fontSize: 11, color: D.textSecondary, fontWeight: 500 },
    specValue: { fontSize: 14, fontWeight: 700, color: D.navy },
    slideArrow: (side) => ({ position: 'absolute', top: '50%', [side]: 10, transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.85)', border: 'none', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }),
  };

  if (viewingProduct) {
    const nightyDesignsList = nightyDesigns[viewingProduct.id] || [];
    return (
      <div style={{ display: 'flex', height: '100vh', backgroundColor: D.bg, fontFamily: "'Inter', sans-serif" }}>
        {useSideNav && <SideNav activeTab={activeTab} setActiveTab={t => { setViewingProduct(null); setActiveTab(t); }} cartCount={totalCartItems} userProfile={userProfile} isTablet={isTablet} onLogout={handleLogoutClick} />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={S.topBar}>
            <button style={S.backBtn} onClick={() => setViewingProduct(null)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            </button>
            <span style={{ fontSize: 16, fontWeight: 700, color: D.navy }}>{viewingProduct.name}</span>
            <div style={{ width: 40 }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: isMobile ? 90 : 20 }}>
            <ProductDesigns
              product={viewingProduct} designs={nightyDesignsList} cart={cart}
              onAddSet={addDesignToCart} onRemoveSet={removeDesignFromCart}
              onBack={() => setViewingProduct(null)}
              onViewCart={() => { setViewingProduct(null); setActiveTab('cart'); }}
            />
          </div>
          {isMobile && <BottomNav activeTab={activeTab} setActiveTab={t => { setViewingProduct(null); setActiveTab(t); }} cartCount={totalCartItems} />}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: D.bg, fontFamily: "'Inter', sans-serif" }}>
      {useSideNav && <SideNav activeTab={activeTab} setActiveTab={setActiveTab} cartCount={totalCartItems} userProfile={userProfile} isTablet={isTablet} onLogout={handleLogoutClick} />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={S.topBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {activeTab !== 'browse' && (
              <button style={S.backBtn} onClick={() => {
                if (activeTab === 'cart' && orderSuccess) { setOrderSuccess(false); }
                else if (activeTab === 'cart' && previousTab !== 'browse') { setActiveTab(previousTab); setPreviousTab('browse'); }
                else { setActiveTab('browse'); }
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              </button>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {isMobile && <span style={{ fontSize: 11, color: D.gold, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Jain Agency</span>}
              <span style={{ fontSize: 16, fontWeight: 700, color: D.navy, lineHeight: 1.2 }}>
                {activeTab === 'browse' ? 'Marketplace' : activeTab === 'cart' ? 'My Cart' : activeTab === 'orders' ? 'My Orders' : 'Profile'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeTab === 'browse' && (
              <button style={S.iconBtn} onClick={() => setShowSearch(!showSearch)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              </button>
            )}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button style={S.iconBtn} onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markAllRead(); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>
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
            <button style={S.iconBtn} onClick={handleLogoutClick} title="Logout">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: isMobile ? 80 : 20 }}>

          {/* BROWSE TAB */}
          {activeTab === 'browse' && (
            <div>
              {showSearch && (
                <div style={{ padding: '0 16px 12px' }}>
                  <div style={S.searchBox}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
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
                <div style={{ ...S.productGrid, gridTemplateColumns: productGridCols }}>
                  {searchedAndFilteredProducts.map(product => {
                    const designs = getProductDesignsList(product);
                    const idx = cardDesignIndices[product.id] || 0;
                    const img = designs[idx]?.photoUrl || 'https://via.placeholder.com/200';
                    return (
                      <div key={product.id} style={S.productCard} onClick={() => {
                        setSelectedProductDetails(product);
                        setModalDesignIdx(idx);
                        // ✅ Pre-fill existing cart quantities for this product
                        const existingQtys = {};
                        (product.sizes || []).forEach(size => {
                          const cartItem = cart.find(i => i.cartKey === `${product.id}_${size}`);
                          if (cartItem) existingQtys[size] = cartItem.quantity;
                        });
                        setSizeQuantities(existingQtys);
                        const alreadyInCart = cart.some(i => i.productId === product.id);
                        setCartAdded(alreadyInCart);
                      }}>
                        <div style={S.cardImgWrap}>
                          <img src={img} alt={product.name} style={S.cardImg} loading="lazy" />
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
                            <span style={S.cardPrice}>₹{product.price}<span style={{ fontSize: 11, fontWeight: 400, color: D.textSecondary }}>/{product.priceUnit || 'Piece'}</span></span>
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
              {orderSuccess ? (
                <div style={{ padding: '60px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: '#e6f4ea', color: D.success, fontSize: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>✓</div>
                  <h2 style={{ color: D.navy, margin: '0 0 10px', fontSize: 24 }}>Order Placed!</h2>
                  <p style={{ color: D.textSecondary, marginBottom: 40 }}>Your order has been sent to the supplier successfully.</p>
                  <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 350 }}>
                    <button style={{ ...S.btnGhost, flex: 1 }} onClick={() => { setOrderSuccess(false); setActiveTab('browse'); }}>Browse More</button>
                    <button style={{ ...S.btnPrimary, flex: 1, marginTop: 0 }} onClick={() => { setOrderSuccess(false); setActiveTab('orders'); }}>Go to Orders</button>
                  </div>
                </div>
              ) : cart.length === 0 ? (
                <div style={{ padding: '80px 0', textAlign: 'center' }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: '#e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={D.navy} strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
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
                      {nonNightyBySupplier[sid].items.map((item, itemIdx) => {
                        // ✅ Calculate total qty for this product across all sizes
                        const productTotal = nonNightyCart
                          .filter(i => i.productId === item.productId)
                          .reduce((s, i) => s + (i.quantity || 0), 0);
                        const moqViolated = item.moq && (productTotal < Number(item.moq) || productTotal % Number(item.moq) !== 0);
                        // Show MOQ warning only on first size of each product
                        const isFirstSizeOfProduct = nonNightyBySupplier[sid].items.findIndex(i => i.productId === item.productId) === itemIdx;

                        return (
                        <div key={item.cartKey} style={{ ...S.cartItem, padding: '12px 0' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: D.textPrimary }}>{item.productName}</p>
                              {item.size && <span style={S.sizeBadge}>{item.size}</span>}
                            </div>
                            <p style={{ margin: 0, fontSize: 12, color: D.textSecondary }}>
                              ₹{item.price}/{item.priceUnit || 'Piece'}
                              {item.moqUnit === 'Set' && item.pcsPerSet ? ` · ${item.pcsPerSet} pcs/set` : ''}
                              {' · '}Total: <b style={{ color: D.navy }}>
                                ₹{(item.moqUnit === 'Set' && item.pcsPerSet
                                  ? item.price * item.quantity * item.pcsPerSet
                                  : item.price * item.quantity
                                ).toLocaleString('en-IN')}
                              </b>
                            </p>
                            {/* ✅ Show MOQ warning only once per product, on first size */}
                            {moqViolated && isFirstSizeOfProduct && (
                              <p style={{ margin: '3px 0 0', fontSize: 11, color: D.error, fontWeight: 600 }}>
                                ⚠ MOQ: {item.moq} {item.moqUnit || 'Set'}(s) required · Current: {productTotal}
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${D.border}`, borderRadius: 8, overflow: 'hidden' }}>
                              <button style={{ width: 32, height: 36, border: 'none', backgroundColor: D.bg, cursor: 'pointer', fontSize: 16, color: D.navy, fontWeight: 700 }} onClick={() => { if (item.quantity <= 1) removeFromCart(item.cartKey); else updateQuantity(item.cartKey, item.quantity - 1); }}>−</button>
                              <input type="number" min={1} value={item.quantity} onChange={e => updateQuantity(item.cartKey, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} style={{ width: 44, height: 36, border: 'none', textAlign: 'center', fontSize: 13, fontWeight: 700, color: D.navy, backgroundColor: D.surface, outline: 'none' }} />
                              <button style={{ width: 32, height: 36, border: 'none', backgroundColor: D.bg, cursor: 'pointer', fontSize: 16, color: D.navy, fontWeight: 700 }} onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}>+</button>
                            </div>
                            <button style={{ width: 30, height: 30, borderRadius: 8, border: 'none', backgroundColor: '#fce8e6', color: D.error, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeFromCart(item.cartKey)}>✕</button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ))}

                  {Object.keys(nightyBySupplier).map(sid => {
                    const group = nightyBySupplier[sid];
                    const totalSets = group.items.reduce((s, i) => s + (i.sets || 0), 0);
                    const nightyMoq = group.items[0]?.moq || 0;
                    const nightyMoqViolated = nightyMoq > 0 && totalSets < nightyMoq;
                    return (
                    <div key={sid} style={S.supplierSection}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#e8edf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: D.navy }}>{group.supplierFirm?.[0]?.toUpperCase()}</span>
                        </div>
                        <span style={S.supplierLabel}>{group.supplierFirm}</span>
                        <span style={{ fontSize: 10, color: D.gold, fontWeight: 600, backgroundColor: '#fef7e0', padding: '2px 7px', borderRadius: 10 }}>{group.category}</span>
                      </div>
                      {/* ✅ Nighty MOQ warning — per supplier total sets */}
                      {nightyMoqViolated && (
                        <p style={{ fontSize: 11, color: D.error, fontWeight: 600, margin: '0 0 10px', padding: '6px 10px', backgroundColor: '#fce8e6', borderRadius: 6 }}>
                          ⚠ Minimum {nightyMoq} sets required · Current: {totalSets} sets
                        </p>
                      )}
                      {group.items.map(item => (
                        <div key={item.cartKey} style={{ ...S.cartItem, padding: '10px 0' }}>
                          <img src={item.photoUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: `1px solid ${D.borderLight}` }} loading="lazy" />
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 13, color: D.textPrimary }}>{item.productName}</p>
                            <p style={{ margin: 0, fontSize: 12, color: D.textSecondary }}>
                              DN {item.designNo}{item.dnNumber ? ` (${item.dnNumber})` : ''}
                              {item.cutLabel ? ` · Cut: ${item.cutLabel}` : ''} · {item.pcsPerSet} pcs/{item.moqUnit || 'Set'}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button style={{ width: 30, height: 30, borderRadius: '50%', border: `1.5px solid ${D.border}`, backgroundColor: D.surface, cursor: 'pointer', fontSize: 16, fontWeight: 700, color: D.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeDesignFromCart(item.cartKey)}>−</button>
                            <span style={{ fontSize: 15, fontWeight: 800, minWidth: 24, textAlign: 'center', color: D.navy }}>{item.sets}</span>
                            <button style={{ width: 30, height: 30, borderRadius: '50%', border: `1.5px solid ${D.border}`, backgroundColor: D.surface, cursor: 'pointer', fontSize: 16, fontWeight: 700, color: D.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => {
  if (item.availableSets !== undefined && item.sets >= item.availableSets) return;
  addDesignToCart(products.find(p => p.id === item.productId), { id: item.designId, designNo: item.designNo, dnNumber: item.dnNumber, photoUrl: item.photoUrl, sets: item.availableSets, cutLabel: item.cutLabel, cutRate: item.cutRate });
}}
style={{ width: 30, height: 30, borderRadius: '50%', border: `1.5px solid ${D.border}`, backgroundColor: item.availableSets !== undefined && item.sets >= item.availableSets ? '#c5c6ce' : D.surface, cursor: item.availableSets !== undefined && item.sets >= item.availableSets ? 'not-allowed' : 'pointer', fontSize: 16, fontWeight: 700, color: D.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                            <button style={{ width: 30, height: 30, borderRadius: 8, border: 'none', backgroundColor: '#fce8e6', color: D.error, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeFromCart(item.cartKey)}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    );
                  })}

                  <div style={{ padding: '8px 0 100px' }}>
                    {cartHasMoqError && (
                      <div style={{ backgroundColor: '#fce8e6', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                        <p style={{ fontSize: 12, color: D.error, fontWeight: 600, margin: '0 0 8px' }}>
                          ⚠ Some items are below MOQ. Please update quantities before checkout.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {moqViolations.map(p => {
                            const prod = products.find(pr => pr.name === p.productName);
                            if (!prod) return null;
                            return (
                              <button
                                key={p.productName}
                                style={{ fontSize: 12, color: D.navy, backgroundColor: D.surface, border: `1px solid ${D.border}`, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}
                                onClick={() => {
                                  const existingQtys = {};
                                  (prod.sizes || []).forEach(size => {
                                    const cartItem = cart.find(i => i.cartKey === `${prod.id}_${size}`);
                                    if (cartItem) existingQtys[size] = cartItem.quantity;
                                  });
                                  setSizeQuantities(existingQtys);
                                  setModalDesignIdx(0);
                                  setIsAddingMore(true);
                                  setCartAdded(false);
                                  setSelectedProductDetails(prod);
                                }}
                              >
                                + Add More "{p.productName}"
                              </button>
                            );
                          })}
                          {nightyMoqViolations.map(([sid, group]) => {
                            const prod = products.find(p => p.supplierId === sid && NIGHTY_CATEGORIES.includes(p.category));
                            if (!prod) return null;
                            return (
                              <button
                                key={sid}
                                style={{ fontSize: 12, color: D.navy, backgroundColor: D.surface, border: `1px solid ${D.border}`, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}
                                onClick={() => { setIsAddingMore(true); setViewingProduct(prod); }}
                              >
                                + Add More Sets "{group.supplierFirm}"
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <button
                      style={{ ...S.btnPrimary, backgroundColor: cartHasMoqError ? D.border : D.navy, cursor: cartHasMoqError ? 'not-allowed' : 'pointer' }}
                      onClick={handleCheckout}
                      disabled={loading || cartHasMoqError}
                    >
                      {loading ? 'Placing Order...' : `Checkout · ₹${cartTotal.toLocaleString('en-IN')}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <OrdersTab orders={orders} onCancel={handleCancelOrder} onReorder={handleReorder} onEdit={handleEditOrder} />
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && userProfile && (
            <div style={{ padding: '0 16px 80px' }}>
              <ProfileEdit userProfile={userProfile} onSave={fetchProfile} categories={categories} />
            </div>
          )}
        </div>

        {isMobile && <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} cartCount={totalCartItems} />}
      </div>

      {/* PRODUCT DETAIL MODAL */}
      {selectedProductDetails && (
        <div style={S.modalOverlay} onClick={() => { setSelectedProductDetails(null); setCartAdded(false); setIsAddingMore(false); }}>
          <div style={S.productModal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHandle} />
            <button style={S.modalClose} onClick={() => { setSelectedProductDetails(null); setCartAdded(false); setIsAddingMore(false); }}>✕</button>
            {(() => {
              const designs = getProductDesignsList(selectedProductDetails);
              const img = designs[modalDesignIdx]?.photoUrl || 'https://via.placeholder.com/300';
              return (
                <div style={{ position: 'relative', width: '100%', aspectRatio: '4/5', backgroundColor: D.bg, overflow: 'hidden' }}>
                  <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
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
            <div style={{ padding: 16 }}>
              <span style={S.modalCategory}>{selectedProductDetails.category}</span>
              <h2 style={{ margin: '6px 0 4px', fontSize: 20, fontWeight: 700, color: D.navy }}>{selectedProductDetails.name}</h2>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: D.textSecondary }}>{selectedProductDetails.supplierFirm}</p>
              <div style={S.specsRow}>
                <div style={S.specItem}>
                  <span style={S.specLabel}>Rate</span>
                  <span style={S.specValue}>₹{selectedProductDetails.price}/{selectedProductDetails.priceUnit || 'Piece'}</span>
                </div>
                <div style={S.specItem}>
                  <span style={S.specLabel}>MOQ</span>
                  {/* ✅ FIX Bug 2: moq directly from product, no division */}
                  <span style={S.specValue}>{selectedProductDetails.moq} {selectedProductDetails.moqUnit || 'Piece'}(s)</span>
                </div>
                {selectedProductDetails.material && <div style={S.specItem}><span style={S.specLabel}>Material</span><span style={S.specValue}>{selectedProductDetails.material}</span></div>}
                {NIGHTY_CATEGORIES.includes(selectedProductDetails.category) && selectedProductDetails.cutRates && (
                  <div style={S.specItem}>
                    <span style={S.specLabel}>Cuts & Rates</span>
                    <span style={S.specValue}>{Object.entries(selectedProductDetails.cutRates).map(([l, r]) => `${l}: ₹${r}/${selectedProductDetails.priceUnit || 'Piece'}`).join(', ')}</span>
                  </div>
                )}
                {!NIGHTY_CATEGORIES.includes(selectedProductDetails.category) && selectedProductDetails.cut && (
                  <div style={S.specItem}><span style={S.specLabel}>Cut</span><span style={S.specValue}>{selectedProductDetails.cut}</span></div>
                )}
              </div>

              {selectedProductDetails.sizes?.length > 0 && !NIGHTY_CATEGORIES.includes(selectedProductDetails.category) && (
                <div style={{ marginBottom: 16 }}>
                  {/* ✅ FIX Bug 2: moq shown consistently, no division math */}
                  <p style={{ fontSize: 13, fontWeight: 600, color: D.navy, margin: '0 0 10px' }}>
                    Qty per Size <span style={{ fontWeight: 400, color: D.textSecondary }}>(multiple of {selectedProductDetails.moq} {selectedProductDetails.moqUnit || 'Piece'})</span>
                  </p>
                  {/* ✅ FIX Bug 4.2: sizes rendered in correct order */}
                  {[...selectedProductDetails.sizes].sort(sortSizes).map(size => (
                    <div key={size} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${D.borderLight}` }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: D.textPrimary }}>Size {size}</span>
                      <input type="number" min="0" placeholder="0" value={sizeQuantities[size] || ''} onChange={e => { setSizeQuantities({ ...sizeQuantities, [size]: e.target.value }); setCartAdded(false); }} onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const t = Object.values({ ...sizeQuantities, [size]: e.target.value }).reduce((s, q) => s + Number(q || 0), 0);
                          const moq = Number(selectedProductDetails.moq || 1);
                          if (t > 0 && t % moq === 0) addSizesToCart(selectedProductDetails);
                        }
                      }} style={{ width: 80, padding: '6px 10px', border: `1px solid ${D.border}`, borderRadius: 6, textAlign: 'center', fontSize: 14 }} />
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
                          <img src={d.photoUrl} alt="" style={{ width: '100%', height: 64, objectFit: 'cover' }} loading="lazy" />
                          <p style={{ margin: 0, fontSize: 10, textAlign: 'center', padding: '2px 0', color: D.textSecondary }}>DN{d.designNo}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {NIGHTY_CATEGORIES.includes(selectedProductDetails.category) ? (
                <button style={S.btnPrimary} onClick={() => { setSelectedProductDetails(null); setViewingProduct(selectedProductDetails); }}>
                  Select Designs & Quantity
                </button>
              ) : (() => {
                const total = Object.values(sizeQuantities).reduce((s, q) => s + Number(q || 0), 0);
                const moq = Number(selectedProductDetails.moq || 1);
                const valid = total > 0 && total % moq === 0;
                // ✅ Set-based: price = total sets × pcsPerSet × pricePerPiece
                const isSetBased = selectedProductDetails.moqUnit === 'Set' && selectedProductDetails.pcsPerSet;
                const totalPrice = isSetBased
                  ? total * selectedProductDetails.pcsPerSet * selectedProductDetails.price
                  : total * selectedProductDetails.price;
                const qtyLabel = isSetBased
                  ? `${total} Set${total !== 1 ? 's' : ''} (${total * selectedProductDetails.pcsPerSet} Pcs) · ₹${totalPrice.toLocaleString('en-IN')}`
                  : `${total} ${selectedProductDetails.moqUnit || 'Piece'}(s)`;

                if (isAddingMore) {
                  return (
                    <button
                      style={{ ...S.btnPrimary, backgroundColor: (selectedProductDetails.sizes?.length > 0 && !valid) ? D.border : D.navy }}
                      onClick={() => {
                        if (selectedProductDetails.sizes?.length > 0 && !valid) return;
                        addSizesToCart(selectedProductDetails);
                        setIsAddingMore(false);
                        setSelectedProductDetails(null);
                      }}
                      disabled={selectedProductDetails.sizes?.length > 0 && !valid}
                    >
                      Update Cart {total > 0 ? `(${qtyLabel})` : ''}
                    </button>
                  );
                }

                if (cartAdded) {
                  return (
                    <button style={{ ...S.btnPrimary, backgroundColor: D.gold }} onClick={() => {
                      setSelectedProductDetails(null);
                      setCartAdded(false);
                      setActiveTab('cart');
                    }}>
                      Go to Cart →
                    </button>
                  );
                }
                return (
                  <>
                    {/* ✅ pcsPerSet info hint */}
                    {isSetBased && (
                      <p style={{ fontSize: 12, color: D.textSecondary, margin: '0 0 8px' }}>
                        1 Set = {selectedProductDetails.pcsPerSet} Pcs · Price = Sets × {selectedProductDetails.pcsPerSet} × ₹{selectedProductDetails.price}
                      </p>
                    )}
                    {total > 0 && !valid && (
                      <p style={{ fontSize: 12, color: D.error, margin: '0 0 8px', fontWeight: 600 }}>
                        ⚠ Total {selectedProductDetails.moqUnit === 'Set' ? 'sets' : 'quantity'} must be a multiple of {moq}
                      </p>
                    )}
                    <button
                      style={{ ...S.btnPrimary, backgroundColor: (selectedProductDetails.sizes?.length > 0 && !valid) ? D.border : D.navy }}
                      onClick={() => addSizesToCart(selectedProductDetails)}
                      disabled={selectedProductDetails.sizes?.length > 0 && !valid}
                    >
                      Add to Cart {total > 0 ? `(${qtyLabel})` : ''}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODALS — root level */}
      {showNightyCheckout && (
        <NightyCheckout
          nightyBySupplier={nightyBySupplier}
          onConfirm={handleNightyConfirm}
          onCancel={() => setShowNightyCheckout(false)}
        />
      )}

      {showTransportCheckout && (
        <TransportCheckout
          suppliers={cartSuppliers}
          savedTransporters={cleanSavedTransporters}
          onConfirm={placeOrder}
          userCity={userProfile?.city || ''}
          onCancel={() => {
            setShowTransportCheckout(false);
            if (tempNightyDetails) setShowNightyCheckout(true);
          }}
        />
      )}
    </div>
  );
}

export default BuyerDashboard;