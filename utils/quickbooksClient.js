// utils/quickbooksClient.js
const axios = require('axios');

const QUICKBOOKS_CONFIG = {
  clientId:     process.env.QUICKBOOKS_CLIENT_ID     || 'ABBIX7EBi1jR9C45z5ZcnHczpIbV30CeD0aO0McUGD0tJmSWg6',
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || 'TP4bXyTrlvZ4bmhXf6lgRPdGk3R2RI4S8OOML1lu',
  environment:  process.env.QUICKBOOKS_ENVIRONMENT   || 'production',
  redirectUri:  process.env.QUICKBOOKS_REDIRECT_URI  || 'https://de-cora.com/api/quickbooks/callback',
  scopes:       'com.intuit.quickbooks.accounting',
};

console.log('QuickBooks Config:', {
  clientId:     QUICKBOOKS_CONFIG.clientId ? `${QUICKBOOKS_CONFIG.clientId.substring(0, 10)}...` : 'NOT SET',
  clientSecret: QUICKBOOKS_CONFIG.clientSecret ? '***HIDDEN***' : 'NOT SET',
  environment:  QUICKBOOKS_CONFIG.environment,
  redirectUri:  QUICKBOOKS_CONFIG.redirectUri,
});

const BASE_URL = QUICKBOOKS_CONFIG.environment === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com';

// ─── Helper: round to 2 decimal places ───────────────────────────────────────
const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

class QuickBooksClient {
  constructor() {
    this.accessToken  = null;
    this.refreshToken = null;
    this.realmId      = null;
    this.tokenExpiry  = null;
  }

  setTokens(accessToken, refreshToken, realmId, expiresIn = 3600) {
    this.accessToken  = accessToken;
    this.refreshToken = refreshToken;
    this.realmId      = realmId;
    this.tokenExpiry  = new Date(Date.now() + expiresIn * 1000);
  }

  isTokenExpired() {
    if (!this.tokenExpiry) return true;
    return new Date() >= this.tokenExpiry;
  }

  getAuthorizationUrl(state = 'random-state-string') {
    const params = new URLSearchParams({
      client_id:     QUICKBOOKS_CONFIG.clientId,
      redirect_uri:  QUICKBOOKS_CONFIG.redirectUri,
      response_type: 'code',
      scope:         QUICKBOOKS_CONFIG.scopes,
      state,
    });
    return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
  }

