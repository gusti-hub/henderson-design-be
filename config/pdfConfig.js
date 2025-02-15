// config/pdfConfig.js

const generatePDF = async (htmlContent, options = {}) => {
  const html_to_pdf = require('html-pdf-node');
  
  // Enhanced Chrome launch options
  const defaultOptions = {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--headless',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-extensions'
    ],
    executablePath: process.env.CHROME_BIN || '/usr/bin/chromium-browser',
    headless: true,
    ignoreHTTPSErrors: true,
    timeout: 120000  // This doesn't affect page.setContent timeout
  };

  // Enhanced PDF options
  const pdfOptions = {
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    ...options
  };

  try {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Create a custom browser instance to set timeouts
        const browser = await require('puppeteer').launch(defaultOptions);
        try {
          const page = await browser.newPage();
          
          // Set various timeouts
          await page.setDefaultNavigationTimeout(120000);
          await page.setDefaultTimeout(120000);
          
          // Set content with explicit waitUntil options
          await page.setContent(htmlContent, {
            waitUntil: ['load', 'networkidle0'],
            timeout: 120000
          });

          // Generate PDF with page instance
          const pdfBuffer = await page.pdf(pdfOptions);
          
          return pdfBuffer;
        } finally {
          await browser.close();
        }
      } catch (error) {
        lastError = error;
        console.error(`PDF Generation Attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      }
    }
    
    throw lastError;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

module.exports = { generatePDF };