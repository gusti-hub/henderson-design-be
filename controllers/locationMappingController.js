// controllers/locationMappingController.js
const LocationMapping = require('../models/LocationMapping');

// Get all mappings with pagination and search
const getMappings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query = {
        $or: [
          { locationName: { $regex: search, $options: 'i' } },
          { floorPlanId: { $regex: search, $options: 'i' } },
          { locationId: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const total = await LocationMapping.countDocuments(query);
    const mappings = await LocationMapping.find(query)
      .populate('allowedProductIds', 'name') // Only populate name field
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({
      mappings,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error in getMappings:', error);
    res.status(500).json({ message: 'Error fetching mappings' });
  }
};

// Get single mapping
const getMapping = async (req, res) => {
  try {
    const mapping = await LocationMapping.findById(req.params.id)
      .populate('allowedProductIds', 'name product_id'); // Include both name and product_id
    
    if (!mapping) {
      return res.status(404).json({ message: 'Mapping not found' });
    }
    
    res.json(mapping);
  } catch (error) {
    console.error('Error in getMapping:', error);
    res.status(500).json({ message: 'Error fetching mapping' });
  }
};

// Create mapping
const createMapping = async (req, res) => {
  try {
    const { locationId, locationName, floorPlanId, allowedProductIds } = req.body;

    // Check if mapping already exists
    const existingMapping = await LocationMapping.findOne({ 
      locationId, 
      floorPlanId 
    });

    if (existingMapping) {
      return res.status(400).json({ 
        message: 'Mapping already exists for this location and floor plan' 
      });
    }

    const mapping = await LocationMapping.create({
      locationId,
      locationName,
      floorPlanId,
      allowedProductIds
    });

    res.status(201).json(mapping);
  } catch (error) {
    console.error('Error in createMapping:', error);
    res.status(400).json({ message: error.message });
  }
};

// Update mapping
const updateMapping = async (req, res) => {
  try {
    const { locationId, locationName, floorPlanId, allowedProductIds } = req.body;
    
    // Check for duplicate if locationId or floorPlanId is changed
    const existingMapping = await LocationMapping.findOne({
      _id: { $ne: req.params.id },
      locationId,
      floorPlanId
    });

    if (existingMapping) {
      return res.status(400).json({
        message: 'Mapping already exists for this location and floor plan'
      });
    }

    const mapping = await LocationMapping.findByIdAndUpdate(
      req.params.id,
      {
        locationId,
        locationName,
        floorPlanId,
        allowedProductIds
      },
      { new: true }
    ).populate('allowedProductIds', 'name');

    if (!mapping) {
      return res.status(404).json({ message: 'Mapping not found' });
    }

    res.json(mapping);
  } catch (error) {
    console.error('Error in updateMapping:', error);
    res.status(400).json({ message: error.message });
  }
};

// Delete mapping
const deleteMapping = async (req, res) => {
  try {
    const mapping = await LocationMapping.findByIdAndDelete(req.params.id);
    
    if (!mapping) {
      return res.status(404).json({ message: 'Mapping not found' });
    }

    res.json({ message: 'Mapping deleted successfully' });
  } catch (error) {
    console.error('Error in deleteMapping:', error);
    res.status(500).json({ message: 'Error deleting mapping' });
  }
};

// Get products for a specific location
const getLocationProducts = async (req, res) => {
  try {
    const { floorPlanId, locationId } = req.query;
    
    const mapping = await LocationMapping.findOne({
      floorPlanId,
      locationId
    }).populate({
      path: 'allowedProductIds',
      select: 'name product_id basePrice image' // Include necessary fields
    });

    if (!mapping) {
      return res.json({ products: [] });
    }

    res.json({ products: mapping.allowedProductIds });
  } catch (error) {
    console.error('Error in getLocationProducts:', error);
    res.status(500).json({ message: 'Error fetching products for location' });
  }
};

module.exports = {
  getMappings,
  getMapping,
  createMapping,
  updateMapping,
  deleteMapping,
  getLocationProducts
};