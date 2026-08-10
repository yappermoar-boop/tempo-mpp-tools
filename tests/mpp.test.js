/**
 * Unit Tests for MPP Core Engine
 */

import { MppCore } from '../src/core/mpp.js';
import { ethers } from 'ethers';

async function runMppTests() {
  console.log('Testing MPP Core Engine...');
  const mpp = new MppCore({ realm: 'Test Realm' });
  const wallet = ethers.Wallet.createRandom();

  // 1. Create challenge
  const challenge = mpp.createChallenge({ amount: '0.05', currency: 'pathUSD' });
  if (!challenge.headerValue.includes('Payment realm="Test Realm"')) {
    throw new Error('Challenge header malformed');
  }

  // 2. Parse challenge
  const parsed = MppCore.parseChallengeHeader(challenge.headerValue);
  if (parsed.amount !== '0.05' || parsed.currency !== 'pathUSD') {
    throw new Error('Parse challenge failed');
  }

  // 3. Sign credential
  const cred = await MppCore.signPaymentCredential(parsed, wallet.privateKey);
  if (!cred.headerValue.startsWith('Payment ')) {
    throw new Error('Credential header malformed');
  }

  // 4. Verify credential
  const verification = await mpp.verifyPaymentCredential(cred.headerValue);
  if (!verification.valid || verification.payer.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`Verification failed: ${verification.error}`);
  }

  console.log('✅ MPP Core Tests Passed!');
}

runMppTests().catch(e => {
  console.error('❌ MPP Test Failed:', e);
  process.exit(1);
});
