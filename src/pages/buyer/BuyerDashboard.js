import React from 'react';
import { D, SIZE_ORDER, sortSizes, S } from '../../components/buyer/BuyerDashboardStyles';
import { useBuyerDashboard } from '../../components/buyer/hooks/useBuyerDashboard';
import { NIGHTY_CATEGORIES } from '../../constants/product';

import ProductDesigns from './ProductDesigns';
import ProfileEdit from '../../components/buyer/ProfileEdit';
import NightyCheckout from '../../components/buyer/NightyCheckout';
import TransportCheckout from '../../components/buyer/TransportCheckout';
import OrdersTab from '../../components/buyer/tabs/OrdersTab';
import SideNav from '../../components/shared/SideNav';
import BottomNav from '../../components/shared/BottomNav';

function BuyerDashboard() {
  const {
    isMobile, isTablet,
    activeTab, setActiveTab,
    previousTab, setPreviousTab,
    products,
    productDesigns,
    orders,
    cart,
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
    notifRef,
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
  } = useBuyerDashboard();





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