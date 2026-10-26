import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const scriptPath = fileURLToPath(import.meta.url);
const automationRoot = path.resolve(path.dirname(scriptPath), '..');
const schemaRoot = path.join(automationRoot, 'evidence', 'schemas');
export const companionRoot = path.join(
  automationRoot,
  'evidence',
  'claim-assessments',
);

async function readJson(filePath) {
  return JSON.parse((await readFile(filePath, 'utf8')).replace(/^\uFEFF/, ''));
}

function formatAjvErrors(errors = []) {
  return errors.map(error => `${error.instancePath || '/'} ${error.message}`);
}

export async function createCompanionValidator() {
  const ajv = new Ajv2020({allErrors: true, strict: false});
  const [catalogSchema, assessmentSchema, catalog] = await Promise.all([
    readJson(path.join(schemaRoot, 'claim-catalog.schema.json')),
    readJson(path.join(schemaRoot, 'claim-assessment.schema.json')),
    readJson(path.join(companionRoot, 'claim-catalog.json')),
  ]);
  const validateCatalogSchema = ajv.compile(catalogSchema);
  const validateAssessmentSchema = ajv.compile(assessmentSchema);
  if (!validateCatalogSchema(catalog)) {
    throw new Error(
      `Claim catalog schema failure: ${formatAjvErrors(validateCatalogSchema.errors).join('; ')}`,
    );
  }
  const catalogProperties = new Set();
  for (const property of catalog.properties) {
    if (catalogProperties.has(property.id)) {
      throw new Error(`Duplicate catalog property: ${property.id}`);
    }
    catalogProperties.add(property.id);
  }
  const claims = new Map();
  for (const claim of catalog.claims) {
    if (claims.has(claim.id)) throw new Error(`Duplicate catalog claim: ${claim.id}`);
    for (const propertyId of claim.materialPropertyIds) {
      if (!catalogProperties.has(propertyId)) {
        throw new Error(`Claim ${claim.id} references undefined property: ${propertyId}`);
      }
    }
    claims.set(claim.id, claim);
  }

  return assessment => {
    const errors = [];
    if (!validateAssessmentSchema(assessment)) {
      errors.push(...formatAjvErrors(validateAssessmentSchema.errors));
      return {valid: false, errors};
    }

    if (assessment.catalogRef !== catalog.catalogId) {
      errors.push(`catalogRef does not identify ${catalog.catalogId}`);
    }
    if (assessment.propertyScope !== catalog.propertyScope) {
      errors.push(`propertyScope does not match catalog scope ${catalog.propertyScope}`);
    }

    const catalogClaim = claims.get(assessment.claim.id);
    if (!catalogClaim) {
      errors.push(`claim ${assessment.claim.id} is absent from the catalog`);
      return {valid: false, errors};
    }
    for (const field of ['proposition', 'assuranceTarget']) {
      if (assessment.claim[field] !== catalogClaim[field]) {
        errors.push(`claim.${field} differs from the versioned catalog`);
      }
    }

    const actualIds = assessment.properties.map(property => property.id);
    if (new Set(actualIds).size !== actualIds.length) {
      errors.push('properties contains a duplicate identifier');
    }
    const expectedIds = new Set(catalogClaim.materialPropertyIds);
    const actualSet = new Set(actualIds);
    for (const id of expectedIds) {
      if (!actualSet.has(id)) errors.push(`identified material property is missing: ${id}`);
    }
    for (const id of actualSet) {
      if (!expectedIds.has(id)) errors.push(`property is not in the versioned claim catalog: ${id}`);
    }

    const routeBlocking = assessment.properties.filter(property =>
      ['bypassed', 'unvalidatedSubstitution'].includes(property.treatment),
    );
    if (
      ['supports', 'challenges'].includes(assessment.claimDisposition) &&
      routeBlocking.length > 0
    ) {
      errors.push(
        `claimDisposition cannot be ${assessment.claimDisposition} when identified material properties are bypassed or unvalidated: ` +
          routeBlocking.map(property => property.id).join(', '),
      );
    }
    if (
      assessment.claimDisposition === 'notSupportedByRoute' &&
      routeBlocking.length === 0
    ) {
      errors.push(
        'claimDisposition notSupportedByRoute requires a bypassed or unvalidated identified material property',
      );
    }
    if (
      assessment.executionValidity === 'valid' &&
      assessment.claimDisposition === 'notEvaluated'
    ) {
      errors.push('a valid execution cannot use claimDisposition notEvaluated');
    }

    return {valid: errors.length === 0, errors};
  };
}

async function jsonFiles(directory) {
  return (await readdir(directory))
    .filter(fileName => fileName.endsWith('.json'))
    .sort();
}

export async function validateCompanion() {
  const validate = await createCompanionValidator();
  const recordsRoot = path.join(companionRoot, 'records');
  const invalidRoot = path.join(companionRoot, 'invalid-fixtures');
  const recordFiles = await jsonFiles(recordsRoot);
  const invalidFiles = await jsonFiles(invalidRoot);
  const failures = [];
  const assessmentIds = new Set();

  for (const fileName of recordFiles) {
    const assessment = await readJson(path.join(recordsRoot, fileName));
    const result = validate(assessment);
    if (assessmentIds.has(assessment.assessmentId)) {
      failures.push(`${fileName}: duplicate assessmentId ${assessment.assessmentId}`);
    }
    assessmentIds.add(assessment.assessmentId);
    if (!result.valid) failures.push(`${fileName}: ${result.errors.join('; ')}`);
  }

  for (const fileName of invalidFiles) {
    const assessment = await readJson(path.join(invalidRoot, fileName));
    const result = validate(assessment);
    if (result.valid) failures.push(`${fileName}: invalid fixture was accepted`);
  }

  if (recordFiles.length !== 4) {
    failures.push(`expected four populated assessments; found ${recordFiles.length}`);
  }
  if (invalidFiles.length < 1) failures.push('expected at least one invalid fixture');

  return {
    valid: failures.length === 0,
    recordCount: recordFiles.length,
    rejectedFixtureCount: invalidFiles.length,
    failures,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const result = await validateCompanion();
  if (!result.valid) {
    process.stderr.write(`${result.failures.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Validated ${result.recordCount} claim assessments and confirmed ` +
        `${result.rejectedFixtureCount} invalid fixture(s) were rejected.\n`,
    );
  }
}
