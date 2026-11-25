import { readFileSync } from 'fs';
import { runSmokeTest } from './checks';
import { apiEndpoint, resolveStage } from '../stage';

// The outputs that `npx projen deploy` writes after cdk deploy
const OUTPUTS_FILE = 'cdk.out/deploy-outputs.json';
const STACK = 'KenilworthfordWebsite';

async function main() {
  const outputs = JSON.parse(readFileSync(OUTPUTS_FILE, 'utf-8'))[STACK];
  if (!outputs?.DistributionDomainName || !outputs?.Version) {
    throw new Error(`${OUTPUTS_FILE} has no ${STACK} outputs. Deploy first.`);
  }
  const stage = resolveStage();
  const baseUrl = `https://${outputs.DistributionDomainName}`;
  console.log(`Smoke testing release ${outputs.Version} (${stage}) at ${baseUrl}`);

  const failures = await runSmokeTest({
    apiEndpoint: apiEndpoint(stage),
    baseUrl,
    log: (message) => console.log(`  ${message}`),
    version: outputs.Version,
  });
  if (failures.length > 0) {
    console.error(`Smoke test failed:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Smoke test passed');
}

main().catch((error) => {
  console.error(`Smoke test failed: ${(error as Error).message}`);
  process.exit(1);
});
