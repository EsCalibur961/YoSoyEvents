import { getApp, getApps, initializeApp } from "firebase/app";

import { getFirestore } from "firebase/firestore";

import { getAuth } from "firebase/auth";

import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCgse2JBg4Pah8k-gVUEGb6cLFwcbw",
  authDomain: "yosoy-events.firebaseapp.com",
  projectId: "yosoy-events",
  storageBucket: "yosoy-events.firebasestorage.app",
  messagingSenderId: "534651781819",
  appId: "1:534651781819:web:e89464d8dd311a3711df9e",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const auth = getAuth(app);

export const storage = getStorage(app);

export default app;
