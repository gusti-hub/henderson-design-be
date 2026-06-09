/**
 * copy-db.js
 * Copies all collections from source DB to target DB.
 * Usage: node scripts/copy-db.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const SOURCE_URI = process.env.MONGO_URI;
const TARGET_URI = SOURCE_URI.replace('/admin?', '/henderson-test?');

const COLLECTIONS = [
  'users', 'orders', 'poversions', 'proposalversions', 'billinvoices',
  'expenses', 'products', 'vendors', 'appointments', 'activitylogs',
  'orderversionlogs', 'clientquestionnaires', 'journeys', 'journeychats',
  'locationmappings', 'meetingschedules', 'nextstepsoptions',
  'quickbookstokens', 'counters', 'availabilityconfigs',
];

async function copyDB() {
  console.log('Connecting to source DB...');
  const sourceConn = await mongoose.createConnection(SOURCE_URI).asPromise();

  console.log('Connecting to target DB...');
  const targetConn = await mongoose.createConnection(TARGET_URI).asPromise();

  console.log(`Source: ${sourceConn.db.databaseName}`);
  console.log(`Target: ${targetConn.db.databaseName}`);
  console.log('');

  for (const collName of COLLECTIONS) {
    try {
      const sourceColl = sourceConn.db.collection(collName);
      const targetColl = targetConn.db.collection(collName);

      const docs = await sourceColl.find({}).toArray();
      if (docs.length === 0) {
        console.log(`  SKIP  ${collName} (empty)`);
        continue;
      }

      await targetColl.deleteMany({});
      await targetColl.insertMany(docs);
      console.log(`  ✅    ${collName}: ${docs.length} documents copied`);
    } catch (err) {
      console.log(`  ❌    ${collName}: ${err.message}`);
    }
  }

  await sourceConn.close();
  await targetConn.close();
  console.log('\nDone.');
}

copyDB().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
