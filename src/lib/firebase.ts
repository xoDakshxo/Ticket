// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, User } from 'firebase/auth';
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
  serverTimestamp,
  QueryConstraint,
  Unsubscribe,
} from 'firebase/firestore';

// Firebase configuration from environment variables
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
export const firestore = getFirestore(app);

// Type definitions for better TypeScript support
interface FirebaseResponse<T> {
  data: T | null;
  error: { message: string } | null;
}

interface FirebaseQueryResponse<T> {
  data: T[];
  count: number;
  error: { message: string } | null;
}

// Authentication API
export const firebaseAuth = {
  signUp: async (email: string, password: string): Promise<FirebaseResponse<{ user: User }>> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return { data: { user: userCredential.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  signInWithPassword: async (email: string, password: string): Promise<FirebaseResponse<{ user: User }>> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { data: { user: userCredential.user }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  signOut: async (): Promise<FirebaseResponse<null>> => {
    try {
      await firebaseSignOut(auth);
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  },

  getUser: () => {
    const user = auth.currentUser;
    // Map uid to id for Supabase compatibility
    if (user) {
      return {
        data: {
          user: {
            ...user,
            id: user.uid // Add id property for compatibility
          }
        },
        error: null
      };
    }
    return { data: { user: null }, error: null };
  },

  onAuthStateChange: (callback: (user: User | null) => void): Unsubscribe => {
    return onAuthStateChanged(auth, callback);
  },

  // Get current user synchronously
  getCurrentUser: () => auth.currentUser,
};

// Firestore Database Operations
export const db = {
  // Collections helper
  collection: (name: string) => collection(firestore, name),

  // Get all documents from a collection
  getAll: async <T = any>(collectionName: string, ...constraints: QueryConstraint[]): Promise<FirebaseQueryResponse<T>> => {
    try {
      const q = constraints.length > 0
        ? query(collection(firestore, collectionName), ...constraints)
        : collection(firestore, collectionName);

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      return { data, count: data.length, error: null };
    } catch (error: any) {
      console.error(`Error getting documents from ${collectionName}:`, error);
      return { data: [], count: 0, error: { message: error.message } };
    }
  },

  // Get a single document
  getOne: async <T = any>(collectionName: string, docId: string): Promise<FirebaseResponse<T>> => {
    try {
      const docRef = doc(firestore, collectionName, docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { data: { id: docSnap.id, ...docSnap.data() } as T, error: null };
      } else {
        return { data: null, error: { message: 'Document not found' } };
      }
    } catch (error: any) {
      console.error(`Error getting document ${docId} from ${collectionName}:`, error);
      return { data: null, error: { message: error.message } };
    }
  },

  // Create a new document
  create: async <T = any>(collectionName: string, data: any): Promise<FirebaseResponse<T>> => {
    try {
      const docRef = await addDoc(collection(firestore, collectionName), {
        ...data,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      const newDoc = await getDoc(docRef);
      return { data: { id: newDoc.id, ...newDoc.data() } as T, error: null };
    } catch (error: any) {
      console.error(`Error creating document in ${collectionName}:`, error);
      return { data: null, error: { message: error.message } };
    }
  },

  // Update a document
  update: async <T = any>(collectionName: string, docId: string, data: any): Promise<FirebaseResponse<T>> => {
    try {
      const docRef = doc(firestore, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp(),
      });
      const updatedDoc = await getDoc(docRef);
      return { data: { id: updatedDoc.id, ...updatedDoc.data() } as T, error: null };
    } catch (error: any) {
      console.error(`Error updating document ${docId} in ${collectionName}:`, error);
      return { data: null, error: { message: error.message } };
    }
  },

  // Delete a document
  delete: async (collectionName: string, docId: string): Promise<FirebaseResponse<null>> => {
    try {
      await deleteDoc(doc(firestore, collectionName, docId));
      return { data: null, error: null };
    } catch (error: any) {
      console.error(`Error deleting document ${docId} from ${collectionName}:`, error);
      return { data: null, error: { message: error.message } };
    }
  },

  // Subscribe to real-time updates
  subscribe: <T = any>(
    collectionName: string,
    callback: (data: T[]) => void,
    ...constraints: QueryConstraint[]
  ): Unsubscribe => {
    const q = constraints.length > 0
      ? query(collection(firestore, collectionName), ...constraints)
      : collection(firestore, collectionName);

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      callback(data);
    }, (error) => {
      console.error(`Error in realtime subscription for ${collectionName}:`, error);
    });
  },

  // Query helpers
  where,
  orderBy,
};

// Main Firebase API (compatible interface for migration from Supabase)
export const firebase = {
  auth: firebaseAuth,

  from: (table: string) => ({
    select: (columns: string = '*', options?: any) => {
      let constraints: QueryConstraint[] = [];

      const queryBuilder = {
        data: [] as any[],
        count: 0,
        error: null as any,

        eq: function(column: string, value: any) {
          constraints.push(where(column, '==', value));
          return this; // Return this for chaining
        },

        order: function(column: string, opts?: { ascending?: boolean }) {
          const direction = opts?.ascending === false ? 'desc' : 'asc';
          constraints.push(orderBy(column, direction));
          return this; // Return this for chaining
        },

        then: async (resolve: any) => {
          try {
            // Validate constraints don't have undefined values
            const hasUndefined = constraints.some((c: any) => {
              // Check if constraint has undefined value
              return c?._queryOptions?.fieldFilters?.some((f: any) => f.value === undefined);
            });

            if (hasUndefined) {
              const errorResult = { data: [], count: 0, error: { message: 'Query contains undefined values' } };
              return resolve ? resolve(errorResult) : errorResult;
            }

            const result = await db.getAll(table, ...constraints);

            // Handle count-only requests
            if (options?.count === 'exact' && options?.head === true) {
              return resolve ? resolve({ count: result.count, error: result.error }) : { count: result.count, error: result.error };
            }

            const finalResult = { data: result.data, count: result.count, error: result.error };
            return resolve ? resolve(finalResult) : finalResult;
          } catch (error: any) {
            const errorResult = { data: [], count: 0, error: { message: error.message } };
            return resolve ? resolve(errorResult) : errorResult;
          }
        },

        catch: (reject: any) => {
          return Promise.reject(reject);
        }
      };

      return queryBuilder;
    },

    insert: (data: any) => {
      // Ensure user_id is set if auth.currentUser exists
      const dataWithUser = {
        ...data,
        user_id: data.user_id || auth.currentUser?.uid
      };

      return {
        select: () => ({
          single: async () => {
            const result = await db.create(table, dataWithUser);
            if (result.error) {
              return { data: null, error: result.error };
            }
            // Return data directly for .single()
            return { data: result.data, error: null };
          },
          then: async (resolve: any) => {
            const result = await db.create(table, dataWithUser);
            return resolve ? resolve({ data: result.data, error: result.error }) : { data: result.data, error: result.error };
          }
        }),
        then: async (resolve: any) => {
          const result = await db.create(table, dataWithUser);
          return resolve ? resolve(result) : result;
        }
      };
    },

    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        then: async (resolve: any) => {
          const docs = await db.getAll(table, where(column, '==', value));
          if (docs.data.length > 0) {
            const result = await db.update(table, docs.data[0].id, data);
            return resolve ? resolve(result) : result;
          }
          return resolve ? resolve({ data: null, error: { message: 'No document found' } }) : { data: null, error: { message: 'No document found' } };
        }
      })
    }),

    delete: () => ({
      eq: (column: string, value: any) => ({
        then: async (resolve: any) => {
          const docs = await db.getAll(table, where(column, '==', value));
          if (docs.data.length > 0) {
            const result = await db.delete(table, docs.data[0].id);
            return resolve ? resolve(result) : result;
          }
          return resolve ? resolve({ data: null, error: null }) : { data: null, error: null };
        }
      })
    })
  }),

  // Real-time subscriptions
  channel: (name: string) => {
    let unsubscribe: Unsubscribe | null = null;

    return {
      on: (event: string, filter: any, callback: () => void) => {
        const tableName = filter.table;

        return {
          subscribe: () => {
            unsubscribe = db.subscribe(tableName, () => {
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

  // Cloud Functions
  functions: {
    invoke: async (functionName: string, options?: any) => {
      try {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, functionName);

        const result = await callable(options || {});
        return { data: result.data, error: null };
      } catch (error: any) {
        console.error(`Error calling function ${functionName}:`, error);
        return { data: null, error: { message: error.message } };
      }
    }
  }
};

// Export for backwards compatibility
export const supabase = firebase;

// Export direct database access
export { firestore as database };
