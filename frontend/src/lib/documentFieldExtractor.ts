/**
 * Smart Document Field Extractor
 * Intelligently extracts structured procurement fields from unstructured document text
 * Supports: DOCX, PDF, TXT, MD, and other text-based formats
 */

// Field types we want to extract from documents
export interface ExtractedFields {
  // Identification
  contractId?: string;
  supplierId?: string;
  agreementId?: string;
  poNumber?: string;

  // Parties
  supplierName?: string;
  buyerName?: string;
  companyName?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Dates
  startDate?: string;
  endDate?: string;
  effectiveDate?: string;
  expiryDate?: string;
  signedDate?: string;

  // Financial
  contractValue?: string;
  totalValue?: string;
  annualSpend?: string;
  unitPrice?: string;
  currency?: string;
  paymentTerms?: string;

  // Category & Classification
  category?: string;
  subcategory?: string;
  commodityType?: string;
  serviceType?: string;

  // Location
  country?: string;
  region?: string;
  address?: string;
  headquarters?: string;
  deliveryLocations?: string;

  // Terms & Conditions
  terms?: string;
  sla?: string;
  warrantyPeriod?: string;
  noticePeriod?: string;
  renewalTerms?: string;

  // Performance & Risk
  performanceRating?: string;
  riskLevel?: string;
  certifications?: string;

  // Strategy (for Playbooks)
  sourcingStrategy?: string;
  savingsTarget?: string;
  negotiationApproach?: string;
  marketAnalysis?: string;

  // Other extracted content
  [key: string]: string | undefined;
}

// Pattern definitions for field extraction
interface FieldPattern {
  field: keyof ExtractedFields;
  patterns: RegExp[];
  postProcess?: (match: string) => string;
}

// Common date formats
const DATE_PATTERN = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{1,2}[\s,]+\d{4}|\d{1,2}[\s]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{4})/i;

// Currency pattern
const CURRENCY_PATTERN = /(?:USD|EUR|GBP|INR|JPY|CNY|AUD|CAD|\$|€|£|₹|¥)?[\s]*[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|M|B|K|lakhs?|crores?|lacs?))?/i;

