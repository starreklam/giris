import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCCK9a6hClKRb8_VgmiB_6ufYCE6QHbawY",
  authDomain: "star-reklam.firebaseapp.com",
  projectId: "star-reklam",
  storageBucket: "star-reklam.firebasestorage.app",
  messagingSenderId: "1016505174164",
  appId: "1:1016505174164:web:cee272fdaeb83a4b06cc81",
  measurementId: "G-DC24K4KJG7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BELGE = doc(db, "star_veri", "ana");

export function buluttanDinle(callback) {
  return onSnapshot(BELGE, (snap) => {
    if (snap.exists()) callback(snap.data());
  }, (err) => {
    console.error("Firebase dinleme hatası:", err);
  });
}

export async function buluttaKaydet(veri) {
  try {
    await setDoc(BELGE, veri, { merge: true });
  } catch (err) {
    console.error("Firebase kaydetme hatası:", err);
  }
}
