/**
 * Test Tempo Moderato RPC Connectivity and Faucet Methods
 */

import { defaultRpcClient } from '../src/core/rpc.js';
import { defaultWalletManager } from '../src/core/wallet.js';

async function runRpcTests() {
  console.log('Testing Tempo Moderato RPC Connectivity...');

  const status = await defaultRpcClient.getNetworkStatus();
  console.log('Network Status:', status);

  if (!status.online) {
    throw new Error(`Tempo Moderato RPC is offline: ${status.error}`);
  }

  // Create temporary test wallet
  const tempWallet = defaultWalletManager.createWallet('RPC Test Wallet');
  console.log(`Created test wallet: ${tempWallet.address}`);

  // Test faucet funding
  console.log(`Calling tempo_fundAddress for ${tempWallet.address}...`);
  const faucetRes = await defaultRpcClient.fundAddress(tempWallet.address);
  console.log('Faucet Response:', faucetRes);

  // Check balance
  const balance = await defaultRpcClient.getNativeBalance(tempWallet.address);
  console.log('Native Balance:', balance);

  console.log('✅ Tempo RPC & Faucet Tests Passed!');
}

runRpcTests().catch(e => {
  console.error('❌ RPC Test Failed:', e);
  process.exit(1);
});
