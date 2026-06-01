import React from 'react';
import { NIGHTY_CATEGORIES } from '../../../constants/product';

export default function CartTab({
  cart,
  orderSuccess, setOrderSuccess,
  loading,
  cartTotal,
  totalCartItems,
  nonNightyBySupplier,
  nightyBySupplier,
  nonNightyCart,
  moqViolations, nightyMoqViolations,
  cartHasMoqError,
  products,
  removeFromCart, updateQuantity,
  removeDesignFromCart, addDesignToCart,
  setSizeQuantities, setModalDesignIdx,
  setSelectedProductDetails,
  setCartAdded, setIsAddingMore,
  setViewingProduct,
  setActiveTab,
  handleCheckout,
  S, D,
}) {
  return (
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${D.border}`, borderRadius: 8, overflow: 'hidden' }}>
                        <button style={{ width: 32, height: 36, border: 'none', backgroundColor: D.bg, cursor: 'pointer', fontSize: 16, color: D.navy, fontWeight: 700 }} onClick={() => { if (item.quantity <= 1) removeFromCart(item.cartKey); else updateQuantity(item.cartKey, item.quantity - 1); }}>−</button>
                        <input type="number" min={1} value={item.quantity} onChange={e => updateQuantity(item.cartKey, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} style={{ width: 44, height: 36, border: 'none', textAlign: 'center', fontSize: 13, fontWeight: 700, color: D.navy, backgroundColor: D.surface, outline: 'none' }} />
                        <button style={{ width: 32, height: 36, border: 'none', backgroundColor: D.bg, cursor: 'pointer', fontSize: 16, color: D.navy, fontWeight: 700 }} onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}>+</button>
                      </div>
                      <span style={{ fontSize: 10, color: D.textSecondary, fontWeight: 600 }}>
                        {item.moqUnit === 'Set' ? `${item.quantity} Set(s)` : `${item.quantity} ${item.priceUnit || 'Piece'}`}
                      </span>
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
                    <button style={{ width: 30, height: 30, borderRadius: '50%', border: `1.5px solid ${D.border}`, backgroundColor: item.availableSets !== undefined && item.sets >= item.availableSets ? '#c5c6ce' : D.surface, cursor: item.availableSets !== undefined && item.sets >= item.availableSets ? 'not-allowed' : 'pointer', fontSize: 16, fontWeight: 700, color: D.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => {
                      if (item.availableSets !== undefined && item.sets >= item.availableSets) return;
                      addDesignToCart(products.find(p => p.id === item.productId), { id: item.designId, designNo: item.designNo, dnNumber: item.dnNumber, photoUrl: item.photoUrl, sets: item.availableSets, cutLabel: item.cutLabel, cutRate: item.cutRate });
                    }}>+</button>
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
  );
}
