// utils/quickbooksClient.js - SECURE VERSION with .env
const axios = require('axios');

/**
 * QuickBooks Configuration - FROM ENVIRONMENT VARIABLES
 */
const QUICKBOOKS_CONFIG = {
  clientId: process.env.QUICKBOOKS_CLIENT_ID || 'ABnClFfpOy8b037cefQMShOEWhBAhBpofiytDzJLQ7i82WyDtu',
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || 'IhxBfIvXwnNttRG8EgMjk327sofxEONjDF0FBm7c',
  environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
  redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:5000/api/quickbooks/callback',
  scopes: 'com.intuit.quickbooks.accounting'
};

// Log configuration (hide secrets)
console.log('QuickBooks Config:', {
  clientId: QUICKBOOKS_CONFIG.clientId ? `${QUICKBOOKS_CONFIG.clientId.substring(0, 10)}...` : 'NOT SET',
  clientSecret: QUICKBOOKS_CONFIG.clientSecret ? '***HIDDEN***' : 'NOT SET',
  environment: QUICKBOOKS_CONFIG.environment,
  redirectUri: QUICKBOOKS_CONFIG.redirectUri,
  scopes: QUICKBOOKS_CONFIG.scopes
});

const BASE_URL = QUICKBOOKS_CONFIG.environment === 'production' 
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com';

/**
 * QuickBooks Client Class
 */
