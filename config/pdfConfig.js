// config/pdfConfig.js

const generatePDF = async (htmlContent, options = {}) => {
    const html_to_pdf = require('html-pdf-node');
    
    // Default Chrome launch options
    const defaultOptions = {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--headless'
      ],
      executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser'
    };
  
    // Merge with user options
    const pdfOptions = {
      format: 'Letter',
      timeout: 60000,
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      ...options,
      args: [...(options.args || []), ...defaultOptions.args]
    };
  
    try {
      const file = { content: htmlContent };
      const pdfBuffer = await html_to_pdf.generatePdf(file, {
        ...pdfOptions,
        browserOptions: defaultOptions
      });
      return pdfBuffer;
    } catch (error) {
      console.error('PDF Generation Error:', error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  };
  
  module.exports = { generatePDF };