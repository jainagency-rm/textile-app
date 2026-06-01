export const D = {
  navy: '#031632', gold: '#775a19', goldLight: '#fed488',
  bg: '#f8f9fa', surface: '#ffffff', textPrimary: '#191c1d', textSecondary: '#44474d',
  border: '#c5c6ce', borderLight: '#e7e8e9', error: '#ba1a1a', success: '#1a6b3c',
};

export const SIZE_ORDER = { 'XS': 0, 'S': 1, 'M': 2, 'L': 3, 'XL': 4, '2XL': 5, '3XL': 6, '4XL': 7, '5XL': 8 };

export const sortSizes = (a, b) => {
  const ai = SIZE_ORDER[a] ?? 99;
  const bi = SIZE_ORDER[b] ?? 99;
  return ai !== bi ? ai - bi : a.localeCompare(b);
};

export const S = {
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
