import {
  Building2,
  MapPin,
  Scale,
  FileText,
  Shield,
  ShieldCheck,
  LandPlot,
  ArrowRight,
  Search,
} from 'lucide-react';

export const DEPARTMENT_ICONS = {
  registration: Building2,
  administration: MapPin,
  planning: Scale,
  survey: LandPlot,
  valuation: FileText,
  adjudication: Shield,
  nlc: ShieldCheck,
};

export const DEPARTMENTS = [
  {
    key: 'registration',
    title: 'LAND REGISTRATION',
    description: 'Register land, submit title applications, and manage certificates of ownership.',
    color: '#38bdf8',
  },
  {
    key: 'administration',
    title: 'LAND ADMINISTRATION',
    description: 'Manage leases, charges, restrictions, and statutory land user approvals.',
    color: '#22c55e',
  },
  {
    key: 'planning',
    title: 'PHYSICAL PLANNING',
    description: 'Development plans, compliance certificates, and spatial planning approvals.',
    color: '#a78bfa',
  },
  {
    key: 'survey',
    title: 'SURVEY & MAPPING',
    description: 'GIS surveys, boundary resolution, cadastral plans, and parcel mapping.',
    color: '#fbbf24',
  },
  {
    key: 'valuation',
    title: 'VALUATION',
    description: 'Property valuation for taxation, arbitration, and government acquisitions.',
    color: '#ef4444',
  },
  {
    key: 'adjudication',
    title: 'ADJUDICATION & SETTLEMENT',
    description: 'Community land rights recognition and settlement scheme processing.',
    color: '#8b5cf6',
  },
  {
    key: 'nlc',
    title: 'NATIONAL LAND COMMISSION',
    description: 'Public land administration, compulsory acquisition, and historical land injustices.',
    color: '#06b6d4',
  },
];

export const DEPARTMENT_SERVICE_LISTS = {
  registration: [
    'Caution',
    'Registration of Certificates of Titles / Leases',
    'Replacement of Title',
    'Search',
    'Stamp Duty',
    'Transfer',
  ],
  administration: ['Charge', 'Lease', 'Restriction'],
  planning: [],
  survey: [],
  valuation: [],
  adjudication: [],
  nlc: [],
};

export const DEPARTMENT_INFO = {
  registration: { title: 'LAND REGISTRATION', description: 'Cryptographic deed registration, caveat management, and title issuance.', icon: Building2 },
  administration: { title: 'LAND ADMINISTRATION', description: 'Management of public/private land leases and statutory user approvals.', icon: MapPin },
  planning: { title: 'PHYSICAL PLANNING', description: 'Spatial allocation, master plan approvals, and environmental compliance.', icon: Scale },
  survey: { title: 'SURVEY & MAPPING', description: 'GIS beacon verification, cadastral plan processing, and RIM amendments.', icon: LandPlot },
  valuation: { title: 'VALUATION', description: 'Property valuation for taxation, arbitration, and government acquisitions.', icon: FileText },
  adjudication: { title: 'ADJUDICATION & SETTLEMENT', description: 'Community land rights recognition and settlement scheme processing.', icon: Shield },
  nlc: { title: 'NATIONAL LAND COMMISSION', description: 'Public land administration and compulsory land acquisition management.', icon: ShieldCheck },
};

export const SERVICE_ICONS = {
  'Caution': ShieldCheck,
  'Registration of Certificates of Titles / Leases': FileText,
  'Replacement of Title': FileText,
  'Search': Search,
  'Stamp Duty': Scale,
  'Transfer': ArrowRight,
  'Charge': FileText,
  'Lease': FileText,
  'Restriction': Shield,
};

export const SERVICE_DESCRIPTIONS = {
  'Caution': 'Place a caution or caveat on a parcel to protect your interest against unauthorized dealings, transfers, or registrations.',
  'Registration of Certificates of Titles / Leases': 'Register a new certificate of title or lease for a parcel of land with the Land Registry.',
  'Replacement of Title': 'Apply for a replacement title deed if the original is lost, damaged, or destroyed.',
  'Search': 'Search the registry for parcel ownership and title information. Results include SHA-256 document integrity verification and optional on-chain verification.',
  'Stamp Duty': 'Assess and pay stamp duty for land transactions based on property value.',
  'Transfer': 'Apply to transfer ownership of land from one person to another. Requires current ownership and registrar approval.',
  'Charge': 'Register a charge against a parcel as security for a loan or debt.',
  'Lease': 'Apply for a lease of public or private land for a specified term.',
  'Restriction': 'Place a restriction on a parcel to prevent certain dealings without consent.',
};

export const SERVICE_REQUIREMENTS = {
  'Caution': ['Valid national ID', 'Parcel number', 'Written reason for caution', 'Application fee'],
  'Registration of Certificates of Titles / Leases': ['Valid national ID', 'Original title document', 'Sale agreement', 'Application fee'],
  'Replacement of Title': ['Valid national ID', 'Police abstract (if title is lost)', 'Affidavit of loss', 'Application fee'],
  'Search': ['Parcel number', 'Application fee'],
  'Stamp Duty': ['Sale agreement', 'Valuation report from a registered valuer', 'Application fee'],
  'Transfer': ['Valid national ID', 'Original title deed', 'Consent to transfer from registrar', 'Application fee'],
  'Charge': ['Valid national ID', 'Original title deed', 'Loan agreement', 'Application fee'],
  'Lease': ['Valid national ID', 'Lease agreement', 'Land control board consent (if applicable)', 'Application fee'],
  'Restriction': ['Valid national ID', 'Parcel number', 'Written reason for restriction', 'Application fee'],
};

export const SERVICE_PROCESS = {
  'Caution': ['Submit application with supporting documents', 'Registrar reviews the application', 'Caution is registered on the parcel title', 'You receive confirmation of registration'],
  'Registration of Certificates of Titles / Leases': ['Submit application with title documents', 'Registrar verifies ownership and documents', 'Application is approved or rejected', 'Certificate is issued upon approval', 'Event is anchored on the blockchain'],
  'Replacement of Title': ['Submit affidavit and police abstract', 'Registrar verifies the claim', 'Replacement title is issued', 'Old title is cancelled'],
  'Search': ['Enter parcel number', 'System searches registry database', 'Results show ownership and document digests', 'Optional on-chain verification available'],
  'Stamp Duty': ['Submit sale agreement', 'Valuation report is assessed', 'Stamp duty amount is calculated', 'Payment is made and receipt issued'],
  'Transfer': ['Initiate transfer with recipient details', 'Registrar reviews and approves/rejects', 'Ownership is updated in the database', 'Event is anchored on the blockchain'],
  'Charge': ['Submit charge application', 'Registrar verifies title ownership', 'Charge is registered against the parcel', 'Charge document is issued'],
  'Lease': ['Submit lease application', 'Registrar reviews terms and eligibility', 'Lease is approved and registered', 'Lease certificate is issued'],
  'Restriction': ['Submit restriction application', 'Registrar reviews the request', 'Restriction is placed on the parcel title', 'Confirmation is issued'],
};

export const IMPLEMENTED_SERVICES = new Set([
  'Search',
  'Registration of Certificates of Titles / Leases',
  'Transfer',
]);
