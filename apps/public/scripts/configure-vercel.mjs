import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * @param {string} template
 * @param {string | undefined} configuredApiUrl
 * @returns {string}
 */
export function renderVercelConfiguration(template, configuredApiUrl) {
  if (!configuredApiUrl) {
    throw new Error('VITE_PUBLIC_PHOTO_API_URL is required to configure Vercel');
  }

  let apiUrl;
  try {
    apiUrl = new URL(configuredApiUrl);
  } catch {
    throw new Error('VITE_PUBLIC_PHOTO_API_URL must be an absolute URL');
  }

  if (
    apiUrl.protocol !== 'https:' ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.search ||
    apiUrl.hash ||
    apiUrl.pathname.replace(/\/+$/u, '') !== '/functions/v1/photo'
  ) {
    throw new Error('VITE_PUBLIC_PHOTO_API_URL must be an HTTPS URL ending in /functions/v1/photo');
  }

  const rendered = template.replaceAll('__PHOTO_API_ORIGIN__', apiUrl.origin);
  if (rendered.includes('__PHOTO_API_ORIGIN__')) {
    throw new Error('Vercel configuration could not be rendered');
  }

  JSON.parse(rendered);
  return rendered;
}

function configureVercel() {
  const appDirectory = fileURLToPath(new URL('..', import.meta.url));
  const templatePath = fileURLToPath(new URL('../vercel.template.json', import.meta.url));
  const outputPath = fileURLToPath(new URL('../vercel.json', import.meta.url));
  const template = readFileSync(templatePath, 'utf8');
  const rendered = renderVercelConfiguration(
    template,
    process.env.VITE_PUBLIC_PHOTO_API_URL?.trim(),
  );
  writeFileSync(outputPath, rendered, { encoding: 'utf8', flag: 'w' });
  process.stdout.write(`Configured ${appDirectory} for a production Vercel build.\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (invokedPath === import.meta.url) configureVercel();
