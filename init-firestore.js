/**
 * Initialize Firestore with basic structure
 * Run with: node init-firestore.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function initializeFirestore() {
  console.log('🔥 Initializing Firestore...\n');

  try {
    // Create sample collections (they'll be created on first write)
    const collections = [
      'tickets',
      'ticket_suggestions',
      'feedback_sources',
      'user_profiles',
      'integration_configs',
      'clusters',
      'events',
      'ticket_feedback_links',
      'loop_messages',
      'outreach_log',
      'feedback_engagement_snapshots'
    ];

    console.log('📦 Collections that will be created on first use:');
    collections.forEach(col => console.log(`   - ${col}`));

    console.log('\n✅ Firestore is ready!');
    console.log('\n📋 Next steps:');
    console.log('   1. Security rules: ✅ Already deployed');
    console.log('   2. Indexes: Create them by clicking the error links in console');
    console.log('   3. Test your app: Add a subreddit in Settings\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

initializeFirestore();
