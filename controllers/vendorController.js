// controllers/vendorController.js

const Vendor = require('../models/Vendor');

// Get all vendors with pagination
const getVendors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const skip = (page - 1) * limit;

    let searchQuery = {};
    
    if (search) {
      searchQuery.$or = [
        { vendorCode: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { representativeName: { $regex: search, $options: 'i' } },
        { 'contactInfo.email': { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      searchQuery.status = status;
    }

    const total = await Vendor.countDocuments(searchQuery);
    const vendors = await Vendor.find(searchQuery)
      .populate('createdBy', 'name email')
      .populate('modifiedBy', 'name email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      vendors,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error in getVendors:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get single vendor
const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('modifiedBy', 'name email');
    
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    
    res.json(vendor);
  } catch (error) {
    console.error('Get vendor error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Create vendor
const createVendor = async (req, res) => {
  try {
    const {
      name,
      website,
      defaultMarkup,
      defaultDiscount,
      vendorDepositRequested,
      phone,
      email,
      fax,
      street,
      city,
      state,
      zip,
      country,
      accountNumber,
      tags,
      loginUsername,
      loginPassword,
      vendorRepName,
      orderMethod,
      paymentMethod,
      terms,
      notes
    } = req.body;

    // Validate required fields
    if (!name || !phone || !email) {
      return res.status(400).json({ 
        message: 'Please provide all required fields' 
      });
    }

    // Check if email already exists (before generating code)
    const emailExists = await Vendor.findOne({ 'contactInfo.email': email });
    if (emailExists) {
      return res.status(400).json({ 
        message: 'Email already exists' 
      });
    }

    // ✅ Auto-generate vendor code (optimized - single query)
    const vendorCode = await Vendor.generateNextCode();
    console.log('✅ Auto-generated vendor code:', vendorCode);

    const vendor = await Vendor.create({
      vendorCode: vendorCode,
      name,
      website,
      defaultMarkup: defaultMarkup || 0,
      defaultDiscount: defaultDiscount || 0,
      vendorDepositRequested: vendorDepositRequested || 0,
      contactInfo: {
        phone,
        email,
        fax: fax || ''
      },
      address: {
        street: street || '',
        city: city || '',
        state: state || '',
        zip: zip || '',
        country: country || ''
      },
      accountNumber: accountNumber || '',
      tags: tags || '',
      loginCredentials: {
        username: loginUsername || '',
        password: loginPassword || '',
        vendorRepName: vendorRepName || ''
      },
      termsAndPayment: {
        orderMethod: orderMethod || '',
        paymentMethod: paymentMethod || '',
        terms: terms || ''
      },
      notes: notes || '',
      createdBy: req.user._id,
      modifiedBy: req.user._id
    });

    // Populate creator info
    const populatedVendor = await Vendor.findById(vendor._id)
      .populate('createdBy', 'name email')
      .populate('modifiedBy', 'name email');

    console.log('✅ Vendor created successfully:', {
      code: populatedVendor.vendorCode,
      name: populatedVendor.name
    });

    res.status(201).json(populatedVendor);
  } catch (error) {
    console.error('Error in createVendor:', error);
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      if (error.keyPattern?.vendorCode) {
        // This should rarely happen with our optimized logic
        return res.status(409).json({ 
          message: 'Vendor code conflict detected. Please try again.' 
        });
      }
      if (error.keyPattern?.['contactInfo.email']) {
        return res.status(400).json({ 
          message: 'Email already exists' 
        });
      }
    }
    
    res.status(500).json({ 
      message: 'Error creating vendor',
      error: error.message 
    });
  }
};

// Update vendor
const updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const {
      name,
      website,
      defaultMarkup,
      defaultDiscount,
      vendorDepositRequested,
      phone,
      email,
      fax,
      street,
      city,
      state,
      zip,
      country,
      accountNumber,
      tags,
      loginUsername,
      loginPassword,
      vendorRepName,
      orderMethod,
      paymentMethod,
      terms,
      notes,
      status
    } = req.body;

    // Check email uniqueness if it's being changed
    if (email && email !== vendor.contactInfo.email) {
      const emailExists = await Vendor.findOne({ 
        'contactInfo.email': email,
        _id: { $ne: vendor._id }
      });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    // Update basic fields (vendor code is never updated)
    if (name) vendor.name = name;
    if (website !== undefined) vendor.website = website;
    if (defaultMarkup !== undefined) vendor.defaultMarkup = defaultMarkup;
    if (defaultDiscount !== undefined) vendor.defaultDiscount = defaultDiscount;
    if (vendorDepositRequested !== undefined) vendor.vendorDepositRequested = vendorDepositRequested;
    
    // Update contact info
    if (phone) vendor.contactInfo.phone = phone;
    if (email) vendor.contactInfo.email = email;
    if (fax !== undefined) vendor.contactInfo.fax = fax;
    
    // Update address
    if (street !== undefined) vendor.address.street = street;
    if (city !== undefined) vendor.address.city = city;
    if (state !== undefined) vendor.address.state = state;
    if (zip !== undefined) vendor.address.zip = zip;
    if (country !== undefined) vendor.address.country = country;
    
    // Update other fields
    if (accountNumber !== undefined) vendor.accountNumber = accountNumber;
    if (tags !== undefined) vendor.tags = tags;
    
    // Update login credentials
    if (loginUsername !== undefined) vendor.loginCredentials.username = loginUsername;
    if (loginPassword !== undefined) vendor.loginCredentials.password = loginPassword;
    if (vendorRepName !== undefined) vendor.loginCredentials.vendorRepName = vendorRepName;
    
    // Update terms and payment
    if (orderMethod !== undefined) vendor.termsAndPayment.orderMethod = orderMethod;
    if (paymentMethod !== undefined) vendor.termsAndPayment.paymentMethod = paymentMethod;
    if (terms !== undefined) vendor.termsAndPayment.terms = terms;
    
    if (notes !== undefined) vendor.notes = notes;
    if (status) vendor.status = status;
    
    vendor.modifiedBy = req.user._id;
    vendor.updatedAt = Date.now();

    await vendor.save();

    const updatedVendor = await Vendor.findById(vendor._id)
      .populate('createdBy', 'name email')
      .populate('modifiedBy', 'name email');

    console.log('✅ Vendor updated:', {
      code: updatedVendor.vendorCode,
      name: updatedVendor.name
    });

    res.json(updatedVendor);
  } catch (error) {
    console.error('Update vendor error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field === 'vendorCode' ? 'Vendor code' : 'Email'} already in use` 
      });
    }
    
    res.status(500).json({ message: 'Error updating vendor' });
  }
};

// Delete vendor
const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    
    console.log('✅ Vendor deleted:', vendor.vendorCode);
    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get vendor statistics
const getVendorStats = async (req, res) => {
  try {
    const totalVendors = await Vendor.countDocuments();
    const activeVendors = await Vendor.countDocuments({ status: 'active' });
    const inactiveVendors = await Vendor.countDocuments({ status: 'inactive' });
    
    const avgMarkupResult = await Vendor.aggregate([
      {
        $group: {
          _id: null,
          avgMarkup: { $avg: '$defaultMarkup' }
        }
      }
    ]);
    
    const avgMarkup = avgMarkupResult.length > 0 ? avgMarkupResult[0].avgMarkup : 0;

    res.json({
      totalVendors,
      activeVendors,
      inactiveVendors,
      avgMarkup: avgMarkup.toFixed(2)
    });
  } catch (error) {
    console.error('Get vendor stats error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  getVendorStats
};