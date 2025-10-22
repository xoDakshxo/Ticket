// Mock Supabase client for local development without backend
// This provides the same interface as Supabase but with local mock data

type Callback = () => void;

const mockData = {
  feedbackSources: [],
  tickets: [],
  ticketSuggestions: [],
  userProfiles: [],
  integrationConfigs: [],
};

// Simple event emitter for mock real-time subscriptions
const subscribers: { [key: string]: Callback[] } = {};

const emit = (channel: string) => {
  if (subscribers[channel]) {
    subscribers[channel].forEach(callback => callback());
  }
};

// Mock auth
export const mockAuth = {
  signUp: async (credentials: any) => {
    return { data: { user: { email: credentials.email } }, error: null };
  },
  signInWithPassword: async (credentials: any) => {
    return { data: { user: { email: credentials.email } }, error: null };
  },
  signOut: async () => {
    localStorage.removeItem('user');
    return { error: null };
  },
  getUser: async () => {
    const user = localStorage.getItem('user');
    return { data: { user: user ? JSON.parse(user) : null }, error: null };
  },
};

// Mock Supabase client
export const supabase = {
  auth: mockAuth,

  from: (table: string) => ({
    select: (columns: string = '*', options?: any) => ({
      eq: (column: string, value: any) => ({
        data: mockData[table as keyof typeof mockData] || [],
        count: (mockData[table as keyof typeof mockData] || []).length,
        error: null,
      }),
      data: mockData[table as keyof typeof mockData] || [],
      count: (mockData[table as keyof typeof mockData] || []).length,
      error: null,
    }),
    insert: (data: any) => ({
      select: () => ({
        single: () => ({
          data: { id: Date.now(), ...data },
          error: null,
        }),
        data: [{ id: Date.now(), ...data }],
        error: null,
      }),
      data: { id: Date.now(), ...data },
      error: null,
    }),
    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        data: { ...data },
        error: null,
      }),
    }),
    delete: () => ({
      eq: (column: string, value: any) => ({
        data: null,
        error: null,
      }),
    }),
  }),

  channel: (name: string) => ({
    on: (event: string, filter: any, callback: Callback) => {
      if (!subscribers[name]) {
        subscribers[name] = [];
      }
      subscribers[name].push(callback);
      return {
        subscribe: () => {
          return { unsubscribe: () => {} };
        },
      };
    },
    subscribe: () => {
      return { unsubscribe: () => {} };
    },
  }),

  removeChannel: (channel: any) => {
    // Mock implementation
  },

  functions: {
    invoke: async (functionName: string, options?: any) => {
      console.log(`Mock function call: ${functionName}`, options);

      // Return mock data based on function name
      if (functionName === 'suggest-tickets') {
        return {
          data: { suggestions: [] },
          error: null,
        };
      }

      if (functionName === 'reddit-sync') {
        return {
          data: { synced: 0 },
          error: null,
        };
      }

      return { data: null, error: null };
    },
  },
};