class QuickBooksClient {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.realmId = null;
    this.tokenExpiry = null;
  }

  /**
   * Set tokens
   */
  setTokens(accessToken, refreshToken, realmId, expiresIn = 3600) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.realmId = realmId;
    this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired() {
    if (!this.tokenExpiry) return true;
    return new Date() >= this.tokenExpiry;
  }

  /**
   * Get OAuth Authorization URL
   */
  getAuthorizationUrl(state = 'random-state-string') {
    const authUrl = `https://appcenter.intuit.com/connect/oauth2`;
    const params = new URLSearchParams({
      client_id: QUICKBOOKS_CONFIG.clientId,
      redirect_uri: QUICKBOOKS_CONFIG.redirectUri,
      response_type: 'code',
      scope: QUICKBOOKS_CONFIG.scopes,
      state: state
    });
    
    const fullUrl = `${authUrl}?${params.toString()}`;
    console.log('Generated OAuth URL:', fullUrl);
    
    return fullUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code) {
    try {
      const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
      const auth = Buffer.from(`${QUICKBOOKS_CONFIG.clientId}:${QUICKBOOKS_CONFIG.clientSecret}`).toString('base64');

      console.log('Exchanging code for tokens...');
      console.log('Token URL:', tokenUrl);
      console.log('Redirect URI:', QUICKBOOKS_CONFIG.redirectUri);

      const response = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: QUICKBOOKS_CONFIG.redirectUri
        }),
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );

      const { access_token, refresh_token, expires_in, x_refresh_token_expires_in } = response.data;

      console.log('Tokens received successfully');

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
        refreshTokenExpiresIn: x_refresh_token_expires_in
      };
    } catch (error) {
      console.error('QuickBooks token exchange error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error_description || 'Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    try {
      const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
      const auth = Buffer.from(`${QUICKBOOKS_CONFIG.clientId}:${QUICKBOOKS_CONFIG.clientSecret}`).toString('base64');

      console.log('Refreshing access token...');

      const response = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken
        }),
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      
      this.setTokens(access_token, refresh_token, this.realmId, expires_in);

      console.log('Token refreshed successfully');

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in
      };
    } catch (error) {
      console.error('QuickBooks token refresh error:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Create Customer in QuickBooks
   */
  async createCustomer(customerData) {
    try {
      if (this.isTokenExpired()) {
        await this.refreshAccessToken();
      }

      const url = `${BASE_URL}/v3/company/${this.realmId}/customer`;
      
      const customer = {
        DisplayName: customerData.name,
        PrimaryEmailAddr: {
          Address: customerData.email
        },
        PrimaryPhone: customerData.phone ? {
          FreeFormNumber: customerData.phone
        } : undefined,
        BillAddr: customerData.address ? {
          Line1: customerData.address.line1,
          City: customerData.address.city,
          CountrySubDivisionCode: customerData.address.state,
          PostalCode: customerData.address.postalCode
        } : undefined,
        Notes: customerData.notes || `Unit: ${customerData.unitNumber}, Client Code: ${customerData.clientCode}`
      };

      console.log('Creating customer in QuickBooks:', customerData.name);

      const response = await axios.post(url, customer, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('Customer created:', response.data.Customer.Id);

      return response.data.Customer;
    } catch (error) {
      console.error('QuickBooks create customer error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.Fault?.Error?.[0]?.Detail || 'Failed to create customer in QuickBooks');
    }
  }

  /**
   * Create Invoice in QuickBooks
   */
  async createInvoice(invoiceData) {
    try {
      if (this.isTokenExpired()) {
        await this.refreshAccessToken();
      }

      const url = `${BASE_URL}/v3/company/${this.realmId}/invoice`;

      const invoice = {
        Line: [
          {
            DetailType: 'SalesItemLineDetail',
            Amount: invoiceData.amount,
            SalesItemLineDetail: {
              ItemRef: {
                value: invoiceData.itemId || '1',
                name: invoiceData.itemName || 'Services'
              },
              Qty: 1,
              UnitPrice: invoiceData.amount
            },
            Description: invoiceData.description
          }
        ],
        CustomerRef: {
          value: invoiceData.customerId
        },
        TxnDate: invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
        DueDate: invoiceData.dueDate,
        DocNumber: invoiceData.invoiceNumber,
        PrivateNote: invoiceData.notes || '',
        CustomerMemo: {
          value: invoiceData.memo || 'Thank you for your business!'
        }
      };

      console.log('Creating invoice in QuickBooks:', invoiceData.invoiceNumber);

      const response = await axios.post(url, invoice, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('Invoice created:', response.data.Invoice.Id);

      return response.data.Invoice;
    } catch (error) {
      console.error('QuickBooks create invoice error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.Fault?.Error?.[0]?.Detail || 'Failed to create invoice in QuickBooks');
    }
  }

  /**
   * Get Invoice by ID
   */
  async getInvoice(invoiceId) {
    try {
      if (this.isTokenExpired()) {
        await this.refreshAccessToken();
      }

      const url = `${BASE_URL}/v3/company/${this.realmId}/invoice/${invoiceId}`;

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      });

      return response.data.Invoice;
    } catch (error) {
      console.error('QuickBooks get invoice error:', error.response?.data || error.message);
      throw new Error('Failed to get invoice from QuickBooks');
    }
  }

  /**
   * Search Customer by Email
   */
  async findCustomerByEmail(email) {
    try {
      if (this.isTokenExpired()) {
        await this.refreshAccessToken();
      }

      const url = `${BASE_URL}/v3/company/${this.realmId}/query`;
      const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email}'`;

      const response = await axios.get(url, {
        params: { query },
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      });

      const customers = response.data.QueryResponse?.Customer || [];
      return customers.length > 0 ? customers[0] : null;
    } catch (error) {
      console.error('QuickBooks find customer error:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get or Create Customer
   */
  async getOrCreateCustomer(customerData) {
    try {
      let customer = await this.findCustomerByEmail(customerData.email);
      
      if (!customer) {
        customer = await this.createCustomer(customerData);
      }

      return customer;
    } catch (error) {
      console.error('QuickBooks get or create customer error:', error.message);
      throw error;
    }
  }

  /**
   * Void Invoice
   */
  async voidInvoice(invoiceId) {
    try {
      if (this.isTokenExpired()) {
        await this.refreshAccessToken();
      }

      const invoice = await this.getInvoice(invoiceId);

      const url = `${BASE_URL}/v3/company/${this.realmId}/invoice`;
      
      const voidInvoice = {
        Id: invoiceId,
        SyncToken: invoice.SyncToken,
        sparse: true,
        PrivateNote: 'VOID'
      };

      const response = await axios.post(url, voidInvoice, {
        params: { operation: 'void' },
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      return response.data.Invoice;
    } catch (error) {
      console.error('QuickBooks void invoice error:', error.response?.data || error.message);
      throw new Error('Failed to void invoice in QuickBooks');
    }
  }
}

// Singleton instance
const quickbooksClient = new QuickBooksClient();

module.exports = {
  quickbooksClient,
  QuickBooksClient,
  QUICKBOOKS_CONFIG
};