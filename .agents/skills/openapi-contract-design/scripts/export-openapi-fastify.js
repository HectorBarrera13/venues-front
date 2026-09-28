/**
 * Headless OpenAPI Export Script for Fastify
 * Place at scripts/export-openapi.js and expose via "npm run openapi:generate"
 */
import { writeFileSync } from 'fs';
import { buildApp } from '../src/app.js';

async function generateOpenApiSpec() {
  const app = await buildApp();
  await app.ready();

  const openapiYaml = app.swagger({ yaml: true });
  writeFileSync('openapi.yaml', openapiYaml);

  await app.close();
  console.log('Successfully exported openapi.yaml');
}

generateOpenApiSpec().catch((err) => {
  console.error('Failed to export OpenAPI spec:', err);
  process.exit(1);
});
