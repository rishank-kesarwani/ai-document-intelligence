/**
 * Generates valid minimal PDF binary buffers containing text for synthetic/redacted demonstration documents.
 * These are 100% compliant PDF 1.4 documents with real xref tables and content streams.
 */
export class SyntheticDocumentsUtil {
  static createMinimalPdf(lines: string[]): Buffer {
    // Build text object commands for PDF content stream
    let textStream = 'BT\n/F1 12 Tf\n50 720 Td\n18 TL\n';
    for (const line of lines) {
      // Escape parentheses and backslashes in PDF literal strings
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      textStream += `(${escaped}) '\n`;
    }
    textStream += 'ET';

    const streamLength = Buffer.byteLength(textStream, 'utf8');

    const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
    const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
    const obj3 =
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';
    const obj4 = `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${textStream}\nendstream\nendobj\n`;
    const obj5 =
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

    const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';

    const offsets: number[] = [];
    let currentOffset = Buffer.byteLength(header, 'binary');

    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj1, 'binary');

    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj2, 'binary');

    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj3, 'binary');

    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj4, 'binary');

    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj5, 'binary');

    const xrefOffset = currentOffset;
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (const off of offsets) {
      const padded = off.toString().padStart(10, '0');
      xref += `${padded} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    const fullPdf = header + obj1 + obj2 + obj3 + obj4 + obj5 + xref + trailer;
    return Buffer.from(fullPdf, 'binary');
  }

  static getSampleInvoice(): { filename: string; buffer: Buffer; metadata: any } {
    const lines = [
      '*** DEMONSTRATION DATA - SYNTHETIC / REDACTED ***',
      'ACME CLOUD SOLUTIONS INC.',
      '100 Silicon Boulevard, Suite 500, San Jose, CA 95134',
      'Contact: billing@acmecloud.example.com',
      '',
      'INVOICE',
      'Invoice Number: INV-2026-9042',
      'Invoice Date: 2026-10-15',
      'Due Date: 2026-11-15',
      'Payment Terms: Net 30',
      'Currency: USD',
      '',
      'BILL TO:',
      'Global Logistics Partners LLC',
      'Customer ID: CUST-8831',
      '',
      'DESCRIPTION                      QTY    UNIT PRICE    TOTAL',
      '------------------------------------------------------------',
      'Enterprise Cloud Infrastructure    1    $10,000.00   $10,000.00',
      'Managed Security Operations       1     $2,500.00    $2,500.00',
      '------------------------------------------------------------',
      'Subtotal: $12,500.00',
      'Tax (10%): $1,250.00',
      'Total Amount: $13,750.00',
      '',
      'Status: PENDING_PAYMENT',
      'Routing Number: *****1234 (Redacted)',
      'Account Number: *******7890 (Redacted)',
      '*** END OF DEMO INVOICE ***',
    ];

    return {
      filename: 'demo-invoice-acme-inv9042.pdf',
      buffer: this.createMinimalPdf(lines),
      metadata: {
        documentType: 'invoice',
        isDemo: true,
        schemaId: 'invoice-v1',
      },
    };
  }

  static getSampleContract(): { filename: string; buffer: Buffer; metadata: any } {
    const lines = [
      '*** DEMONSTRATION DATA - SYNTHETIC / REDACTED ***',
      'MUTUAL NON-DISCLOSURE AGREEMENT',
      '',
      'This Mutual Non-Disclosure Agreement is entered into on 2026-11-01',
      'Parties:',
      '1. Apex Technologies Corp ("Disclosing Party")',
      '2. Nova Dynamics Inc ("Receiving Party")',
      '',
      'Agreement Title: Mutual Non-Disclosure Agreement',
      'Effective Date: 2026-11-01',
      'Expiration Date: 2028-11-01',
      'Term of Confidentiality: 3 Years from date of disclosure',
      'Governing Law: State of California',
      'Liability Cap: $100,000.00',
      '',
      'Signatures:',
      'Authorized Representative: J. Doe (VP Engineering)',
      'Authorized Representative: S. Smith (General Counsel)',
      '*** END OF DEMO CONTRACT ***',
    ];

    return {
      filename: 'demo-contract-nda-apex-nova.pdf',
      buffer: this.createMinimalPdf(lines),
      metadata: {
        documentType: 'contract',
        isDemo: true,
        schemaId: 'contract-v1',
      },
    };
  }

  static getSampleTaxForm(): { filename: string; buffer: Buffer; metadata: any } {
    const lines = [
      '*** DEMONSTRATION DATA - SYNTHETIC / REDACTED ***',
      'FORM W-9 (Request for Taxpayer Identification Number and Certification)',
      '',
      'Name of Taxpayer: TechVentures Systems LLC',
      'Business Name / Disregarded Entity: TechVentures Cloud',
      'Federal Tax Classification: Limited Liability Company',
      'Exemptions: Exempt Payee Code 1',
      'Address: 100 Innovation Way, Suite 400',
      'City, State, Zip: Austin, TX 78701',
      'Taxpayer Identification Number (EIN): XX-XXX8921 (Redacted)',
      'Certification Date: 2026-01-10',
      'Certified under penalties of perjury.',
      '*** END OF DEMO W-9 TAX FORM ***',
    ];

    return {
      filename: 'demo-tax-form-w9-techventures.pdf',
      buffer: this.createMinimalPdf(lines),
      metadata: {
        documentType: 'tax_form',
        isDemo: true,
        schemaId: 'tax-form-w9',
      },
    };
  }
}
