import path from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import { renderTemplate, listTemplates } from '../src/templates';

beforeAll(() => {
  process.env.TEMPLATES_DIR = path.resolve(__dirname, '../../templates');
});

// Visible text only: drop the hidden preheader block, tags and entities.
function bodyText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ');
}

describe('renderTemplate variable handling', () => {
  it('never renders the literal "undefined" for missing variables and applies fallbacks', () => {
    for (const key of ['street-team-prospect', 'solace-intro']) {
      const result = renderTemplate(key, {})!;
      expect(result.html).not.toContain('undefined');
      expect(result.html).toMatch(/(Hello|Hi) there,/);
    }
  });

  it('uses supplied values and HTML-escapes them', () => {
    const result = renderTemplate('street-team-prospect', { firstName: '<b>Kemi</b>' })!;
    expect(result.html).toContain('Hello &lt;b&gt;Kemi&lt;/b&gt;,');
  });

  it('rejects unsafe URL schemes and falls back to the default link', () => {
    const result = renderTemplate('solace-intro', { campaignUrl: 'javascript:alert(1)' })!;
    expect(result.html).not.toContain('javascript:');
    expect(result.html).toContain('href="http://localhost:7080/campaigns/harmattan-sessions"');
  });

  it('builds a plain-text alternative without head/CSS noise', () => {
    const { text } = renderTemplate('solace-intro', { firstName: 'Ada' })!;
    expect(text).toMatch(/Hi Ada,/);
    expect(text).not.toContain('@media');
  });

  it('prefixes the subject for test runs', () => {
    expect(renderTemplate('solace-intro', {}, true)!.subject).toMatch(/^\[TEST\] /);
  });
});

describe('email briefs', () => {
  it('street-team-prospect has the required content and none of the banned wording', () => {
    const { html } = renderTemplate('street-team-prospect', {
      firstName: 'Kemi',
      nextStepText: 'Please complete your screening interview booking.',
      screeningUrl: 'http://localhost:7080/street-team/screening',
    })!;
    expect(html).toContain('name="viewport"');
    expect(html).toContain('Next step for your Tidewave Street Team application');
    expect(html).toContain('href="http://localhost:7080/street-team/screening"');
    expect(html).toContain('not an offer of employment or a binding engagement');
    expect(html).toMatch(/<a [^>]*href="mailto:unsubscribe@tidewave\.test[^"]*"[^>]*>Unsubscribe<\/a>/);

    const text = bodyText(html).toLowerCase();
    for (const banned of ['hired', 'active', 'field ready', 'salary', 'wage', 'guarantee you']) {
      expect(text).not.toContain(banned);
    }
  });

  it('solace-intro has the required content and none of the banned wording', () => {
    const { html } = renderTemplate('solace-intro', {
      firstName: 'Ada',
      campaignUrl: 'http://localhost:7080/campaigns/harmattan-sessions',
      unsubscribeUrl: 'http://localhost:7080/u/abc',
    })!;
    expect(html).toContain('name="viewport"');
    expect(html).toContain('Meet the Harmattan Sessions');
    expect(html).toContain('entirely voluntary');
    expect(html).toContain('not an investment, not a loan, and not employment');
    expect(html).toMatch(/<a [^>]*href="http:\/\/localhost:7080\/u\/abc"[^>]*>Unsubscribe<\/a>/);

    const text = bodyText(html).toLowerCase();
    for (const banned of ['profit', 'royalt', 'equity', 'interest', 'guarantee', 'hurry', 'last chance', 'limited time']) {
      expect(text).not.toContain(banned);
    }
  });

  it('lists the draft template as draft so the staff screen can exclude it', () => {
    const draft = listTemplates().find((t) => t.key === 'old-promo-draft');
    expect(draft?.status).toBe('draft');
  });
});
