import { Injectable } from '@nestjs/common';
import { ScanResultDto } from '../common/scan-result.dto';

@Injectable()
export class VoiceService {
  parseTranscript(transcript: string): ScanResultDto {
    const result: ScanResultDto = {};
    const text = transcript;

    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const websiteRegex = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?\b/gi;

    const emails = text.match(emailRegex);
    if (emails) {
      result.emails = emails.map(e => ({ email: e.toLowerCase(), type: 'work' }));
    }

    const phoneMatches = text.match(phoneRegex);
    if (phoneMatches) {
      result.phones = phoneMatches.map(p => {
        const lower = text.toLowerCase();
        const type = lower.includes('mobile') || lower.includes('cell') ? 'mobile'
          : lower.includes('office') || lower.includes('work') ? 'office'
          : lower.includes('home') ? 'home' : 'other';
        return { phone: p.replace(/[-.\s]/g, ''), type };
      });
    }

    const websiteMatch = text.match(websiteRegex);
    if (websiteMatch) {
      let url = websiteMatch[0];
      if (!url.startsWith('http')) url = 'https://' + url;
      result.website = url;
    }

    const relationshipKeywords = ['client', 'vendor', 'accountant', 'attorney', 'mortgage broker', 'inspector', 'friend'];
    const relKeyword = relationshipKeywords.find(k => text.toLowerCase().includes(k));
    if (relKeyword) {
      result.businessRelationship = relKeyword.charAt(0).toUpperCase() + relKeyword.slice(1);
    }

    const cleanText = text
      .replace(emailRegex, '')
      .replace(phoneRegex, '')
      .replace(websiteRegex, '')
      .replace(/email|mobile|office|home|cell|phone|website|at|dot/g, '')
      .replace(/[^\w\s,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const parts = cleanText.split(/\s+(?:at|from|with|is\s+a|is\s+an)\s+/i);

    if (parts.length >= 2) {
      const namePart = parts[0].trim();
      const restPart = parts[1].trim();

      const nameWords = namePart.split(/\s+/);
      if (nameWords.length >= 2 && nameWords.length <= 5) {
        result.fullName = namePart;
      }

      const titleKeywords = ['manager', 'director', 'president', 'ceo', 'cto', 'engineer', 'developer', 'sales', 'agent', 'broker', 'specialist', 'coordinator', 'consultant', 'analyst', 'assistant', 'attorney', 'accountant', 'inspector'];
      const titleMatch = titleKeywords.find(k => restPart.toLowerCase().includes(k));

      if (titleMatch) {
        const titleEnd = restPart.toLowerCase().indexOf(titleMatch) + titleMatch.length;
        const titleStr = restPart.substring(0, titleEnd + 10).split(/\s+/).slice(0, 4).join(' ');
        result.jobTitle = titleStr;
      }

      const companyKeywords = ['realty', 'inc', 'llc', 'corp', 'properties', 'company', 'group', 'solutions', 'technologies', 'consulting', 'partners', 'ltd'];
      const companyMatch = companyKeywords.find(k => restPart.toLowerCase().includes(k));
      if (companyMatch) {
        const words = restPart.split(/\s+/);
        for (let i = 0; i < words.length; i++) {
          if (words[i].toLowerCase().includes(companyMatch)) {
            const start = Math.max(0, i - 2);
            const end = Math.min(words.length, i + 2);
            result.company = words.slice(start, end).join(' ');
            break;
          }
        }
      }
    } else {
      const words = cleanText.split(/\s+/);
      if (words.length >= 2 && words.length <= 5 && !result.fullName) {
        result.fullName = cleanText;
      }
    }

    if (!result.fullName) {
      const words = cleanText.split(/\s+/);
      const filtered = words.filter(w => w.length > 1);
      if (filtered.length >= 2) {
        result.fullName = filtered.slice(0, 3).join(' ');
      }
    }

    return result;
  }
}
