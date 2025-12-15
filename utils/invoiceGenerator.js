// utils/invoiceGenerator.js
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Invoice Configuration
 */
const INVOICE_CONFIGS = {
  16: {
    type: 'design-fee',
    title: 'Design Fee Invoice (30%)',
    percentage: 30,
    template: 'Invoice_Template_With_Placeholders.docx',
    description: (collection, bedroomCount) => 
      `Design Fee Invoice (30%) - ${collection} - ${bedroomCount} Bedroom Package`
  },
  43: {
    type: 'progress-50',
    title: 'Progress Payment Invoice (50%)',
    percentage: 20, // Additional 20% to reach 50% total
    template: 'Invoice_Template_With_Placeholders.docx',
    description: (collection, bedroomCount) => 
      `Progress Payment (50% Total) - ${collection} - ${bedroomCount} Bedroom Package`
  },
  58: {
    type: 'progress-75',
    title: 'Progress Payment Invoice (75%)',
    percentage: 25, // Additional 25% to reach 75% total
    template: 'Invoice_Template_With_Placeholders.docx',
    description: (collection, bedroomCount) => 
      `Progress Payment (75% Total) - ${collection} - ${bedroomCount} Bedroom Package`
  },
  67: {
    type: 'final-payment',
    title: 'Final Payment Invoice',
    percentage: 25, // Final 25% to reach 100% total
    template: 'Invoice_Template_With_Placeholders.docx',
    description: (collection, bedroomCount) => 
      `Final Payment (100% Complete) - ${collection} - ${bedroomCount} Bedroom Package`
  }
};

/**
 * Generate Invoice DOCX
 * @param {Object} client - User/Client object
 * @param {Number} stepNumber - Step number (16, 43, 58, or 67)
 * @param {String} invoiceNumber - Generated invoice number (e.g., ALIA0006-01)
 * @returns {Buffer} - DOCX file buffer
 */
