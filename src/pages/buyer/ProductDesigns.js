import React, { useState } from 'react';

function ProductDesigns({ product, designs, cart, onAddSet, onRemoveSet, onBack }) {
  const [lightbox, setLightbox] = useState(null);
  const pcsPerSet = product.category === 'Nighty with Dupatta' ? 20 : 30;

  const getCartSets = (designId) => {
    const cartKey = `${product.id}_${designId}`;
    const item = cart.find(i => i.cartKey === cartKey);
    return item ? item.sets : 0;
  };

  return (
    <div style={styles.container}>
      {/* Lightbox */}
      {lightbox && (
        <div style={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <div style={styles.lightboxContent} onClick={e => e.stopPropagation()}>
            <img src={lightbox} alt="" style={styles.lightboxImg} />
            <button style={styles.lightboxClose} onClick={() => setLightbox(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <div>
          <h2 style={styles.title}>{product.name}</h2>
          <p style={styles.subtitle}>
            Cut: {product.cut} | ₹{product.price}/set | 1 set = {pcsPerSet} pcs | Total Sets: {product.totalSets || 0}
          </p>
        </div>
        <div style={styles.cartInfo}>
          <p style={styles.cartCount}>In Cart: {cart.filter(i => i.productId === product.id).reduce((s, i) => s + i.sets, 0)} sets</p>
        </div>
      </div>

      {/* Designs Grid */}
      <div style={styles.grid}>
        {designs.map(design => {
          const inCart = getCartSets(design.id);
          return (
            <div key={design.id} style={styles.card}>
              <div style={styles.imgWrapper} onClick={() => setLightbox(design.photoUrl)}>
                <img src={design.photoUrl} alt="" style={styles.img} />
                <div style={styles.zoomIcon}>🔍</div>
              </div>
              <div style={styles.cardBody}>
                <p style={styles.dnNo}>DN {design.designNo}{design.dnNumber ? ` — ${design.dnNumber}` : ''}</p>
                <p style={design.sets === 0 ? styles.outOfStock : styles.available}>
                  {design.sets === 0 ? 'Out of Stock' : `${design.sets} sets available`}
                </p>
                <p style={styles.pcsInfo}>{design.sets * pcsPerSet} pcs</p>

                {design.sets > 0 && (
                  <div style={styles.addSection}>
                    {inCart === 0 ? (
                      <button style={styles.addBtn} onClick={() => onAddSet(product, design)}>+ Add Set</button>
                    ) : (
                      <div style={styles.qtyControl}>
                        <button style={styles.qtyBtn} onClick={() => onRemoveSet(`${product.id}_${design.id}`)}>−</button>
                        <div style={styles.qtyInfo}>
                          <span style={styles.qtyNum}>{inCart}</span>
                          <span style={styles.qtyLabel}>sets</span>
                        </div>
                        <button style={styles.qtyBtn} onClick={() => onAddSet(product, design)}>+</button>
                      </div>
                    )}
                    {inCart > 0 && (
                      <p style={styles.inCartPcs}>{inCart * pcsPerSet} pcs in cart</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: { flex: 1, padding: '30px', backgroundColor: '#f5f5f5', minHeight: '100vh' },
  header: { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '25px', backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  backBtn: { padding: '10px 18px', backgroundColor: '#1a1a2e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' },
  title: { color: '#1a1a2e', margin: '0 0 5px 0', fontSize: '22px' },
  subtitle: { color: '#666', fontSize: '13px', margin: 0 },
  cartInfo: { marginLeft: 'auto' },
  cartCount: { backgroundColor: '#e63946', color: 'white', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' },
  card: { backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', transition: 'transform 0.2s' },
  imgWrapper: { position: 'relative', cursor: 'pointer', overflow: 'hidden' },
  img: { width: '100%', height: '180px', objectFit: 'cover', display: 'block' },
  zoomIcon: { position: 'absolute', top: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', padding: '4px 6px', borderRadius: '6px', fontSize: '14px' },
  cardBody: { padding: '12px' },
  dnNo: { fontWeight: 'bold', fontSize: '14px', color: '#1a1a2e', marginBottom: '4px' },
  available: { color: '#2ecc71', fontSize: '12px', marginBottom: '2px' },
  outOfStock: { color: '#e63946', fontSize: '12px', marginBottom: '2px' },
  pcsInfo: { color: '#999', fontSize: '11px', marginBottom: '10px' },
  addSection: { display: 'flex', flexDirection: 'column', gap: '5px' },
  addBtn: { width: '100%', padding: '8px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' },
  qtyControl: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9f9f9', borderRadius: '8px', padding: '4px 8px', border: '1px solid #eee' },
  qtyBtn: { width: '28px', height: '28px', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: '#1a1a2e', color: 'white', fontSize: '16px', fontWeight: 'bold' },
  qtyInfo: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  qtyNum: { fontWeight: 'bold', fontSize: '16px', color: '#1a1a2e' },
  qtyLabel: { fontSize: '10px', color: '#999' },
  inCartPcs: { color: '#e63946', fontSize: '11px', textAlign: 'center', fontWeight: 'bold' },
  lightboxOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  lightboxContent: { position: 'relative', maxWidth: '90vw', maxHeight: '90vh' },
  lightboxImg: { maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' },
  lightboxClose: { position: 'absolute', top: '-15px', right: '-15px', width: '35px', height: '35px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
};

export default ProductDesigns;