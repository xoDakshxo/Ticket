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
  limit as limitConstraint,
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

type FirestoreRecord = Record<string, unknown> & { id: string };

interface SupabaseSelectOptions {
  count?: 'exact';
  head?: boolean;
}

type FilterFunction<T> = (row: T) => boolean;

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
};

// Authentication API
export const firebaseAuth = {
  signUp: async (email: string, password: string): Promise<FirebaseResponse<{ user: User }>> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return { data: { user: userCredential.user }, error: null };
    } catch (error: unknown) {
      return { data: null, error: { message: toErrorMessage(error) } };
    }
  },

  signInWithPassword: async (email: string, password: string): Promise<FirebaseResponse<{ user: User }>> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { data: { user: userCredential.user }, error: null };
    } catch (error: unknown) {
      return { data: null, error: { message: toErrorMessage(error) } };
    }
  },

  signOut: async (): Promise<FirebaseResponse<null>> => {
    try {
      await firebaseSignOut(auth);
      return { data: null, error: null };
    } catch (error: unknown) {
      return { data: null, error: { message: toErrorMessage(error) } };
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
  getAll: async <T extends FirestoreRecord = FirestoreRecord>(collectionName: string, ...constraints: QueryConstraint[]): Promise<FirebaseQueryResponse<T>> => {
    try {
      const q = constraints.length > 0
        ? query(collection(firestore, collectionName), ...constraints)
        : collection(firestore, collectionName);

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((document) => {
        const payload = document.data() as Record<string, unknown>;
        return { id: document.id, ...payload } as T;
      });
      return { data, count: data.length, error: null };
    } catch (error: unknown) {
      console.error(`Error getting documents from ${collectionName}:`, error);
      return { data: [], count: 0, error: { message: toErrorMessage(error) } };
    }
  },

  // Get a single document
  getOne: async <T extends FirestoreRecord = FirestoreRecord>(collectionName: string, docId: string): Promise<FirebaseResponse<T>> => {
    try {
      const docRef = doc(firestore, collectionName, docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const payload = docSnap.data() as Record<string, unknown>;
        return { data: { id: docSnap.id, ...payload } as T, error: null };
      } else {
        return { data: null, error: { message: 'Document not found' } };
      }
    } catch (error: unknown) {
      console.error(`Error getting document ${docId} from ${collectionName}:`, error);
      return { data: null, error: { message: toErrorMessage(error) } };
    }
  },

  // Create a new document
  create: async <T extends FirestoreRecord = FirestoreRecord>(collectionName: string, data: Record<string, unknown>): Promise<FirebaseResponse<T>> => {
    try {
      const docRef = await addDoc(collection(firestore, collectionName), {
        ...data,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      const newDoc = await getDoc(docRef);
      const payload = newDoc.data() as Record<string, unknown> | undefined;
      return { data: payload ? ({ id: newDoc.id, ...payload } as T) : null, error: null };
    } catch (error: unknown) {
      console.error(`Error creating document in ${collectionName}:`, error);
      return { data: null, error: { message: toErrorMessage(error) } };
    }
  },

  // Update a document
  update: async <T extends FirestoreRecord = FirestoreRecord>(collectionName: string, docId: string, data: Record<string, unknown>): Promise<FirebaseResponse<T>> => {
    try {
      const docRef = doc(firestore, collectionName, docId);
      await updateDoc(docRef, {
        ...data,
        updated_at: serverTimestamp(),
      });
      const updatedDoc = await getDoc(docRef);
      const payload = updatedDoc.data() as Record<string, unknown> | undefined;
      return { data: payload ? ({ id: updatedDoc.id, ...payload } as T) : null, error: null };
    } catch (error: unknown) {
      console.error(`Error updating document ${docId} in ${collectionName}:`, error);
      return { data: null, error: { message: toErrorMessage(error) } };
    }
  },

  // Delete a document
  delete: async (collectionName: string, docId: string): Promise<FirebaseResponse<null>> => {
    try {
      await deleteDoc(doc(firestore, collectionName, docId));
      return { data: null, error: null };
    } catch (error: unknown) {
      console.error(`Error deleting document ${docId} from ${collectionName}:`, error);
      return { data: null, error: { message: toErrorMessage(error) } };
    }
  },

  // Subscribe to real-time updates
  subscribe: <T extends FirestoreRecord = FirestoreRecord>(
    collectionName: string,
    callback: (data: T[]) => void,
    ...constraints: QueryConstraint[]
  ): Unsubscribe => {
    const q = constraints.length > 0
      ? query(collection(firestore, collectionName), ...constraints)
      : collection(firestore, collectionName);

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((document) => {
        const payload = document.data() as Record<string, unknown>;
        return { id: document.id, ...payload } as T;
      });
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

  from: <TRecord extends FirestoreRecord = FirestoreRecord>(table: string) => ({
    select: (_columns: string = '*', options?: SupabaseSelectOptions) => {
      const queryConstraints: QueryConstraint[] = [];
      const manualFilters: FilterFunction<TRecord>[] = [];
      let idFilter: string | null = null;
      let hasUndefinedFilter = false;
      let limitValue: number | null = null;

      const applyManualFilters = (rows: TRecord[]): TRecord[] => {
        if (!rows?.length || manualFilters.length === 0) return rows;
        return manualFilters.reduce<TRecord[]>((acc, filter) => acc.filter(filter), rows);
      };

      const runQuery = async () => {
        try {
          if (hasUndefinedFilter) {
            return { data: [] as TRecord[], count: 0, error: { message: 'Query contains undefined values' } };
          }

          if (idFilter) {
            const result = await db.getOne<TRecord>(table, idFilter);
            const rows = result.data ? [result.data] : [];
            const filtered = applyManualFilters(rows);

            if (options?.count === 'exact' && options?.head) {
              return { data: [] as TRecord[], count: filtered.length, error: result.error };
            }

            return { data: filtered, count: filtered.length, error: result.error };
          }

          const constraintsToUse = limitValue !== null
            ? [...queryConstraints, limitConstraint(limitValue)]
            : queryConstraints;

          const result = await db.getAll<TRecord>(table, ...constraintsToUse);
          const filtered = applyManualFilters(result.data);

          if (options?.count === 'exact' && options?.head) {
            return { data: [] as TRecord[], count: filtered.length, error: result.error };
          }

          return { data: filtered, count: filtered.length, error: result.error };
        } catch (error: unknown) {
          return { data: [] as TRecord[], count: 0, error: { message: toErrorMessage(error) } };
        }
      };

      const builder = {
        eq: (column: string, value: unknown) => {
          if (value === undefined) {
            hasUndefinedFilter = true;
            return builder;
          }

          if (column === 'id') {
            idFilter = typeof value === 'string' ? value : String(value);
          } else {
            queryConstraints.push(where(column, '==', value));
          }
          return builder;
        },

        neq: (column: string, value: unknown) => {
          manualFilters.push((row) => {
            if (!row) return false;
            const target = column === 'id' ? row.id : (row as Record<string, unknown>)[column];
            return target !== value;
          });
          return builder;
        },

        order: (column: string, opts?: { ascending?: boolean }) => {
          const direction = opts?.ascending === false ? 'desc' : 'asc';
          queryConstraints.push(orderBy(column, direction));
          return builder;
        },

        limit: (value: number) => {
          if (Number.isFinite(value) && value > 0) {
            limitValue = Math.floor(value);
          }
          return builder;
        },

        then: async <TReturn = { data: TRecord[]; count: number; error: { message: string } | null }>(resolve?: (value: { data: TRecord[]; count: number; error: { message: string } | null }) => TReturn | Promise<TReturn>) => {
          const result = await runQuery();
          if (resolve) {
            return resolve(result);
          }
          return result as TReturn;
        },

        catch: <TReturn = never>(reject?: (reason: unknown) => TReturn | Promise<TReturn>) => {
          return runQuery().then((value) => value, (error) => {
            if (reject) {
              return reject(error);
            }
            throw error;
          });
        },

        single: async () => {
          const result = await runQuery();
          if (result.error) {
            return { data: null, error: result.error };
          }
          return { data: result.data[0] ?? null, error: null };
        }
      };

      return builder;
    },

    insert: (payload: Record<string, unknown> | Array<Record<string, unknown>>) => {
      const isArrayInput = Array.isArray(payload);
      const inputArray = (isArrayInput ? payload : [payload]).map((item) => {
        const record: Record<string, unknown> = { ...item };
        if (record.user_id === undefined) {
          record.user_id = auth.currentUser?.uid ?? null;
        }
        return record;
      });

      type InsertResult = { data: TRecord | TRecord[] | null; error: { message: string } | null };
      let insertPromise: Promise<InsertResult> | null = null;

      const runInsert = async (): Promise<InsertResult> => {
        const created: TRecord[] = [];
        for (const record of inputArray) {
          const result = await db.create<TRecord>(table, record);
          if (result.error || !result.data) {
            return {
              data: isArrayInput ? created : null,
              error: result.error ?? { message: 'Failed to create document' }
            };
          }
          created.push(result.data);
        }

        return {
          data: isArrayInput ? created : created[0] ?? null,
          error: null
        };
      };

      const ensureInsert = () => {
        if (!insertPromise) {
          insertPromise = runInsert();
        }
        return insertPromise;
      };

      return {
        select: () => ({
          single: async () => {
            const result = await ensureInsert();
            if (result.error) {
              return { data: null, error: result.error };
            }
            const first = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
            return { data: first ?? null, error: null };
          },
          then: async <TReturn = InsertResult>(resolve?: (value: InsertResult) => TReturn | Promise<TReturn>) => {
            const result = await ensureInsert();
            return resolve ? resolve(result) : (result as unknown as TReturn);
          }
        }),
        then: async <TReturn = InsertResult>(resolve?: (value: InsertResult) => TReturn | Promise<TReturn>) => {
          const result = await ensureInsert();
          return resolve ? resolve(result) : (result as unknown as TReturn);
        }
      };
    },

    update: (data: Record<string, unknown>) => ({
      eq: (column: string, value: unknown) => ({
        then: async <TReturn = FirebaseResponse<TRecord>>(resolve?: (value: FirebaseResponse<TRecord>) => TReturn | Promise<TReturn>) => {
          if (value === undefined) {
            const errorResult = { data: null, error: { message: 'No document found' } };
            return resolve ? resolve(errorResult) : (errorResult as unknown as TReturn);
          }

          if (column === 'id') {
            const result = await db.update<TRecord>(table, String(value), data);
            return resolve ? resolve(result) : (result as unknown as TReturn);
          }

          const docs = await db.getAll<TRecord>(table, where(column, '==', value));
          if (docs.error) {
            const errorResult = { data: null, error: docs.error };
            return resolve ? resolve(errorResult) : (errorResult as unknown as TReturn);
          }

          if (docs.data.length > 0) {
            const result = await db.update<TRecord>(table, docs.data[0].id, data);
            return resolve ? resolve(result) : (result as unknown as TReturn);
          }

          const errorResult = { data: null, error: { message: 'No document found' } };
          return resolve ? resolve(errorResult) : (errorResult as unknown as TReturn);
        }
      })
    }),

    delete: () => ({
      eq: (column: string, value: unknown) => ({
        then: async <TReturn = FirebaseResponse<null>>(resolve?: (value: FirebaseResponse<null>) => TReturn | Promise<TReturn>) => {
          if (value === undefined) {
            const errorResult = { data: null, error: { message: 'Invalid delete filter' } };
            return resolve ? resolve(errorResult) : (errorResult as unknown as TReturn);
          }

          if (column === 'id') {
            const result = await db.delete(table, String(value));
            return resolve ? resolve(result) : (result as unknown as TReturn);
          }

          const docs = await db.getAll<TRecord>(table, where(column, '==', value));
          if (docs.error) {
            const errorResult = { data: null, error: docs.error };
            return resolve ? resolve(errorResult) : (errorResult as unknown as TReturn);
          }

          if (docs.data.length > 0) {
            const result = await db.delete(table, docs.data[0].id);
            return resolve ? resolve(result) : (result as unknown as TReturn);
          }

          const okResult = { data: null, error: null };
          return resolve ? resolve(okResult) : (okResult as unknown as TReturn);
        }
      }),
      neq: (column: string, value: unknown) => ({
        then: async <TReturn = FirebaseResponse<null>>(resolve?: (value: FirebaseResponse<null>) => TReturn | Promise<TReturn>) => {
          const docs = await db.getAll<TRecord>(table);
          if (docs.error) {
            const errorResult = { data: null, error: docs.error };
            return resolve ? resolve(errorResult) : (errorResult as unknown as TReturn);
          }

          const targets = docs.data.filter((row) => {
            const rowRecord = row as Record<string, unknown>;
            const targetValue = column === 'id' ? row.id : rowRecord[column];
            return targetValue !== value;
          });

          let lastError: { message: string } | null = null;
          for (const row of targets) {
            const result = await db.delete(table, row.id);
            if (result.error) {
              lastError = result.error;
              break;
            }
          }

          const response = { data: null, error: lastError };
          return resolve ? resolve(response) : (response as unknown as TReturn);
        }
      })
    })
  }),

  // Real-time subscriptions
  channel: (name: string) => {
    let unsubscribe: Unsubscribe | null = null;

    return {
      on: (_event: string, filter: { table: string }, callback: () => void) => {
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

  removeChannel: (_channel: unknown) => {
    // Firebase handles cleanup automatically
  },

  // Cloud Functions
  functions: {
    invoke: async (functionName: string, options?: Record<string, unknown>) => {
      try {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const functions = getFunctions(app, 'asia-south1');
        const callable = httpsCallable(functions, functionName);

        const result = await callable(options ?? {});
        return { data: result.data, error: null };
      } catch (error: unknown) {
        console.error(`Error calling function ${functionName}:`, error);
        return { data: null, error: { message: toErrorMessage(error) } };
      }
    }
  }
};

// Export for backwards compatibility
export const supabase = firebase;

// Export direct database access
export { firestore as database };
