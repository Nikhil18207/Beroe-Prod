/**
 * Generate DOCX files that match the Food & Beverages XLSX spend data
 * Creates: Supplier_Master, Contract, and Category_Playbook documents
 */

const path = require('path');
// Load docx from frontend node_modules
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, BorderStyle, AlignmentType } = require(path.join(__dirname, '../frontend/node_modules/docx'));
const fs = require('fs');

// Data extracted from the Food & Beverages XLSX
const suppliers = [
  { id: "SUP-01", name: "AgriGlobal Ltd", country: "Indonesia", region: "APAC", tier: "Tier 1", marketShare: 12, contact: "Ahmad Wijaya", email: "ahmad.wijaya@agriglobal.com", phone: "+62-21-555-0101", address: "Jl. Sudirman No. 45, Jakarta 12190, Indonesia", certifications: "ISO 9001, FSSC 22000, Halal", paymentTerms: "Net 30", establishedYear: 2005 },
  { id: "SUP-02", name: "EuroFoods GmbH", country: "Germany", region: "EMEA", tier: "Tier 1", marketShare: 8, contact: "Hans Mueller", email: "h.mueller@eurofoods.de", phone: "+49-30-555-0202", address: "Friedrichstraße 123, 10117 Berlin, Germany", certifications: "ISO 9001, BRC, IFS", paymentTerms: "Net 45", establishedYear: 1998 },
  { id: "SUP-03", name: "LatAm Agro SA", country: "Brazil", region: "LATAM", tier: "Tier 1", marketShare: 10, contact: "Carlos Silva", email: "carlos.silva@latamargo.com.br", phone: "+55-11-555-0303", address: "Av. Paulista 1500, São Paulo, SP 01310-100, Brazil", certifications: "ISO 9001, FSSC 22000, Rainforest Alliance", paymentTerms: "Net 30", establishedYear: 2001 },
  { id: "SUP-04", name: "NorthFarm Inc", country: "USA", region: "North America", tier: "Tier 1", marketShare: 7, contact: "John Smith", email: "j.smith@northfarm.com", phone: "+1-312-555-0404", address: "500 Michigan Ave, Chicago, IL 60611, USA", certifications: "ISO 9001, SQF, USDA Organic", paymentTerms: "Net 30", establishedYear: 1995 }
];

const categories = [
  { level1: "Raw Materials", level2: "Food Inputs", level3: "Sugar", commodity: "Sugar" },
  { level1: "Raw Materials", level2: "Food Inputs", level3: "Milk", commodity: "Milk" },
  { level1: "Raw Materials", level2: "Food Inputs", level3: "Edible Oil", commodity: "Edible Oil" },
  { level1: "Raw Materials", level2: "Food Inputs", level3: "Packaging", commodity: "Packaging" },
  { level1: "Raw Materials", level2: "Food Inputs", level3: "Wheat", commodity: "Wheat" }
];

const items = [
  { code: "SKU-SUG-02", desc: "Refined Sugar", uom: "KG", category: "Sugar" },
  { code: "SKU-MLK-03", desc: "Skimmed Milk Powder", uom: "KG", category: "Milk" },
  { code: "SKU-OIL-04", desc: "Edible Oil", uom: "LTR", category: "Edible Oil" },
  { code: "SKU-PKG-05", desc: "Food Packaging Film", uom: "KG", category: "Packaging" },
  { code: "SKU-WHT-01", desc: "Wheat Flour Grade A", uom: "KG", category: "Wheat" }
];

// Helper function to create table cell
function createCell(text, isHeader = false) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: text || '', bold: isHeader })],
      alignment: AlignmentType.LEFT
    })],
    shading: isHeader ? { fill: "E8E8E8" } : undefined
  });
}

// Helper function to create table row
function createRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map(cell => createCell(cell, isHeader))
  });
}

