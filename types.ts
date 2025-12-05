
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  WIZARD = 'WIZARD', // New AI Flow
  INVOICES = 'INVOICES',
  SETTINGS = 'SETTINGS',
  INVOICE_DETAIL = 'INVOICE_DETAIL', // New View
  REPORTS = 'REPORTS', // New Reports View
  CATALOG = 'CATALOG', // New Catalog View
}

export enum ProfileType {
  FREELANCE = 'Autónomo',
  COMPANY = 'Empresa (SAS/SL)',
}

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  description?: string; // Added optional description
  sku?: string; // Added optional SKU
  isRecurring?: boolean; // New: Monthly/Recurring flag
}

export interface BrandingConfig {
  primaryColor: string;
  templateStyle: 'Modern' | 'Classic' | 'Minimal';
  logoUrl?: string;
}

export interface EmailConfig {
  provider: 'SYSTEM' | 'GMAIL' | 'SMTP';
  email?: string;
  // SMTP (Sending)
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  // IMAP (Receiving)
  imapHost?: string;
  imapPort?: number;
  useSSL?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  type: ProfileType;
  taxId: string; // NIF, RFC, CUIT
  address?: string;
  country?: string;
  fiscalRegime?: string; // e.g. "Regimen Simplificado"
  
  // Branding
  branding?: BrandingConfig;
  
  // Finance
  bankAccount?: string; // IBAN / CBU / CLABE
  defaultCurrency?: string; // New: Default currency for user
  paymentTermsDays?: number;
  acceptsOnlinePayment?: boolean;

  // Catalog
  defaultServices?: CatalogItem[];

  // Comms
  toneOfVoice?: 'Formal' | 'Casual';
  emailTemplates?: {
    invoiceNew: string;
    invoiceOverdue: string;
  };
  emailConfig?: EmailConfig; // New: Email configuration
  whatsappNumber?: string;   // New: WhatsApp for sending
  whatsappCountryCode?: string; // New: Prefix

  // Subscription
  plan?: 'Free' | 'Emprendedor Pro' | 'Empresa Scale';
  renewalDate?: string;

  // AI Configuration
  apiKeys?: {
    gemini?: string;
    openai?: string;
  };

  avatar: string;
  isOnboardingComplete: boolean;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
  tax: number;
}

export interface TimelineEvent {
  id: string;
  type: 'CREATED' | 'SENT' | 'OPENED' | 'CLICKED' | 'APPROVED' | 'PAID' | 'REMINDER';
  title: string;
  description?: string;
  timestamp: string;
  icon?: string; // Optional custom icon hint
}

export interface Invoice {
  id: string;
  clientName: string;
  clientTaxId?: string;
  date: string;
  items: InvoiceItem[];
  total: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'PendingSync' | 'Viewed';
  currency: string;
  type: 'Invoice' | 'Quote' | 'Expense'; 
  
  // Vital Signs
  timeline?: TimelineEvent[];
  successProbability?: number; // 0-100 (Only for Quotes)
}

export interface ParsedInvoiceData {
  clientName: string;
  concept: string;
  amount: number;
  currency: string;
  detectedType: 'Invoice' | 'Quote' | 'Expense';
}

export interface ChartData {
  name: string;
  value: number;
}

// NEW: Structured AI Analysis for Reports
export interface FinancialAnalysisResult {
  healthScore: number; // 0-100
  healthStatus: 'Excellent' | 'Good' | 'Fair' | 'Critical';
  diagnosis: string;
  actionableTips: string[];
  projection: string;
}

// NEW: Specific Deep Dive Report for a single chart
export interface DeepDiveReport {
  chartTitle: string;
  executiveSummary: string;
  keyMetrics: { label: string; value: string; trend: 'up' | 'down' | 'neutral' }[];
  strategicInsight: string;
  recommendation: string;
}

// NEW: Price Analysis Structure
export interface PriceAnalysisResult {
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  currency: string;
  reasoning: string;
}
