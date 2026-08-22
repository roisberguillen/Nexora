import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED_AREAS = [
  'Universale',
  'Mobile',
  'Desktop',
  'Tablet',
  'Visuale',
  'Ricerca',
  'Form',
  'Feedback',
  'Accessibilità',
  'Finanza',
  'Performance',
];

const PLACEHOLDER = /(?:YYYY-MM-DD|descrivere la |inserire |\/percorso-o-non-applicabile|TODO|TBD)/i;

export function requiresReview(stagedPaths) {
  return stagedPaths.length > 0;
}

export function validateReviewContent(content) {
  const errors = [];
  const normalized = content.replace(/\r\n/g, '\n');

  if (!/^Manifest:\s*nexora-ui-ux-mobile-desktop\/v1\s*$/m.test(normalized)) {
    errors.push('Manifest non valido o mancante.');
  }

  for (const field of [
    'Data',
    'Schermata',
    'Route',
    'Flusso principale',
    'Reviewer/fase',
    'Modifiche',
  ]) {
    const match = normalized.match(new RegExp(`^${field}:\\s*(.+)$`, 'mi'));
    if (!match || PLACEHOLDER.test(match[1])) {
      errors.push(`Campo obbligatorio incompleto: ${field}.`);
    }
  }

  for (const area of REQUIRED_AREAS) {
    const match = normalized.match(
      new RegExp(
        `^\\|\\s*${area}\\s*\\|[^\\n]*\\|\\s*(PASS|N\\/A)\\s*\\|\\s*([^|\\n]+)\\|\\s*$`,
        'mi',
      ),
    );
    if (!match) {
      errors.push(`Verifica mancante o con esito non valido: ${area}.`);
    } else if (match[2].trim().length < 4 || PLACEHOLDER.test(match[2])) {
      errors.push(`Evidenza o motivazione N/A insufficiente: ${area}.`);
    }
  }

  if (!/^P0 aperti:\s*Nessuno\s*$/mi.test(normalized)) {
    errors.push('Sono presenti P0 aperti: il commit è bloccato.');
  }
  if (!/^Esito:\s*(PASS|PASS_CON_P1)\s*$/mi.test(normalized)) {
    errors.push('Esito finale mancante o non valido.');
  }

  return errors;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function stagedReviewPaths(stagedPaths) {
  return stagedPaths
    .filter((filePath) => filePath.startsWith('.codex/reviews/ui-ux/') && filePath.endsWith('.md'));
}

export function main(argv = process.argv.slice(2)) {
  const explicitPath = argv[0];
  const paths = git(['diff', '--cached', '--name-only']).split('\n').filter(Boolean);

  if (explicitPath) {
    const errors = validateReviewContent(readFileSync(resolve(explicitPath), 'utf8'));
    if (errors.length > 0) {
      console.error(errors.map((error) => `- ${error}`).join('\n'));
      return 1;
    }
    console.log('Checklist UI/UX valida.');
    return 0;
  }

  if (!requiresReview(paths)) {
    console.log('Nessuna modifica nello stage: checklist non richiesta.');
    return 0;
  }

  const reviewPaths = stagedReviewPaths(paths);
  if (reviewPaths.length === 0) {
    console.error('Modifica rilevata: aggiungere una review in .codex/reviews/ui-ux/.');
    return 1;
  }

  const errors = reviewPaths.flatMap((reviewPath) =>
    validateReviewContent(git(['show', `:${reviewPath}`])).map((error) => `${reviewPath}: ${error}`),
  );
  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join('\n'));
    return 1;
  }

  console.log('Checklist UI/UX valida.');
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = main();
}
