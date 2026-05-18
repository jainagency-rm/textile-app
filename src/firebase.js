import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDwhZBZVRdBczSlgw6CkzdIZEj7c31wvAY",
  authDomain: "textile-app-cd9fa.firebaseapp.com",
  projectId: "textile-app-cd9fa",
  storageBucket: "textile-app-cd9fa.firebasestorage.app",
  messagingSenderId: "167815836682",
  appId: "1:167815836682:web:2869218ab91052fbb81bf3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);