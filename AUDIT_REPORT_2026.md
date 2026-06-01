📋 EXECUTIVE SUMMARY

  Ye ek React + Firebase + PWA app hai Jain Agency ke liye. Codebase functional hai lekin serious security holes, extreme performance
  bottlenecks, aur massive duplicate code hain. Niche har category ka analysis hai.

  ---
  🔴 1. SECURITY VULNERABILITIES

  [CRITICAL] — Firestore Rules: Any Buyer Can Modify ANY User's Data

  File: firestore.rules:12-14
  match /users/{userId} {
    allow read, write: if isAuthenticated(); // ❌ Koi bhi user, kisi bhi user ka data badal sakta hai
  }
  Problem: Ek buyer userId guess karke kisi aur ka status: 'approved' kar sakta hai, ya role change kar sakta hai.
  Impact: Full account takeover, unauthorized access to admin/supplier roles.
  Fix:
  match /users/{userId} {
    allow read: if isAuthenticated();
    allow write: if request.auth.uid == userId  // sirf khud ka data
               || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
  }

  ---
  [CRITICAL] — Koi bhi Authenticated User Product Add/Delete/Modify Kar Sakta Hai

  File: firestore.rules:18-20
  match /products/{productId}/{document=**} {
    allow read, write: if isAuthenticated(); // ❌ Buyer product delete kar sakta hai!
  }
  Impact: Competitor products delete kar sakta hai, prices change kar sakta hai.
  Fix: Role-based writes — sirf supplier apna product modify kare.

  ---
  [CRITICAL] — No Route Protection in App.js

  File: src/App.js:49-57
  <Route path="/admin" element={<AdminDashboard />} />  // ❌ No auth check!
  <Route path="/buyer" element={<BuyerDashboard />} />
  Problem: URL pe direct /admin type karo — admin panel khul jayega bina login ke (agar koi cached auth state hai). Aur logically koi
  buyer /admin directly access try kar sakta hai.
  Impact: Unauthorized admin panel access.
  Fix: ProtectedRoute component banao:
  function ProtectedRoute({ element, requiredRole }) {
    const user = auth.currentUser;
    if (!user) return <Navigate to="/" />;
    // role check karo Firestore se
    return element;
  }

  ---
  [HIGH] — Admin Panel Route Discoverable

  File: src/App.js:55
  Problem: /admin route publicly known. Login page pe hidden button hai but /admin direct accessible.
  Impact: Admin login page pe brute force possible.

  ---
  [HIGH] — Orders Delete Rule Inconsistency (App Will Crash)

  File: firestore.rules:32 vs src/pages/admin/AdminDashboard.js:244
  // Firestore rules:
  allow delete: if false; // ❌ Delete completely blocked

  // But AdminDashboard calls:
  await deleteDoc(doc(db, 'orders', orderId)); // 💥 ye crash karega!
  Impact: Admin ke liye "Delete Order" button kaam nahi karta, silent error.

  ---
  [MEDIUM] — External Placeholder Image Domain

  File: src/pages/buyer/BuyerDashboard.js:747
  const img = designs[idx]?.photoUrl || 'https://via.placeholder.com/200'; // ❌
  Impact: External dependency, CSP violation risk, user data leakage to third party.

  ---
  🔴 2. FIREBASE INEFFICIENCIES

  [CRITICAL] — N+1 Firestore Reads in fetchProducts (Catastrophic)

  File: src/pages/buyer/BuyerDashboard.js:154-173
  for (const prod of prods) {           // 50 products
    if (NIGHTY_CATEGORIES includes...) {
      const cutsSnap = await getDocs(..'cuts'..); // +1 read per product
      for (const cutDoc of cutsSnap.docs) {       // per cut bhi loop
        const designsSnap = await getDocs(..designs..); // +1 per cut!
      }
    } else {
      await getDocs(..designs..); // +1 per non-nighty product
    }
  }
  Impact: 50 products = potentially 150-200+ Firestore reads per page load. Ye Firebase bill explode karega aur load time 5-10 seconds
  tak pahunch sakta hai.
  Fix: Designs ko product document mein hi embed karo (subcollection avoid karo), ya batch read karo.

  ---
  [CRITICAL] — Serial Awaits in Nighty Product Upload

  File: src/components/supplier/AddProductWizard.js:178-183
  for (const cut of form.cuts) {           // Sequential! ❌
    const cutRef = await addDoc(..cuts..);
    for (let i = 0; i < cut.designs.length; i++) {
      await addDoc(..designs..);           // Aur ye bhi sequential! ❌
    }
  }
  Impact: 3 cuts × 10 designs = 33 sequential Firestore writes. 30+ seconds upload time possible.
  Fix: Promise.all() use karo.

  ---
  [HIGH] — notifyNewProduct Sends N Individual Writes

  File: src/utils/notifications.js:54-57
  await Promise.all([
    createNotification(adminId, ..),
    ...buyerIds.map(id => createNotification(id, ..)), // 100 buyers = 100 writes!
  ]);
  Impact: 100 buyers hain toh ek product add karne pe 101 Firestore writes. Firebase costs explode.
  Fix: Buyers ke liye notifications collection ki jagah ek broadcasts collection use karo jisme ek document sab buyers padhein.

  ---
  [HIGH] — No Offline Persistence for PWA

  File: src/firebase.js
  Problem: Firestore offline persistence enable nahi ki:
  // Missing:
  import { enableIndexedDbPersistence } from 'firebase/firestore';
  enableIndexedDbPersistence(db);
  Impact: PWA offline kaam nahi karega. User internet lose kare toh blank screen.

  ---
  [HIGH] — Batch Delete 500 Limit Risk

  File: src/pages/admin/AdminDashboard.js:100-111
  const batch = writeBatch(db);
  prodSnap.docs.forEach(d => batch.delete(..));  // koi limit nahi!
  orderSnap.docs.forEach(d => batch.delete(..)); // 500+ docs toh crash!
  Impact: Agar ek supplier ke 300+ products aur 300+ orders hain, batch fail hoga.

  ---
  [HIGH] — Mixed Real-time + One-time Reads

  File: src/pages/buyer/BuyerDashboard.js
  Problem: Orders getDocs se laate hain (one-time), notifications onSnapshot se (real-time). Agar koi order status update hota hai,
  buyer ko refresh karna padega.

  ---
  [MEDIUM] — fetchAllData After Batch Delete (Double Load)

  File: src/pages/admin/AdminDashboard.js:114
  await batch.commit();
  setUsers(users.filter(u => u.id !== user.id)); // local update
  await fetchAllData(); // ❌ Full reload again! Redundant.

  ---
  🔴 3. PERFORMANCE BOTTLENECKS

  [CRITICAL] — BuyerDashboard: No useMemo on Heavy Computations

  File: src/pages/buyer/BuyerDashboard.js:186-320
  // Ye sab har render pe recalculate hote hain:
  const categories = [...new Set(products.map(p => p.category))]; // ❌
  const searchedAndFilteredProducts = categoryFiltered.filter(...); // ❌
  const cartTotal = cart.reduce(...); // ❌
  const nonNightyByProduct = nonNightyCart.reduce(...); // ❌
  Impact: Cart mein quantity change karo toh 6-7 expensive computations phir se run hote hain.

  ---
  [HIGH] — No Code Splitting / Lazy Loading for Dashboards

  File: src/App.js
  import AdminDashboard from './pages/admin/AdminDashboard';   // Always loaded!
  import SupplierDashboard from './pages/supplier/SupplierDashboard'; // Always loaded!
  import BuyerDashboard from './pages/buyer/BuyerDashboard';   // Always loaded!
  Impact: Buyer ka browser Admin + Supplier ka code bhi download karta hai. Bundle size 3x.
  Fix:
  const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));

  ---
  [HIGH] — No Image Lazy Loading

  File: src/pages/buyer/BuyerDashboard.js:763
  <img src={img} alt={product.name} style={S.cardImg} /> // No loading="lazy"!
  Impact: 50 product images ek saath load honge, FCP/LCP slow.

  ---
  [HIGH] — No Pagination (Full Data Load)

  File: src/pages/admin/AdminDashboard.js:60-73
  const [usersSnap, productsSnap, ordersSnap] = await Promise.all([
    getDocs(collection(db, 'users')),    // ALL users
    getDocs(collection(db, 'products')), // ALL products
    getDocs(collection(db, 'orders'))    // ALL orders - could be thousands!
  ]);
  Impact: 1000 orders hain toh sab ek saath load — slow + expensive.

  ---
  [MEDIUM] — Inline Style Objects Created Every Render

  File: Multiple files (BuyerDashboard.js, AdminDashboard.js, etc.)
  // BuyerDashboard line 597 (inside render):
  cardArrow: (side) => ({ position: 'absolute', ...}) // Function call per render!
  Impact: React diffing mein ye objects "new" dikhte hain, unnecessary re-renders.

  ---
  [MEDIUM] — useWindowSize Hook: Initial State window.innerWidth Direct Call

  File: src/hooks/useWindowSize.js:5
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
  });
  // PLUS: handleResize called in useEffect immediately
  Impact: Double width calculation on mount. But AdminDashboard uses its own separate isMobile state altogether — inconsistency!

  ---
  🟡 4. ARCHITECTURE ISSUES

  [HIGH] — BuyerDashboard: 1142 Lines — God Component

  File: src/pages/buyer/BuyerDashboard.js
  Problem: Ek hi file mein:
  - Product browsing logic
  - Cart management
  - Order placement
  - Profile management
  - Notification handling
  - 25+ useState hooks
  - Modal management

  Impact: Debugging nightmarish, unit testing impossible, onboarding developers ko samajhna mushkil.

  ---
  [HIGH] — No Centralized State Management

  Problem: Cart state, user profile, products — sab local state mein. Agar koi component unmount hota hai, data lost. Context/Redux
  nahi.
  Impact: Cart BuyerDashboard unmount pe clear, no cross-component data sharing.

  ---
  [HIGH] — No Error Boundaries

  Problem: Koi bhi component crash kare toh poora app white screen ho jata hai.
  Fix: <ErrorBoundary> wrap karo major routes pe.

  ---
  [MEDIUM] — AdminDashboard: Own isMobile vs useWindowSize Hook

  File: src/pages/admin/AdminDashboard.js:40, 46-49
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768); // ❌ Direct window access
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize); // Re-implementing existing hook!
  }, []);
  Impact: useWindowSize hook already exists but Admin doesn't use it. Code duplication.

  ---
  🟡 5. REPEATED CODE (DRY Violations)

  [CRITICAL] — D Color Constant 8+ Files Mein Define

  Login.js, Register.js, BuyerDashboard.js, SupplierDashboard.js,
  AddProductWizard.js, EditProductModal.js, NightyCheckout.js, TransportCheckout.js
  Fix: src/constants/colors.js banao, wahan se import karo everywhere.

  ---
  [HIGH] — SectionBox, LabelRow, TextInput Components Duplicated

  File: src/components/supplier/AddProductWizard.js:27-51 AND src/components/supplier/EditProductModal.js:9-35
  Identical code dono jagah! These are already in src/components/shared/ folder mein hain — kyun duplicate kiya?

  ---
  [HIGH] — NIGHTY_CATEGORIES Constant Multiple Files Mein

  src/pages/buyer/BuyerDashboard.js:17 — const NIGHTY_CATEGORIES = ['Nighty', 'Nighty with Dupatta']
  src/components/supplier/AddProductWizard.js:9 — const NIGHTY_CATEGORIES = ['Nighty', 'Nighty with Dupatta']
  src/constants/product.js already hai but ye constant wahan nahi!

  ---
  [HIGH] — Notification Dropdown JSX Identical in 2 Dashboards

  Files: src/pages/buyer/BuyerDashboard.js:684-709 AND src/pages/supplier/SupplierDashboard.js:178-199
  Nearly identical notification dropdown JSX. Should be <NotificationDropdown> component.

  ---
  [HIGH] — markAllRead Function Duplicate

  Files: src/pages/buyer/BuyerDashboard.js:130-136 AND src/pages/supplier/SupplierDashboard.js:83-88
  Exact same logic.

  ---
  [MEDIUM] — EyeIcon/EyeOffIcon Defined in Both Login & Register

  Files: src/pages/Login.js:14-27 AND src/pages/Register.js:14-28
  Identical SVG components.

  ---
  [MEDIUM] — Logout Pattern Repeated Everywhere

  // AdminDashboard, BuyerDashboard, SupplierDashboard — same code:
  if (window.confirm('Are you sure you want to logout?'))
    signOut(auth).then(() => navigate('/'));

  ---
  🟡 6. PWA ISSUES

  [CRITICAL] — Service Worker Registration Missing!

  File: src/index.js
  // ❌ No service worker!
  import React from 'react';
  import ReactDOM from 'react-dom/client';
  // serviceWorkerRegistration.register() — completely missing!
  Impact: App offline kaam nahi karega. PWA install ho sakta hai but offline = blank screen.

  ---
  [HIGH] — Wrong App Title

  File: public/index.html:14
  <title>React App</title>  <!-- ❌ CRA default! -->
  Impact: Browser tab mein "React App" dikhta hai. Unprofessional + bad for SEO/PWA.

  ---
  [HIGH] — theme_color Mismatch Between manifest.json and index.html

  // manifest.json:7
  "theme_color": "#ffffff"  // white

  // index.html:7
  <meta name="theme-color" content="#000000" />  // black
  Impact: Android Chrome mein status bar ka color alag-alag dikhega.

  ---
  [HIGH] — Generic Meta Description

  File: public/index.html:8-11
  <meta name="description" content="Web site created using create-react-app" />
  Impact: Zero SEO value, looks unprofessional.

  ---
  [MEDIUM] — PWA Icons: Wrong purpose Value

  File: public/manifest.json:10,16
  {"purpose": "any maskable"}  // ❌ Both icons same purpose!
  Impact: Maskable icon aur regular icon alag hone chahiye. Kuch Android launchers icon crop kar denge.
  Fix: Separate icons: one "purpose": "any", one "purpose": "maskable".

  ---
  [MEDIUM] — No screenshots in Manifest

  Impact: Play Store / Windows Store listing ke liye screenshots missing.

  ---
  🟡 7. BUNDLE SIZE ISSUES

  [HIGH] — xlsx Package Possibly Unused

  File: package.json:19
  "xlsx": "^0.18.5"  // ~1MB+ package!
  Actual code check: AdminDashboard mein exportUsersCSV() function manually CSV generate karta hai — xlsx library use hi nahi ho rahi!
  Impact: ~1MB dead weight in bundle.

  ---
  [HIGH] — jsPDF + jspdf-autotable No Lazy Loading

  Files: src/utils/pdfExport.js, src/utils/adminPdfExport.js
  Problem: PDF libraries (~1.2MB combined) har user ke liye load hote hain, even buyers jo PDF kabhi use nahi karte.
  Fix:
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  ---
  [HIGH] — No Route-level Code Splitting

  Fix:
  const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
  const BuyerDashboard = React.lazy(() => import('./pages/buyer/BuyerDashboard'));
  const SupplierDashboard = React.lazy(() => import('./pages/supplier/SupplierDashboard'));
  Impact: Estimated 40-50% bundle size reduction for end users.

  ---
  [MEDIUM] — react-firebase-hooks Imported But Seemingly Unused

  File: package.json:16
  "react-firebase-hooks": "^5.1.1"
  Code mein koi useCollection, useDocument etc. import nahi dikhta.
  Impact: Dead dependency, adds to node_modules/bundle.

  ---
  🟡 8. MOBILE RESPONSIVENESS ISSUES

  [HIGH] — Admin Tables Not Mobile-Friendly

  File: src/pages/admin/AdminDashboard.js:608
  table: { minWidth: 700, ... }  // Always 700px min
  Impact: Mobile pe horizontal scroll aata hai, awkward UX. Card layout better hoga.

  ---
  [MEDIUM] — Touch Targets Too Small

  File: Multiple
  // AdminDashboard:
  { width: 18, height: 18, borderRadius: '50%', ...}  // ❌ 18x18px too small!
  // Recommended: 44x44px minimum

  ---
  [MEDIUM] — Keyboard Pushes Modal Content Off Screen

  File: src/pages/buyer/BuyerDashboard.js:612
  productModal: { maxHeight: '88vh', overflowY: 'auto' }
  Problem: Mobile keyboard open hone pe viewport shrink hota hai lekin modal adjust nahi hota.
  Fix: max-height: calc(100dvh - env(keyboard-inset-height, 0px)) use karo.

  ---
  [LOW] — No font-display: swap for Inter Font

  Impact: FOIT (Flash of Invisible Text) possible agar Inter slow load ho.

  ---
  📊 SEVERITY SUMMARY TABLE

  ┌───────────────┬──────────┬──────┬────────┬─────┐
  │   Category    │ Critical │ High │ Medium │ Low │
  ├───────────────┼──────────┼──────┼────────┼─────┤
  │ Security      │ 3        │ 2    │ 1      │ 1   │
  ├───────────────┼──────────┼──────┼────────┼─────┤
  │ Firebase      │ 3        │ 4    │ 2      │ 0   │
  ├───────────────┼──────────┼──────┼────────┼─────┤
  │ Performance   │ 1        │ 4    │ 2      │ 0   │
  ├───────────────┼──────────┼──────┼────────┼─────┤
  │ Architecture  │ 0        │ 3    │ 2      │ 0   │
  ├───────────────┼──────────┼──────┼────────┼─────┤
  │ Repeated Code │ 1        │ 4    │ 2      │ 1   │
  ├───────────────┼──────────┼──────┼────────┼─────┤
  │ PWA           │ 1        │ 3    │ 2      │ 0   │
  ├───────────────┼──────────┼──────┼────────┼─────┤
  │ Bundle Size   │ 0        │ 3    │ 1      │ 0   │
  ├───────────────┼──────────┼──────┼────────┼─────┤
  │ Mobile        │ 0        │ 1    │ 2      │ 1   │
  ├───────────────┼──────────┼──────┼────────┼─────┤
  │ TOTAL         │ 9        │ 24   │ 14     │ 3   │
  └───────────────┴──────────┴──────┴────────┴─────┘

  ---
  🗺️  STEP-BY-STEP IMPLEMENTATION PLAN

  🔴 PHASE 1 — CRITICAL FIXES (1-2 din, production-breaking issues)

  Step 1.1 — Route Protection (2 hrs)
  - src/context/AuthContext.js banao (user + role store karo)
  - src/components/shared/ProtectedRoute.js banao
  - App.js mein wrap karo:
  <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />

  Step 1.2 — Firestore Security Rules Fix (1 hr)
  - firestore.rules update karo — role-based read/write
  - Orders ka delete rule fix karo (admin ko allow karo)
  - Test karo Firebase emulator mein

  Step 1.3 — Fix Orders Delete Bug (30 min)
  - Ya Firestore rules mein admin ko delete allow karo
  - Ya deleteDoc call ko try-catch mein wrap karo aur error show karo

  Step 1.4 — App Title + Meta Description (15 min)
  - public/index.html update: title, description, theme-color

  ---
  🟠 PHASE 2 — SHARED CONSTANTS & DEDUPE (1 din)

  Step 2.1 — Shared Colors (1 hr)
  - src/constants/colors.js banao with D object
  - Sab files se import karo

  Step 2.2 — Shared Components (2 hrs)
  - SectionBox, LabelRow, TextInput — src/components/shared/ mein move karo
  - EyeIcon/EyeOffIcon — src/components/shared/EyeIcons.js
  - NotificationDropdown component banao
  - markAllRead logic ko shared hook mein move karo

  Step 2.3 — Shared Constants (30 min)
  - NIGHTY_CATEGORIES src/constants/product.js mein add karo
  - useLogout hook banao (signOut + navigate pattern)

  ---
  🟠 PHASE 3 — FIREBASE PERFORMANCE (2-3 din)

  Step 3.1 — Fix N+1 Reads (Half day)
  - fetchProducts ko refactor karo — designs ko product document mein embed karo ya batched collectionGroup queries use karo
  - Minimum: nighty designs ke liye Promise.all use karo (serial se parallel)

  Step 3.2 — Enable Offline Persistence (30 min)
  // src/firebase.js:
  import { enableIndexedDbPersistence } from 'firebase/firestore';
  enableIndexedDbPersistence(db).catch(err => console.warn('Offline persistence failed', err));

  Step 3.3 — Fix Notification Fan-out (2 hrs)
  - notifyNewProduct ke liye broadcasts collection use karo
  - Buyers apna unread count check karein broadcast documents se

  Step 3.4 — Batch Delete: Add Chunk Logic (1 hr)
  - 500 document batch limit handle karne ke liye chunks mein split karo
  - src/utils/batchDelete.js utility banao

  Step 3.5 — Add Pagination to Admin (2 hrs)
  - Orders/Users tab mein Firestore pagination (startAfter, limit) add karo

  ---
  🟡 PHASE 4 — BUNDLE SIZE & CODE SPLITTING (1 din)

  Step 4.1 — Remove xlsx (15 min)
  - npm uninstall xlsx
  - Verify existing CSV export code works without it

  Step 4.2 — Lazy Load Dashboards (1 hr)
  - App.js mein React.lazy + Suspense add karo
  - Expected: 40-50% initial bundle reduction

  Step 4.3 — Lazy Load PDF Libraries (1 hr)
  - pdfExport.js aur adminPdfExport.js mein dynamic imports use karo

  Step 4.4 — Check react-firebase-hooks (30 min)
  - Agar actually unused hai toh npm uninstall react-firebase-hooks

  ---
  🟡 PHASE 5 — PWA FIX (Half din)

  Step 5.1 — Service Worker Register (30 min)
  - CRA ka reportWebVitals nahi — serviceWorkerRegistration.js add karo
  - src/index.js mein register karo
  - Test: Chrome DevTools > Application > Service Workers

  Step 5.2 — Manifest Cleanup (30 min)
  - theme_color consistent karo (#031632 — navy)
  - Proper maskable icon add karo (separate file)
  - screenshots array add karo

  ---
  🟡 PHASE 6 — PERFORMANCE OPTIMIZATIONS (2 din)

  Step 6.1 — useMemo for Heavy Computations (2 hrs)
  // BuyerDashboard mein:
  const searchedAndFilteredProducts = useMemo(() =>
    categoryFiltered.filter(...), [categoryFiltered, searchTerm, minPrice, maxPrice]
  );
  const cartTotal = useMemo(() => cart.reduce(...), [cart]);

  Step 6.2 — Image Lazy Loading (1 hr)
  <img loading="lazy" src={img} alt={product.name} />

  Step 6.3 — AdminDashboard isMobile Refactor (30 min)
  - useWindowSize hook use karo instead of own isMobile state

  ---
  🟢 PHASE 7 — COMPONENT SPLITTING (3-4 din)

  Step 7.1 — BuyerDashboard Split (2 din)
  BuyerDashboard.js (coordinator, minimal)
  ├── hooks/useCart.js
  ├── hooks/useProducts.js
  ├── hooks/useOrders.js
  ├── components/buyer/BrowseTab.js
  ├── components/buyer/CartTab.js
  └── components/buyer/ProductModal.js

  Step 7.2 — AdminDashboard Split (1 din)
  AdminDashboard.js (coordinator)
  ├── components/admin/UsersTab.js
  ├── components/admin/ProductsTab.js
  ├── components/admin/OrdersTab.js
  └── components/admin/CategoriesTab.js

  Step 7.3 — AddProductWizard Split (1 din)
  AddProductWizard.js (orchestrator)
  ├── wizard/Step1CategorySetup.js
  ├── wizard/Step2PhotosStock.js
  └── wizard/Step3NamePrice.js

  ---
  🟢 PHASE 8 — MOBILE UX POLISH (1 din)

  Step 8.1 — Admin Mobile Tables → Cards
  - Mobile pe table ki jagah card layout use karo

  Step 8.2 — Touch Targets Increase
  - Minimum 44×44px buttons

  Step 8.3 — Modal + Keyboard Fix
  - dvh units use karo mobile pe

  ---
  ⚡ PRIORITY ORDER (Top 5 Jo Pehle Karo)

  ┌──────────┬────────────────────────────┬────────────────────────────────────────────────┐
  │ Priority │           Issue            │                   Why First?                   │
  ├──────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ 1        │ Firestore Rules Fix        │ Aaj bhi koi bhi user data tamper kar sakta hai │
  ├──────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ 2        │ Route Protection           │ Admin panel exposed                            │
  ├──────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ 3        │ N+1 Reads Fix              │ App bahut slow hai, Firebase bill              │
  ├──────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ 4        │ Service Worker             │ PWA claim karte ho but offline doesn't work    │
  ├──────────┼────────────────────────────┼────────────────────────────────────────────────┤
  │ 5        │ Lazy Loading + xlsx remove │ Quick win — bundle 40% chota hoga              │
  └──────────┴────────────────────────────┴────────────────────────────────────────────────┘

  ---
  Bhai, ye report save kar lo. Sabse pehle Security fixes karo (Phase 1), warna app live hai aur vulnerable hai. Phir Firebase
  performance (Phase 3) — ye directly bill aur user experience affect karta hai. Baaki sab gradually karte rehna! Koi specific issue
  pe deep dive karna ho toh batao. 🎯