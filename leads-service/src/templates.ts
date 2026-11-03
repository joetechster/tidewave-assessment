import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import { config } from './config';

export interface TemplateVariable {
  name: string;
  label: string;
  required: boolean;
  example: string;
}

export interface TemplateMetadata {
  key?: string;
  name: string;
  audience: 'street-team' | 'solace-avenue';
  status: 'approved' | 'draft';
  subject: string;
  variables: TemplateVariable[];
}

export interface TemplateItem extends TemplateMetadata {
  key: string;
}

export interface RenderResult {
  subject: string;
  html: string;
  text: string;
}

export function listTemplates(): TemplateItem[] {
  const dir = process.env.TEMPLATES_DIR || config.templatesDir;
  if (!fs.existsSync(dir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(dir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    const templates: TemplateItem[] = [];

    for (const jsonFile of jsonFiles) {
      const key = path.basename(jsonFile, '.json');
      const htmlFile = `${key}.html`;

      if (files.includes(htmlFile)) {
        try {
          const jsonContent = fs.readFileSync(path.join(dir, jsonFile), 'utf-8');
          const meta = JSON.parse(jsonContent) as TemplateMetadata;
          templates.push({
            key,
            name: meta.name || key,
            audience: meta.audience || 'street-team',
            status: meta.status || 'draft',
            subject: meta.subject || '',
            variables: meta.variables || [],
          });
        } catch {
          // ignore corrupted individual template
        }
      }
    }

    return templates;
  } catch (err) {
    console.warn(`[Templates] Error reading templates directory: ${(err as Error).message}`);
    return [];
  }
}

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function safeValue(name: string, value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return '';
  }
  const str = String(value).trim();
  if (/url$/i.test(name) && !SAFE_URL.test(str)) {
    return '';
  }
  return str;
}

export function renderTemplate(
  key: string,
  variables: Record<string, any> = {},
  isTest: boolean = false
): RenderResult | null {
  const dir = process.env.TEMPLATES_DIR || config.templatesDir;
  const jsonPath = path.join(dir, `${key}.json`);
  const htmlPath = path.join(dir, `${key}.html`);

  if (!fs.existsSync(jsonPath) || !fs.existsSync(htmlPath)) {
    return null;
  }

  const metaRaw = fs.readFileSync(jsonPath, 'utf-8');
  const meta: TemplateMetadata = JSON.parse(metaRaw);
  const htmlRaw = fs.readFileSync(htmlPath, 'utf-8');

  // Declared variables are normalised so templates can rely on {{#if}} fallbacks:
  // missing/blank/non-scalar values become '' and URL variables only accept safe schemes.
  const renderContext: Record<string, any> = {};
  if (meta.variables && Array.isArray(meta.variables)) {
    for (const v of meta.variables) {
      renderContext[v.name] = safeValue(v.name, variables?.[v.name]);
    }
  }

  // Also include any extra user variables
  for (const [k, v] of Object.entries(variables || {})) {
    if (renderContext[k] === undefined) {
      renderContext[k] = v;
    }
  }

  const subjectTemplate = handlebars.compile(meta.subject || '');
  const htmlTemplate = handlebars.compile(htmlRaw);

  let subject = subjectTemplate(renderContext);
  if (isTest) {
    subject = `[TEST] ${subject}`;
  }

  const html = htmlTemplate(renderContext);
  // Plain text fallback by stripping html tags
  const text = html
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    subject,
    html,
    text,
  };
}
