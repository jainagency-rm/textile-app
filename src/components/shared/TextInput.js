import React from 'react';
import { D } from '../../constants/design';
import LabelRow from './LabelRow';

export default function TextInput({ label, value, onChange, type = 'text', placeholder, required }) {
  return (
    <LabelRow label={label} required={required}>
      <input 
        type={type} 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder || ''}
        style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: D.textPrimary, backgroundColor: 'transparent', fontFamily: 'inherit' }} 
      />
    </LabelRow>
  );
}