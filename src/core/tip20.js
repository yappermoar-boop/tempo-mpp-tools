/**
 * Tempo TIP-20 Stablecoin Client (pathUSD, AlphaUSD, BetaUSD, ThetaUSD)
 */

import { ethers } from 'ethers';
import { TEMPO_CONFIG, TIP20_ABI } from './config.js';
import { defaultWalletManager } from './wallet.js';

export class Tip20Client {
  constructor(provider = defaultWalletManager.provider) {
    this.provider = provider;
  }

  /**
   * Get Contract instance for a given TIP-20 token
   */
  getTokenContract(tokenSymbolOrAddress, signerOrProvider = this.provider) {
    let tokenAddress = tokenSymbolOrAddress;
    if (TEMPO_CONFIG.tokens[tokenSymbolOrAddress]) {
      tokenAddress = TEMPO_CONFIG.tokens[tokenSymbolOrAddress].address;
    }
    return new ethers.Contract(tokenAddress, TIP20_ABI, signerOrProvider);
  }

  /**
   * Get balance for a specific token
   */
  async getBalance(tokenSymbolOrAddress, ownerAddress) {
    const contract = this.getTokenContract(tokenSymbolOrAddress);
    const [rawBalance, decimals, symbol] = await Promise.all([
      contract.balanceOf(ownerAddress),
      contract.decimals().catch(() => 6),
      contract.symbol().catch(() => tokenSymbolOrAddress),
    ]);

    const formatted = ethers.formatUnits(rawBalance, decimals);
    return {
      token: symbol,
      address: contract.target,
      raw: rawBalance.toString(),
      decimals: Number(decimals),
      formatted,
    };
  }

  /**
   * Query all standard Tempo TIP-20 stablecoin balances for an address
   */
  async getAllBalances(ownerAddress) {
    const tokens = Object.keys(TEMPO_CONFIG.tokens);
    const results = {};

    await Promise.all(
      tokens.map(async (sym) => {
        try {
          const bal = await this.getBalance(sym, ownerAddress);
          results[sym] = bal;
        } catch (err) {
          results[sym] = {
            token: sym,
            error: err.message,
            formatted: '0.00',
          };
        }
      })
    );

    return results;
  }

  /**
   * Transfer TIP-20 tokens
   */
  async transfer(tokenSymbolOrAddress, senderPrivateKey, recipientAddress, amount) {
    const signer = defaultWalletManager.getSigner(senderPrivateKey);
    const contract = this.getTokenContract(tokenSymbolOrAddress, signer);

    const decimals = await contract.decimals().catch(() => 6);
    const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

    const tx = await contract.transfer(recipientAddress, parsedAmount);
    const receipt = await tx.wait(1);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      from: signer.address,
      to: recipientAddress,
      amount: amount.toString(),
      explorerLink: `${TEMPO_CONFIG.network.explorerUrl}/tx/${tx.hash}`,
    };
  }
}

export const defaultTip20Client = new Tip20Client();
