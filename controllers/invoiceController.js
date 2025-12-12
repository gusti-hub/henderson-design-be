// controllers/invoiceController.js
const User = require('../models/User');

// Invoice Configuration
const INVOICE_CONFIGS = {
  15: {
    type: 'design-fee',
    title: '30% Deposit Invoice',
    percentage: 30,
    description: (collection, bedroomCount) => 
      `Design Fee Invoice (30%) - ${collection} - ${bedroomCount} Package`
  },
  43: {
    type: 'progress-50',
    title: 'Progress Payment Invoice (50%)',
    percentage: 20,
    description: (collection, bedroomCount) => 
      `Progress Payment (50% Total) - ${collection} - ${bedroomCount} Package`
  },
  58: {
    type: 'progress-75',
    title: 'Progress Payment Invoice (75%)',
    percentage: 25,
    description: (collection, bedroomCount) => 
      `Progress Payment (75% Total) - ${collection} - ${bedroomCount} Package`
  },
  67: {
    type: 'final-payment',
    title: 'Final Payment Invoice',
    percentage: 25,
    description: (collection, bedroomCount) => 
      `Final Payment (100% Complete) - ${collection} - ${bedroomCount} Package`
  }
};

// Helper: Calculate invoice amounts
function calculateInvoiceAmount(totalAmount, stepNumber) {
  const config = INVOICE_CONFIGS[stepNumber];
  if (!config) throw new Error(`Invalid step number: ${stepNumber}`);

  const invoiceAmount = Math.round(totalAmount * (config.percentage / 100));
  
  let cumulativePercentage = 0;
  if (stepNumber === 15) cumulativePercentage = 30;
  else if (stepNumber === 43) cumulativePercentage = 50;
  else if (stepNumber === 58) cumulativePercentage = 75;
  else if (stepNumber === 67) cumulativePercentage = 100;
  
  const cumulativeAmount = Math.round(totalAmount * (cumulativePercentage / 100));
  const previouslyPaid = cumulativeAmount - invoiceAmount;

  return {
    invoiceAmount,
    cumulativeAmount,
    previouslyPaid,
    remainingBalance: totalAmount - cumulativeAmount,
    currentPercentage: config.percentage,
    cumulativePercentage
  };
}

// ==================== EXPORTED FUNCTIONS ====================

// Generate Invoice
exports.generateInvoice = async (req, res) => {
  try {
    const { clientId, stepNumber } = req.params;
    const { bypassSequentialCheck } = req.body;

    console.log(`[INVOICE] Generating for client ${clientId}, step ${stepNumber}`);

    const step = parseInt(stepNumber);
    if (![15, 43, 58, 67].includes(step)) {
      return res.status(400).json({ 
        message: 'Invalid step number. Must be 15, 43, 58, or 67' 
      });
    }

    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (!client.clientCode) {
      return res.status(400).json({ 
        message: 'Client code is required to generate invoice' 
      });
    }

    if (!client.paymentInfo?.totalAmount || client.paymentInfo.totalAmount === 0) {
      return res.status(400).json({ 
        message: 'Total amount must be set before generating invoice' 
      });
    }

    if (!client.invoices) {
      client.invoices = [];
    }

    const existingInvoice = client.invoices.find(inv => inv.stepNumber === step);
    if (existingInvoice) {
      return res.status(200).json({ 
        message: `Invoice already exists for step ${step}`,
        invoice: existingInvoice
      });
    }

    const invoiceNumber = client.generateInvoiceNumber();
    const totalAmount = client.paymentInfo.totalAmount;
    const amounts = calculateInvoiceAmount(totalAmount, step);
    
    const taxRate = 0.0467;
    const taxAmount = Math.round(amounts.invoiceAmount * taxRate);
    const totalWithTax = amounts.invoiceAmount + taxAmount + 0.06;

    const config = INVOICE_CONFIGS[step];

    const invoice = {
      invoiceNumber,
      stepNumber: step,
      invoiceType: config.type,
      amount: amounts.invoiceAmount,
      percentage: config.percentage,
      description: config.description(
        client.collection || 'Collection',
        client.bedroomCount ? `${client.bedroomCount} Bedroom` : '1 Bedroom'
      ),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      generatedAt: new Date(),
      quickbooksSyncStatus: 'not-synced',
      paid: false,
      paidAmount: 0,
      totalAmount: totalAmount,
      taxAmount: taxAmount,
      totalWithTax: totalWithTax,
      cumulativeAmount: amounts.cumulativeAmount,
      previouslyPaid: amounts.previouslyPaid,
      remainingBalance: amounts.remainingBalance,
      cumulativePercentage: amounts.cumulativePercentage
    };

    client.invoices.push(invoice);
    await client.save();

    console.log(`[INVOICE] Generated ${invoiceNumber} successfully`);

    res.json({
      success: true,
      message: `Invoice ${invoiceNumber} generated successfully`,
      invoice
    });

  } catch (error) {
    console.error('[INVOICE] Generate error:', error);
    res.status(500).json({ 
      message: 'Failed to generate invoice', 
      error: error.message 
    });
  }
};

