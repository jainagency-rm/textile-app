import React from 'react';

export default function BrowseTab({
  showSearch, setShowSearch,
  searchTerm, setSearchTerm,
  minPrice, setMinPrice,
  maxPrice, setMaxPrice,
  selectedCategory, setSelectedCategory,
  categories,
  searchedAndFilteredProducts,
  productDesigns,
  cardDesignIndices, setCardDesignIndices,
  cart,
  setSelectedProductDetails,
  setSizeQuantities,
  setCartAdded,
  setModalDesignIdx,
  getProductDesignsList,
  isMobile,
  productGridCols,
  S, D,
  highlightId,
}) {
  return (
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
              <div key={product.id} id={`row-${product.id}`} style={{ ...S.productCard, ...(product.id === highlightId ? { backgroundColor: '#fff9c4' } : {}) }} onClick={() => {
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
  );
}
