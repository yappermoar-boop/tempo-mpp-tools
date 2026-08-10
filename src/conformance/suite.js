/**
 * MPP Protocol Conformance and Benchmark Test Suite
 * Tests HTTP 402 negotiation, challenge structures, replay protection, cryptographic signatures & settlement
 */

import { MppCore } from '../core/mpp.js';
import { ethers } from 'ethers';
import { defaultRpcClient } from '../core/rpc.js';

export class MppConformanceSuite {
  constructor() {
    this.results = [];
  }

  async runTest(testName, testFn) {
    const start = Date.now();
    try {
      await testFn();
      const duration = Date.now() - start;
      this.results.push({ name: testName, status: 'PASSED', durationMs: duration });
      console.log(`  ✅ [PASS] ${testName} (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - start;
      this.results.push({ name: testName, status: 'FAILED', error: err.message, durationMs: duration });
      console.error(`  ❌ [FAIL] ${testName}: ${err.message} (${duration}ms)`);
    }
  }

  async runAll() {
    console.log('\n========================================');
    console.log('🔍 Running MPP Conformance & Test Suite');
    console.log('========================================\n');

    this.results = [];
    const mpp = new MppCore({ realm: 'Conformance Test Realm' });
    const testWallet = ethers.Wallet.createRandom();

    // Test 1: Challenge Generation Format
    await this.runTest('MPP-CONF-001: Standard WWW-Authenticate 402 Challenge Format', async () => {
      const challenge = mpp.createChallenge({
        amount: '0.50',
        currency: 'pathUSD',
        recipient: '0x1111111111111111111111111111111111111111',
        intent: 'charge',
      });

      if (!challenge.headerValue.startsWith('Payment realm="Conformance Test Realm"')) {
        throw new Error('Header does not start with expected Payment realm');
      }
      if (!challenge.data.challengeId || !challenge.data.signature) {
        throw new Error('Missing challengeId or HMAC signature in challenge payload');
      }
    });

    // Test 2: Challenge Header Parsing
    await this.runTest('MPP-CONF-002: Parsing WWW-Authenticate Header', async () => {
      const header = 'Payment realm="Test", id="test-123", amount="1.25", currency="pathUSD", method="tempo", recipient="0x123", intent="charge", chainId="42431", expires="1999999999", sig="abc"';
      const parsed = MppCore.parseChallengeHeader(header);

      if (parsed.challengeId !== 'test-123' || parsed.amount !== '1.25' || parsed.currency !== 'pathUSD') {
        throw new Error('Parsed fields do not match header parameters');
      }
    });

    // Test 3: Valid Payment Credential Signing & Server Verification
    await this.runTest('MPP-CONF-003: Client Credential Generation & Cryptographic Verification', async () => {
      const challenge = mpp.createChallenge({ amount: '0.10', currency: 'pathUSD' });
      const credential = await MppCore.signPaymentCredential(challenge.data, testWallet.privateKey);

      const verification = await mpp.verifyPaymentCredential(credential.headerValue);
      if (!verification.valid) {
        throw new Error(`Verification failed unexpectedly: ${verification.error}`);
      }
      if (verification.payer.toLowerCase() !== testWallet.address.toLowerCase()) {
        throw new Error('Recovered payer address mismatch');
      }
      if (!verification.receiptHeader || !verification.receiptId) {
        throw new Error('Missing Payment-Receipt in verification result');
      }
    });

    // Test 4: Replay Attack Prevention
    await this.runTest('MPP-CONF-004: Replay Protection (Double Spending Rejection)', async () => {
      const challenge = mpp.createChallenge({ amount: '0.05', currency: 'pathUSD' });
      const credential = await MppCore.signPaymentCredential(challenge.data, testWallet.privateKey);

      // First call should succeed
      const first = await mpp.verifyPaymentCredential(credential.headerValue);
      if (!first.valid) throw new Error('First verification failed');

      // Second call with same credential must fail
      const second = await mpp.verifyPaymentCredential(credential.headerValue);
      if (second.valid) {
        throw new Error('Replay attack was NOT prevented! Double spend allowed.');
      }
    });

    // Test 5: Expired Challenge Rejection
    await this.runTest('MPP-CONF-005: Expired Challenge Rejection', async () => {
      const expiredChallenge = mpp.createChallenge({ amount: '0.01', expiresIn: -10 }); // Already expired
      const credential = await MppCore.signPaymentCredential(expiredChallenge.data, testWallet.privateKey);

      const verification = await mpp.verifyPaymentCredential(credential.headerValue);
      if (verification.valid) {
        throw new Error('Expired challenge was accepted when it should have been rejected');
      }
    });

    // Test 6: Tampered Signature Detection
    await this.runTest('MPP-CONF-006: Tampered Payload / Signature Rejection', async () => {
      const challenge = mpp.createChallenge({ amount: '0.01' });
      const credential = await MppCore.signPaymentCredential(challenge.data, testWallet.privateKey);

      // Tamper signature
      const tamperedCred = {
        ...credential.credential,
        signature: '0x' + '00'.repeat(65),
      };
      const tamperedHeader = `Payment ${Buffer.from(JSON.stringify(tamperedCred)).toString('base64')}`;

      const verification = await mpp.verifyPaymentCredential(tamperedHeader);
      if (verification.valid) {
        throw new Error('Tampered signature was accepted');
      }
    });

    // Test 7: Tempo Moderato Testnet Live RPC Ping
    await this.runTest('MPP-CONF-007: Tempo Moderato RPC Connectivity & Chain ID Validation', async () => {
      const status = await defaultRpcClient.getNetworkStatus();
      if (!status.online) {
        throw new Error(`RPC connection failed: ${status.error}`);
      }
      if (status.chainId !== 42431) {
        throw new Error(`Invalid chain ID: expected 42431, received ${status.chainId}`);
      }
    });

    const passedCount = this.results.filter(r => r.status === 'PASSED').length;
    const failedCount = this.results.filter(r => r.status === 'FAILED').length;

    console.log('\n----------------------------------------');
    console.log(`Summary: ${passedCount} Passed, ${failedCount} Failed (Total: ${this.results.length})`);
    console.log('----------------------------------------\n');

    return {
      total: this.results.length,
      passed: passedCount,
      failed: failedCount,
      details: this.results,
    };
  }
}

export const defaultConformanceSuite = new MppConformanceSuite();
