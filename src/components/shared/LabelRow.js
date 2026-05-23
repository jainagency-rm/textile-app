import React from 'react';
import { D } from '../../constants/design';

export default function LabelRow({ label, required, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${D.borderLight}` }}>
      <span style={{ fontSize: 13, color: D.textSecondary, fontWeight: 600, minWidth: 90, flexShrink: 0 }}>
        {label}{required && <span style={{ color: D.error }}>*</span>}
      </span>
      {children}
    </div>
  );
}