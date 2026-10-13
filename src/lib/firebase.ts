import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCwwTY4Qn9qmKW7ERTlN3w_ywt9r7u03yo",
  authDomain: "crm-atlantica-86811.firebaseapp.com",
  projectId: "crm-atlantica-86811",
  storageBucket: "crm-atlantica-86811.firebasestorage.app",
  messagingSenderId: "890139188685",
  appId: "1:890139188685:web:974cb549daff4ba75d3884",
  measurementId: "G-42911RM34K"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
// Opcional: const analytics = getAnalytics(app); // Funciona se a Vercel/Host permitir window object. Vamos deixar desabilitado por padrão pra evitar quebras no SSR caso futuramente seja usado.

export { auth, googleProvider };
