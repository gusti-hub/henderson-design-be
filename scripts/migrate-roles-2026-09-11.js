/**
 * Role & User Migration — 2026-09-11
 * Run: node scripts/migrate-roles-2026-09-11.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

// ─── Role definitions ─────────────────────────────────────────────────────────
const ALL_ACTIONS = [
  'view_dashboard', 'view_orders', 'view_expenses', 'view_vendors',
  'view_users', 'view_clients', 'view_products', 'view_product_mapping',
  'view_financial_review', 'view_role_management', 'view_logistic_tracker',
];

const ROLE_DEFS = [
  {
    name: 'Software',
    permissions: ALL_ACTIONS,
  },
  {
    name: 'PM/CEE',
    permissions: ['view_dashboard', 'view_clients', 'view_orders', 'view_logistic_tracker'],
  },
  {
    name: 'Designer',
    permissions: ['view_dashboard', 'view_clients', 'view_orders'],
  },
  {
    name: 'Procurement',
    permissions: ['view_dashboard', 'view_orders', 'view_vendors', 'view_expenses'],
  },
  {
    name: 'Logistics',
    permissions: ['view_dashboard', 'view_logistic_tracker'],
  },
  {
    name: 'Finance',
    permissions: ['view_dashboard', 'view_expenses', 'view_financial_review'],
  },
  {
    name: 'PA',
    permissions: ['view_dashboard', 'view_orders', 'view_expenses', 'view_clients', 'view_logistic_tracker'],
  },
  {
    name: 'PM/CEE, Finance',
    permissions: ['view_dashboard', 'view_clients', 'view_orders', 'view_logistic_tracker', 'view_expenses', 'view_financial_review'],
  },
];

// ─── User role assignments ────────────────────────────────────────────────────
const USER_ROLES = [
  // Admin (user.role = 'admin', no role doc needed — full access via code)
  { email: 'lika@henderson.house',            role: 'admin'          },
  { email: 'intan@henderson.house',           role: 'admin'          },
  // Designer
  { email: 'amy@henderson.house',             role: 'Designer'       },
  { email: 'janelle@henderson.house',         role: 'Designer'       },
  // Finance
  { email: 'mark@henderson.house',            role: 'Finance'        },
  { email: 'ami@henderson.house',             role: 'Finance'        },
  { email: 'amadea@henderson.house',          role: 'Finance'        },
  // Logistics
  { email: 'idavaeruza@henderson.house',      role: 'Logistics'      },
  { email: 'erwin@henderson.house',           role: 'Logistics'      },
  { email: 'dian@henderson.house',            role: 'Logistics'      },
  { email: 'vellix@henderson.house',          role: 'Logistics'      },
  { email: 'audly@henderson.house',           role: 'Logistics'      },
  { email: 'erwin@gmail.com',                 role: 'Logistics'      },
  // PA
  { email: 'sara@henderson.house',            role: 'PA'             },
  { email: 'haley@henderson.house',           role: 'PA'             },
  { email: 'alin@henderson.house',            role: 'PA'             },
  { email: 'eka@henderson.house',             role: 'PA'             },
  { email: 'pudensia@henderson.house',        role: 'PA'             },
  // PM/CEE
  { email: 'savanna@henderson.house',         role: 'PM/CEE'         },
  { email: 'daiki@henderson.house',           role: 'PM/CEE'         },
  { email: 'madeline@henderson.house',        role: 'PM/CEE'         },
  { email: 'rob@henderson.house',             role: 'PM/CEE'         },
  { email: 'rei@henderson.house',             role: 'PM/CEE'         },
  // PM/CEE + Finance
  { email: 'nicole@henderson.house',          role: 'PM/CEE, Finance' },
  { email: 'jojo@henderson.house',            role: 'PM/CEE, Finance' },
  // Procurement
  { email: 'rizky@henderson.house',           role: 'Procurement'    },
  { email: 'laela@henderson.house',           role: 'Procurement'    },
  // Software
  { email: 'anjel@henderson.house',           role: 'Software'       },
  { email: 'agustianggaraputra@gmail.com',    role: 'Software'       },
  { email: 'admin@henderson.house',           role: 'Software'       },
  { email: 'almer@henderson.house',           role: 'Software'       },
];

// ─── Users to delete ──────────────────────────────────────────────────────────
const DELETE_EMAILS = [
  'erico@henderson.house',
  'gufran@henderson.house',
  'amywigglesworth@yahoo.com',
  'jmevind@gmail.com',
  'markhsca@gmail.com',
  'rob12@gmail.com',
  'anggaraputra9552@gmail.com',
  'test1@gmail.com',
];

// ─── Run ──────────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const roles = db.collection('roles');
  const users = db.collection('users');

  console.log('\n=== 1. Upsert Role Definitions ===');
  for (const def of ROLE_DEFS) {
    const result = await roles.updateOne(
      { name: def.name },
      { $set: { name: def.name, permissions: def.permissions } },
      { upsert: true }
    );
    const action = result.upsertedCount ? 'CREATED' : 'UPDATED';
    console.log(`  ${action}: ${def.name} (${def.permissions.length} permissions)`);
  }

  console.log('\n=== 2. Update User Roles ===');
  for (const { email, role } of USER_ROLES) {
    const result = await users.updateOne(
      { email: new RegExp(`^${email}$`, 'i') },
      { $set: { role } }
    );
    if (result.matchedCount === 0) {
      console.log(`  NOT FOUND: ${email}`);
    } else {
      console.log(`  OK: ${email} → ${role}`);
    }
  }

  console.log('\n=== 3. Delete Users ===');
  for (const email of DELETE_EMAILS) {
    const result = await users.deleteOne({ email: new RegExp(`^${email}$`, 'i') });
    if (result.deletedCount === 0) {
      console.log(`  NOT FOUND: ${email}`);
    } else {
      console.log(`  DELETED: ${email}`);
    }
  }

  console.log('\n=== Done ===\n');
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
