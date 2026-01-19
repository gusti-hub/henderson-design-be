// scripts/importVendorsFromFile.js

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
require('dotenv').config();

/**
 * Parse CSV/TXT line with comma delimiter
 * Handles quoted values with commas inside
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

async function importVendorsFromFile(filePath) {
  try {
    console.log('🚀 Starting vendor import...\n');

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get admin user for createdBy field
    const adminUser = await User.findOne({ role: 'admin' });
    const adminId = adminUser ? adminUser._id : null;

    if (adminUser) {
      console.log(`👤 Using admin: ${adminUser.name} (${adminUser.email})\n`);
    }

    // Read file
    console.log(`📄 Reading file: ${filePath}`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    console.log(`📊 Found ${lines.length} lines (including header)\n`);

    if (lines.length < 2) {
      console.error('❌ File must have at least a header and one data row');
      process.exit(1);
    }

    // Parse header
    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    console.log('📋 Headers:', headers.join(' | '));
    console.log('─'.repeat(80) + '\n');

    // Expected headers
    const expectedHeaders = {
      name: ['Name', 'name', 'Vendor Name', 'vendor_name'],
      website: ['Vendor Website', 'website', 'Website', 'vendor_website'],
      representativeName: ['Vendor Rep Name', 'rep_name', 'Representative', 'representative_name'],
      defaultMarkup: ['Default Markup', 'markup', 'Markup', 'default_markup'],
      phone: ['Phone', 'phone', 'Phone Number', 'phone_number'],
      email: ['Email', 'email', 'Email Address', 'email_address'],
      street: ['Street', 'street', 'Address', 'address'],
      city: ['City', 'city'],
      state: ['State', 'state'],
      zip: ['Zip', 'zip', 'Zip Code', 'zip_code', 'Postal Code'],
      notes: ['Note', 'note', 'Notes', 'notes', 'Description', 'description']
    };

    // Map headers to field indices
    const headerMap = {};
    for (const [field, variations] of Object.entries(expectedHeaders)) {
      const index = headers.findIndex(h => 
        variations.some(v => v.toLowerCase() === h.toLowerCase())
      );
      if (index !== -1) {
        headerMap[field] = index;
      }
    }

    console.log('🗺️  Header mapping:');
    Object.entries(headerMap).forEach(([field, index]) => {
      console.log(`   ${field.padEnd(20)} -> Column ${index + 1} (${headers[index]})`);
    });
    console.log('\n');

    // Check required fields
    if (headerMap.name === undefined) {
      console.error('❌ Required column "Name" not found in header');
      process.exit(1);
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Process data rows
    console.log('⚙️  Processing vendors...\n');
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        skippedCount++;
        continue;
      }

      const values = parseCSVLine(line);
      
      try {
        // Extract vendor data
        const vendorName = values[headerMap.name]?.trim();
        
        if (!vendorName) {
          console.log(`⏭️  Row ${i + 1}: Skipping - No name provided`);
          skippedCount++;
          continue;
        }

        // Generate vendor code
        const vendorCode = await Vendor.generateNextCode();

        // Extract other fields
        const phone = values[headerMap.phone]?.trim() || 'N/A';
        const rawEmail = values[headerMap.email]?.trim();
        const email = rawEmail || 
          `${vendorName.toLowerCase().replace(/[^a-z0-9]/g, '')}@placeholder.com`;
        
        let representativeName = values[headerMap.representativeName]?.trim() || '';
        
        // Try to extract rep name from notes if not provided
        if (!representativeName && headerMap.notes !== undefined) {
          const notes = values[headerMap.notes]?.trim() || '';
          const match = notes.match(/Rep Name:\s*(.+?)(?:\n|$)/i);
          if (match) {
            representativeName = match[1].trim();
          }
        }
        
        if (!representativeName) {
          representativeName = 'N/A';
        }

        const defaultMarkup = parseFloat(values[headerMap.defaultMarkup]) || 0;

        // Create vendor
        const newVendor = await Vendor.create({
          vendorCode,
          name: vendorName,
          website: values[headerMap.website]?.trim() || '',
          representativeName: representativeName,
          defaultMarkup: defaultMarkup,
          contactInfo: {
            phone: phone,
            email: email
          },
          address: {
            street: values[headerMap.street]?.trim() || '',
            city: values[headerMap.city]?.trim() || '',
            state: values[headerMap.state]?.trim() || '',
            zip: values[headerMap.zip]?.trim() || ''
          },
          notes: values[headerMap.notes]?.trim() || '',
          status: 'active',
          createdBy: adminId,
          modifiedBy: adminId
        });

        console.log(`✅ Row ${i + 1}: ${vendorCode} - ${vendorName}`);
        successCount++;
      } catch (error) {
        const vendorName = values[headerMap.name]?.trim() || `Row ${i + 1}`;
        console.error(`❌ Row ${i + 1}: ${vendorName} - ${error.message}`);
        errors.push({ 
          row: i + 1, 
          vendor: vendorName, 
          error: error.message 
        });
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Rows:     ${lines.length - 1} (excluding header)`);
    console.log(`✅ Success:     ${successCount}`);
    console.log(`❌ Errors:      ${errorCount}`);
    console.log(`⏭️  Skipped:     ${skippedCount}`);
    console.log('='.repeat(80));
    
    if (errors.length > 0) {
      console.log('\n❌ ERROR DETAILS:');
      console.log('─'.repeat(80));
      errors.forEach(err => {
        console.log(`Row ${err.row}: ${err.vendor}`);
        console.log(`  Error: ${err.error}\n`);
      });
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    console.log('🎉 Import completed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Get file path from command line argument
const filePath = process.argv[2];

if (!filePath) {
  console.error('❌ Please provide file path');
  console.log('\nUsage:');
  console.log('  node scripts/importVendorsFromFile.js <file-path>');
  console.log('\nExamples:');
  console.log('  node scripts/importVendorsFromFile.js ./data/vendors.csv');
  console.log('  node scripts/importVendorsFromFile.js ./data/vendors.txt');
  console.log('  node scripts/importVendorsFromFile.js C:\\Users\\Documents\\vendors.csv');
  console.log('');
  process.exit(1);
}

// Run import
importVendorsFromFile(filePath);