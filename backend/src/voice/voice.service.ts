import { Injectable } from '@nestjs/common';
import { ScanResultDto } from '../common/scan-result.dto';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary-safe "does this text contain this keyword" check. Plain
// .includes() caused false positives like "cto" (from the CEO/CTO keyword)
// matching inside unrelated words such as "contraCTOr".
function containsWord(haystack: string, keyword: string): boolean {
  return new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i').test(haystack);
}

function findWord(haystack: string, keywords: string[]): string | undefined {
  return keywords.find(k => containsWord(haystack, k));
}

@Injectable()
export class VoiceService {
  parseTranscript(transcript: string): ScanResultDto {
    const result: ScanResultDto = {};

    // Speech-to-text never produces the "@" or "." symbols — a spoken email
    // comes through as e.g. "john at abc dot com" (and "john dot smith at
    // gmail dot com"). Reconstruct those into real "user@domain.tld" syntax
    // BEFORE any matching so the email is captured and its words don't leak
    // into the name/company. Requiring at least one "dot" on the domain side
    // keeps this from firing on the ordinary connector word in "Manager at
    // ABC Realty".
    const text = transcript.replace(
      /\b([a-z0-9]+(?:\s+dot\s+[a-z0-9]+)*)\s+at\s+([a-z0-9]+(?:\s+dot\s+[a-z0-9]+)+)\b/gi,
      (_match, local: string, domain: string) => {
        const collapse = (s: string) => s.replace(/\s+dot\s+/gi, '.').replace(/\s+/g, '');
        return `${collapse(local)}@${collapse(domain)}`;
      },
    );

    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const websiteRegex = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?\b/gi;
    // Requires a number followed by a street-type suffix so we don't false-positive
    // on phone numbers or other digit sequences spoken in the transcript.
    const addressRegex = /\d+\s+[A-Za-z][A-Za-z\s]{2,40}\b(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct|place|pl)\b/i;

    const emails = text.match(emailRegex);
    if (emails) {
      result.emails = emails.map(e => ({ email: e.toLowerCase(), type: 'work' }));
    }

    // Determine each phone's type from the words immediately preceding it
    // (e.g. "Mobile 518-555-1111. Office 518-555-2222.") rather than from
    // whole-transcript keyword presence, which mislabeled every number the
    // same way whenever more than one type appeared in the same transcript.
    const phoneMatches = [...text.matchAll(phoneRegex)].filter(m => m[0].trim().length > 0);
    if (phoneMatches.length) {
      result.phones = phoneMatches.map(m => {
        const contextStart = Math.max(0, (m.index ?? 0) - 20);
        const context = text.slice(contextStart, m.index ?? 0).toLowerCase();
        const type = context.includes('mobile') || context.includes('cell') ? 'mobile'
          : context.includes('office') || context.includes('work') ? 'office'
          : context.includes('home') ? 'home' : 'other';
        return { phone: m[0].replace(/[-.\s]/g, ''), type };
      });
    }

    // Only treat the email's own domain as a website if a distinct website
    // was actually mentioned elsewhere in the transcript (otherwise "Email
    // john@abc.com" alone would also get misread as a website).
    const textWithoutEmail = text.replace(emailRegex, '');
    const websiteMatch = textWithoutEmail.match(websiteRegex);
    if (websiteMatch) {
      let url = websiteMatch[0];
      if (!url.startsWith('http')) url = 'https://' + url;
      result.website = url;
    }

    const addressMatch = text.match(addressRegex);
    if (addressMatch) {
      result.address = addressMatch[0].trim();
    }

    // Maps a detected keyword to the canonical label used in the app's
    // Business Relationship dropdown (BUSINESS_RELATIONSHIPS in the frontend),
    // kept in sync with scan.service.ts. Longer/more specific phrases are
    // listed first so they match before their shorter substrings.
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
    const relMatch = relationshipKeywordMap.find(([keyword]) => containsWord(text, keyword));
    if (relMatch) {
      result.businessRelationship = relMatch[1];
    }

    // Strip out data we've already extracted, plus their field-label words and
    // the matched relationship keyword (a standalone declarative word like
    // "...Vendor." at the end of the sentence, not part of the company name),
    // so what's left is mostly the name/title/company. Note: connector words
    // used by the split below ("at", "from", "with") are intentionally NOT
    // stripped here, or the split step would have nothing to split on.
    let cleanText = text
      .replace(emailRegex, '')
      .replace(phoneRegex, '')
      .replace(websiteRegex, '')
      .replace(addressRegex, '')
      .replace(/\b(email|mobile|office|home|cell|phone|website|dot)\b/gi, '');

    if (relMatch) {
      cleanText = cleanText.replace(new RegExp(`\\b${escapeRegex(relMatch[0])}\\b`, 'i'), '');
    }

    cleanText = cleanText
      .replace(/[^\w\s,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const parts = cleanText.split(/\s+(?:at|from|with|is\s+a|is\s+an)\s+/i);

    if (parts.length >= 2) {
      let namePart = parts[0].trim();
      const restPart = parts[1].trim();

      // "Name, Title" - split off the title fragment from the name.
      const [namePiece, ...titlePieces] = namePart.split(',');
      const titleFromName = titlePieces.join(',').trim();
      namePart = namePiece.trim();

      const nameWords = namePart.split(/\s+/);
      if (nameWords.length >= 2 && nameWords.length <= 5) {
        result.fullName = namePart;
      }

      const titleKeywords = ['manager', 'director', 'president', 'ceo', 'cto', 'engineer', 'developer', 'sales', 'agent', 'broker', 'specialist', 'coordinator', 'consultant', 'analyst', 'assistant', 'attorney', 'accountant', 'inspector', 'lead', 'officer', 'head'];

      if (titleFromName) {
        result.jobTitle = titleFromName;
      } else {
        const titleMatch = findWord(restPart, titleKeywords);
        if (titleMatch) {
          const titleEnd = restPart.toLowerCase().indexOf(titleMatch) + titleMatch.length;
          const titleStr = restPart.substring(0, titleEnd + 10).split(/\s+/).slice(0, 4).join(' ');
          result.jobTitle = titleStr;
        }
      }

      const companyKeywords = ['realty', 'inc', 'llc', 'corp', 'properties', 'company', 'group', 'solutions', 'technologies', 'consulting', 'partners', 'ltd'];
      const companyMatch = findWord(restPart, companyKeywords);
      if (companyMatch) {
        const words = restPart.split(/\s+/);
        for (let i = 0; i < words.length; i++) {
          if (containsWord(words[i], companyMatch)) {
            const start = Math.max(0, i - 2);
            const end = Math.min(words.length, i + 2);
            result.company = words.slice(start, end).join(' ');
            break;
          }
        }
      }

      // Fall back to treating the whole "rest" segment as the company when no
      // recognizable company keyword is present (e.g. "at ABC Realty" where
      // "Realty" isn't in our keyword list, or a plain company name).
      if (!result.company && restPart) {
        const restWords = restPart.split(/\s+/).filter(w => w.length > 1);
        if (restWords.length >= 1 && restWords.length <= 6) {
          result.company = restPart;
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

    // Requirement: default to "Other" whenever a relationship can't be determined.
    if (!result.businessRelationship) {
      result.businessRelationship = 'Other';
    }

    return result;
  }
}
