#!/usr/bin/env node

/**
 * Tempo MPP CLI - Machine Payments Protocol & Moderato Testnet Toolkit
 */

import { defaultWalletManager } from '../src/core/wallet.js';
import { defaultRpcClient } from '../src/core/rpc.js';
import { defaultTip20Client } from '../src/core/tip20.js';
import { defaultActivityBot } from '../src/bot/activity-bot.js';
import { defaultConformanceSuite } from '../src/conformance/suite.js';
import { MppAgentClient } from '../src/client/mpp-agent.js';
import { TEMPO_CONFIG } from '../src/core/config.js';

const args = process.argv.slice(2);
const command = args[0] || 'help';

async function main() {
  switch (command.toLowerCase()) {
    case 'wallet': {
      const sub = args[1] || 'list';
      if (sub === 'new' || sub === 'create') {
        const label = args[2] || `Tempo Wallet #${Date.now().toString().slice(-4)}`;
        const w = defaultWalletManager.createWallet(label);
        defaultWalletManager.saveWallet(w);
        console.log('\n🎉 Created New Tempo Wallet:');
        console.log(`  Address:     ${w.address}`);
        console.log(`  Private Key: ${w.privateKey}`);
        console.log(`  Label:       ${w.label}`);
        console.log(`  Saved to:    wallets.json\n`);
      } else if (sub === 'batch') {
        const count = parseInt(args[2] || '3', 10);
        console.log(`\n📦 Generating ${count} new Tempo wallets...`);
        const wallets = defaultWalletManager.generateBatch(count);
        wallets.forEach((w, i) => console.log(`  #${i + 1} ${w.address}`));
        console.log(`\nSaved ${wallets.length} wallets to wallets.json\n`);
      } else {
        const wallets = defaultWalletManager.loadWallets();
        console.log(`\n📋 Saved Tempo Wallets (${wallets.length}):`);
        if (wallets.length === 0) {
          console.log('  No wallets found. Run "tempo-mpp wallet new" to create one.');
        } else {
          wallets.forEach((w, i) => {
            console.log(`  [${i + 1}] ${w.label.padEnd(20)} ${w.address}`);
          });
        }
        console.log('');
      }
      break;
    }

    case 'faucet': {
      let targetAddress = args[1];
      if (!targetAddress) {
        const wallets = defaultWalletManager.loadWallets();
        if (wallets.length > 0) {
          targetAddress = wallets[0].address;
          console.log(`No address specified. Using first saved wallet: ${targetAddress}`);
        } else {
          console.error('Error: Please provide a wallet address: tempo-mpp faucet <0xAddress>');
          process.exit(1);
        }
      }

      console.log(`\n💧 Requesting funds from Tempo Moderato Faucet (tempo_fundAddress)...`);
      console.log(`  Target: ${targetAddress}`);
      try {
        const res = await defaultRpcClient.fundAddress(targetAddress);
        console.log(`  ✅ ${res.message}`);
        console.log(`  Explorer: ${TEMPO_CONFIG.network.explorerUrl}/address/${targetAddress}\n`);
      } catch (err) {
        console.error(`  ❌ Faucet failed: ${err.message}\n`);
      }
      break;
    }

    case 'balance': {
      let targetAddress = args[1];
      if (!targetAddress) {
        const wallets = defaultWalletManager.loadWallets();
        if (wallets.length > 0) {
          targetAddress = wallets[0].address;
        } else {
          console.error('Error: Please provide a wallet address: tempo-mpp balance <0xAddress>');
          process.exit(1);
        }
      }

      console.log(`\n💰 Balances for ${targetAddress}:`);
      try {
        const native = await defaultRpcClient.getNativeBalance(targetAddress);
        const tokens = await defaultTip20Client.getAllBalances(targetAddress);

        console.log(`  Native Gas:  ${native.formatted} ${native.symbol}`);
        console.log(`  pathUSD:     ${tokens.pathUSD?.formatted || '0.00'}`);
        console.log(`  AlphaUSD:    ${tokens.AlphaUSD?.formatted || '0.00'}`);
        console.log(`  BetaUSD:     ${tokens.BetaUSD?.formatted || '0.00'}\n`);
      } catch (err) {
        console.error(`  ❌ Balance check failed: ${err.message}\n`);
      }
      break;
    }

    case 'transfer': {
      const recipient = args[1];
      const amount = args[2] || '1.0';
      const token = args[3] || 'pathUSD';

      if (!recipient) {
        console.error('Usage: tempo-mpp transfer <recipientAddress> [amount] [tokenSymbol]');
        process.exit(1);
      }

      const wallets = defaultWalletManager.loadWallets();
      if (wallets.length === 0) {
        console.error('Error: No sender wallet found in wallets.json. Run "tempo-mpp wallet new" first.');
        process.exit(1);
      }

      const sender = wallets[0];
      console.log(`\n💸 Transferring ${amount} ${token} on Tempo Moderato...`);
      console.log(`  From: ${sender.address}`);
      console.log(`  To:   ${recipient}`);

      try {
        const result = await defaultTip20Client.transfer(token, sender.privateKey, recipient, amount);
        console.log(`  ✅ Success! Block #${result.blockNumber}`);
        console.log(`  Tx Hash: ${result.txHash}`);
        console.log(`  Explorer: ${result.explorerLink}\n`);
      } catch (err) {
        console.error(`  ❌ Transfer failed: ${err.message}\n`);
      }
      break;
    }

    case 'bot':
    case 'tx-spammer':
    case 'airdrop': {
      const count = parseInt(args[1] || '3', 10);
      const transfers = parseInt(args[2] || '2', 10);
      console.log(`\n🤖 Starting Tempo Testnet Activity & Airdrop Bot Cycle...`);
      await defaultActivityBot.runCycle(count, transfers);
      break;
    }

    case 'test':
    case 'conformance': {
      await defaultConformanceSuite.runAll();
      break;
    }

    case 'agent':
    case 'fetch': {
      const url = args[1] || 'http://localhost:3402/api/mpp/protected-ai-data';
      const wallets = defaultWalletManager.loadWallets();
      if (wallets.length === 0) {
        console.error('Error: No wallet found. Run "tempo-mpp wallet new" first.');
        process.exit(1);
      }

      console.log(`\n🤖 Autonomous AI Agent Fetch: ${url}`);
      const agent = new MppAgentClient(wallets[0].privateKey);
      const res = await agent.fetch(url);
      const data = await res.response.json();

      console.log(`  HTTP Status: ${res.status}`);
      console.log(`  Paid:        ${res.paid}`);
      console.log(`  Receipt:     ${res.receipt}`);
      console.log(`  Response:    `, data);
      console.log('');
      break;
    }

    case 'studio':
    case 'server': {
      console.log('\nStarting Tempo MPP Studio Web Server...');
      await import('../src/server/studio.js');
      break;
    }

    default: {
      console.log(`
╔══════════════════════════════════════════════════════════════════╗
║               ⚡ TEMPO MPP TOOLS & TESTNET CLI                   ║
║  Machine Payments Protocol (MPP) & Tempo Moderato Suite          ║
╚══════════════════════════════════════════════════════════════════╝

Commands:
  tempo-mpp wallet [new|list|batch]     Manage Tempo EVM wallets
  tempo-mpp faucet [address]            Claim 1,000,000 TIP-20 tokens via tempo_fundAddress
  tempo-mpp balance [address]           Query native & TIP-20 stablecoin balances
  tempo-mpp transfer <to> [amt] [token] Send on-chain TIP-20 transaction
  tempo-mpp bot [wallets] [transfers]   Run automated testnet activity & airdrop cycle
  tempo-mpp test                        Run full MPP Conformance Test Suite
  tempo-mpp agent <url>                 Fetch HTTP 402 resource with auto-payment
  tempo-mpp studio                      Launch Interactive Web Dashboard on :3402
      `);
      break;
    }
  }
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
