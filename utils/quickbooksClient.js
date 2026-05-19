// utils/quickbooksClient.js
const axios = require('axios');

const QUICKBOOKS_CONFIG = {
  clientId:     process.env.QUICKBOOKS_CLIENT_ID     || 'ABBIX7EBi1jR9C45z5ZcnHczpIbV30CeD0aO0McUGD0tJmSWg6',
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || 'TP4bXyTrlvZ4bmhXf6lgRPdGk3R2RI4S8OOML1lu',
  environment:  process.env.QUICKBOOKS_ENVIRONMENT   || 'production',
  redirectUri:  process.env.QUICKBOOKS_REDIRECT_URI  || 'https://de-cora.com/api/quickbooks/callback',
  scopes:       'com.intuit.quickbooks.accounting',
};

const BASE_URL = QUICKBOOKS_CONFIG.environment === 'production'
  ? 'https://quickbooks.api.intuit.com'
  : 'https://sandbox-quickbooks.api.intuit.com';

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

// ─── Shared Item ID Map ───────────────────────────────────────────────────────
const ITEM_ID_MAP = {
  'Product':                 '3',
  'FDI':                     '4',
  'FDI-Vendor':              '12',
  'Other':                   '5',
  'Design Fees':             '7',
  'Expediting':              '8',
  'Hours':                   '2',
  'Labor':                   '2',
  'Reimbursable':            '6',
  'Project Management Fees': '11',
  'Sales':                   '1',
  'Indonesia':               '10',
  'Bad Debts':               '13',
  'default':                 '3',
};

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

  // ─── Find Item by Name ────────────────────────────────────────────────────────
  async findItemByName(name) {
    if (this.isTokenExpired()) await this.refreshAccessToken();
    try {
      const safeName = name.replace(/'/g, "\\'");
      const response = await axios.get(`${BASE_URL}/v3/company/${this.realmId}/query`, {
        params: { query: `SELECT * FROM Item WHERE Name = '${safeName}' MAXRESULTS 5` },
        headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Accept': 'application/json' },
      });
      const items = response.data.QueryResponse?.Item || [];
      return items.length > 0 ? items[0] : null;
    } catch (err) {
      console.warn('QB findItemByName error:', err.message);
      return null;
    }
  }

  // ─── Find Class by Name ───────────────────────────────────────────────────────
  async findClassByName(name) {
    if (!name || !name.trim()) return null;
    if (this.isTokenExpired()) await this.refreshAccessToken();
    try {
      const safeName = name.trim().replace(/'/g, "\\'");
      const response = await axios.get(`${BASE_URL}/v3/company/${this.realmId}/query`, {
        params: { query: `SELECT * FROM Class WHERE Name = '${safeName}' MAXRESULTS 5` },
        headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Accept': 'application/json' },
      });
      const classes = response.data.QueryResponse?.Class || [];
      if (classes.length > 0) {
        console.log(`QB: Class "${name}" resolved to ID ${classes[0].Id}`);
        return classes[0];
      }
      console.warn(`QB: Class "${name}" not found`);
      return null;
    } catch (err) {
      console.warn('QB findClassByName error:', err.message);
      return null;
    }
  }

  // ─── Customer ─────────────────────────────────────────────────────────────────
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

  // ─── Invoice — CREATE ──────────────────────────────────────────────────────────
  async createInvoice(invoiceData, itemId = '3') {
    if (this.isTokenExpired()) await this.refreshAccessToken();

    let lines;
    if (invoiceData.lines && invoiceData.lines.length > 0) {
      lines = invoiceData.lines.map(line => {
        const qty       = round2(line.qty || 1);
        const unitPrice = round2(line.unitPrice || 0);
        const amount    = round2(unitPrice * qty);
        return {
          DetailType:          'SalesItemLineDetail',
          Amount:              amount,
          Description:         (line.description || '').substring(0, 4000),
          SalesItemLineDetail: {
            ItemRef:   { value: itemId, name: 'Product' },
            Qty:       qty,
            UnitPrice: unitPrice,
            ...(line.classRef ? { ClassRef: { value: line.classRef } } : {}),
          },
        };
      });
    } else {
      const amount = round2(invoiceData.amount || 0);
      lines = [{
        DetailType:          'SalesItemLineDetail',
        Amount:              amount,
        Description:         (invoiceData.description || '').substring(0, 4000),
        SalesItemLineDetail: {
          ItemRef:   { value: itemId, name: 'Product' },
          Qty:       1,
          UnitPrice: amount,
        },
      }];
    }

    lines = lines.filter(l => l.Amount > 0);
    if (lines.length === 0) throw new Error('No valid line items to create invoice');

    const invoice = {
      sparse:       true,
      Line:         lines,
      CustomerRef:  { value: invoiceData.customerId },
      TxnDate:      invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
      DueDate:      invoiceData.dueDate || invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
      DocNumber:    invoiceData.invoiceNumber,
      PrivateNote:  '',
      CustomerMemo: { value: '' },
    };

    const response = await axios.post(
      `${BASE_URL}/v3/company/${this.realmId}/invoice`,
      invoice,
      { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );
    return response.data.Invoice;
  }

  // ─── Invoice — GET ────────────────────────────────────────────────────────────
  async getInvoice(invoiceId) {
    if (this.isTokenExpired()) await this.refreshAccessToken();
    const response = await axios.get(
      `${BASE_URL}/v3/company/${this.realmId}/invoice/${invoiceId}`,
      { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Accept': 'application/json' } }
    );
    return response.data.Invoice;
  }

  // ─── Invoice — UPDATE ─────────────────────────────────────────────────────────
  async updateInvoice(invoiceId, invoiceData, itemId = '3') {
    if (this.isTokenExpired()) await this.refreshAccessToken();
    const existing = await this.getInvoice(invoiceId);

    let lines;
    if (invoiceData.lines && invoiceData.lines.length > 0) {
      lines = invoiceData.lines.map(line => {
        const qty       = round2(line.qty || 1);
        const unitPrice = round2(line.unitPrice || 0);
        const amount    = round2(unitPrice * qty);
        return {
          DetailType:          'SalesItemLineDetail',
          Amount:              amount,
          Description:         (line.description || '').substring(0, 4000),
          SalesItemLineDetail: {
            ItemRef:   { value: itemId, name: 'Product' },
            Qty:       qty,
            UnitPrice: unitPrice,
            ...(line.classRef ? { ClassRef: { value: line.classRef } } : {}),
          },
        };
      });
    } else {
      const amount = round2(invoiceData.amount || 0);
      lines = [{
        DetailType:          'SalesItemLineDetail',
        Amount:              amount,
        Description:         (invoiceData.description || '').substring(0, 4000),
        SalesItemLineDetail: {
          ItemRef:   { value: itemId, name: 'Product' },
          Qty:       1,
          UnitPrice: amount,
        },
      }];
    }

    lines = lines.filter(l => l.Amount > 0);
    if (lines.length === 0) throw new Error('No valid line items to update invoice');

    const invoice = {
      sparse:       true,
      Id:           invoiceId,
      SyncToken:    existing.SyncToken,
      Line:         lines,
      CustomerRef:  { value: invoiceData.customerId },
      TxnDate:      invoiceData.invoiceDate || existing.TxnDate,
      DueDate:      invoiceData.dueDate     || existing.DueDate,
      DocNumber:    invoiceData.invoiceNumber,
      PrivateNote:  '',
      CustomerMemo: { value: '' },
    };

    const response = await axios.post(
      `${BASE_URL}/v3/company/${this.realmId}/invoice`,
      invoice,
      { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );
    console.log('QB: Updated invoice:', response.data.Invoice.Id);
    return response.data.Invoice;
  }

  // ─── Invoice — VOID ───────────────────────────────────────────────────────────
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

  // ─── Vendor ───────────────────────────────────────────────────────────────────
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

  // ─── Bill — GET ───────────────────────────────────────────────────────────────
  async getBill(billId) {
    if (this.isTokenExpired()) await this.refreshAccessToken();
    const response = await axios.get(
      `${BASE_URL}/v3/company/${this.realmId}/bill/${billId}`,
      { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Accept': 'application/json' } }
    );
    return response.data.Bill;
  }

  // ─── Bill — CREATE ────────────────────────────────────────────────────────────
  async createBill(billData) {
    if (this.isTokenExpired()) await this.refreshAccessToken();

    let lines = billData.lines.map(line => {
      const qty       = round2(line.qty || 1);
      const unitPrice = round2(line.unitPrice || 0);
      const amount    = round2(unitPrice * qty);
      const lineType  = line.lineType || 'Product';
      const itemId    = ITEM_ID_MAP[lineType] || ITEM_ID_MAP['default'];

      return {
        DetailType:  'ItemBasedExpenseLineDetail',
        Amount:      amount,
        Description: (line.description || '').substring(0, 4000),
        ItemBasedExpenseLineDetail: {
          ItemRef:        { value: itemId, name: lineType },
          Qty:            qty,
          UnitPrice:      unitPrice,
          BillableStatus: 'NotBillable',
          ...(line.classRef ? { ClassRef: { value: line.classRef } } : {}),
        },
      };
    });

    lines = lines.filter(l => l.Amount > 0);
    if (lines.length === 0) throw new Error('No valid line items to create bill');

    const bill = {
      Line:      lines,
      VendorRef: { value: billData.vendorId },
      TxnDate:   billData.date    || new Date().toISOString().split('T')[0],
      DueDate:   billData.dueDate || billData.date || new Date().toISOString().split('T')[0],
      DocNumber: billData.docNumber,
    };

    const response = await axios.post(
      `${BASE_URL}/v3/company/${this.realmId}/bill`,
      bill,
      { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );
    console.log('QB: Created bill:', response.data.Bill.Id);
    return response.data.Bill;
  }

  // ─── Bill — UPDATE ────────────────────────────────────────────────────────────
  async updateBill(billId, billData) {
    if (this.isTokenExpired()) await this.refreshAccessToken();

    // ✅ Fetch existing untuk dapat SyncToken — QB wajib ini untuk update
    const existing = await this.getBill(billId);

    let lines = billData.lines.map(line => {
      const qty       = round2(line.qty || 1);
      const unitPrice = round2(line.unitPrice || 0);
      const amount    = round2(unitPrice * qty);
      const lineType  = line.lineType || 'Product';
      const itemId    = ITEM_ID_MAP[lineType] || ITEM_ID_MAP['default'];

      return {
        DetailType:  'ItemBasedExpenseLineDetail',
        Amount:      amount,
        Description: (line.description || '').substring(0, 4000),
        ItemBasedExpenseLineDetail: {
          ItemRef:        { value: itemId, name: lineType },
          Qty:            qty,
          UnitPrice:      unitPrice,
          BillableStatus: 'NotBillable',
          ...(line.classRef ? { ClassRef: { value: line.classRef } } : {}),
        },
      };
    });

    lines = lines.filter(l => l.Amount > 0);
    if (lines.length === 0) throw new Error('No valid line items to update bill');

    const bill = {
      Id:        billId,
      SyncToken: existing.SyncToken, // ✅ wajib untuk update
      sparse:    true,
      Line:      lines,
      VendorRef: { value: billData.vendorId },
      TxnDate:   billData.date    || existing.TxnDate,
      DueDate:   billData.dueDate || existing.DueDate,
      DocNumber: billData.docNumber,
    };

    const response = await axios.post(
      `${BASE_URL}/v3/company/${this.realmId}/bill`,
      bill,
      { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );
    console.log('QB: Updated bill:', response.data.Bill.Id);
    return response.data.Bill;
  }
}

const quickbooksClient = new QuickBooksClient();
module.exports = { quickbooksClient, QuickBooksClient, QUICKBOOKS_CONFIG };