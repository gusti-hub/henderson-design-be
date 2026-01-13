const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://doadmin:71Y65U2h30dKgT4t@db-mongodb-sfo3-27284-081e1b26.mongo.ondigitalocean.com/admin?tls=true&authSource=admin';

const createIndexes = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const ordersCollection = db.collection('orders');

    console.log('📊 Creating indexes...');

    // Create individual indexes
    await ordersCollection.createIndex({ createdAt: -1 });
    console.log('  ✓ createdAt index created');

    await ordersCollection.createIndex({ status: 1 });
    console.log('  ✓ status index created');

    await ordersCollection.createIndex({ 'clientInfo.name': 1 });
    console.log('  ✓ clientInfo.name index created');

    await ordersCollection.createIndex({ 'clientInfo.unitNumber': 1 });
    console.log('  ✓ clientInfo.unitNumber index created');

    await ordersCollection.createIndex({ user: 1 });
    console.log('  ✓ user index created');

    await ordersCollection.createIndex({ packageType: 1 });
    console.log('  ✓ packageType index created');

    // Create compound indexes
    await ordersCollection.createIndex({ status: 1, createdAt: -1 });
    console.log('  ✓ status + createdAt compound index created');

    await ordersCollection.createIndex({ user: 1, status: 1 });
    console.log('  ✓ user + status compound index created');

    console.log('\n✅ All indexes created successfully!\n');

    // Show all indexes
    const indexes = await ordersCollection.indexes();
    console.log('📋 Current indexes on orders collection:');
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${JSON.stringify(index.key)} ${index.name ? `(${index.name})` : ''}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Done! MongoDB connection closed.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

createIndexes();