// backend/utils/clientCodeGenerator.js
const User = require('../models/User');

/**
 * Generate unique client code in format: ALI001, ALI002, ALI003, etc.
 * @returns {Promise<string>} Generated client code
 */
const generateClientCode = async () => {
  try {
    // Find the last user with clientCode (sorted descending)
    const lastUser = await User.findOne({ 
      clientCode: { $exists: true, $ne: null } 
    })
      .sort({ clientCode: -1 })
      .select('clientCode')
      .lean();
    
    let nextNumber = 1;
    
    if (lastUser && lastUser.clientCode) {
      // Extract number from "ALI001" → 001 → 1
      const match = lastUser.clientCode.match(/ALI(\d+)/);
      if (match) {
        const currentNumber = parseInt(match[1], 10);
        nextNumber = currentNumber + 1;
      }
    }
    
    // Format with leading zeros: 1 → "001", 23 → "023", 456 → "456"
    const clientCode = `ALI${String(nextNumber).padStart(3, '0')}`;
    
    console.log(`[ClientCode] Generated: ${clientCode}`);
    return clientCode;
  } catch (error) {
    console.error('[ClientCode] Error generating:', error);
    throw new Error('Failed to generate client code');
  }
};

/**
 * Validate client code format
 * @param {string} code - Client code to validate
 * @returns {boolean} True if valid
 */
const validateClientCode = (code) => {
  if (!code) return false;
  const pattern = /^ALI\d{3,}$/;
  return pattern.test(code);
};

module.exports = { 
  generateClientCode,
  validateClientCode
};