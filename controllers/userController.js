const User = require('../models/User');
const bcrypt = require('bcryptjs');


// Get admin users with pagination
const getAdminUsers = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const skip = (page - 1) * limit;
  
      // Create search query
      const searchQuery = {
        role: 'admin',
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
  
      const total = await User.countDocuments(searchQuery);
      const users = await User.find(searchQuery)
        .select('-password')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      res.json({
        users,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  
  
  // Create admin user with validation
  const createAdminUser = async (req, res) => {
    try {
      const { email, name, password } = req.body;
  
      // Validate input
      if (!email || !name || !password) {
        return res.status(400).json({ 
          message: 'Please provide all required fields' 
        });
      }
  
      // Check if user exists
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ 
          message: 'User with this email already exists' 
        });
      }
  
      const adminUser = await User.create({ 
        email,
        name,
        password,
        role: 'admin'
      });
  
      res.status(201).json({
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role
      });
    } catch (error) {
      console.error('Error in createAdminUser:', error);
      res.status(500).json({ 
        message: 'Error creating admin user',
        error: error.message 
      });
    }
  };

// Update admin user
const updateAdminUser = async (req, res) => {
    try {
        // Find user and include password field
        const user = await User.findById(req.params.id);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
    
        const { name, email, password, role } = req.body;
    
        // Check email uniqueness if it's being changed
        if (email && email !== user.email) {
          const emailExists = await User.findOne({ email });
          if (emailExists) {
            return res.status(400).json({ message: 'Email already in use' });
          }
        }
    
        // Update basic fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (role) user.role = role;
    
        // Handle password update if provided
        if (password) {
          // Directly hash the password using bcrypt
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);
          
          // Update user with new hashed password
          await User.findByIdAndUpdate(user._id, {
            name: name || user.name,
            email: email || user.email,
            role: role || user.role,
            password: hashedPassword
          });
        } else {
          // Update without changing password
          await User.findByIdAndUpdate(user._id, {
            name: name || user.name,
            email: email || user.email,
            role: role || user.role
          });
        }
    
        // Fetch updated user (without password)
        const updatedUser = await User.findById(user._id).select('-password');
    
        res.json(updatedUser);
      } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Error updating user' });
      }
};

// Delete admin user
const deleteAdminUser = async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ 
      _id: req.params.id, 
      role: 'admin' 
    });
    
    if (!user) {
      return res.status(404).json({ message: 'Admin user not found' });
    }
    res.json({ message: 'Admin user deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update current user profile
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email, currentPassword, newPassword } = req.body;

    // Check email uniqueness if changed
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    // Handle password change
    if (currentPassword && newPassword) {
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      user.password = newPassword; // will be hashed by pre-save hook
    }

    if (name) user.name = name;
    if (email) user.email = email;

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');
    res.json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getProfile,        // ← tambahkan ini
  updateProfile      // ← tambahkan ini
};