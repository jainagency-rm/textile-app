import React from 'react';
import { D } from '../../constants/design';

export default function SectionBox({ title, children, required }) {
  return (
    <div style={{ backgroundColor: D.bg, borderRadius: 12, padding: 14, border: `1px solid ${D.borderLight}`, marginBottom: 12 }}>
      {title && (
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: D.navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}{required && <span style={{ color: D.error }}> *</span>}
        </p>
      )}
      {children}
    </div>
  );
}