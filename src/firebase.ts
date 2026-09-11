import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import config from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(config);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app, config.firestoreDatabaseId);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

export { app, db, auth };
