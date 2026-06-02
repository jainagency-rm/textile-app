import React from 'react';
import { D, SIZE_ORDER, sortSizes, S } from '../../components/buyer/BuyerDashboardStyles';
import { useBuyerDashboard } from '../../components/buyer/hooks/useBuyerDashboard';
import { NIGHTY_CATEGORIES } from '../../constants/product';

import ProductDesigns from './ProductDesigns';
import NightyCheckout from '../../components/buyer/NightyCheckout';
import TransportCheckout from '../../components/buyer/TransportCheckout';
import OrdersTab from '../../components/buyer/tabs/OrdersTab';
import BrowseTab from '../../components/buyer/tabs/BrowseTab';
import CartTab from '../../components/buyer/tabs/CartTab';
import ProfileTab from '../../components/buyer/tabs/ProfileTab';
import SideNav from '../../components/shared/SideNav';
import BottomNav from '../../components/shared/BottomNav';
import { useInactivityLogout } from '../../hooks/useInactivityLogout';

function BuyerDashboard() {
  useInactivityLogout();
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
            {isMobile && (
              <button style={S.iconBtn} onClick={handleLogoutClick} title="Logout">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D.textSecondary} strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: isMobile ? 80 : 20 }}>

          {/* BROWSE TAB */}
          {activeTab === 'browse' && (
            <BrowseTab
              showSearch={showSearch} setShowSearch={setShowSearch}
              searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              minPrice={minPrice} setMinPrice={setMinPrice}
              maxPrice={maxPrice} setMaxPrice={setMaxPrice}
              selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
              categories={categories}
              searchedAndFilteredProducts={searchedAndFilteredProducts}
              productDesigns={productDesigns}
              cardDesignIndices={cardDesignIndices} setCardDesignIndices={setCardDesignIndices}
              cart={cart}
              setSelectedProductDetails={setSelectedProductDetails}
              setSizeQuantities={setSizeQuantities}
              setCartAdded={setCartAdded}
              setModalDesignIdx={setModalDesignIdx}
              getProductDesignsList={getProductDesignsList}
              isMobile={isMobile}
              productGridCols={productGridCols}
              S={S} D={D}
            />
          )}

          {/* CART TAB */}
          {activeTab === 'cart' && (
            <CartTab
              cart={cart}
              orderSuccess={orderSuccess} setOrderSuccess={setOrderSuccess}
              loading={loading}
              cartTotal={cartTotal}
              totalCartItems={totalCartItems}
              nonNightyBySupplier={nonNightyBySupplier}
              nightyBySupplier={nightyBySupplier}
              nonNightyCart={nonNightyCart}
              moqViolations={moqViolations} nightyMoqViolations={nightyMoqViolations}
              cartHasMoqError={cartHasMoqError}
              products={products}
              removeFromCart={removeFromCart} updateQuantity={updateQuantity}
              removeDesignFromCart={removeDesignFromCart} addDesignToCart={addDesignToCart}
              setSizeQuantities={setSizeQuantities} setModalDesignIdx={setModalDesignIdx}
              setSelectedProductDetails={setSelectedProductDetails}
              setCartAdded={setCartAdded} setIsAddingMore={setIsAddingMore}
              setViewingProduct={setViewingProduct}
              setActiveTab={setActiveTab}
              handleCheckout={handleCheckout}
              S={S} D={D}
            />
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <OrdersTab orders={orders} onCancel={handleCancelOrder} onReorder={handleReorder} onEdit={handleEditOrder} />
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <ProfileTab
              userProfile={userProfile}
              fetchProfile={fetchProfile}
              categories={categories}
              S={S}
              D={D}
            />
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