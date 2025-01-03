// controllers/dashboardController.js
const Order = require('../models/Order');
const html_to_pdf = require('html-pdf-node');

const getDashboardStats = async (req, res) => {
    try {
      // Get Recent Orders (last 10 orders)
      const recentOrders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('_id selectedPlan.clientInfo.name status createdAt clientInfo');
  
      // Count Orders by Status
      const [
        ongoingCount,
        confirmedCount,
        completedCount,
        totalOrderCount
      ] = await Promise.all([
        Order.countDocuments({ status: 'ongoing' }),
        Order.countDocuments({ status: 'confirmed' }),
        Order.countDocuments({ status: 'completed' }),
        Order.countDocuments()
      ]);
  
      // Get Top Products (grouped by product_id, finish, and fabric)
      const topProducts = await Order.aggregate([
        {
          $match: { status: { $in: ['confirmed', 'completed'] } }
        },
        {
          $unwind: '$selectedProducts'
        },
        {
          $group: {
            _id: {
              productId: '$selectedProducts.product_id',
              finish: '$selectedProducts.selectedOptions.finish',
              fabric: '$selectedProducts.selectedOptions.fabric'
            },
            productName: { $first: '$selectedProducts.name' },
            totalQuantity: { $sum: '$selectedProducts.quantity' },
            totalAmount: { $sum: '$selectedProducts.finalPrice' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { totalQuantity: -1 }
        },
        {
          $limit: 5
        }
      ]);
  
      // Calculate Total Revenue
      const revenue = await Order.aggregate([
        {
          $match: { status: { $in: ['confirmed', 'completed'] } }
        },
        {
          $unwind: '$selectedProducts'
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$selectedProducts.finalPrice' }
          }
        }
      ]);
  
      // Get Monthly Orders Count (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
      const monthlyOrders = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 },
            revenue: {
              $sum: {
                $reduce: {
                  input: '$selectedProducts',
                  initialValue: 0,
                  in: { $add: ['$$value', '$$this.finalPrice'] }
                }
              }
            }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);
  
      // Get Pending Payments Count
      const pendingPayments = await Order.countDocuments({
        'paymentDetails.installments': {
          $elemMatch: { status: 'pending' }
        }
      });
  
      // Format monthly data for chart
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedMonthlyData = monthlyOrders.map(item => ({
        month: monthNames[item._id.month - 1],
        year: item._id.year,
        orders: item.count,
        revenue: item.revenue
      }));
  
      // Compile all stats
      const stats = {
        overview: {
          totalOrders: totalOrderCount,
          ongoingOrders: ongoingCount,
          confirmedOrders: confirmedCount,
          completedOrders: completedCount,
          pendingPayments: pendingPayments,
          totalRevenue: revenue[0]?.total || 0
        },
        recentOrders: recentOrders.map(order => ({
          _id: order._id,
          clientName: order.selectedPlan?.clientInfo?.name || order.clientInfo?.name || 'N/A',
          status: order.status,
          createdAt: order.createdAt
        })),
        topProducts: topProducts.map(product => ({
          productId: product._id.productId,
          name: product.productName,
          finish: product._id.finish,
          fabric: product._id.fabric,
          quantity: product.totalQuantity,
          amount: product.totalAmount
        })),
        monthlyStats: formattedMonthlyData,
        orderDistribution: {
          ongoing: ongoingCount,
          confirmed: confirmedCount,
          completed: completedCount
        }
      };
  
      res.json(stats);
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({ message: error.message });
    }
};

const generatePurchaseOrder = async (req, res) => {
    try {
      const { orderIds } = req.body;
      
      if (!orderIds || orderIds.length === 0) {
        return res.status(400).json({ message: 'No orders selected' });
      }
  
      // Fetch all selected orders
      const orders = await Order.find({ _id: { $in: orderIds } });
  
      // Group products across all orders
      const groupedProducts = orders.reduce((acc, order) => {
        order.selectedProducts.forEach(product => {
          const key = `${product.product_id}-${product.selectedOptions.finish}-${product.selectedOptions.fabric}`;
          if (!acc[key]) {
            acc[key] = {
              productId: product.product_id,
              name: product.name,
              selectedOptions: product.selectedOptions,
              quantity: 0,
              unitPrice: product.unitPrice,
              totalPrice: 0,
              orders: new Set()
            };
          }
          acc[key].quantity += product.quantity;
          acc[key].totalPrice += product.finalPrice;
          acc[key].orders.add(order._id.toString());
        });
        return acc;
      }, {});
  
      // Generate HTML for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f5f5f5; }
              .header { text-align: center; margin-bottom: 30px; }
              .summary { margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>HENDERSON DESIGN GROUP</h1>
              <h2>Combined Purchase Order</h2>
              <p>Date: ${new Date().toLocaleDateString()}</p>
            </div>
  
            <table>
              <thead>
                <tr>
                  <th>Product ID</th>
                  <th>Name</th>
                  <th>Finish</th>
                  <th>Fabric</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total Price</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(groupedProducts).map(product => `
                  <tr>
                    <td>${product.productId}</td>
                    <td>${product.name}</td>
                    <td>${product.selectedOptions.finish}</td>
                    <td>${product.selectedOptions.fabric}</td>
                    <td>${product.quantity}</td>
                    <td>$${product.unitPrice.toFixed(2)}</td>
                    <td>$${product.totalPrice.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
  
            <div class="summary">
              <p>Total Orders: ${orderIds.length}</p>
              <p>Total Amount: $${Object.values(groupedProducts)
                .reduce((sum, p) => sum + p.totalPrice, 0)
                .toFixed(2)}</p>
              <p>Order IDs: ${orderIds.join(', ')}</p>
            </div>
          </body>
        </html>
      `;
  
      const options = {
        format: 'Letter',
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
      };
  
      const file = { content: htmlContent };
      const pdfBuffer = await html_to_pdf.generatePdf(file, options);
  
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=purchase-order-${Date.now()}.pdf`);
      res.send(pdfBuffer);
  
    } catch (error) {
      console.error('Error generating purchase order:', error);
      res.status(500).json({ message: 'Error generating purchase order' });
    }
  };

module.exports = {
  getDashboardStats,
  generatePurchaseOrder
};