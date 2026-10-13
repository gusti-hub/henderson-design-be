// Data for the Install Binder "Project Directory" (used by the Excel export; mirrors the PDF page)
const User = require('../models/User');

const ALIA = { name: 'Ālia', street: '888 Ala Moana Boulevard', cityLine: 'Honolulu HI 96814', web: 'https://www.alia888alamoana.com/' };
const HDG  = { name: 'Henderson Design Group', street: '4343 Royal Place', cityLine: 'Honolulu HI 96816', web: 'www.henderson.house', office: '808-315-8782' };

// clientUser: the client's User document (or plain object); orders: the client's orders
const buildProjectDirectory = async ({ clientUser, orders = [], clientName = '', unitNumber = '' }) => {
  const name = String(clientName || clientUser?.name || 'Client').trim();
  const addr = clientUser?.address || {};
  const cityLn = [addr.city, [addr.state, addr.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const projectLabel = unitNumber ? `${ALIA.name} Unit ${unitNumber}` : ALIA.name;
  const projectNo = (orders.find(o => o?.projectCode)?.projectCode) || '';
  const floorPlanName = orders[0]?.clientInfo?.floorPlan || '';

  // Interiors contact = the project manager assigned to this client (falls back to assistant, then designer)
  const team = clientUser?.teamAssignment || {};
  const interiorsName = String(team.projectManager || team.projectManagerAssistant || team.designer || '').trim();
  const interiorsUser = interiorsName
    ? await User.findOne({ name: interiorsName }).select('email phoneNumber').lean().catch(() => null)
    : null;
  const first = interiorsName.split(/\s+/)[0]?.toLowerCase() || '';
  const interiors = {
    contact: interiorsName,
    cell:    interiorsUser?.phoneNumber || '',
    email:   interiorsUser?.email || (first ? `${first}@henderson.house` : ''),
  };
  const mailName = String(clientUser?.name || name).trim();

  return {
    projectLabel,
    sections: [
      { labels: ['PROJECT', 'PROJECT NO.'], values: [projectLabel, projectNo], subs: [] },
      { labels: ['CLIENT', '(Mailing Address)'], values: [mailName, addr.street, cityLn, addr.country],
        subs: [['Contact', mailName], ['Phone', clientUser?.phoneNumber || ''], ['Cell', ''], ['Email', clientUser?.email || '']] },
      { labels: ['CLIENT', '(Project Address)'], values: [ALIA.name, unitNumber ? `Unit ${unitNumber}` : '', floorPlanName, ALIA.street, ALIA.cityLine],
        subs: [['Contact', ''], ['Phone', ''], ['Cell', ''], ['Email', ''], ['Web', ALIA.web]] },
      { labels: ['INTERIORS'], values: [HDG.name, HDG.street, HDG.cityLine],
        subs: [['Contact', interiors.contact], ['Office', HDG.office], ['Cell', interiors.cell], ['Web', HDG.web], ['Email', interiors.email]] },
    ],
  };
};

module.exports = { buildProjectDirectory };
