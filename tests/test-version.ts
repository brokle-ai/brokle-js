/**
 * Quick test for version parameter support
 */

import { getClient, Attrs } from '../packages/brokle/src/index';

const client = getClient({
  apiKey: 'bk_fzwUZlCBIE3Z0QfGnfAIKjZ4DuK4ChJHf3mPnnbV',
  baseUrl: 'http://localhost:8080',
  environment: 'version-test',
  release: 'v2.0.0',
  debug: true,
});

async function testVersion() {
  console.log('Testing version parameter support...\n');

  // Test 1: traced() with version
  await client.traced('test-traced', async (span) => {
    span.setAttribute(Attrs.USER_ID, 'version-user');
    console.log('✓ Traced with version="A"');
  }, undefined, { version: 'A' });

  // Test 2: generation() with version
  await client.generation('chat', 'gpt-4', 'openai', async (span) => {
    span.setAttribute(Attrs.GEN_AI_USAGE_INPUT_TOKENS, 10);
    console.log('✓ Generation with version="B"');
  }, { version: 'B' });

  // Flush
  await client.flush();
  console.log('\n✓ All spans flushed');

  console.log('\nVerify in ClickHouse:');
  console.log('docker exec brokle-clickhouse clickhouse-client --user brokle --password brokle_password --query "SELECT name, version, release, environment FROM traces WHERE user_id = \'version-user\' FORMAT Vertical"');
}

testVersion().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
