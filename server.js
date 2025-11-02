const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const profileRoutes = require('./routes/profileRoutes');
const trackActivity = require('./middleware/activityTracker');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Configure timeouts and limits for PDF generation
app.use((req, res, next) => {
  // Set timeout to 5 minutes
  req.setTimeout(300000);
  res.setTimeout(300000);
  next();
});

// Increase payload limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ 
  limit: '50mb', 
  extended: true 
}));

// Middleware
app.use(cors());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/activity', require('./routes/activityRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/location-mappings', require('./routes/locationMappingsRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/clients-portal', require('./routes/clientPortalRoutes'));
app.use('/api/questionnaires', require('./routes/questionnaireRoutes'));
app.use('/api/profile', profileRoutes);

// Enhanced error handling
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    path: req.path,
    method: req.method
  });

  if (err.name === 'TimeoutError') {
    return res.status(408).json({
      message: 'Request timeout - The operation took too long to complete'
    });
  }

  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

// Create server with proper timeouts
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Set keep-alive timeout
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Handle process errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});