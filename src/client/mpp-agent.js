/**
 * MPP Autonomous Agent Client (AI Agent / HTTP Client SDK)
 * Automatically handles HTTP 402 Payment Required challenges using a Tempo wallet
 */

import { MppCore } from '../core/mpp.js';

export class MppAgentClient {
  constructor(privateKey, options = {}) {
    this.privateKey = privateKey;
    this.autoPayMaxAmount = options.autoPayMaxAmount || 10.0; // Security limit per request
    this.allowedCurrencies = options.allowedCurrencies || ['pathUSD', 'AlphaUSD', 'BetaUSD', 'ThetaUSD'];
  }

  /**
   * Fetch with automatic MPP 402 negotiation
   * @param {string} url
   * @param {RequestInit} [options]
   */
  async fetch(url, options = {}) {
    const initialHeaders = { ...(options.headers || {}) };

    // Step 1: Send initial request
    const response = await fetch(url, {
      ...options,
      headers: initialHeaders,
    });

    // If status is not 402, return response immediately
    if (response.status !== 402) {
      return {
        response,
        paid: false,
        receipt: null,
      };
    }

    // Step 2: Extract and parse WWW-Authenticate challenge
    const wwwAuth = response.headers.get('www-authenticate') || response.headers.get('WWW-Authenticate');
    if (!wwwAuth || !wwwAuth.startsWith('Payment')) {
      throw new Error(`Server returned 402 without valid WWW-Authenticate: Payment header`);
    }

    const challenge = MppCore.parseChallengeHeader(wwwAuth);

    // Step 3: Security check (budget limit & currency check)
    const reqAmount = parseFloat(challenge.amount);
    if (reqAmount > this.autoPayMaxAmount) {
      throw new Error(`Payment request ${reqAmount} ${challenge.currency} exceeds agent auto-pay limit (${this.autoPayMaxAmount})`);
    }

    if (!this.allowedCurrencies.includes(challenge.currency)) {
      throw new Error(`Currency ${challenge.currency} is not in agent allowed list`);
    }

    // Step 4: Sign Payment Credential using agent's Tempo wallet
    const credential = await MppCore.signPaymentCredential(challenge, this.privateKey);

    // Step 5: Retry request with Authorization header
    const authorizedHeaders = {
      ...initialHeaders,
      'Authorization': credential.headerValue,
    };

    const authorizedResponse = await fetch(url, {
      ...options,
      headers: authorizedHeaders,
    });

    // Step 6: Extract Payment-Receipt header
    const receiptHeader = authorizedResponse.headers.get('payment-receipt') || authorizedResponse.headers.get('Payment-Receipt');

    return {
      response: authorizedResponse,
      paid: true,
      challenge,
      payer: credential.payerAddress,
      receipt: receiptHeader,
      status: authorizedResponse.status,
    };
  }
}