// ============================================
// SUPPLIER MASTER DOCUMENT
// ============================================
async function createSupplierMaster() {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "SUPPLIER MASTER DATA",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          text: "Food & Beverages Category - GlobalFoods Ltd",
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        new Paragraph({
          text: "Document Information",
          heading: HeadingLevel.HEADING_2
        }),
        new Paragraph({ text: `Document ID: SM-FB-2025-001` }),
        new Paragraph({ text: `Last Updated: ${new Date().toISOString().split('T')[0]}` }),
        new Paragraph({ text: `Category: Food & Beverages` }),
        new Paragraph({ text: `Total Suppliers: ${suppliers.length}`, spacing: { after: 400 } }),

        new Paragraph({
          text: "Supplier Summary Table",
          heading: HeadingLevel.HEADING_2
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createRow(["Supplier ID", "Supplier Name", "Country", "Region", "Tier", "Market Share %"], true),
            ...suppliers.map(s => createRow([s.id, s.name, s.country, s.region, s.tier, String(s.marketShare)]))
          ]
        }),
        new Paragraph({ text: "", spacing: { after: 400 } }),

        // Detailed supplier information
        ...suppliers.flatMap(s => [
          new Paragraph({
            text: `${s.name} (${s.id})`,
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({ text: `Supplier ID: ${s.id}` }),
          new Paragraph({ text: `Legal Name: ${s.name}` }),
          new Paragraph({ text: `Country: ${s.country}` }),
          new Paragraph({ text: `Region: ${s.region}` }),
          new Paragraph({ text: `Tier: ${s.tier}` }),
          new Paragraph({ text: `Market Share: ${s.marketShare}%` }),
          new Paragraph({ text: `Primary Contact: ${s.contact}` }),
          new Paragraph({ text: `Email: ${s.email}` }),
          new Paragraph({ text: `Phone: ${s.phone}` }),
          new Paragraph({ text: `Address: ${s.address}` }),
          new Paragraph({ text: `Certifications: ${s.certifications}` }),
          new Paragraph({ text: `Payment Terms: ${s.paymentTerms}` }),
          new Paragraph({ text: `Established: ${s.establishedYear}`, spacing: { after: 300 } })
        ])
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(path.join(__dirname, '../backend/data/Supplier_Master_Client_Sample.docx'), buffer);
  console.log('Created: Supplier_Master_Client_Sample.docx');
}

// ============================================
// CONTRACT DOCUMENT
// ============================================
async function createContract() {
  const contracts = suppliers.map((s, idx) => ({
    id: `CTR-FB-2025-00${idx + 1}`,
    supplierId: s.id,
    supplierName: s.name,
    startDate: "2025-01-01",
    endDate: "2026-12-31",
    value: (500000 + idx * 150000).toLocaleString(),
    currency: "USD",
    status: "Active",
    autoRenewal: idx % 2 === 0 ? "Yes" : "No",
    noticePeriod: "90 days",
    paymentTerms: s.paymentTerms,
    items: items.filter((_, i) => i % suppliers.length === idx || (idx === 0 && i === suppliers.length - 1)).map(i => i.desc).join(", ") || items[0].desc
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "MASTER SERVICE AGREEMENTS & CONTRACTS",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          text: "Food & Beverages Category - GlobalFoods Ltd",
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        new Paragraph({
          text: "Document Information",
          heading: HeadingLevel.HEADING_2
        }),
        new Paragraph({ text: `Document ID: CTR-FB-2025-MASTER` }),
        new Paragraph({ text: `Last Updated: ${new Date().toISOString().split('T')[0]}` }),
        new Paragraph({ text: `Total Active Contracts: ${contracts.length}`, spacing: { after: 400 } }),

        new Paragraph({
          text: "Contract Summary Table",
          heading: HeadingLevel.HEADING_2
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createRow(["Contract ID", "Supplier", "Start Date", "End Date", "Value (USD)", "Status"], true),
            ...contracts.map(c => createRow([c.id, c.supplierName, c.startDate, c.endDate, c.value, c.status]))
          ]
        }),
        new Paragraph({ text: "", spacing: { after: 400 } }),

        // Detailed contract information
        ...contracts.flatMap(c => [
          new Paragraph({
            text: `Contract: ${c.id}`,
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({ text: `Contract ID: ${c.id}` }),
          new Paragraph({ text: `Supplier ID: ${c.supplierId}` }),
          new Paragraph({ text: `Supplier Name: ${c.supplierName}` }),
          new Paragraph({ text: `Start Date: ${c.startDate}` }),
          new Paragraph({ text: `End Date: ${c.endDate}` }),
          new Paragraph({ text: `Contract Value: $${c.value} ${c.currency}` }),
          new Paragraph({ text: `Status: ${c.status}` }),
          new Paragraph({ text: `Auto Renewal: ${c.autoRenewal}` }),
          new Paragraph({ text: `Notice Period: ${c.noticePeriod}` }),
          new Paragraph({ text: `Payment Terms: ${c.paymentTerms}` }),
          new Paragraph({ text: `Covered Items: ${c.items}` }),
          new Paragraph({
            text: "Terms and Conditions:",
            spacing: { before: 200 }
          }),
          new Paragraph({ text: "1. Pricing shall remain fixed for the contract period unless commodity index variance exceeds 15%." }),
          new Paragraph({ text: "2. Quality standards must meet FSSC 22000 certification requirements." }),
          new Paragraph({ text: "3. Delivery terms: CIF to designated GlobalFoods warehouses." }),
          new Paragraph({ text: "4. Dispute resolution through ICC arbitration.", spacing: { after: 300 } })
        ])
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(path.join(__dirname, '../backend/data/Contract_Client_Sample.docx'), buffer);
  console.log('Created: Contract_Client_Sample.docx');
}

// ============================================
// CATEGORY PLAYBOOK DOCUMENT
// ============================================
async function createCategoryPlaybook() {
  const playbooks = categories.map((cat, idx) => ({
    category: cat.level3,
    commodity: cat.commodity,
    hierarchy: `${cat.level1} > ${cat.level2} > ${cat.level3}`,
    savingsTarget: `${8 + idx * 2}%`,
    sourcingStrategy: idx % 2 === 0 ? "Competitive Bidding" : "Strategic Partnership",
    riskLevel: idx < 2 ? "Medium" : "Low",
    preferredSuppliers: suppliers.slice(0, 2 + idx % 2).map(s => s.name).join(", "),
    marketTrend: idx % 3 === 0 ? "Up" : idx % 3 === 1 ? "Stable" : "Down",
    negotiationApproach: ["Volume consolidation", "Long-term contracts", "Index-linked pricing", "Multi-source strategy"][idx % 4],
    qualityRequirements: ["FSSC 22000", "ISO 9001", "BRC", "Halal certification"][idx % 4]
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "CATEGORY SOURCING PLAYBOOK",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER
        }),
        new Paragraph({
          text: "Food & Beverages - Raw Materials",
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        new Paragraph({
          text: "Document Information",
          heading: HeadingLevel.HEADING_2
        }),
        new Paragraph({ text: `Document ID: PB-FB-2025-001` }),
        new Paragraph({ text: `Last Updated: ${new Date().toISOString().split('T')[0]}` }),
        new Paragraph({ text: `Owner: Procurement Excellence Team` }),
        new Paragraph({ text: `Categories Covered: ${categories.length}`, spacing: { after: 400 } }),

        new Paragraph({
          text: "Category Overview",
          heading: HeadingLevel.HEADING_2
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createRow(["Category", "Savings Target", "Strategy", "Risk Level"], true),
            ...playbooks.map(p => createRow([p.category, p.savingsTarget, p.sourcingStrategy, p.riskLevel]))
          ]
        }),
        new Paragraph({ text: "", spacing: { after: 400 } }),

        // Detailed playbook for each category
        ...playbooks.flatMap(p => [
          new Paragraph({
            text: `${p.category} Category Playbook`,
            heading: HeadingLevel.HEADING_2
          }),
          new Paragraph({ text: `Category: ${p.category}` }),
          new Paragraph({ text: `Commodity Type: ${p.commodity}` }),
          new Paragraph({ text: `Category Hierarchy: ${p.hierarchy}` }),
          new Paragraph({ text: `Savings Target: ${p.savingsTarget}` }),
          new Paragraph({ text: `Sourcing Strategy: ${p.sourcingStrategy}` }),
          new Paragraph({ text: `Risk Level: ${p.riskLevel}` }),
          new Paragraph({ text: `Market Trend: ${p.marketTrend}` }),
          new Paragraph({ text: `Preferred Suppliers: ${p.preferredSuppliers}` }),
          new Paragraph({ text: `Negotiation Approach: ${p.negotiationApproach}` }),
          new Paragraph({ text: `Quality Requirements: ${p.qualityRequirements}` }),
          new Paragraph({
            text: "Strategic Recommendations:",
            spacing: { before: 200 }
          }),
          new Paragraph({ text: "1. Monitor commodity index prices weekly for market timing opportunities." }),
          new Paragraph({ text: "2. Maintain at least 2 qualified suppliers per category for supply security." }),
          new Paragraph({ text: "3. Negotiate index-linked pricing with floor/ceiling mechanisms." }),
          new Paragraph({ text: "4. Conduct quarterly business reviews with strategic suppliers.", spacing: { after: 300 } })
        ]),

        new Paragraph({
          text: "Item Catalog",
          heading: HeadingLevel.HEADING_2
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createRow(["Item Code", "Description", "Unit of Measure", "Category"], true),
            ...items.map(i => createRow([i.code, i.desc, i.uom, i.category]))
          ]
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(path.join(__dirname, '../backend/data/Category_Playbook_Client_Sample.docx'), buffer);
  console.log('Created: Category_Playbook_Client_Sample.docx');
}

// Run all generators
async function main() {
  try {
    await createSupplierMaster();
    await createContract();
    await createCategoryPlaybook();
    console.log('\nAll DOCX files created successfully!');
    console.log('Files are located in: backend/data/');
  } catch (error) {
    console.error('Error creating documents:', error);
    process.exit(1);
  }
}

main();
