import React, { useState } from 'react';
import { useWindowSize } from '../../hooks/useWindowSize';

const D = {
  navy: '#031632', gold: '#775a19', goldLight: '#fed488',
  bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d',
  textSecondary: '#44474d', borderLight: '#e7e8e9', error: '#ba1a1a', success: '#1a6b3c',
};

function ProductDesigns({ product, designs, cart, onAddSet, onRemoveSet, onBack }) {
  const [lightbox, setLightbox] = useState(null);
  const { isMobile, isTablet } = useWindowSize();

  if (!product) {
    return (
      <div style={{ flex: 1, padding: '24px', backgroundColor: D.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h3 style={{ color: D.navy }}>Loading product details...</h3>
      </div>
    );
  }

  const pcsPerSet = product.category === 'Nighty with Dupatta' ? 20 : 30;

  const getCartSets = (designId) => {
    const cartKey = `${product.id}_${designId}`;
    const item = cart?.find(i => i.cartKey === cartKey);
    return item ? item.sets : 0;
  };

  const totalInCart = cart?.filter(i => i.productId === product.id).reduce((s, i) => s + i.sets, 0) || 0;
  const gridCols = isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)';

  // FIX: Designs ko cut ke hisaab se group karo
  const isNighty = product.isNighty || product.designMode === 'nighty';
  const cutGroups = {};
  if (isNighty && designs?.length > 0 && designs[0]?.cutLabel) {
    designs.forEach(d => {
      const label = d.cutLabel || 'Other';
      if (!cutGroups[label]) cutGroups[label] = { rate: d.cutRate, designs: [] };
      cutGroups[label].designs.push(d);
    });
  }
  const hasCutGroups = Object.keys(cutGroups).length > 0;

  const DesignCard = ({ design }) => {
    const inCart = getCartSets(design.id);
    const hasSetsValue = design.sets !== undefined && design.sets !== null;
    const isOutOfStock = hasSetsValue && design.sets === 0;

    return (
      <div style={styles.card}>
        <div style={styles.imgWrapper} onClick={() => setLightbox(design.photoUrl)}>
          <img src={design.photoUrl} alt="" style={{ ...styles.img, height: isMobile ? 140 : 180 }} />
          <div style={styles.zoomIcon}>🔍</div>
          {/* Cut badge on image */}
          {design.cutLabel && (
            <div style={{ position: 'absolute', top: 6, left: 6, backgroundColor: D.navy, color: 'white', padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
              {design.cutLabel}
            </div>
          )}
        </div>
        <div style={{ padding: isMobile ? '8px 10px 10px' : '12px' }}>
          <p style={{ fontWeight: 700, fontSize: isMobile ? 12 : 14, color: D.navy, margin: '0 0 2px' }}>
            DN {design.designNo}{design.dnNumber ? ` — ${design.dnNumber}` : ''}
          </p>
          {/* Cut rate per design if available */}
          {design.cutRate && (
            <p style={{ color: D.gold, fontSize: 10, margin: '0 0 2px', fontWeight: 700 }}>
              ₹{design.cutRate}/set
            </p>
          )}
          <p style={{ color: isOutOfStock ? D.error : D.success, fontSize: 11, margin: '0 0 2px', fontWeight: 600 }}>
            {isOutOfStock ? 'Out of Stock' : (hasSetsValue ? `${design.sets} sets` : 'In Stock')}
          </p>
          {hasSetsValue ? (
            <p style={{ color: D.textSecondary, fontSize: 10, margin: '0 0 8px' }}>{design.sets * pcsPerSet} pcs</p>
          ) : (
            <p style={{ height: 14, margin: '0 0 8px' }} />
          )}

          {!isOutOfStock && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {inCart === 0 ? (
                <button
                  style={{ width: '100%', padding: isMobile ? '7px' : '8px', backgroundColor: D.gold, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: isMobile ? 12 : 13 }}
                  onClick={() => onAddSet(product, design)}
                >
                  + Add Set
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: D.bg, borderRadius: 8, padding: '3px 6px', border: `1px solid ${D.borderLight}` }}>
                  <button style={{ width: 26, height: 26, border: 'none', borderRadius: 6, cursor: 'pointer', backgroundColor: D.navy, color: 'white', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => onRemoveSet(`${product.id}_${design.id}`)}>−</button>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: D.navy, lineHeight: 1 }}>{inCart}</span>
                    <span style={{ fontSize: 9, color: D.textSecondary }}>sets</span>
                  </div>
                  <button style={{ width: 26, height: 26, border: 'none', borderRadius: 6, cursor: 'pointer', backgroundColor: D.navy, color: 'white', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => onAddSet(product, design)}>+</button>
                </div>
              )}
              {inCart > 0 && (
                <p style={{ color: D.gold, fontSize: 10, textAlign: 'center', fontWeight: 700, margin: 0 }}>
                  {inCart * pcsPerSet} pcs in cart
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, padding: isMobile ? '16px' : '24px 30px', backgroundColor: D.bg, minHeight: '100vh' }}>
      {lightbox && (
        <div style={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <div style={styles.lightboxContent} onClick={e => e.stopPropagation()}>
            <img src={lightbox} alt="" style={styles.lightboxImg} />
            <button style={styles.lightboxClose} onClick={() => setLightbox(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, backgroundColor: D.surface, padding: isMobile ? '14px' : '16px 20px', borderRadius: 12, boxShadow: '0 2px 8px rgba(3,22,50,0.06)', border: `1px solid ${D.borderLight}` }}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ color: D.navy, margin: '0 0 4px', fontSize: isMobile ? 16 : 20, fontWeight: 700, lineHeight: 1.2 }}>{product.name}</h2>
          <p style={{ color: D.textSecondary, fontSize: isMobile ? 11 : 13, margin: 0, lineHeight: 1.4 }}>
            {/* FIX: cutRates dikhao agar nighty hai */}
            {hasCutGroups
              ? Object.entries(cutGroups).map(([label, g]) => `${label}: ₹${g.rate}/set`).join(' · ')
              : product.cutRates
                ? Object.entries(product.cutRates).map(([l, r]) => `${l}: ₹${r}/set`).join(' · ')
                : `₹${product.price}/set`
            }
            {` · 1 set = ${pcsPerSet} pcs`}
          </p>
        </div>
        <div style={{ backgroundColor: '#e63946', color: 'white', padding: '5px 12px', borderRadius: 20, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {totalInCart} in cart
        </div>
      </div>

      {/* FIX: Agar cut groups hain toh section-wise dikhao, warna flat grid */}
      {hasCutGroups ? (
        Object.entries(cutGroups).map(([cutLabel, group]) => (
          <div key={cutLabel} style={{ marginBottom: 28 }}>
            {/* Cut section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ backgroundColor: D.navy, color: 'white', padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                {cutLabel}
              </div>
              <span style={{ fontSize: 13, color: D.gold, fontWeight: 700 }}>₹{group.rate}/set</span>
              <span style={{ fontSize: 12, color: D.textSecondary }}>{group.designs.length} designs</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: isMobile ? 10 : 16 }}>
              {group.designs.map(design => <DesignCard key={design.id} design={design} />)}
            </div>
          </div>
        ))
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: isMobile ? 10 : 16 }}>
          {designs?.map(design => <DesignCard key={design.id} design={design} />)}
        </div>
      )}

      {(!designs || designs.length === 0) && (
        <div style={{ textAlign: 'center', padding: '60px 16px', color: D.textSecondary }}>
          <p style={{ fontSize: 15 }}>No designs available</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  backBtn: { padding: '8px 14px', backgroundColor: D.navy, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', fontWeight: 600, flexShrink: 0 },
  card: { backgroundColor: D.surface, borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 8px rgba(3,22,50,0.07)', border: `1px solid ${D.borderLight}` },
  imgWrapper: { position: 'relative', cursor: 'pointer', overflow: 'hidden' },
  img: { width: '100%', objectFit: 'cover', display: 'block' },
  zoomIcon: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.45)', color: 'white', padding: '3px 5px', borderRadius: 5, fontSize: 12 },
  lightboxOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  lightboxContent: { position: 'relative', maxWidth: '90vw', maxHeight: '90vh' },
  lightboxImg: { maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 },
  lightboxClose: { position: 'absolute', top: -14, right: -14, width: 32, height: 32, backgroundColor: D.error, color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

export default ProductDesigns;