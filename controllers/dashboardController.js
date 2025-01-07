// controllers/dashboardController.js
const Order = require('../models/Order');
const html_to_pdf = require('html-pdf-node');
const { generatePDF } = require('../config/pdfConfig');


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
    const orders = await Order.find({ _id: { $in: orderIds } }).populate('user');
    const currentDate = new Date().toLocaleDateString();
    const orderNumber = `HDG-${Date.now().toString().slice(-6)}`;

    // Simplified HTML generation - avoid complex calculations in template
    const headerTemplate = `
      <div class="company-header">
        74-5518 Kaiwi Street Suite B<br>
        Kailua Kona, HI 96740-3145<br>
        (808) 315-8782<br>
        Fax:
      </div>
      <div class="company-logo">
        <div class="company-name">HENDERSON</div>
        <div class="company-tagline">DESIGN GROUP</div>
      </div>`;

    // Pre-process products to simplify template generation
    const allProducts = orders.flatMap(order => 
      order.selectedProducts.map(product => ({
        image: product.selectedOptions?.image,
        name: product.name,
        quantity: product.quantity || 1,
        fabric: product.selectedOptions?.fabric || '',
        finish: product.selectedOptions?.finish || '',
        unitPrice: product.unitPrice?.toFixed(2) || '0.00',
        finalPrice: product.finalPrice?.toFixed(2) || '0.00'
      }))
    );

    // Calculate totals beforehand
    const totalAmount = orders.reduce((sum, order) => 
      sum + order.selectedProducts.reduce((sum, product) => sum + (product.finalPrice || 0), 0), 0);

    let htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page { size: Letter; margin: 0.5in; }
            body { 
              font-family: Arial, sans-serif;
              font-size: 11pt;
              line-height: 1.3;
              margin: 0;
              padding: 0;
            }
            .page { page-break-after: always; }
            .page:last-child { page-break-after: auto; }
            .company-header { margin-bottom: 20px; }
            .company-logo {
              position: absolute;
              top: 0;
              right: 0;
              text-align: right;
            }
            .company-name {
              color: rgb(0, 86, 112);
              font-size: 26pt;
              margin: 0;
            }
            .company-tagline {
              color: rgb(0, 86, 112);
              font-size: 12pt;
              margin: 0;
            }
            .order-title {
              font-weight: bold;
              font-size: 12pt;
              margin: 20px 0;
              border-bottom: 1px solid black;
              padding-bottom: 5px;
            }
            .main-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              border-bottom: 1px solid black;
              margin-bottom: 10px;
              position: relative;
            }
            .main-grid::after {
              content: '';
              position: absolute;
              top: 0;
              bottom: 0;
              left: 50%;
              width: 1px;
              background-color: black;
            }
            .ship-to, .comments {
              border-bottom: 1px solid black;
              margin-bottom: 10px;
              padding-bottom: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid black;
              padding: 8px;
              height: 150px;
            }
            th {
              background-color: #808080;
              color: white;
              height: auto;
            }
            .product-container {
              display: grid;
              grid-template-columns: 100px 1fr;
              gap: 10px;
              height: 134px;
            }
            .product-image {
              width: 100px;
              height: 134px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .product-image img {
              max-width: 100px;
              max-height: 134px;
              object-fit: contain;
            }
            .cost-cell { text-align: right; }
          </style>
        </head>
        <body>`;

    // Generate pages with proper product distribution
    let currentIndex = 0;
    let pageCount = 0;
    while (currentIndex < allProducts.length) {
      const productsPerPage = pageCount === 0 ? 2 : // First page
                             currentIndex + 5 <= allProducts.length ? 5 : // Middle pages
                             Math.min(4, allProducts.length - currentIndex); // Last page

      const pageProducts = allProducts.slice(currentIndex, currentIndex + productsPerPage);
      
      htmlContent += `
        <div class="page">
          ${pageCount === 0 ? `
            ${headerTemplate}
            <div class="order-title">Purchase Order</div>
            <div class="main-grid">
              <div class="left-section">
                <div><b>To:</b><br>
                  ${orders[0]?.selectedPlan?.clientInfo?.name || ''}<br>
                  ${orders[0]?.selectedPlan?.clientInfo?.unitNumber || ''}</div>
                <div><b>Attention:</b></div>
                <div><b>Phone:</b></div>
                <div><b>Fax:</b></div>
              </div>
              <div class="right-section">
                <div><b>Order #:</b> ${orderNumber}</div>
                <div><b>Order Date:</b> ${currentDate}</div>
                <div><b>Printed Date:</b> ${currentDate}</div>
                <div><b>Account Number:</b> ${orders[0]?._id?.toString().slice(-5) || ''}</div>
                <div><b>Rep Name:</b></div>
                <div><b>Rep Phone:</b></div>
                <div><b>Rep Email:</b></div>
                <div><b>Terms:</b></div>
                <div><b>Client:</b></div>
                <div><b>Estimate #:</b></div>
              </div>
            </div>
            <div class="ship-to">
              <div><b>Ship To:</b></div>
              <div><b>Attention:</b></div>
            </div>
            <div class="comments">
              <div><b>Comments:</b></div>
              <div><b>Notes:</b></div>
            </div>
          ` : ''}
          <table>
            ${pageCount === 0 ? `
              <thead>
                <tr>
                  <th style="width: 60%">Description</th>
                  <th style="width: 20%">Unit Cost</th>
                  <th style="width: 20%">Total Cost</th>
                </tr>
              </thead>` : ''}
            <tbody>
              ${pageProducts.map(product => `
                <tr>
                  <td>
                    <div class="product-container">
                      <div class="product-image">
                        ${product.image ? 
                          `<img src="${product.image}" alt="${product.name}">` : 
                          '<div style="width:100px;height:100px;background:#f0f0f0"></div>'}
                      </div>
                      <div class="product-specs">
                        <div>Quantity: ${product.quantity}</div>
                        <div>Fabric: ${product.fabric}</div>
                        <div>Finish: ${product.finish}</div>
                      </div>
                    </div>
                  </td>
                  <td class="cost-cell">$${product.unitPrice}</td>
                  <td class="cost-cell">$${product.finalPrice}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${pageCount === Math.ceil((allProducts.length - 2) / 5) ? `
            <div style="margin-top: 20px; text-align: right;">
              <div><b>Sub Total:</b> $${totalAmount.toFixed(2)}</div>
              <div><b>Shipping:</b> $0.00</div>
              <div><b>Others:</b> $0.00</div>
              <div><b>Total:</b> $${totalAmount.toFixed(2)}</div>
            </div>` : ''}
        </div>`;

      currentIndex += productsPerPage;
      pageCount++;
    }

    htmlContent += '</body></html>';

    const pdfBuffer = await generatePDF(htmlContent, {
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=proposal-${order._id}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
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