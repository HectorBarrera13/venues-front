/**
 * Headless OpenAPI Export Script for NestJS
 * Place at scripts/export-openapi.ts and expose via "npm run openapi:generate"
 */
import { writeFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function generateOpenApiSpec() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Ticket D-Saster Microservice API')
    .setDescription('Authoritative REST API specification')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  writeFileSync('openapi.json', JSON.stringify(document, null, 2));

  await app.close();
  console.log('Successfully exported openapi.json');
}

generateOpenApiSpec().catch((err) => {
  console.error('Failed to export OpenAPI spec:', err);
  process.exit(1);
});