  async getTokensFromCode(code) {
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const auth     = Buffer.from(`${QUICKBOOKS_CONFIG.clientId}:${QUICKBOOKS_CONFIG.clientSecret}`).toString('base64');
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: QUICKBOOKS_CONFIG.redirectUri }),
      { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' } }
    );
    const { access_token, refresh_token, expires_in, x_refresh_token_expires_in } = response.data;
    return { accessToken: access_token, refreshToken: refresh_token, expiresIn: expires_in, refreshTokenExpiresIn: x_refresh_token_expires_in };
  }

  async refreshAccessToken() {
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const auth     = Buffer.from(`${QUICKBOOKS_CONFIG.clientId}:${QUICKBOOKS_CONFIG.clientSecret}`).toString('base64');
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: this.refreshToken }),
      { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' } }
    );
    const { access_token, refresh_token, expires_in } = response.data;
    this.setTokens(access_token, refresh_token, this.realmId, expires_in);
    return { accessToken: access_token, refreshToken: refresh_token, expiresIn: expires_in };
  }

  // ─── Customer ──────────────────────────────────────────────────────────────
  async createCustomer(customerData) {
    if (this.isTokenExpired()) await this.refreshAccessToken();
    const customer = {
      DisplayName:      customerData.name,
      PrimaryEmailAddr: customerData.email ? { Address: customerData.email } : undefined,
      PrimaryPhone:     customerData.phone ? { FreeFormNumber: customerData.phone } : undefined,
      Notes:            `Unit: ${customerData.unitNumber || ''}, Code: ${customerData.clientCode || ''}`,
    };
    const response = await axios.post(
      `${BASE_URL}/v3/company/${this.realmId}/customer`,
      customer,
      { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );
    return response.data.Customer;
  }

  async findCustomerByEmail(email) {
    if (this.isTokenExpired()) await this.refreshAccessToken();
    try {
      const response = await axios.get(`${BASE_URL}/v3/company/${this.realmId}/query`, {
        params: { query: `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email}'` },
        headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Accept': 'application/json' },
      });
      const customers = response.data.QueryResponse?.Customer || [];
      return customers.length > 0 ? customers[0] : null;
    } catch { return null; }
  }

  async findCustomerByName(name) {
    if (this.isTokenExpired()) await this.refreshAccessToken();
    try {
      const safeName = name.replace(/'/g, "\\'");
      const response = await axios.get(`${BASE_URL}/v3/company/${this.realmId}/query`, {
        params: { query: `SELECT * FROM Customer WHERE DisplayName = '${safeName}'` },
        headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Accept': 'application/json' },
      });
      const customers = response.data.QueryResponse?.Customer || [];
      return customers.length > 0 ? customers[0] : null;
    } catch { return null; }
  }

  async getOrCreateCustomer(customerData) {
    let customer = customerData.email ? await this.findCustomerByEmail(customerData.email) : null;
    if (!customer) customer = await this.findCustomerByName(customerData.name);
    if (!customer) customer = await this.createCustomer(customerData);
    return customer;
  }

  // ─── Invoice ───────────────────────────────────────────────────────────────
  async createInvoice(invoiceData) {
    if (this.isTokenExpired()) await this.refreshAccessToken();

    let lines;

    if (invoiceData.lines && invoiceData.lines.length > 0) {
      lines = invoiceData.lines.map(line => {
        const qty       = round2(line.qty || 1);
        const unitPrice = round2(line.unitPrice || 0);
        // ✅ Amount HARUS = round2(unitPrice * qty) — QB validasi ini strict
        const amount    = round2(unitPrice * qty);

        return {
          DetailType:          'SalesItemLineDetail',
          Amount:              amount,
          Description:         (line.description || '').substring(0, 4000),
          SalesItemLineDetail: {
            ItemRef:   { value: '1', name: 'Services' },
            Qty:       qty,
            UnitPrice: unitPrice,
          },
        };
      });
    } else {
      // Fallback: single line dari invoiceData.amount
      const amount = round2(invoiceData.amount || 0);
      lines = [{
        DetailType:          'SalesItemLineDetail',
        Amount:              amount,
        Description:         (invoiceData.description || '').substring(0, 4000),
        SalesItemLineDetail: {
          ItemRef:   { value: '1', name: 'Services' },
          Qty:       1,
          UnitPrice: amount,
        },
      }];
    }

    // Filter out zero-amount lines — QB reject lines dengan Amount = 0
    lines = lines.filter(l => l.Amount > 0);

    if (lines.length === 0) {
      throw new Error('No valid line items to create invoice');
    }

    const invoice = {
      Line:         lines,
      CustomerRef:  { value: invoiceData.customerId },
      TxnDate:      invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
      DueDate:      invoiceData.dueDate || invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
      DocNumber:    invoiceData.invoiceNumber,
      PrivateNote:  (invoiceData.notes || '').substring(0, 4000),
      CustomerMemo: { value: (invoiceData.memo || 'Thank you for your business!').substring(0, 1000) },
    };

    const response = await axios.post(
      `${BASE_URL}/v3/company/${this.realmId}/invoice`,
      invoice,
      { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );
    return response.data.Invoice;
  }

  async getInvoice(invoiceId) {
    if (this.isTokenExpired()) await this.refreshAccessToken();
    const response = await axios.get(
      `${BASE_URL}/v3/company/${this.realmId}/invoice/${invoiceId}`,
      { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Accept': 'application/json' } }
    );
    return response.data.Invoice;
  }

  async voidInvoice(invoiceId) {
    if (this.isTokenExpired()) await this.refreshAccessToken();
    const invoice     = await this.getInvoice(invoiceId);
    const voidInvoice = { Id: invoiceId, SyncToken: invoice.SyncToken, sparse: true, PrivateNote: 'VOID' };
    const response    = await axios.post(
      `${BASE_URL}/v3/company/${this.realmId}/invoice`,
      voidInvoice,
      { params: { operation: 'void' }, headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );
    return response.data.Invoice;
  }

  // ─── Vendor ────────────────────────────────────────────────────────────────
  async getOrCreateVendor(vendorName) {
    if (this.isTokenExpired()) await this.refreshAccessToken();
    try {
      const safeName = vendorName.replace(/'/g, "\\'");
      const searchRes = await axios.get(`${BASE_URL}/v3/company/${this.realmId}/query`, {
        params: { query: `SELECT * FROM Vendor WHERE DisplayName = '${safeName}'` },
        headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Accept': 'application/json' },
      });
      const vendors = searchRes.data.QueryResponse?.Vendor || [];
      if (vendors.length > 0) return vendors[0];
    } catch (err) { console.warn('QB vendor search error:', err.message); }

    const createRes = await axios.post(
      `${BASE_URL}/v3/company/${this.realmId}/vendor`,
      { DisplayName: vendorName },
      { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );
    console.log('QB: Created vendor:', vendorName);
    return createRes.data.Vendor;
  }

  // ─── Bill (for PO sync) ────────────────────────────────────────────────────
  async createBill(billData) {
    if (this.isTokenExpired()) await this.refreshAccessToken();

    let lines = billData.lines.map(line => {
      const qty       = round2(line.qty || 1);
      const unitPrice = round2(line.unitPrice || 0);
      // ✅ Amount HARUS = round2(unitPrice * qty) — QB validasi ini strict
      const amount    = round2(unitPrice * qty);

      return {
        DetailType:  'ItemBasedExpenseLineDetail',
        Amount:      amount,
        Description: (line.description || '').substring(0, 4000),
        ItemBasedExpenseLineDetail: {
          // value '1' = Services item di sandbox
          // Di production ganti dengan Item ID Product yang sesuai
          ItemRef:        { value: billData.itemId || '1', name: 'Product' },
          Qty:            qty,
          UnitPrice:      unitPrice,
          BillableStatus: 'NotBillable',
        },
      };
    });

    // Filter out zero-amount lines
    lines = lines.filter(l => l.Amount > 0);

    if (lines.length === 0) {
      throw new Error('No valid line items to create bill');
    }

    const bill = {
      Line:        lines,
      VendorRef:   { value: billData.vendorId },
      TxnDate:     billData.date    || new Date().toISOString().split('T')[0],
      DueDate:     billData.dueDate || billData.date || new Date().toISOString().split('T')[0],
      DocNumber:   billData.docNumber,
      PrivateNote: (billData.notes || '').substring(0, 4000),
    };

    const response = await axios.post(
      `${BASE_URL}/v3/company/${this.realmId}/bill`,
      bill,
      { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );
    console.log('QB: Created bill:', response.data.Bill.Id, 'for vendor:', billData.vendorId);
    return response.data.Bill;
  }
}

const quickbooksClient = new QuickBooksClient();
module.exports = { quickbooksClient, QuickBooksClient, QUICKBOOKS_CONFIG };