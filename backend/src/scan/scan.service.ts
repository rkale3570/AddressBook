import { Injectable, Logger } from '@nestjs/common';
import { ScanResultDto } from '../common/scan-result.dto';

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  async processImage(imageBuffer: Buffer): Promise<ScanResultDto> {
    this.logger.log(`Processing image: ${imageBuffer.length} bytes`);

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

      return this.parseText(data.text || '');
    } catch (err: any) {
      this.logger.error(`OCR failed: ${err.message}`);
      if (err.stack) this.logger.error(err.stack);
      throw new Error(`OCR processing failed: ${err.message}`);
    }
  }

  parseText(text: string): ScanResultDto {
    const result: ScanResultDto = {};
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    this.logger.log(`Parsing ${lines.length} lines: ${JSON.stringify(lines)}`);

    const emailSet = new Set<string>();
    const phoneSet = new Map<string, string>();
    const usedLines = new Set<number>();

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /\+?[\d\s\-\(\)]{7,20}/;
    const websiteRegex = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}\b/;
    const addressRegex = /\d+\s+[A-Za-z]/;
    const companyKeywords = ['inc', 'llc', 'corp', 'ltd', 'co ', 'company', 'realty', 'properties', 'group', 'solutions', 'technologies', 'consulting', 'services', 'enterprises', 'associates', 'partners', 'best'];
    const titleKeywords = ['manager', 'director', 'coordinates', 'president', 'ceo', 'cto', 'cfo', 'coo', 'engineer', 'developer', 'sales', 'agent', 'broker', 'specialist', 'coordinator', 'consultant', 'analyst', 'assistant', 'attorney', 'accountant', 'inspector', 'officer', 'lead', 'head', 'supervisor', 'admin', 'representative', 'executive'];
    const relationshipKeywords = ['client', 'vendor', 'accountant', 'attorney', 'mortgage broker', 'inspector', 'contractor', 'friend'];

    let potentialEmails = lines.flatMap(line => {
      const matches = line.match(emailRegex);
      return matches ? matches.map(m => ({ line, email: m })) : [];
    });

    this.logger.log(`Found ${potentialEmails.length} email-like patterns in lines: ${JSON.stringify(potentialEmails.map(e => e.email))}`);

    for (const { line, email } of potentialEmails) {
      if (!emailSet.has(email.toLowerCase())) {
        emailSet.add(email.toLowerCase());
        usedLines.add(lines.indexOf(line));
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

      const relKeyword = relationshipKeywords.find(k => line.toLowerCase().includes(k));
      if (relKeyword && !result.businessRelationship) {
        result.businessRelationship = relKeyword.charAt(0).toUpperCase() + relKeyword.slice(1);
        usedLines.add(i);
        continue;
      }
    }

    let nameFound = false;
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = lines[i];
      const lower = line.toLowerCase();

      if (!result.businessRelationship) {
        const relKeyword = relationshipKeywords.find(k => lower.includes(k));
        if (relKeyword) {
          result.businessRelationship = relKeyword.charAt(0).toUpperCase() + relKeyword.slice(1);
          usedLines.add(i);
          continue;
        }
      }

      if (!nameFound) {
        const words = line.split(/\s+/).filter(w => w.length > 1);
        if (words.length >= 2 && words.length <= 6 && line.length < 50) {
          result.fullName = line;
          nameFound = true;
          usedLines.add(i);
          this.logger.log(`Matched name: ${line}`);
          continue;
        }
      }

      if (nameFound && !result.jobTitle) {
        const hasTitle = titleKeywords.some(k => lower.includes(k));
        if (hasTitle) {
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

    this.logger.log(`Final result: ${JSON.stringify(result)}`);
    return result;
  }
}