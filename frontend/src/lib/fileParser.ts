/**
 * Comprehensive File Parser
 * Supports: CSV, Excel (xlsx/xls), PDF, Word (docx), Markdown, Text, JSON, and more
 */

import * as XLSX from 'xlsx';
import {
  extractDocumentFields,
  fieldsToTableData,
  detectDocumentType,
  type DocumentType,
  type ExtractedFields
} from './documentFieldExtractor';

// Types for parsed data
export interface ParsedFileData {
  headers: string[];
  rows: Record<string, string>[];
  rawText?: string;
  htmlContent?: string; // For document files (DOCX, etc.) - rich HTML content for editing
  extractedFields?: ExtractedFields; // Smart-extracted fields from document content
  metadata?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    sheetName?: string;
    pageCount?: number;
    isDocument?: boolean; // True if this is a document file (not tabular data)
    documentType?: DocumentType; // Detected document type (contract, supplier_master, playbook, etc.)
  };
}

export type { ExtractedFields, DocumentType };

export interface ParseResult {
  success: boolean;
  data?: ParsedFileData;
  error?: string;
  fileCategory: 'spreadsheet' | 'document' | 'text' | 'unknown';
}

// Get file extension
const getFileExtension = (fileName: string): string => {
  return fileName.split('.').pop()?.toLowerCase() || '';
};

// Get file category based on extension
export const getFileCategory = (fileName: string): 'spreadsheet' | 'document' | 'text' | 'unknown' => {
  const ext = getFileExtension(fileName);

  if (['csv', 'xlsx', 'xls', 'xlsm', 'xlsb', 'ods'].includes(ext)) return 'spreadsheet';
  if (['pdf', 'doc', 'docx', 'rtf', 'odt'].includes(ext)) return 'document';
  if (['txt', 'md', 'markdown', 'json', 'xml', 'yaml', 'yml', 'tex', 'latex', 'html', 'htm', 'log', 'ini', 'cfg', 'conf'].includes(ext)) return 'text';

  return 'unknown';
};

