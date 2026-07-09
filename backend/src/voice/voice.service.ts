import { Injectable, Logger } from '@nestjs/common';
import { ScanResultDto } from '../common/scan-result.dto';

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const WEBSITE_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?\b/gi;
const ADDRESS_REGEX = /\d+\s+\w+\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|blvd|boulevard|way|court|ct|place|pl|highway|hwy)\b/i;

const RELATIONSHIP_KEYWORDS = [
  'client', 'vendor', 'accountant', 'attorney', 'mortgage broker',
  'inspector', 'contractor', 'friend',
];

const TITLE_KEYWORDS = [
  'manager', 'director', 'president', 'ceo', 'cto', 'cfo', 'coo',
  'engineer', 'developer', 'sales', 'agent', 'broker', 'specialist',
  'coordinator', 'consultant', 'analyst', 'assistant', 'attorney',
  'accountant', 'inspector', 'officer', 'lead', 'head', 'supervisor',
  'representative', 'executive', 'owner', 'founder', 'partner',
];

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  parseTranscript(transcript: string): ScanResultDto {
    const result: ScanResultDto = {};
    const text = (transcript || '').trim();
    if (!text) return result;

    this.logger.log(`Parsing transcript: "${text}"`);

    const sentences = text
      .split(/[.!?]+(?=\s+|$)/)
      .map(s => s.trim())
      .filter(Boolean);

    const emails: { email: string; type: string }[] = [];
    const phones: { phone: string; type: string }[] = [];
    const consumed = new Set<number>();

    sentences.forEach((sentence, idx) => {
      const lower = sentence.toLowerCase();
      let claimed = false;

      const emailMatches = sentence.match(EMAIL_REGEX);
      if (emailMatches) {
        const type = /personal/.test(lower) ? 'personal'
          : /other/.test(lower) ? 'other' : 'work';
        for (const e of emailMatches) {
          emails.push({ email: e.toLowerCase(), type });
        }
        claimed = true;
      }

      const phoneMatches = sentence.match(PHONE_REGEX);
      if (phoneMatches) {
        const type = /mobile|cell/.test(lower) ? 'mobile'
          : /office|work/.test(lower) ? 'office'
          : /home/.test(lower) ? 'home' : 'other';
        for (const p of phoneMatches) {
          phones.push({ phone: p.replace(/[^\d+]/g, ''), type });
        }
        claimed = true;
      }

      if (!result.website && !emailMatches) {
        const hasKeyword = /\b(?:website|web\s*site|url|site)\b/i.test(sentence);
        const urlMatches = sentence.match(WEBSITE_REGEX) || [];
        const url = urlMatches.find(u => !u.includes('@'));
        if (url && (hasKeyword || /^https?:\/\//i.test(url) || /^www\./i.test(url))) {
          result.website = /^https?:\/\//i.test(url) ? url : 'https://' + url;
          claimed = true;
        }
      }

      if (!result.address && ADDRESS_REGEX.test(sentence)) {
        result.address = sentence.replace(/^(?:address\s+is\s+|address\s+|located\s+at\s+)/i, '');
        claimed = true;
      }

      if (!result.businessRelationship) {
        const rel = RELATIONSHIP_KEYWORDS.find(k => new RegExp(`\\b${k}\\b`, 'i').test(sentence));
        if (rel) {
          result.businessRelationship = rel.split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          const wordCount = sentence.split(/\s+/).length;
          if (wordCount <= 3) claimed = true;
        }
      }

      if (claimed) consumed.add(idx);
    });

    for (let i = 0; i < sentences.length; i++) {
      if (consumed.has(i)) continue;
      if (result.fullName && result.jobTitle && result.company) break;
      this.extractNameTitleCompany(sentences[i], result);
    }

    if (emails.length) result.emails = emails;
    if (phones.length) result.phones = phones;

    this.logger.log(`Parsed result: ${JSON.stringify(result)}`);
    return result;
  }

  private extractNameTitleCompany(sentence: string, result: ScanResultDto): void {
    const commaParts = sentence.split(',').map(p => p.trim()).filter(Boolean);

    if (!result.fullName && commaParts.length >= 1) {
      const candidate = commaParts[0];
      const words = candidate.split(/\s+/);
      if (words.length >= 2 && words.length <= 5 && /^[A-Za-z][A-Za-z'.-]*$/.test(words[0])) {
        result.fullName = candidate;
      }
    }

    const remainder = commaParts.length > 1
      ? commaParts.slice(1).join(', ')
      : (result.fullName ? '' : sentence);

    if (!remainder) return;

    const atMatch = remainder.match(/^(.+?)\s+(?:at|from|with|for)\s+(.+)$/i);
    if (atMatch) {
      const [, titlePart, companyPart] = atMatch;
      if (!result.jobTitle) result.jobTitle = titlePart.trim();
      if (!result.company) result.company = companyPart.trim();
      return;
    }

    const lower = remainder.toLowerCase();
    if (!result.jobTitle && TITLE_KEYWORDS.some(k => new RegExp(`\\b${k}\\b`, 'i').test(lower))) {
      result.jobTitle = remainder.trim();
    } else if (!result.company) {
      result.company = remainder.trim();
    }
  }
}
