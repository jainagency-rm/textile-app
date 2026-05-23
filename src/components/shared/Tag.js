import React from 'react';
import { D } from '../../constants/design';

export default function Tag({ label, active, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '5px 10px' : '7px 13px',
      border: `1.5px solid ${active ? D.navy : D.border}`,
      borderRadius: 8, cursor: 'pointer',
      fontSize: small ? 12 : 13, fontWeight: active ? 700 : 500,
      backgroundColor: active ? D.navy : D.surface,
      color: active ? 'white' : D.textPrimary,
    }}>
      {label}
    </button>
  );
}