// Parse CSV text - optimized for large files (1M+ rows)
const parseCSV = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
  // Fast line split using indexOf for better performance
  const lines: string[] = [];
  let start = 0;
  let end = text.indexOf('\n');

  while (end !== -1) {
    const line = text.slice(start, end).replace(/\r$/, '');
    if (line.trim()) lines.push(line);
    start = end + 1;
    end = text.indexOf('\n', start);
  }
  // Last line
  const lastLine = text.slice(start).replace(/\r$/, '');
  if (lastLine.trim()) lines.push(lastLine);

  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter (comma, semicolon, tab)
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t') && !firstLine.includes(',')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

  // Optimized row parser - uses char codes for speed
  const delimCode = delimiter.charCodeAt(0);
  const quoteCode = 34; // "

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    const len = line.length;

    for (let i = 0; i < len; i++) {
      const code = line.charCodeAt(i);

      if (code === quoteCode) {
        if (inQuotes && i + 1 < len && line.charCodeAt(i + 1) === quoteCode) {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (code === delimCode && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += line[i];
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const headerCount = headers.length;
  const rowCount = lines.length - 1;

  // Pre-allocate array for better performance
  const rows: Record<string, string>[] = new Array(rowCount);

  // Process in optimized loop
  for (let i = 0; i < rowCount; i++) {
    const values = parseRow(lines[i + 1]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headerCount; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows[i] = row;
  }

  return { headers, rows };
};

// Smart sheet selection for multi-sheet Excel files
const selectBestSheet = (workbook: XLSX.WorkBook): { sheetName: string; worksheet: XLSX.WorkSheet; reason: string } => {
  const sheetNames = workbook.SheetNames;

  // If only one sheet, use it
  if (sheetNames.length === 1) {
    return {
      sheetName: sheetNames[0],
      worksheet: workbook.Sheets[sheetNames[0]],
      reason: 'only sheet'
    };
  }

  // Priority 1: Look for sheets with data-related names (case-insensitive, flexible matching)
  const dataSheetPatterns = [
    // Exact/primary matches (highest priority)
    /^data$/i,
    /^spend[_\s]?data$/i,
    /^transactions?$/i,
    /^spend$/i,
    /^raw[_\s]?data$/i,
    // Contains patterns (medium priority)
    /spend/i,
    /transaction/i,
    /invoice/i,
    /purchase/i,
    /order/i,
    /detail/i,
    /record/i,
    /master/i,
    // Exclude patterns - sheets we should skip
  ];

  const excludePatterns = [
    /^summary$/i,
    /^overview$/i,
    /^dashboard$/i,
    /^chart/i,
    /^pivot/i,
    /^analysis$/i,
    /^result/i,
    /^output$/i,
    /^report$/i,
    /^template$/i,
    /^instruction/i,
    /^readme/i,
    /^config/i,
    /^setting/i,
  ];

  // Check each pattern in priority order
  for (const pattern of dataSheetPatterns) {
    for (const name of sheetNames) {
      // Skip if it matches an exclude pattern
      const shouldExclude = excludePatterns.some(exclude => exclude.test(name));
      if (shouldExclude) continue;

      if (pattern.test(name)) {
        return {
          sheetName: name,
          worksheet: workbook.Sheets[name],
          reason: `matched pattern "${pattern.source}"`
        };
      }
    }
  }

  // Priority 2: Find sheet with most data rows (likely the main data sheet)
  let bestSheet = sheetNames[0];
  let maxRows = 0;
  let bestReason = 'first sheet (fallback)';

  for (const name of sheetNames) {
    const worksheet = workbook.Sheets[name];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
    const rowCount = jsonData.length;

    // Skip sheets with very few rows (likely summary/config sheets)
    if (rowCount <= 5) continue;

    // Check if sheet has exclude pattern - deprioritize but don't skip entirely
    const isExcluded = excludePatterns.some(exclude => exclude.test(name));
    const effectiveRowCount = isExcluded ? rowCount * 0.5 : rowCount;

    if (effectiveRowCount > maxRows) {
      maxRows = effectiveRowCount;
      bestSheet = name;
      bestReason = `most data rows (${rowCount} rows)`;
    }
  }

  return {
    sheetName: bestSheet,
    worksheet: workbook.Sheets[bestSheet],
    reason: bestReason
  };
};

// Parse Excel file (xlsx, xls)
const parseExcel = async (file: File): Promise<ParsedFileData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        // Smart sheet selection - finds the best data sheet
        const { sheetName: selectedSheetName, worksheet, reason } = selectBestSheet(workbook);

        // Log sheet selection for debugging
        console.log(`[FileParser] Excel has ${workbook.SheetNames.length} sheets: [${workbook.SheetNames.join(', ')}]`);
        console.log(`[FileParser] Selected sheet: "${selectedSheetName}" (${reason})`);

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          resolve({ headers: [], rows: [], metadata: { fileName: file.name, fileType: 'excel', fileSize: file.size, sheetName: selectedSheetName } });
          return;
        }

        // First row as headers
        const headers = (jsonData[0] as unknown[]).map((h, idx) =>
          h !== undefined && h !== null ? String(h).trim() : `Column_${idx + 1}`
        );

        // Rest as rows
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const rowData = jsonData[i] as unknown[];
          if (!rowData || rowData.length === 0) continue;

          const row: Record<string, string> = {};
          headers.forEach((header, idx) => {
            const val = rowData[idx];
            row[header] = val !== undefined && val !== null ? String(val) : '';
          });
          rows.push(row);
        }

        resolve({
          headers,
          rows,
          metadata: {
            fileName: file.name,
            fileType: 'excel',
            fileSize: file.size,
            sheetName: selectedSheetName
          }
        });
      } catch (err) {
        reject(new Error(`Failed to parse Excel file: ${err}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// Parse text-based files (txt, md, json, xml, etc.)
const parseTextFile = async (file: File): Promise<ParsedFileData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const ext = getFileExtension(file.name);

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;

        // For JSON files, try to extract structured data
        if (ext === 'json') {
          try {
            const jsonData = JSON.parse(text);

            // If it's an array of objects, treat as table
            if (Array.isArray(jsonData) && jsonData.length > 0 && typeof jsonData[0] === 'object') {
              const headers = Object.keys(jsonData[0]);
              const rows = jsonData.map(item => {
                const row: Record<string, string> = {};
                headers.forEach(h => {
                  row[h] = item[h] !== undefined ? String(item[h]) : '';
                });
                return row;
              });
              resolve({ headers, rows, rawText: text, metadata: { fileName: file.name, fileType: 'json', fileSize: file.size } });
              return;
            }
          } catch {
            // Not valid JSON, treat as text
          }
        }

        // For markdown tables, try to extract
        if (ext === 'md' || ext === 'markdown') {
          const tableMatch = text.match(/\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/);
          if (tableMatch) {
            const headerLine = tableMatch[1];
            const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
            const rowLines = tableMatch[2].trim().split('\n');
            const rows = rowLines.map(line => {
              const values = line.split('|').map(v => v.trim()).filter(v => v);
              const row: Record<string, string> = {};
              headers.forEach((h, idx) => {
                row[h] = values[idx] || '';
              });
              return row;
            });
            resolve({ headers, rows, rawText: text, metadata: { fileName: file.name, fileType: 'markdown', fileSize: file.size } });
            return;
          }
        }

        // For XML, try to extract elements
        if (ext === 'xml') {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');
          const items = xmlDoc.getElementsByTagName('*');

          // Try to find repeated elements (rows)
          const tagCounts: Record<string, number> = {};
          for (let i = 0; i < items.length; i++) {
            const tag = items[i].tagName;
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }

          // Find most common repeated element (likely row element)
          const rowTag = Object.entries(tagCounts)
            .filter(([, count]) => count > 1)
            .sort((a, b) => b[1] - a[1])[0]?.[0];

          if (rowTag) {
            const rowElements = xmlDoc.getElementsByTagName(rowTag);
            if (rowElements.length > 0) {
              const firstRow = rowElements[0];
              const headers: string[] = [];
              for (let i = 0; i < firstRow.children.length; i++) {
                headers.push(firstRow.children[i].tagName);
              }

              const rows: Record<string, string>[] = [];
              for (let i = 0; i < rowElements.length; i++) {
                const row: Record<string, string> = {};
                for (let j = 0; j < rowElements[i].children.length; j++) {
                  const child = rowElements[i].children[j];
                  row[child.tagName] = child.textContent || '';
                }
                rows.push(row);
              }
              resolve({ headers, rows, rawText: text, metadata: { fileName: file.name, fileType: 'xml', fileSize: file.size } });
              return;
            }
          }
        }

        // Try smart field extraction for text files
        const documentType = detectDocumentType(text);
        const extractedFields = extractDocumentFields(text);
        const { headers: extractedHeaders, rows: extractedRows } = fieldsToTableData(extractedFields);

        // If we extracted fields, use them
        if (extractedHeaders.length > 0) {
          resolve({
            headers: extractedHeaders,
            rows: extractedRows,
            rawText: text,
            extractedFields,
            metadata: {
              fileName: file.name,
              fileType: ext,
              fileSize: file.size,
              isDocument: true,
              documentType
            }
          });
        } else {
          // Default: return as raw text with line-based structure
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          resolve({
            headers: ['Line', 'Content'],
            rows: lines.slice(0, 1000).map((line, idx) => ({ 'Line': String(idx + 1), 'Content': line })),
            rawText: text,
            metadata: { fileName: file.name, fileType: ext, fileSize: file.size, isDocument: true }
          });
        }
      } catch (err) {
        reject(new Error(`Failed to parse text file: ${err}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// Parse Word document (docx) - returns both HTML for editing and smart-extracted fields
const parseDocx = async (file: File): Promise<ParsedFileData> => {
  // Dynamic import for mammoth - need to get default export
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default || mammothModule;

  // Read file as ArrayBuffer directly (simpler than FileReader)
  const arrayBuffer = await file.arrayBuffer();

  // Get both HTML (for rich editing) and raw text (for extraction)
  const [htmlResult, textResult] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer }),
    mammoth.extractRawText({ arrayBuffer })
  ]);

  const htmlContent = htmlResult.value;
  const text = textResult.value;

  // Try to detect tables in text (tab-separated or consistent spacing)
  const lines = text.split(/\r?\n/).filter((l: string) => l.trim());

  // Check if it looks like a table (has tabs or consistent | separators)
  const hasTable = lines.some((l: string) => l.includes('\t') || l.split('|').length > 2);

  if (hasTable) {
    // Try to parse as table
    const delimiter = lines[0].includes('\t') ? '\t' : '|';
    const headers = lines[0].split(delimiter).map((h: string) => h.trim()).filter((h: string) => h);
    const rows = lines.slice(1).map((line: string) => {
      const values = line.split(delimiter).map((v: string) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h: string, idx: number) => {
        row[h] = values[idx] || '';
      });
      return row;
    }).filter((row: Record<string, string>) => Object.values(row).some(v => v));

    return {
      headers,
      rows,
      rawText: text,
      htmlContent,
      metadata: { fileName: file.name, fileType: 'docx', fileSize: file.size, isDocument: false }
    };
  } else {
    // Smart field extraction for documents
    const documentType = detectDocumentType(text);
    const extractedFields = extractDocumentFields(text);
    const { headers, rows } = fieldsToTableData(extractedFields);

    // If we extracted fields, use them; otherwise fall back to showing content
    if (headers.length > 0) {
      return {
        headers,
        rows,
        rawText: text,
        htmlContent,
        extractedFields,
        metadata: {
          fileName: file.name,
          fileType: 'docx',
          fileSize: file.size,
          isDocument: true,
          documentType
        }
      };
    } else {
      // Fallback: return as document content with HTML for rich editing
      return {
        headers: ['Content'],
        rows: [{ 'Content': text }],
        rawText: text,
        htmlContent,
        metadata: {
          fileName: file.name,
          fileType: 'docx',
          fileSize: file.size,
          isDocument: true,
          documentType
        }
      };
    }
  }
};

