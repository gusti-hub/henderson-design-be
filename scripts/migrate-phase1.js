/**
 * migrate-phase1.js
 *
 * Tujuan: Pastikan Order punya semua data yang dibutuhkan
 * sebelum kita ubah PO/Proposal supaya selalu baca dari Order.
 *
 * Rules:
 *  - TIDAK ada data yang dihapus
 *  - TIDAK ada perubahan di POVersion / ProposalVersion
 *  - Hanya COPY/TAMBAH data ke Order yang masih kurang
 *
 * Run on test DB:
 *   node scripts/migrate-phase1.js
 *
 * Run on production (when ready):
 *   NODE_ENV=production node scripts/migrate-phase1.js
 */

require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env' : '.env.test' });
const mongoose = require('mongoose');

const isProduction = process.env.NODE_ENV === 'production';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db  = mongoose.connection.db;
  const env = isProduction ? '🔴 PRODUCTION' : '🟢 TEST (henderson-test)';

  console.log('');
  console.log('=================================================');
  console.log(` PHASE 1 MIGRATION — ${env}`);
  console.log('=================================================');
  console.log('');
  console.log('Rules:');
  console.log('  - Nothing is deleted');
  console.log('  - POVersion / ProposalVersion are NOT touched');
  console.log('  - Only COPY data TO Order where Order is missing it');
  console.log('');

  const stats = {
    proposalNumber: { copied: 0, skipped: 0 },
    clientInfo:     { copied: 0, skipped: 0 },
    products:       { copied: 0, skipped: 0 },
    orphanPV:       0,
    orphanPO:       0,
  };

  const orders = await db.collection('orders').find({}).toArray();
  console.log(`Found ${orders.length} orders to check.\n`);

  for (const order of orders) {
    const orderId = order._id;

    // ── 1. proposalNumber ──────────────────────────────────────────────────
    if (!order.proposalNumber) {
      // Find any ProposalVersion linked to this order that has a proposalNumber
      const pv = await db.collection('proposalversions').findOne(
        { orderId, proposalNumber: { $nin: [null, ''] } },
        { projection: { proposalNumber: 1 } }
      );

      if (pv?.proposalNumber) {
        await db.collection('orders').updateOne(
          { _id: orderId },
          { $set: { proposalNumber: pv.proposalNumber } }
        );
        console.log(`  ✅ Order ${orderId} — proposalNumber copied: ${pv.proposalNumber}`);
        stats.proposalNumber.copied++;
      } else {
        stats.proposalNumber.skipped++; // no PV with proposalNumber, leave null
      }
    } else {
      stats.proposalNumber.skipped++;
    }

    // ── 2. clientInfo ──────────────────────────────────────────────────────
    if (!order.clientInfo?.name) {
      // Try to get from POVersion first, then ProposalVersion
      const po = await db.collection('poversions').findOne(
        { orderId, 'clientInfo.name': { $nin: [null, ''] } },
        { projection: { clientInfo: 1 } }
      );
      const pv = po ? null : await db.collection('proposalversions').findOne(
        { orderId, 'clientInfo.name': { $nin: [null, ''] } },
        { projection: { clientInfo: 1 } }
      );

      const source = po || pv;
      if (source?.clientInfo?.name) {
        await db.collection('orders').updateOne(
          { _id: orderId },
          { $set: { clientInfo: source.clientInfo } }
        );
        console.log(`  ✅ Order ${orderId} — clientInfo copied: ${source.clientInfo.name}`);
        stats.clientInfo.copied++;
      } else {
        stats.clientInfo.skipped++;
      }
    } else {
      stats.clientInfo.skipped++;
    }

    // ── 3. selectedProducts ────────────────────────────────────────────────
    // Only copy if Order has 0 products — this means Order lost its data somehow
    const orderProductCount = (order.selectedProducts || []).length;
    if (orderProductCount === 0) {
      // Try to restore from the latest ProposalVersion (most recent snapshot)
      const latestPV = await db.collection('proposalversions').findOne(
        { orderId, 'selectedProducts.0': { $exists: true } },
        { projection: { selectedProducts: 1, createdAt: 1 }, sort: { createdAt: -1 } }
      );

      if (latestPV?.selectedProducts?.length > 0) {
        await db.collection('orders').updateOne(
          { _id: orderId },
          { $set: { selectedProducts: latestPV.selectedProducts } }
        );
        console.log(`  ✅ Order ${orderId} — selectedProducts restored from PV (${latestPV.selectedProducts.length} items)`);
        stats.products.copied++;
      } else {
        stats.products.skipped++;
      }
    } else {
      stats.products.skipped++;
    }
  }

  // ── Check orphan ProposalVersions (PV with no matching Order) ─────────────
  console.log('\nChecking for orphan documents...');
  const allPVs = await db.collection('proposalversions').find({}, { projection: { orderId: 1 } }).toArray();
  for (const pv of allPVs) {
    const exists = await db.collection('orders').findOne({ _id: pv.orderId }, { projection: { _id: 1 } });
    if (!exists) {
      console.log(`  ⚠️  ProposalVersion ${pv._id} — Order ${pv.orderId} not found (orphan, kept as-is)`);
      stats.orphanPV++;
    }
  }

  const allPOs = await db.collection('poversions').find({}, { projection: { orderId: 1 } }).toArray();
  for (const po of allPOs) {
    const exists = await db.collection('orders').findOne({ _id: po.orderId }, { projection: { _id: 1 } });
    if (!exists) {
      console.log(`  ⚠️  POVersion ${po._id} — Order ${po.orderId} not found (orphan, kept as-is)`);
      stats.orphanPO++;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('');
  console.log('=================================================');
  console.log(' SUMMARY');
  console.log('=================================================');
  console.log(`proposalNumber  — copied: ${stats.proposalNumber.copied}, skipped: ${stats.proposalNumber.skipped}`);
  console.log(`clientInfo      — copied: ${stats.clientInfo.copied}, skipped: ${stats.clientInfo.skipped}`);
  console.log(`selectedProducts — restored: ${stats.products.copied}, skipped: ${stats.products.skipped}`);
  console.log(`Orphan PVs (kept as-is): ${stats.orphanPV}`);
  console.log(`Orphan POs (kept as-is): ${stats.orphanPO}`);
  console.log('');

  const needsReview = stats.orphanPV > 0 || stats.orphanPO > 0;
  if (needsReview) {
    console.log('⚠️  There are orphan documents. They are kept as-is and will not affect the new flow.');
  }
  console.log('✅ Migration done. Safe to proceed to Phase 2.');

  await mongoose.disconnect();
}

run().catch(e => {
  console.error('\nFatal error:', e.message);
  process.exit(1);
});
