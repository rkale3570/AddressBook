import { Injectable, Logger } from '@nestjs/common';
import { ScanResultDto } from '../common/scan-result.dto';

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  async processImage(imageBuffer: Buffer): Promise<ScanResultDto> {
    this.logger.log(`Processing image: ${imageBuffer.length} bytes`);

    let rawText = '';
    try {
      this.logger.log('Initializing Tesseract worker...');
      const { createWorker } = await import('tesseract.js');

      this.logger.log('Creating worker with language: eng');
      const worker = await createWorker('eng');
      this.logger.log('Worker created successfully');

      this.logger.log('Recognizing text...');
      const { data } = await worker.recognize(imageBuffer);
      this.logger.log(`Recognition complete. Text: ${data.text?.substring(0, 200)}... (confidence: ${data.confidence})`);
      await worker.terminate();

      rawText = data.text || '';
    } catch (err: any) {
      this.logger.error(`OCR failed: ${err.message}`);
      if (err.stack) this.logger.error(err.stack);
      throw new Error(`OCR processing failed: ${err.message}`);
    }

    if (!rawText.trim()) {
      throw new Error('No readable text was detected in the image.');
    }

    return this.parseText(rawText);
  }

  parseText(text: string): ScanResultDto {
    const result: ScanResultDto = {};
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    this.logger.log(`Parsing ${lines.length} lines: ${JSON.stringify(lines)}`);

    if (lines.length === 0) {
      throw new Error('No readable text was detected in the image.');
    }

    const emailSet = new Set<string>();
    const phoneSet = new Map<string, string>();
    const usedLines = new Set<number>();

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /\+?[\d\s\-\(\)]{7,20}/;
    const websiteRegex = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}\b/;
    const addressRegex = /\d+\s+[A-Za-z]/;
    const companyKeywords = ['inc', 'llc', 'corp', 'ltd', 'co ', 'company', 'realty', 'properties', 'group', 'solutions', 'technologies', 'consulting', 'services', 'enterprises', 'associates', 'partners', 'best'];
    const titleKeywords = ['manager', 'director', 'coordinates', 'president', 'ceo', 'cto', 'cfo', 'coo', 'engineer', 'developer', 'sales', 'agent', 'broker', 'specialist', 'coordinator', 'consultant', 'analyst', 'assistant', 'attorney', 'accountant', 'inspector', 'officer', 'lead', 'head', 'supervisor', 'admin', 'representative', 'executive'];

    // Maps a detected keyword to the canonical label used in the app's
    // Business Relationship dropdown (BUSINESS_RELATIONSHIPS in the frontend).
    // Longer/more specific phrases are listed first so they're matched before
    // their shorter substrings (e.g. "mortgage broker" before "broker").
    const relationshipKeywordMap: [string, string][] = [
      ['mortgage broker', 'Mortgage Broker'],
      ['accountant', 'Accountant'],
      ['attorney', 'Attorney'],
      ['contractor', 'Contractor'],
      ['inspector', 'Inspector'],
      ['supplier', 'Supplier'],
      ['customer', 'Customer'],
      ['employee', 'Employee'],
      ['vendor', 'Vendor'],
      ['client', 'Client'],
      ['friend', 'Friend'],
    ];

    // Word-boundary match so a keyword only counts as a relationship when it's
    // a standalone word — otherwise e.g. a company line "Accountants Group" or
    // "Friendly Realty" would be misread as a Business Relationship.
    const findRelationship = (line: string): string | undefined => {
      const match = relationshipKeywordMap.find(([keyword]) =>
        new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(line),
      );
      return match?.[1];
    };

    const potentialEmails = lines.flatMap((line, index) => {
      const matches = line.match(emailRegex);
      return matches ? matches.map(m => ({ index, email: m })) : [];
    });

    this.logger.log(`Found ${potentialEmails.length} email-like patterns in lines: ${JSON.stringify(potentialEmails.map(e => e.email))}`);

    for (const { index, email } of potentialEmails) {
      if (!emailSet.has(email.toLowerCase())) {
        emailSet.add(email.toLowerCase());
        usedLines.add(index);
        this.logger.log(`Matched email: ${email}`);
      }
    }

    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = lines[i];

      const cleanLine = line.replace(/[^\d+\-() ]/g, '').trim();
      if (phoneRegex.test(line) && /\d{3,}/.test(cleanLine)) {
        const digits = cleanLine.replace(/[^\d]/g, '');
        if (digits.length >= 7 && digits.length <= 15) {
          const type = line.toLowerCase().includes('mobile') || line.toLowerCase().includes('cell') ? 'mobile'
            : line.toLowerCase().includes('office') || line.toLowerCase().includes('work') ? 'office'
            : line.toLowerCase().includes('home') ? 'home' : 'other';
          phoneSet.set(digits, type);
          usedLines.add(i);
          this.logger.log(`Matched phone: ${digits} (${type}) from line: "${line}"`);
          continue;
        }
      }

      const websiteMatch = line.match(websiteRegex);
      if (websiteMatch && !result.website) {
        let url = websiteMatch[0];
        if (!url.startsWith('http')) url = 'https://' + url;
        result.website = url;
        usedLines.add(i);
        this.logger.log(`Matched website: ${url}`);
        continue;
      }

      if (!result.businessRelationship) {
        const relLabel = findRelationship(line);
        if (relLabel) {
          result.businessRelationship = relLabel;
          usedLines.add(i);
          continue;
        }
      }
    }

    let nameFound = false;
    let nameIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = lines[i];
      const lower = line.toLowerCase();

      if (!result.businessRelationship) {
        const relLabel = findRelationship(line);
        if (relLabel) {
          result.businessRelationship = relLabel;
          usedLines.add(i);
          continue;
        }
      }

      if (!nameFound) {
        const words = line.split(/\s+/).filter(w => w.length > 1);
        if (words.length >= 2 && words.length <= 6 && line.length < 50) {
          result.fullName = line;
          nameFound = true;
          nameIndex = i;
          usedLines.add(i);
          this.logger.log(`Matched name: ${line}`);
          continue;
        }
      }

      if (nameFound && !result.jobTitle) {
        const hasTitle = titleKeywords.some(k => lower.includes(k));

        // Business-card convention is Name → Title → Company, so the line
        // immediately below the name is very likely the job title even when it
        // contains none of our title keywords (e.g. "Realtor", "Photographer").
        // Previously such titles were dropped AND the company detector then
        // grabbed the title line, so the real company was lost entirely.
        // Only apply this positional fallback when a *separate* line is still
        // available to serve as the company, so a card that has a company but
        // no title doesn't get its company line mislabeled as a title.
        const looksLikeCompany = companyKeywords.some(k => lower.includes(k));
        const hasLaterCompanyCandidate = lines.some(
          (l, j) => j > i && !usedLines.has(j) && !addressRegex.test(l),
        );
        const isLineAfterName = i === nameIndex + 1;

        if (hasTitle || (isLineAfterName && !looksLikeCompany && !addressRegex.test(line) && hasLaterCompanyCandidate)) {
          result.jobTitle = line;
          usedLines.add(i);
          this.logger.log(`Matched title: ${line}`);
          continue;
        }
      }
    }

    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = lines[i];
      const lower = line.toLowerCase();

      if (!result.company) {
        const isCompany = companyKeywords.some(k => lower.includes(k));
        if (isCompany || (line.split(' ').length >= 1 && line.length < 40 && !addressRegex.test(line))) {
          result.company = line;
          usedLines.add(i);
          this.logger.log(`Matched company: ${line}`);
          continue;
        }
      }
    }

    const addressLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = lines[i];
      if (addressRegex.test(line) || (line.length > 10 && /\d/.test(line))) {
        addressLines.push(line);
        usedLines.add(i);
      }
    }
    if (addressLines.length > 0) {
      result.address = addressLines.join(', ');
      this.logger.log(`Matched address: ${result.address}`);
    }

    result.emails = Array.from(emailSet).map(email => ({ email, type: 'work' }));
    result.phones = Array.from(phoneSet.entries()).map(([phone, type]) => ({ phone, type }));

    // Requirement: default to "Other" whenever a relationship can't be determined.
    if (!result.businessRelationship) {
      result.businessRelationship = 'Other';
    }

    this.logger.log(`Final result: ${JSON.stringify(result)}`);
    return result;
  }
}
