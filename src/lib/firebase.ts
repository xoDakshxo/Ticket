// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  QueryConstraint,
  serverTimestamp
} from 'firebase/firestore';

// Firebase configuration
// These values come from your Firebase Console
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Auth API
export const firebaseAuth = {
  signUp: async (email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return { data: { user: userCredential.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  signInWithPassword: async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { data: { user: userCredential.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  signOut: async () => {
    try {
      await signOut(auth);
      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message } };
    }
  },

  getUser: () => {
    return { data: { user: auth.currentUser }, error: null };
  },

  onAuthStateChange: (callback: (user: any) => void) => {
    return onAuthStateChanged(auth, callback);
  }
};

// Generic Firestore operations
const firestoreOperations = {
  // Get all documents from a collection
  getAll: async (collectionName: string, ...constraints: QueryConstraint[]) => {
    try {
      const q = constraints.length > 0
        ? query(collection(db, collectionName), ...constraints)
        : query(collection(db, collectionName));

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return { data, count: data.length, error: null };
    } catch (error: any) {
      return { data: [], count: 0, error: { message: error.message } };
    }
  },

  // Get a single document
  getOne: async (collectionName: string, docId: string) => {
    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
      } else {
        return { data: null, error: { message: 'Document not found' } };
      }
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  // Create a new document
  create: async (collectionName: string, data: any) => {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      const newDoc = await getDoc(docRef);
      return { data: { id: newDoc.id, ...newDoc.data() }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  // Update a document
  update: async (collectionName: string, docId: string, data: any) => {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp(),
      });
      const updatedDoc = await getDoc(docRef);
      return { data: { id: updatedDoc.id, ...updatedDoc.data() }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  // Delete a document
  delete: async (collectionName: string, docId: string) => {
    try {
      await deleteDoc(doc(db, collectionName, docId));
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  // Subscribe to real-time updates
  subscribe: (collectionName: string, callback: (data: any[]) => void, ...constraints: QueryConstraint[]) => {
    const q = constraints.length > 0
      ? query(collection(db, collectionName), ...constraints)
      : query(collection(db, collectionName));

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
  }
};

// Supabase-compatible API wrapper
// This mimics the Supabase API structure for easier migration
export const supabase = {
  auth: firebaseAuth,

  from: (table: string) => ({
    select: (columns: string = '*', options?: any) => {
      const queryBuilder = {
        data: [] as any[],
        count: 0,
        error: null as any,

        eq: function(column: string, value: any) {
          // Execute the query with filter
          const execute = async () => {
            const result = await firestoreOperations.getAll(
              table,
              where(column, '==', value)
            );
            this.data = result.data;
            this.count = result.count;
            this.error = result.error;
            return this;
          };

          // Return promise-like object
          return {
            ...this,
            then: (resolve: any, reject?: any) => execute().then(resolve, reject),
            catch: (reject: any) => execute().catch(reject),
          };
        },

        // For queries without filters
        then: async (resolve: any, reject?: any) => {
          const result = await firestoreOperations.getAll(table);
          this.data = result.data;
          this.count = result.count;
          this.error = result.error;
          return resolve ? resolve(this) : this;
        },

        catch: (reject: any) => {
          return Promise.reject(reject);
        }
      };

      // Handle count and head options
      if (options?.count === 'exact' && options?.head === true) {
        return {
          ...queryBuilder,
          eq: function(column: string, value: any) {
            return {
              then: async (resolve: any) => {
                const result = await firestoreOperations.getAll(table, where(column, '==', value));
                resolve({ count: result.count, error: result.error });
              }
            };
          },
          then: async (resolve: any) => {
            const result = await firestoreOperations.getAll(table);
            resolve({ count: result.count, error: result.error });
          }
        };
      }

      return queryBuilder;
    },

    insert: (data: any) => ({
      select: () => ({
        single: async () => {
          return await firestoreOperations.create(table, data);
        }
      }),
      then: async (resolve: any) => {
        const result = await firestoreOperations.create(table, data);
        return resolve ? resolve(result) : result;
      }
    }),

    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        then: async (resolve: any) => {
          // Find the document first
          const docs = await firestoreOperations.getAll(table, where(column, '==', value));
          if (docs.data.length > 0) {
            const result = await firestoreOperations.update(table, docs.data[0].id, data);
            return resolve ? resolve(result) : result;
          }
          return resolve ? resolve({ data: null, error: { message: 'No document found' } }) : { data: null, error: { message: 'No document found' } };
        }
      })
    }),

    delete: () => ({
      eq: (column: string, value: any) => ({
        then: async (resolve: any) => {
          // Find the document first
          const docs = await firestoreOperations.getAll(table, where(column, '==', value));
          if (docs.data.length > 0) {
            const result = await firestoreOperations.delete(table, docs.data[0].id);
            return resolve ? resolve(result) : result;
          }
          return resolve ? resolve({ data: null, error: null }) : { data: null, error: null };
        }
      })
    })
  }),

  // Real-time subscriptions (Supabase style)
  channel: (name: string) => {
    let unsubscribe: (() => void) | null = null;

    return {
      on: (event: string, filter: any, callback: () => void) => {
        // Extract table name from filter
        const tableName = filter.table;

        return {
          subscribe: () => {
            // Subscribe to Firestore real-time updates
            unsubscribe = firestoreOperations.subscribe(tableName, () => {
              callback();
            });
            return { unsubscribe: () => unsubscribe?.() };
          }
        };
      },
      subscribe: () => {
        return { unsubscribe: () => unsubscribe?.() };
      }
    };
  },

  removeChannel: (channel: any) => {
    // Firebase handles cleanup automatically
  },

  // Mock functions (for edge functions)
  functions: {
    invoke: async (functionName: string, options?: any) => {
      console.log(`Firebase: Mock function call to ${functionName}`, options);

      // Return mock data for now
      // In production, you'd replace these with Cloud Functions or your own API
      if (functionName === 'suggest-tickets') {
        return { data: { suggestions: [] }, error: null };
      }

      if (functionName === 'reddit-sync') {
        return { data: { synced: 0 }, error: null };
      }

      return { data: null, error: null };
    }
  }
};

// Export for direct use
export { firestoreOperations };
