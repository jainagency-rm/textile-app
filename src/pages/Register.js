import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { notifyNewUser } from '../utils/notifications';

function Register() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || 'buyer';
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    gstNumber: '',
    firmName: '',
    contactPerson: '',
    mobile: '',
    address: '',
    city: '',
    district: '',
    state: '',
    pincode: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleStep1 = (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', userCred.user.uid), {
        uid: userCred.user.uid,
        email,
        role,
        status: 'pending',
        createdAt: new Date(),
        ...formData,
      });

      // Admin ko notify karo
      const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
      const adminId = adminSnap.docs[0]?.id;
      if (adminId) await notifyNewUser(adminId, formData.firmName, role);

      navigate('/pending');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Email already registered');
      else setError('Something went wrong. Try again.');
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>{role === 'buyer' ? 'Buyer' : 'Supplier'} Registration</h2>

        {step === 1 && (
          <form onSubmit={handleStep1} style={styles.form}>
            <input style={styles.input} type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
            <input style={styles.input} type="password" placeholder="Password (min 6 characters)" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.button} type="submit">Next</button>
            <p style={styles.loginText}>Already registered? <Link to="/" style={styles.link}>Login</Link></p>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <input style={styles.input} name="gstNumber" placeholder="GST Number" value={formData.gstNumber}
              onChange={handleChange} required />
            <input style={styles.input} name="firmName" placeholder="Firm Name" value={formData.firmName}
              onChange={handleChange} required />
            <input style={styles.input} name="contactPerson" placeholder="Contact Person" value={formData.contactPerson}
              onChange={handleChange} required />
            <input style={styles.input} name="mobile" placeholder="Mobile Number" value={formData.mobile}
              onChange={handleChange} required />
            <input style={styles.input} name="address" placeholder="Address" value={formData.address}
              onChange={handleChange} required />
            <input style={styles.input} name="city" placeholder="City" value={formData.city}
              onChange={handleChange} required />
            <input style={styles.input} name="district" placeholder="District" value={formData.district}
              onChange={handleChange} required />
            <input style={styles.input} name="state" placeholder="State" value={formData.state}
              onChange={handleChange} required />
            <input style={styles.input} name="pincode" placeholder="Pincode" value={formData.pincode}
              onChange={handleChange} required />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.button} type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit for Approval'}
            </button>
            <button style={styles.backButton} type="button" onClick={() => setStep(1)}>Back</button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', padding: '20px' },
  card: { backgroundColor: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 2px 20px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
  title: { textAlign: 'center', color: '#1a1a2e', marginBottom: '25px' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  input: { padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none' },
  button: { padding: '12px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' },
  backButton: { padding: '12px', backgroundColor: '#ddd', color: '#333', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  error: { color: 'red', fontSize: '13px', margin: '0' },
  loginText: { textAlign: 'center', fontSize: '13px', color: '#666' },
  link: { color: '#e63946', textDecoration: 'none' },
};

export default Register;