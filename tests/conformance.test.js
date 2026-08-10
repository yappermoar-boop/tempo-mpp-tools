/**
 * Conformance Test Runner
 */

import { defaultConformanceSuite } from '../src/conformance/suite.js';

async function main() {
  const result = await defaultConformanceSuite.runAll();
  if (result.failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
