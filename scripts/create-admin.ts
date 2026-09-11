import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

// Read config
const configPath = path.resolve('./firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

admin.initializeApp({ projectId: config.projectId });

const db = getFirestore();

async function createAdmin() {
  try {
    const user = await getAuth().createUser({
      email: 'admin@khaleej.com',
      password: 'password123',
      displayName: 'Admin'
    });
    
    await db.collection('admins').doc(user.uid).set({
      email: 'admin@khaleej.com',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Admin user created: admin@khaleej.com / password123');
  } catch(e: any) {
    if (e.code === 'auth/email-already-exists') {
      console.log('Admin already exists.');
    } else {
      console.error(e);
    }
  }
}

createAdmin();
