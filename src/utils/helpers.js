export function getStatusStyle(status) {
  if (status === 'Delivered') return { bg: '#e6f4ea', color: '#1a6b3c' };
  if (status === 'Shipped' || status === 'Processing') return { bg: '#e8f0fe', color: '#1a3a8f' };
  if (status === 'Partially Dispatched') return { bg: '#fff3e0', color: '#7a5200' };
  if (status === 'Cancelled') return { bg: '#fce8e6', color: '#ba1a1a' };
  return { bg: '#f1f3f4', color: '#44474d' };
}
