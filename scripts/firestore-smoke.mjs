#!/usr/bin/env node

const requiredKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID"
];

const missing = requiredKeys.filter((key) => !process.env[key]);
if (missing.length) {
  console.error("Missing environment variables:", missing.join(", "));
  console.error("Run with: node --env-file=.env scripts/firestore-smoke.mjs");
  process.exit(1);
}

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, limit as limitDocuments } from "firebase/firestore/lite";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

async function run() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const ticketsQuery = query(collection(db, "tickets"), orderBy("created_at", "desc"), limitDocuments(5));
  const snapshot = await getDocs(ticketsQuery);

  console.log(`Retrieved ${snapshot.size} tickets (showing up to 5):`);
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    console.log(`- ${doc.id}: ${data.title || "Untitled"} [${data.state || "unknown"}]`);
  });
}

run().catch((error) => {
  console.error("Firestore smoke test failed:", error.message);
  process.exitCode = 1;
});
