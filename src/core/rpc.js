/**
 * Tempo Moderato Testnet JSON-RPC Client & Faucet Controller
 */

import { TEMPO_CONFIG } from './config.js';

export class TempoRpcClient {
  constructor(rpcUrl = TEMPO_CONFIG.network.rpcUrl) {
    this.rpcUrl = rpcUrl;
  }

  /**
   * Execute raw JSON-RPC call
   */
  async call(method, params = []) {
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`RPC Error [${data.error.code}]: ${data.error.message}`);
    }

    return data.result;
  }

  /**
   * Ping network & check status
   */
  async getNetworkStatus() {
    try {
      const [blockHex, chainIdHex] = await Promise.all([
        this.call('eth_blockNumber'),
        this.call('eth_chainId'),
      ]);

      const blockNumber = parseInt(blockHex, 16);
      const chainId = parseInt(chainIdHex, 16);

      return {
        online: true,
        blockNumber,
        chainId,
        rpcUrl: this.rpcUrl,
        networkName: TEMPO_CONFIG.network.name,
      };
    } catch (err) {
      return {
        online: false,
        error: err.message,
        rpcUrl: this.rpcUrl,
      };
    }
  }

  /**
   * Call the Moderato Testnet Faucet (tempo_fundAddress)
   * Funds the given address with native gas and 1,000,000 of each test stablecoin
   * @param {string} address - 0x EVM Address
   */
  async fundAddress(address) {
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      throw new Error(`Invalid EVM address format: ${address}`);
    }

    // Call custom tempo_fundAddress RPC method
    const result = await this.call('tempo_fundAddress', [address]);
    return {
      success: true,
      address,
      result,
      message: `Successfully requested testnet funds from Moderato Faucet for ${address}`,
    };
  }

  /**
   * Get Native Gas / USD Balance
   */
  async getNativeBalance(address) {
    const hexBalance = await this.call('eth_getBalance', [address, 'latest']);
    const wei = BigInt(hexBalance);
    const eth = Number(wei) / 1e18;
    return {
      wei: wei.toString(),
      formatted: eth.toFixed(4),
      symbol: TEMPO_CONFIG.network.nativeCurrency.symbol,
    };
  }

  /**
   * Get latest block number
   */
  async getBlockNumber() {
    const hex = await this.call('eth_blockNumber');
    return parseInt(hex, 16);
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash) {
    return await this.call('eth_getTransactionReceipt', [txHash]);
  }
}

export const defaultRpcClient = new TempoRpcClient();