const generateInvoiceDOCX = async (client, stepNumber, invoiceNumber) => {
  console.log(`>>> GENERATING INVOICE FOR STEP ${stepNumber} <<<`);

  try {
    // Validate step number
    if (![16, 43, 58, 67].includes(stepNumber)) {
      throw new Error(`Invalid step number: ${stepNumber}. Must be 16, 43, 58, or 67`);
    }

    const config = INVOICE_CONFIGS[stepNumber];
    const templatePath = path.join(__dirname, 'templates', config.template);
    const tempDir = '/tmp/invoice-generator';
    const timestamp = Date.now();
    const outputDocx = path.join(tempDir, `invoice_${invoiceNumber}_${timestamp}.docx`);

    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });
    
    // Check template exists
    try {
      await fs.access(templatePath);
    } catch (error) {
      throw new Error(`Template not found: ${config.template}`);
    }

    // Calculate amounts
    const totalAmount = client.paymentInfo?.totalAmount || 0;
    const invoiceAmount = Math.round(totalAmount * (config.percentage / 100));
    
    // Calculate cumulative total paid including this invoice
    let cumulativePercentage = 0;
    if (stepNumber === 16) cumulativePercentage = 30;
    else if (stepNumber === 43) cumulativePercentage = 50;
    else if (stepNumber === 58) cumulativePercentage = 75;
    else if (stepNumber === 67) cumulativePercentage = 100;
    
    const cumulativeAmount = Math.round(totalAmount * (cumulativePercentage / 100));
    const previouslyPaid = cumulativeAmount - invoiceAmount;

    // Prepare invoice data
    const invoiceData = {
      // Invoice Header
      invoiceNumber: invoiceNumber,
      invoiceDate: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }),
      effectiveDate: new Date().toLocaleDateString('en-US', { 
        month: '2-digit',
        day: '2-digit', 
        year: '2-digit'
      }),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }),
      
      // Client Information
      clientName: client.name || 'Client Name',
      clientEmail: client.email || '',
      email: client.email || '',  // Add email for template
      unitNumber: client.unitNumber || '________',
      floorPlan: client.floorPlan || '________',
      clientCode: client.clientCode || 'N/A',
      
      // Collection & Package Info
      collection: client.collection || 'Collection',
      collectionType: client.collection || 'Collection',
      bedroomCount: client.bedroomCount ? `${client.bedroomCount} Bedroom` : '1 Bedroom',
      packageType: client.collection ? `${client.collection} - ${client.bedroomCount} Bedroom` : 'Package',
      
      // Amounts
      totalAmount: `$${totalAmount.toLocaleString()}`,
      invoiceAmount: `$${invoiceAmount.toLocaleString()}`,
      designFeeAmount: `$${invoiceAmount.toLocaleString()}`,
      currentPaymentAmount: `$${invoiceAmount.toLocaleString()}`,
      cumulativeAmount: `$${cumulativeAmount.toLocaleString()}`,
      previouslyPaid: `$${previouslyPaid.toLocaleString()}`,
      remainingBalance: `$${(totalAmount - cumulativeAmount).toLocaleString()}`,
      
      // Percentages
      currentPercentage: `${config.percentage}%`,
      cumulativePercentage: `${cumulativePercentage}%`,
      
      // Description
      description: config.description(
        client.collection || 'Collection',
        client.bedroomCount ? `${client.bedroomCount} Bedroom` : '1 Bedroom'
      ),
      invoiceTitle: config.title,
      
      // Company Info
      companyName: 'Henderson Design Group',
      companyAddress: 'Aloha Tower Marketplace',
      companyCity: 'Honolulu, HI 96813',
      companyEmail: 'aloha@henderson.house',
      companyWebsite: 'henderson.house',
      
      // Payment Terms
      paymentTerms: 'Net 30 days',
      paymentMethods: 'Bank Transfer, Credit Card, Check'
    };

    // Add aliases for common template variations
    // Some templates use different placeholder names
    invoiceData.currentAmount = invoiceData.invoiceAmount;
    invoiceData.dueAmount = invoiceData.invoiceAmount;
    invoiceData.amountDue = invoiceData.invoiceAmount;
    invoiceData.paymentAmount = invoiceData.invoiceAmount;

    // Save to JSON file for Python script
    const dataPath = path.join(tempDir, `data_${timestamp}.json`);
    await fs.writeFile(dataPath, JSON.stringify(invoiceData, null, 2));

    // Python script to modify DOCX  
    const pythonScript = `
import json
from docx import Document

with open("${dataPath.replace(/\\/g, '/')}", 'r') as f:
    data = json.load(f)

doc = Document("${templatePath.replace(/\\/g, '/')}")

def merge_runs(paragraph):
    """Merge all runs in paragraph to avoid split placeholder issue"""
    if not paragraph.runs:
        return
    
    # Get full text
    full_text = ''.join([run.text for run in paragraph.runs])
    
    # Clear all runs
    for _ in range(len(paragraph.runs)):
        p_element = paragraph._element
        p_element.remove(paragraph.runs[0]._element)
    
    # Add single run with full text
    paragraph.add_run(full_text)

def replace_placeholders(paragraph, data):
    """Replace all placeholders in paragraph"""
    if not paragraph.runs:
        return
    
    # Merge runs first to handle split placeholders
    merge_runs(paragraph)
    
    # Now replace in the single run
    if paragraph.runs:
        text = paragraph.runs[0].text
        for key, value in data.items():
            placeholder = "{{" + key + "}}"
            text = text.replace(placeholder, str(value))
        paragraph.runs[0].text = text

# Process paragraphs
for paragraph in doc.paragraphs:
    if '{{' in paragraph.text:
        replace_placeholders(paragraph, data)

# Process tables
for table in doc.tables:
    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                if '{{' in paragraph.text:
                    replace_placeholders(paragraph, data)

# Process headers and footers
for section in doc.sections:
    # Headers
    for header in [section.header, section.first_page_header, section.even_page_header]:
        try:
            for paragraph in header.paragraphs:
                if '{{' in paragraph.text:
                    replace_placeholders(paragraph, data)
            # Process tables in headers
            for table in header.tables:
                for row in table.rows:
                    for cell in row.cells:
                        for paragraph in cell.paragraphs:
                            if '{{' in paragraph.text:
                                replace_placeholders(paragraph, data)
        except:
            pass
    
    # Footers
    for footer in [section.footer, section.first_page_footer, section.even_page_footer]:
        try:
            for paragraph in footer.paragraphs:
                if '{{' in paragraph.text:
                    replace_placeholders(paragraph, data)
            # Process tables in footers
            for table in footer.tables:
                for row in table.rows:
                    for cell in row.cells:
                        for paragraph in cell.paragraphs:
                            if '{{' in paragraph.text:
                                replace_placeholders(paragraph, data)
        except:
            pass

doc.save("${outputDocx.replace(/\\/g, '/')}")
print("SUCCESS")
`;

    const scriptPath = path.join(tempDir, `modify_invoice_${timestamp}.py`);
    await fs.writeFile(scriptPath, pythonScript);

    // Execute Python script with better error handling
    const pythonCmd = 'python3';
    console.log(`Executing Python script to replace placeholders...`);
    console.log(`Template: ${templatePath}`);
    console.log(`Output: ${outputDocx}`);
    
    const { stdout, stderr } = await execPromise(`${pythonCmd} "${scriptPath}"`);

    console.log(`Python stdout: ${stdout}`);
    if (stderr) console.log(`Python stderr: ${stderr}`);

    if (!stdout.includes('SUCCESS')) {
      console.error('Python script did not complete successfully');
      console.error('stdout:', stdout);
      console.error('stderr:', stderr);
      throw new Error(`Python script failed: ${stderr || 'Unknown error'}`);
    }

    console.log(`✓ Invoice DOCX created: ${invoiceNumber}`);

    // Read the generated DOCX
    const docxBuffer = await fs.readFile(outputDocx);

    // Cleanup temporary files
    await fs.unlink(scriptPath).catch(() => {});
    await fs.unlink(dataPath).catch(() => {});
    await fs.unlink(outputDocx).catch(() => {});

    return docxBuffer;

  } catch (error) {
    console.error('Invoice generation error:', error.message);
    throw error;
  }
};

