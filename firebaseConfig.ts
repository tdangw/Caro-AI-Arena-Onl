// Import the functions you need from the SDKs you need
// FIX: Switched to Firebase v9 compat initialization to resolve module export errors, while keeping service getters modular.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// IMPORTANT: Replace this with your own Firebase project's configuration!
// See README.md for instructions on how to get this.
const firebaseConfig = {
  apiKey: 'AIzaSyDCmIQ9Kly6RWPz89D5bsAIyk9wKmWDjZc',
  authDomain: 'caro-ai-arena.firebaseapp.com',
  databaseURL:
    'https://caro-ai-arena-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'caro-ai-arena',
  storageBucket: 'caro-ai-arena.firebasestorage.app',
  messagingSenderId: '316000837643',
  appId: '1:316000837643:web:805db8f084712d9cabe70e',
  measurementId: 'G-86DC259ZW2',
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

export { app, auth, db, rtdb };
