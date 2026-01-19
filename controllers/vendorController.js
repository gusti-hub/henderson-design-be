const Vendor = require('../models/Vendor');

// Get all vendors with pagination
const getVendors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const skip = (page - 1) * limit;

    // Build search query
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
      vendorCode,
      name,
      website,
      representativeName,
      defaultMarkup,
      phone,
      email,
      street,
      city,
      state,
      zip,
      notes
    } = req.body;

    // Validate required fields
    if (!name || !representativeName || !phone || !email) {
      return res.status(400).json({ 
        message: 'Please provide all required fields' 
      });
    }

    // Generate vendor code if not provided
    let finalVendorCode = vendorCode;
    if (!finalVendorCode) {
      finalVendorCode = await Vendor.generateNextCode();
    } else {
      finalVendorCode = vendorCode.toUpperCase();
      // Check if vendor code already exists
      const vendorExists = await Vendor.findOne({ vendorCode: finalVendorCode });
      if (vendorExists) {
        return res.status(400).json({ 
          message: 'Vendor code already exists' 
        });
      }
    }

    // Check if email already exists
    const emailExists = await Vendor.findOne({ 'contactInfo.email': email });
    if (emailExists) {
      return res.status(400).json({ 
        message: 'Email already exists' 
      });
    }

    const vendor = await Vendor.create({
      vendorCode: finalVendorCode,
      name,
      website,
      representativeName,
      defaultMarkup: defaultMarkup || 0,
      contactInfo: {
        phone,
        email
      },
      address: {
        street,
        city,
        state,
        zip
      },
      notes,
      createdBy: req.user._id,
      modifiedBy: req.user._id
    });

    // Populate creator info
    const populatedVendor = await Vendor.findById(vendor._id)
      .populate('createdBy', 'name email')
      .populate('modifiedBy', 'name email');

    res.status(201).json(populatedVendor);
  } catch (error) {
    console.error('Error in createVendor:', error);
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
      vendorCode,
      name,
      website,
      representativeName,
      defaultMarkup,
      phone,
      email,
      street,
      city,
      state,
      zip,
      notes,
      status
    } = req.body;

    // Check vendor code uniqueness if it's being changed
    if (vendorCode && vendorCode.toUpperCase() !== vendor.vendorCode) {
      const codeExists = await Vendor.findOne({ vendorCode: vendorCode.toUpperCase() });
      if (codeExists) {
        return res.status(400).json({ message: 'Vendor code already in use' });
      }
    }

    // Check email uniqueness if it's being changed
    if (email && email !== vendor.contactInfo.email) {
      const emailExists = await Vendor.findOne({ 'contactInfo.email': email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    // Update fields
    if (vendorCode) vendor.vendorCode = vendorCode.toUpperCase();
    if (name) vendor.name = name;
    if (website !== undefined) vendor.website = website;
    if (representativeName) vendor.representativeName = representativeName;
    if (defaultMarkup !== undefined) vendor.defaultMarkup = defaultMarkup;
    if (phone) vendor.contactInfo.phone = phone;
    if (email) vendor.contactInfo.email = email;
    if (street !== undefined) vendor.address.street = street;
    if (city !== undefined) vendor.address.city = city;
    if (state !== undefined) vendor.address.state = state;
    if (zip !== undefined) vendor.address.zip = zip;
    if (notes !== undefined) vendor.notes = notes;
    if (status) vendor.status = status;
    
    vendor.modifiedBy = req.user._id;
    vendor.updatedAt = Date.now();

    await vendor.save();

    const updatedVendor = await Vendor.findById(vendor._id)
      .populate('createdBy', 'name email')
      .populate('modifiedBy', 'name email');

    res.json(updatedVendor);
  } catch (error) {
    console.error('Update vendor error:', error);
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
    
    // Average markup
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

// PENTING: Export semua fungsi
module.exports = {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  getVendorStats
};