/**
 * Get Invoice Configuration
 * @param {Number} stepNumber - Step number
 * @returns {Object} - Invoice config
 */
const getInvoiceConfig = (stepNumber) => {
  return INVOICE_CONFIGS[stepNumber] || null;
};

/**
 * Calculate Invoice Amount
 * @param {Number} totalAmount - Total project amount
 * @param {Number} stepNumber - Step number
 * @returns {Object} - Amount breakdown
 */
const calculateInvoiceAmount = (totalAmount, stepNumber) => {
  const config = INVOICE_CONFIGS[stepNumber];
  if (!config) {
    throw new Error(`Invalid step number: ${stepNumber}`);
  }

  const invoiceAmount = Math.round(totalAmount * (config.percentage / 100));
  
  let cumulativePercentage = 0;
  if (stepNumber === 16) cumulativePercentage = 30;
  else if (stepNumber === 43) cumulativePercentage = 50;
  else if (stepNumber === 58) cumulativePercentage = 75;
  else if (stepNumber === 67) cumulativePercentage = 100;
  
  const cumulativeAmount = Math.round(totalAmount * (cumulativePercentage / 100));
  const previouslyPaid = cumulativeAmount - invoiceAmount;
  const remainingBalance = totalAmount - cumulativeAmount;

  return {
    invoiceAmount,
    percentage: config.percentage,
    cumulativeAmount,
    cumulativePercentage,
    previouslyPaid,
    remainingBalance,
    description: config.description
  };
};

module.exports = {
  generateInvoiceDOCX,
  getInvoiceConfig,
  calculateInvoiceAmount,
  INVOICE_CONFIGS
};