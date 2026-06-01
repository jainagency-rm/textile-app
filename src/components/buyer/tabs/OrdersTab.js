import React from 'react';
import OrderCard from '../OrderCard';

const D = { textSecondary: '#44474d' };

function OrdersTab({ orders, onCancel, onReorder }) {
  return (
    <div style={{ padding: '8px 16px' }}>
      {orders.length === 0 ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: D.textSecondary }}>
          <p style={{ fontSize: 15 }}>No orders yet</p>
        </div>
      ) : (
        orders.map(order => (
          <OrderCard 
            key={order.id} 
            order={order} 
            onCancel={onCancel} 
            onReorder={onReorder} 
          />
        ))
      )}
    </div>
  );
}

export default OrdersTab;