// Field extraction patterns - ordered by specificity
const FIELD_PATTERNS: FieldPattern[] = [
  // Contract/Agreement IDs
  {
    field: 'contractId',
    patterns: [
      /contract\s*(?:id|no|number|#|ref)[\s:]*([A-Z0-9\-\/]+)/i,
      /agreement\s*(?:id|no|number|#|ref)[\s:]*([A-Z0-9\-\/]+)/i,
      /(?:CT|AGR|CON)[-\s]?[A-Z]*[-\s]?\d{4}[-\s]?\d{2,}/i,
    ],
  },
  {
    field: 'supplierId',
    patterns: [
      /supplier\s*(?:id|code|no|number|#)[\s:]*([A-Z0-9\-]+)/i,
      /vendor\s*(?:id|code|no|number|#)[\s:]*([A-Z0-9\-]+)/i,
      /(?:SUP|VEN|VEND)[-\s]?[A-Z]*[-\s]?\d+/i,
    ],
  },
  {
    field: 'poNumber',
    patterns: [
      /(?:PO|purchase\s*order)\s*(?:no|number|#)?[\s:]*([A-Z0-9\-]+)/i,
    ],
  },

  // Party Names
  {
    field: 'supplierName',
    patterns: [
      /supplier\s*(?:name)?[\s:]+([A-Z][A-Za-z\s&.,]+(?:Ltd|LLC|Inc|Corp|GmbH|Pvt|Private|Limited|Company|Co|Services|Solutions|Technologies|Systems)?\.?)/i,
      /vendor\s*(?:name)?[\s:]+([A-Z][A-Za-z\s&.,]+(?:Ltd|LLC|Inc|Corp|GmbH|Pvt|Private|Limited|Company|Co|Services|Solutions|Technologies|Systems)?\.?)/i,
      /(?:between|with|to)\s+([A-Z][A-Za-z\s&.,]+(?:Ltd|LLC|Inc|Corp|GmbH|Pvt|Private|Limited|Company|Co)\.?)/i,
      /provider[\s:]+([A-Z][A-Za-z\s&.,]+(?:Ltd|LLC|Inc|Corp|GmbH|Pvt|Private|Limited)\.?)/i,
    ],
    postProcess: (s) => s.replace(/[,.]$/, '').trim(),
  },
  {
    field: 'buyerName',
    patterns: [
      /buyer[\s:]+([A-Z][A-Za-z\s&.,]+(?:Ltd|LLC|Inc|Corp|GmbH|Pvt|Private|Limited)?\.?)/i,
      /client[\s:]+([A-Z][A-Za-z\s&.,]+(?:Ltd|LLC|Inc|Corp|GmbH|Pvt|Private|Limited)?\.?)/i,
      /purchaser[\s:]+([A-Z][A-Za-z\s&.,]+(?:Ltd|LLC|Inc|Corp|GmbH|Pvt|Private|Limited)?\.?)/i,
    ],
    postProcess: (s) => s.replace(/[,.]$/, '').trim(),
  },
  {
    field: 'contactPerson',
    patterns: [
      /contact\s*(?:person|name)?[\s:]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      /(?:point\s*of\s*contact|poc)[\s:]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
      /account\s*manager[\s:]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    ],
  },
  {
    field: 'contactEmail',
    patterns: [
      /(?:email|e-mail)[\s:]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    ],
  },
  {
    field: 'contactPhone',
    patterns: [
      /(?:phone|tel|telephone|mobile)[\s:]*([+\d\s\-()]{10,})/i,
    ],
  },

  // Dates
  {
    field: 'startDate',
    patterns: [
      new RegExp(`(?:start|commencement|effective|begin)\\s*date[\\s:]*${DATE_PATTERN.source}`, 'i'),
      new RegExp(`(?:from|starting|begins?|commences?)\\s*:?\\s*${DATE_PATTERN.source}`, 'i'),
    ],
  },
  {
    field: 'endDate',
    patterns: [
      new RegExp(`(?:end|expiry|expiration|termination|completion)\\s*date[\\s:]*${DATE_PATTERN.source}`, 'i'),
      new RegExp(`(?:to|until|ending|expires?|terminates?)\\s*:?\\s*${DATE_PATTERN.source}`, 'i'),
      new RegExp(`valid\\s*(?:until|through|till)[\\s:]*${DATE_PATTERN.source}`, 'i'),
    ],
  },
  {
    field: 'effectiveDate',
    patterns: [
      new RegExp(`effective\\s*(?:date)?[\\s:]*${DATE_PATTERN.source}`, 'i'),
    ],
  },
  {
    field: 'signedDate',
    patterns: [
      new RegExp(`(?:signed|executed|dated)\\s*(?:on)?[\\s:]*${DATE_PATTERN.source}`, 'i'),
    ],
  },

  // Financial
  {
    field: 'contractValue',
    patterns: [
      new RegExp(`(?:contract|total|agreement)\\s*value[\\s:]*${CURRENCY_PATTERN.source}`, 'i'),
      new RegExp(`(?:total|contract)\\s*(?:amount|worth)[\\s:]*${CURRENCY_PATTERN.source}`, 'i'),
    ],
  },
  {
    field: 'annualSpend',
    patterns: [
      new RegExp(`(?:annual|yearly)\\s*(?:spend|expenditure|value)[\\s:]*${CURRENCY_PATTERN.source}`, 'i'),
      new RegExp(`(?:spend|expenditure)\\s*(?:per|each)?\\s*(?:year|annum)[\\s:]*${CURRENCY_PATTERN.source}`, 'i'),
    ],
  },
  {
    field: 'unitPrice',
    patterns: [
      new RegExp(`(?:unit|per\\s*unit)\\s*(?:price|cost|rate)[\\s:]*${CURRENCY_PATTERN.source}`, 'i'),
      new RegExp(`(?:rate|price)[\\s:]*${CURRENCY_PATTERN.source}\\s*(?:per|/|each)`, 'i'),
    ],
  },
  {
    field: 'currency',
    patterns: [
      /currency[\s:]*([A-Z]{3}|USD|EUR|GBP|INR|JPY|CNY)/i,
      /(?:in|denominated\s*in)[\s]*([A-Z]{3}|USD|EUR|GBP|INR|JPY|CNY)/i,
    ],
  },
  {
    field: 'paymentTerms',
    patterns: [
      /payment\s*terms?[\s:]+([^\n.]+)/i,
      /(?:net|due\s*in)\s*(\d+)\s*days?/i,
    ],
  },

  // Category & Classification
  {
    field: 'category',
    patterns: [
      /(?:category|classification|type)[\s:]+([A-Za-z\s&]+?)(?:\n|\.|\,|$)/i,
      /(?:commodity|product|service)\s*(?:type|category)?[\s:]+([A-Za-z\s&]+?)(?:\n|\.|\,|$)/i,
    ],
    postProcess: (s) => s.trim().replace(/[,.]$/, ''),
  },
  {
    field: 'serviceType',
    patterns: [
      /(?:service|services)\s*(?:type|provided|offered)?[\s:]+([A-Za-z\s&,]+?)(?:\n|\.(?!\w)|$)/i,
    ],
    postProcess: (s) => s.trim().replace(/[,.]$/, ''),
  },

  // Location
  {
    field: 'country',
    patterns: [
      /country[\s:]+([A-Za-z\s]+?)(?:\n|\.|\,|$)/i,
      /(?:located|based)\s*(?:in|at)[\s:]+([A-Za-z\s]+?)(?:\n|\.|\,|$)/i,
      /headquarters?[\s:]+([A-Za-z\s,]+?)(?:\n|$)/i,
    ],
    postProcess: (s) => s.trim().replace(/[,.]$/, ''),
  },
  {
    field: 'region',
    patterns: [
      /region[\s:]+([A-Za-z\s]+?)(?:\n|\.|\,|$)/i,
      /(?:EMEA|APAC|LATAM|Americas|North America|Europe|Asia)/i,
    ],
  },
  {
    field: 'address',
    patterns: [
      /(?:address|location)[\s:]+([^\n]+)/i,
      /(?:office|headquarters)\s*(?:at|:)\s*([^\n]+)/i,
    ],
  },
  {
    field: 'deliveryLocations',
    patterns: [
      /(?:delivery|service)\s*(?:locations?|centers?)[\s:]+([^\n]+)/i,
    ],
  },

  // Terms
  {
    field: 'terms',
    patterns: [
      /(?:terms|conditions)[\s:]+([^\n]+(?:\n[^\n]+){0,3})/i,
      /(?:contract|agreement)\s*(?:term|duration|period)[\s:]+([^\n]+)/i,
    ],
  },
  {
    field: 'sla',
    patterns: [
      /(?:SLA|service\s*level)[\s:]+([^\n]+)/i,
      /(?:uptime|availability)[\s:]+(\d+(?:\.\d+)?%)/i,
    ],
  },
  {
    field: 'warrantyPeriod',
    patterns: [
      /warranty[\s:]+([^\n]+)/i,
      /warranty\s*(?:period|term)[\s:]+(\d+\s*(?:years?|months?|days?))/i,
    ],
  },
  {
    field: 'noticePeriod',
    patterns: [
      /notice\s*(?:period)?[\s:]+(\d+\s*(?:days?|weeks?|months?))/i,
      /(?:termination|cancellation)\s*notice[\s:]+(\d+\s*(?:days?|weeks?|months?))/i,
    ],
  },
  {
    field: 'renewalTerms',
    patterns: [
      /(?:renewal|auto[\s-]*renew)[\s:]+([^\n]+)/i,
    ],
  },

  // Performance & Risk
  {
    field: 'performanceRating',
    patterns: [
      /(?:performance|rating|score)[\s:]+(\d+(?:\.\d+)?%?)/i,
      /(?:on[\s-]*time\s*delivery|OTD)[\s:]+(\d+(?:\.\d+)?%)/i,
    ],
  },
  {
    field: 'riskLevel',
    patterns: [
      /risk\s*(?:level|rating|assessment)?[\s:]+([A-Za-z]+)/i,
    ],
  },
  {
    field: 'certifications',
    patterns: [
      /(?:certifications?|accreditations?)[\s:]+([^\n]+)/i,
      /(?:ISO\s*\d+|SOC\s*\d|GDPR|HIPAA|PCI[\s-]*DSS)/gi,
    ],
  },

  // Strategy (Playbooks)
  {
    field: 'sourcingStrategy',
    patterns: [
      /(?:sourcing|procurement)\s*strategy[\s:]+([^\n]+(?:\n[^\n]+){0,2})/i,
      /strategy[\s:]+([^\n]+)/i,
    ],
  },
  {
    field: 'savingsTarget',
    patterns: [
      /(?:savings?|cost\s*reduction)\s*(?:target|goal)?[\s:]+(\d+(?:\.\d+)?%?(?:\s*-\s*\d+(?:\.\d+)?%)?)/i,
    ],
  },
  {
    field: 'negotiationApproach',
    patterns: [
      /(?:negotiation|pricing)\s*(?:approach|strategy|model)?[\s:]+([^\n]+)/i,
    ],
  },
  {
    field: 'marketAnalysis',
    patterns: [
      /(?:market|industry)\s*(?:analysis|overview|trends?)[\s:]+([^\n]+(?:\n[^\n]+){0,3})/i,
    ],
  },
];

// Extract value from text using patterns
const extractValue = (text: string, patterns: RegExp[]): string | undefined => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Return the captured group if exists, otherwise the whole match
      return (match[1] || match[0]).trim();
    }
  }
  return undefined;
};

// Main extraction function
export const extractDocumentFields = (text: string): ExtractedFields => {
  const fields: ExtractedFields = {};

  // Clean up text - normalize whitespace
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ');

  // Extract each field
  for (const { field, patterns, postProcess } of FIELD_PATTERNS) {
    const value = extractValue(normalizedText, patterns);
    if (value) {
      fields[field] = postProcess ? postProcess(value) : value;
    }
  }

  return fields;
};

// Convert extracted fields to headers and rows for table display
export const fieldsToTableData = (fields: ExtractedFields): {
  headers: string[];
  rows: Record<string, string>[];
} => {
  const headers: string[] = [];
  const row: Record<string, string> = {};

  // Field display names mapping
  const fieldDisplayNames: Record<string, string> = {
    contractId: 'Contract ID',
    supplierId: 'Supplier ID',
    agreementId: 'Agreement ID',
    poNumber: 'PO Number',
    supplierName: 'Supplier Name',
    buyerName: 'Buyer Name',
    companyName: 'Company Name',
    contactPerson: 'Contact Person',
    contactEmail: 'Contact Email',
    contactPhone: 'Contact Phone',
    startDate: 'Start Date',
    endDate: 'End Date',
    effectiveDate: 'Effective Date',
    expiryDate: 'Expiry Date',
    signedDate: 'Signed Date',
    contractValue: 'Contract Value',
    totalValue: 'Total Value',
    annualSpend: 'Annual Spend',
    unitPrice: 'Unit Price',
    currency: 'Currency',
    paymentTerms: 'Payment Terms',
    category: 'Category',
    subcategory: 'Subcategory',
    commodityType: 'Commodity Type',
    serviceType: 'Service Type',
    country: 'Country',
    region: 'Region',
    address: 'Address',
    headquarters: 'Headquarters',
    deliveryLocations: 'Delivery Locations',
    terms: 'Terms',
    sla: 'SLA',
    warrantyPeriod: 'Warranty Period',
    noticePeriod: 'Notice Period',
    renewalTerms: 'Renewal Terms',
    performanceRating: 'Performance Rating',
    riskLevel: 'Risk Level',
    certifications: 'Certifications',
    sourcingStrategy: 'Sourcing Strategy',
    savingsTarget: 'Savings Target',
    negotiationApproach: 'Negotiation Approach',
    marketAnalysis: 'Market Analysis',
  };

  // Add fields in a logical order
  const fieldOrder: (keyof ExtractedFields)[] = [
    'contractId', 'supplierId', 'agreementId', 'poNumber',
    'supplierName', 'buyerName', 'companyName',
    'category', 'subcategory', 'commodityType', 'serviceType',
    'startDate', 'endDate', 'effectiveDate', 'expiryDate', 'signedDate',
    'contractValue', 'totalValue', 'annualSpend', 'unitPrice', 'currency', 'paymentTerms',
    'country', 'region', 'address', 'headquarters', 'deliveryLocations',
    'contactPerson', 'contactEmail', 'contactPhone',
    'terms', 'sla', 'warrantyPeriod', 'noticePeriod', 'renewalTerms',
    'performanceRating', 'riskLevel', 'certifications',
    'sourcingStrategy', 'savingsTarget', 'negotiationApproach', 'marketAnalysis',
  ];

  for (const field of fieldOrder) {
    const value = fields[field];
    if (value) {
      const displayName = fieldDisplayNames[field as string] || String(field);
      headers.push(displayName);
      row[displayName] = value;
    }
  }

  // If no fields were extracted, return empty
  if (headers.length === 0) {
    return { headers: [], rows: [] };
  }

  return { headers, rows: [row] };
};

// Detect document type based on content
export type DocumentType = 'contract' | 'supplier_master' | 'playbook' | 'invoice' | 'general';

export const detectDocumentType = (text: string): DocumentType => {
  const lowerText = text.toLowerCase();

  // Check for contract indicators
  const contractIndicators = [
    'agreement', 'contract', 'terms and conditions', 'hereby agrees',
    'parties agree', 'effective date', 'termination', 'indemnification',
    'governing law', 'dispute resolution', 'confidentiality'
  ];
  const contractScore = contractIndicators.filter(i => lowerText.includes(i)).length;

  // Check for supplier master indicators
  const supplierIndicators = [
    'supplier profile', 'vendor profile', 'company profile',
    'certifications', 'capabilities', 'service offerings',
    'delivery centers', 'annual revenue', 'employee count'
  ];
  const supplierScore = supplierIndicators.filter(i => lowerText.includes(i)).length;

  // Check for playbook indicators
  const playbookIndicators = [
    'sourcing strategy', 'category strategy', 'market analysis',
    'savings target', 'negotiation', 'supplier landscape',
    'cost drivers', 'best practices', 'risk mitigation'
  ];
  const playbookScore = playbookIndicators.filter(i => lowerText.includes(i)).length;

  // Check for invoice indicators
  const invoiceIndicators = [
    'invoice', 'bill to', 'ship to', 'payment due',
    'subtotal', 'tax', 'total amount', 'invoice number'
  ];
  const invoiceScore = invoiceIndicators.filter(i => lowerText.includes(i)).length;

  // Return the type with highest score
  const scores = [
    { type: 'contract' as DocumentType, score: contractScore },
    { type: 'supplier_master' as DocumentType, score: supplierScore },
    { type: 'playbook' as DocumentType, score: playbookScore },
    { type: 'invoice' as DocumentType, score: invoiceScore },
  ];

  scores.sort((a, b) => b.score - a.score);

  return scores[0].score > 1 ? scores[0].type : 'general';
};

// Get relevant field patterns based on document type
export const getRelevantFields = (docType: DocumentType): (keyof ExtractedFields)[] => {
  switch (docType) {
    case 'contract':
      return [
        'contractId', 'supplierName', 'buyerName', 'category',
        'startDate', 'endDate', 'contractValue', 'currency',
        'paymentTerms', 'terms', 'sla', 'noticePeriod', 'renewalTerms'
      ];
    case 'supplier_master':
      return [
        'supplierId', 'supplierName', 'category', 'serviceType',
        'country', 'region', 'headquarters', 'deliveryLocations',
        'contactPerson', 'contactEmail', 'contactPhone',
        'annualSpend', 'performanceRating', 'riskLevel', 'certifications'
      ];
    case 'playbook':
      return [
        'category', 'subcategory', 'sourcingStrategy', 'savingsTarget',
        'negotiationApproach', 'marketAnalysis', 'riskLevel', 'supplierName'
      ];
    case 'invoice':
      return [
        'poNumber', 'supplierName', 'contractValue', 'currency',
        'paymentTerms', 'startDate'
      ];
    default:
      return [
        'supplierName', 'category', 'contractValue', 'startDate', 'endDate',
        'country', 'contactEmail'
      ];
  }
};
