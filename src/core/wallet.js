/**
 * Tempo EVM Wallet Manager & Key Generator
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { defaultRpcClient } from './rpc.js';
import { TEMPO_CONFIG } from './config.js';

export class WalletManager {
  constructor(storagePath = './wallets.json') {
    this.storagePath = path.resolve(storagePath);
    this.provider = new ethers.JsonRpcProvider(
      TEMPO_CONFIG.network.rpcUrl,
      {
        chainId: TEMPO_CONFIG.network.chainId,
        name: TEMPO_CONFIG.network.name,
      }
    );
  }

  /**
   * Create a new random EVM Wallet
   */
  createWallet(label = 'Tempo Wallet') {
    const randomWallet = ethers.Wallet.createRandom();
    const walletData = {
      address: randomWallet.address,
      privateKey: randomWallet.privateKey,
      mnemonic: randomWallet.mnemonic ? randomWallet.mnemonic.phrase : null,
      label,
      createdAt: new Date().toISOString(),
    };

    return walletData;
  }

  /**
   * Import wallet from private key
   */
  importFromPrivateKey(privateKey, label = 'Imported Wallet') {
    const wallet = new ethers.Wallet(privateKey);
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: null,
      label,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get Ethers Signer instance for a private key connected to Moderato RPC
   */
  getSigner(privateKey) {
    return new ethers.Wallet(privateKey, this.provider);
  }

  /**
   * Load saved wallets from local JSON store
   */
  loadWallets() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn(`Failed to read wallets store: ${e.message}`);
    }
    return [];
  }

  /**
   * Save wallet to local store
   */
  saveWallet(walletData) {
    const wallets = this.loadWallets();
    const existingIndex = wallets.findIndex(w => w.address.toLowerCase() === walletData.address.toLowerCase());
    if (existingIndex >= 0) {
      wallets[existingIndex] = { ...wallets[existingIndex], ...walletData };
    } else {
      wallets.push(walletData);
    }
    fs.writeFileSync(this.storagePath, JSON.stringify(wallets, null, 2), 'utf8');
    return wallets;
  }

  /**
   * Generate multiple wallets (useful for testing, bot activity, airdrop simulation)
   */
  generateBatch(count = 5) {
    const newWallets = [];
    for (let i = 1; i <= count; i++) {
      const w = this.createWallet(`Tempo Test Account #${i}`);
      newWallets.push(w);
      this.saveWallet(w);
    }
    return newWallets;
  }
}

export const defaultWalletManager = new WalletManager();