// Get Invoice Data
exports.getInvoiceData = async (req, res) => {
  try {
    const { clientId, invoiceNumber } = req.params;

    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const invoice = client.invoices?.find(inv => inv.invoiceNumber === invoiceNumber);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json({
      success: true,
      data: {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.generatedAt,
        dueDate: invoice.dueDate,
        clientName: client.name,
        unitNumber: client.unitNumber || 'N/A',
        email: client.email,
        totalAmount: invoice.totalAmount,
        invoiceAmount: invoice.amount,
        taxAmount: invoice.taxAmount,
        totalWithTax: invoice.totalWithTax,
        previouslyPaid: invoice.previouslyPaid,
        cumulativeAmount: invoice.cumulativeAmount,
        remainingBalance: invoice.remainingBalance,
        currentPercentage: invoice.percentage,
        cumulativePercentage: invoice.cumulativePercentage,
        description: invoice.description,
        collection: client.collection || 'Collection',
        bedroomCount: client.bedroomCount ? `${client.bedroomCount} Bedroom` : '1 Bedroom',
        packageType: client.packageType || 'Package',
        paid: invoice.paid,
        paidAmount: invoice.paidAmount,
        quickbooksSyncStatus: invoice.quickbooksSyncStatus
      }
    });

  } catch (error) {
    console.error('[INVOICE] Get data error:', error);
    res.status(500).json({ 
      message: 'Failed to get invoice data', 
      error: error.message 
    });
  }
};

// Get Client Invoices
exports.getClientInvoices = async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (!client.invoices) {
      client.invoices = [];
    }

    const invoices = client.invoices.map(inv => ({
      invoiceNumber: inv.invoiceNumber,
      stepNumber: inv.stepNumber,
      invoiceType: inv.invoiceType,
      amount: inv.amount,
      percentage: inv.percentage,
      description: inv.description,
      dueDate: inv.dueDate,
      generatedAt: inv.generatedAt,
      quickbooksId: inv.quickbooksId,
      quickbooksSyncStatus: inv.quickbooksSyncStatus,
      quickbooksSyncedAt: inv.quickbooksSyncedAt,
      paid: inv.paid,
      paidAt: inv.paidAt,
      paidAmount: inv.paidAmount
    }));

    res.json({
      success: true,
      count: invoices.length,
      invoices
    });

  } catch (error) {
    console.error('[INVOICE] Get invoices error:', error);
    res.status(500).json({ 
      message: 'Failed to get invoices', 
      error: error.message 
    });
  }
};

// Delete Invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const { clientId, invoiceNumber } = req.params;

    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (!client.invoices) {
      client.invoices = [];
    }

    const invoiceIndex = client.invoices.findIndex(inv => inv.invoiceNumber === invoiceNumber);
    if (invoiceIndex === -1) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const invoice = client.invoices[invoiceIndex];

    if (invoice.quickbooksSyncStatus === 'synced') {
      return res.status(400).json({ 
        message: 'Cannot delete invoice that has been synced to QuickBooks. Please void it in QuickBooks first.' 
      });
    }

    client.invoices.splice(invoiceIndex, 1);
    await client.save();

    console.log(`[INVOICE] Deleted ${invoiceNumber}`);

    res.json({
      success: true,
      message: `Invoice ${invoiceNumber} deleted successfully`
    });

  } catch (error) {
    console.error('[INVOICE] Delete error:', error);
    res.status(500).json({ 
      message: 'Failed to delete invoice', 
      error: error.message 
    });
  }
};