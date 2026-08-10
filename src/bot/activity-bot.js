/**
 * Tempo Moderato Testnet Activity & Airdrop Automation Bot
 * Interacts with Faucet, executes TIP-20 transfers & MPP requests to build on-chain activity
 */

import { defaultWalletManager } from '../core/wallet.js';
import { defaultRpcClient } from '../core/rpc.js';
import { defaultTip20Client } from '../core/tip20.js';
import { MppAgentClient } from '../client/mpp-agent.js';
import { TEMPO_CONFIG } from '../core/config.js';

export class TempoActivityBot {
  constructor(options = {}) {
    this.walletManager = options.walletManager || defaultWalletManager;
    this.rpcClient = options.rpcClient || defaultRpcClient;
    this.tip20Client = options.tip20Client || defaultTip20Client;
    this.logs = [];
    this.isRunning = false;
  }

  log(msg, type = 'info', extra = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      message: msg,
      ...extra,
    };
    this.logs.push(entry);
    console.log(`[${entry.timestamp}] [${type.toUpperCase()}] ${msg}`);
    return entry;
  }

  /**
   * Run a full testnet cycle:
   * 1. Check/Create Wallets
   * 2. Claim Moderato Faucet (tempo_fundAddress)
   * 3. Query TIP-20 Stablecoin Balances
   * 4. Execute TIP-20 Micro-Transfers
   * 5. Perform MPP Payment Simulation
   */
  async runCycle(walletCount = 3, transferCount = 2) {
    if (this.isRunning) {
      throw new Error('Bot cycle is already running');
    }

    this.isRunning = true;
    this.log(`🚀 Starting Tempo Testnet Activity Cycle (${TEMPO_CONFIG.network.name})`, 'start');

    const cycleResults = {
      walletsFunded: [],
      transfers: [],
      mppPayments: [],
      errors: [],
    };

    try {
      // Step 1: Ensure we have enough test wallets
      let wallets = this.walletManager.loadWallets();
      if (wallets.length < walletCount) {
        const needed = walletCount - wallets.length;
        this.log(`Generating ${needed} new Tempo testnet wallet(s)...`, 'info');
        const generated = this.walletManager.generateBatch(needed);
        wallets = this.walletManager.loadWallets();
      }

      const activeWallets = wallets.slice(0, walletCount);

      // Step 2: Faucet Funding for each wallet
      for (const w of activeWallets) {
        try {
          this.log(`Requesting testnet funds for ${w.address}...`, 'faucet');
          const fundRes = await this.rpcClient.fundAddress(w.address);
          cycleResults.walletsFunded.push({
            address: w.address,
            success: true,
          });
          this.log(`✅ Faucet funded: ${w.address}`, 'success');
        } catch (err) {
          this.log(`⚠️ Faucet warning for ${w.address}: ${err.message}`, 'warn');
        }
      }

      // Small delay to let blocks confirm
      await new Promise(r => setTimeout(r, 2000));

      // Step 3: Check balances
      for (const w of activeWallets) {
        try {
          const native = await this.rpcClient.getNativeBalance(w.address);
          const pathUsd = await this.tip20Client.getBalance('pathUSD', w.address);
          this.log(`Wallet ${w.address.slice(0, 8)}... | Native: ${native.formatted} ${native.symbol} | pathUSD: ${pathUsd.formatted}`, 'balance');
        } catch (e) {
          this.log(`Balance query failed for ${w.address}: ${e.message}`, 'warn');
        }
      }

      // Step 4: Execute Transfers between wallets
      if (activeWallets.length >= 2) {
        for (let i = 0; i < transferCount; i++) {
          const sender = activeWallets[i % activeWallets.length];
          const receiver = activeWallets[(i + 1) % activeWallets.length];
          const amount = (0.5 + Math.random() * 2).toFixed(2); // Random 0.5 - 2.5 pathUSD

          try {
            this.log(`Sending ${amount} pathUSD from ${sender.address.slice(0, 6)}... to ${receiver.address.slice(0, 6)}...`, 'tx');
            const tx = await this.tip20Client.transfer('pathUSD', sender.privateKey, receiver.address, amount);
            cycleResults.transfers.push(tx);
            this.log(`✅ TX Confirmed! Block: ${tx.blockNumber} | Hash: ${tx.txHash}`, 'success', {
              explorer: tx.explorerLink,
            });
          } catch (err) {
            this.log(`Transfer error: ${err.message}`, 'error');
            cycleResults.errors.push({ action: 'transfer', error: err.message });
          }
        }
      }

      this.log(`🎉 Activity cycle completed successfully!`, 'finish');
    } catch (err) {
      this.log(`Fatal cycle error: ${err.message}`, 'error');
      cycleResults.errors.push({ action: 'cycle', error: err.message });
    } finally {
      this.isRunning = false;
    }

    return cycleResults;
  }
}

export const defaultActivityBot = new TempoActivityBot();
