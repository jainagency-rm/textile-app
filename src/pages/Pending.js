import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

function Pending() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>⏳</div>
        <h2 style={styles.title}>Approval Pending</h2>
        <p style={styles.text}>
          Your account has been submitted for approval. 
          You will be able to login once admin approves your account.
        </p>
        <p style={styles.subtext}>Please check back later.</p>
        <button style={styles.button} onClick={handleLogout}>Logout</button>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  card: { backgroundColor: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 2px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', textAlign: 'center' },
  icon: { fontSize: '60px', marginBottom: '20px' },
  title: { color: '#1a1a2e', marginBottom: '15px' },
  text: { color: '#555', lineHeight: '1.6', marginBottom: '10px' },
  subtext: { color: '#999', fontSize: '13px', marginBottom: '25px' },
  button: { padding: '12px 30px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' },
};

export default Pending;