// Parse PDF file
const parsePDF = async (file: File): Promise<ParsedFileData> => {
  // Dynamic import for pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker path
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';
        const pageCount = pdf.numPages;

        // Extract text from all pages
        for (let i = 1; i <= pageCount; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: { str?: string }) => item.str || '')
            .join(' ');
          fullText += pageText + '\n';
        }

        const lines = fullText.split(/\r?\n/).filter(l => l.trim());

        // Try to detect tabular structure
        // Look for consistent spacing patterns that might indicate columns
        const spacingPattern = /\s{2,}/g;
        const hasConsistentSpacing = lines.slice(0, 10).every(l => spacingPattern.test(l));

        if (hasConsistentSpacing && lines.length > 1) {
          // Try to parse as table
          const firstLine = lines[0];
          const headers = firstLine.split(/\s{2,}/).map(h => h.trim()).filter(h => h);

          if (headers.length > 1) {
            const rows = lines.slice(1).map(line => {
              const values = line.split(/\s{2,}/).map(v => v.trim());
              const row: Record<string, string> = {};
              headers.forEach((h, idx) => {
                row[h] = values[idx] || '';
              });
              return row;
            }).filter(row => Object.values(row).some(v => v));

            resolve({
              headers,
              rows,
              rawText: fullText,
              metadata: { fileName: file.name, fileType: 'pdf', fileSize: file.size, pageCount }
            });
            return;
          }
        }

        // Smart field extraction for PDF documents
        const documentType = detectDocumentType(fullText);
        const extractedFields = extractDocumentFields(fullText);
        const { headers: extractedHeaders, rows: extractedRows } = fieldsToTableData(extractedFields);

        // If we extracted fields, use them
        if (extractedHeaders.length > 0) {
          resolve({
            headers: extractedHeaders,
            rows: extractedRows,
            rawText: fullText,
            extractedFields,
            metadata: {
              fileName: file.name,
              fileType: 'pdf',
              fileSize: file.size,
              pageCount,
              isDocument: true,
              documentType
            }
          });
        } else {
          // Fallback: return as text content
          resolve({
            headers: ['Line', 'Content'],
            rows: lines.slice(0, 1000).map((line, idx) => ({ 'Line': String(idx + 1), 'Content': line })),
            rawText: fullText,
            metadata: {
              fileName: file.name,
              fileType: 'pdf',
              fileSize: file.size,
              pageCount,
              isDocument: true,
              documentType
            }
          });
        }
      } catch (err) {
        reject(new Error(`Failed to parse PDF: ${err}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// Main parse function
export const parseFile = async (file: File): Promise<ParseResult> => {
  const ext = getFileExtension(file.name);
  const category = getFileCategory(file.name);

  try {
    let data: ParsedFileData;

    switch (ext) {
      // Spreadsheets
      case 'csv':
        const csvText = await file.text();
        const csvData = parseCSV(csvText);
        data = { ...csvData, metadata: { fileName: file.name, fileType: 'csv', fileSize: file.size } };
        break;

      case 'xlsx':
      case 'xls':
      case 'xlsm':
      case 'xlsb':
      case 'ods':
        data = await parseExcel(file);
        break;

      // Documents
      case 'pdf':
        data = await parsePDF(file);
        break;

      case 'docx':
        data = await parseDocx(file);
        break;

      case 'doc':
        // Old .doc format is harder to parse, return basic info
        data = {
          headers: ['Info'],
          rows: [{ 'Info': 'Legacy .doc format - please convert to .docx for full parsing' }],
          metadata: { fileName: file.name, fileType: 'doc', fileSize: file.size }
        };
        break;

      // Text-based files
      case 'txt':
      case 'md':
      case 'markdown':
      case 'json':
      case 'xml':
      case 'yaml':
      case 'yml':
      case 'tex':
      case 'latex':
      case 'html':
      case 'htm':
      case 'log':
      case 'ini':
      case 'cfg':
      case 'conf':
      case 'rtf':
        data = await parseTextFile(file);
        break;

      default:
        // Try to read as text
        try {
          data = await parseTextFile(file);
        } catch {
          data = {
            headers: ['Info'],
            rows: [{ 'Info': `Unsupported file type: ${ext}` }],
            metadata: { fileName: file.name, fileType: ext, fileSize: file.size }
          };
        }
    }

    return { success: true, data, fileCategory: category };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error parsing file',
      fileCategory: category
    };
  }
};

// Supported formats for UI display
export const SUPPORTED_FILE_FORMATS = {
  spreadsheet: ['csv', 'xlsx', 'xls', 'xlsm', 'xlsb', 'ods'],
  document: ['pdf', 'docx', 'doc', 'rtf', 'odt'],
  text: ['txt', 'md', 'markdown', 'json', 'xml', 'yaml', 'yml', 'tex', 'latex', 'html', 'htm', 'log', 'ini', 'cfg', 'conf']
};

export const SUPPORTED_FORMATS_STRING = [
  ...SUPPORTED_FILE_FORMATS.spreadsheet,
  ...SUPPORTED_FILE_FORMATS.document,
  ...SUPPORTED_FILE_FORMATS.text
].map(ext => `.${ext}`).join(',');
