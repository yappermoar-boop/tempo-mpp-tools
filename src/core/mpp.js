/**
 * Machine Payments Protocol (MPP) Core Engine
 * Standardized HTTP 402 Payment Negotiation & Verification
 */

import { ethers } from 'ethers';
import crypto from 'crypto';
import { TEMPO_CONFIG } from './config.js';

export class MppCore {
  constructor(options = {}) {
    this.realm = options.realm || 'Tempo API Services';
    this.supportedCurrencies = options.supportedCurrencies || ['pathUSD', 'AlphaUSD', 'BetaUSD'];
    this.usedChallenges = new Map(); // Replay attack prevention store
    this.secretKey = options.secretKey || crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create an HTTP 402 WWW-Authenticate Payment Challenge
   * @param {Object} opts
   * @param {string} opts.amount - Amount required, e.g. "0.10"
   * @param {string} opts.currency - Token symbol, e.g. "pathUSD"
   * @param {string} opts.recipient - Beneficiary 0x address
   * @param {string} opts.intent - "charge" or "session"
   */
  createChallenge(opts = {}) {
    const amount = opts.amount || '0.01';
    const currency = opts.currency || TEMPO_CONFIG.mpp.defaultCurrency;
    const recipient = opts.recipient || '0x0000000000000000000000000000000000000000';
    const intent = opts.intent || TEMPO_CONFIG.mpp.intents.CHARGE;
    const expiresIn = opts.expiresIn || TEMPO_CONFIG.mpp.challengeExpirySeconds;

    const challengeId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    // HMAC signature for challenge integrity
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(`${challengeId}:${amount}:${currency}:${recipient}:${expiresAt}:${intent}`);
    const signature = hmac.digest('hex');

    const challengeData = {
      challengeId,
      amount,
      currency,
      recipient,
      intent,
      expiresAt,
      signature,
      realm: this.realm,
      method: TEMPO_CONFIG.mpp.defaultMethod,
      chainId: TEMPO_CONFIG.network.chainId,
    };

    // Store in active challenges
    this.usedChallenges.set(challengeId, { ...challengeData, settled: false });

    // Format standard WWW-Authenticate Header
    const authHeaderValue = `Payment realm="${this.realm}", id="${challengeId}", amount="${amount}", currency="${currency}", method="tempo", recipient="${recipient}", intent="${intent}", chainId="${TEMPO_CONFIG.network.chainId}", expires="${expiresAt}", sig="${signature}"`;

    return {
      headerValue: authHeaderValue,
      data: challengeData,
    };
  }

  /**
   * Parse WWW-Authenticate Header into a structured challenge object
   */
  static parseChallengeHeader(headerString) {
    if (!headerString || !headerString.startsWith('Payment')) {
      throw new Error('Invalid authentication scheme. Expected "Payment".');
    }

    const params = {};
    const regex = /(\w+)=["']?([^"',]+)["']?/g;
    let match;
    while ((match = regex.exec(headerString)) !== null) {
      params[match[1]] = match[2];
    }

    return {
      challengeId: params.id,
      realm: params.realm,
      amount: params.amount,
      currency: params.currency,
      method: params.method || 'tempo',
      recipient: params.recipient,
      intent: params.intent || 'charge',
      chainId: parseInt(params.chainId || '42431', 10),
      expiresAt: parseInt(params.expires || '0', 10),
      serverSignature: params.sig,
    };
  }

  /**
   * Sign challenge on behalf of a Client / AI Agent
   * @param {Object} challengeData - Parsed challenge
   * @param {string} privateKey - Client's EVM private key
   * @param {string} [txHash] - Optional on-chain transaction hash proof
   */
  static async signPaymentCredential(challengeData, privateKey, txHash = null) {
    const wallet = new ethers.Wallet(privateKey);
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(8).toString('hex');

    // Canonical payload string to sign
    const payload = JSON.stringify({
      challengeId: challengeData.challengeId,
      amount: challengeData.amount,
      currency: challengeData.currency,
      payer: wallet.address,
      recipient: challengeData.recipient,
      txHash: txHash || 'pre-authorized-session',
      timestamp,
      nonce,
    });

    const clientSignature = await wallet.signMessage(payload);

    const credentialObj = {
      version: '1.0',
      scheme: 'Payment',
      payer: wallet.address,
      payload: Buffer.from(payload).toString('base64'),
      signature: clientSignature,
    };

    const headerValue = `Payment ${Buffer.from(JSON.stringify(credentialObj)).toString('base64')}`;

    return {
      headerValue,
      credential: credentialObj,
      payerAddress: wallet.address,
    };
  }

  /**
   * Verify an Authorization: Payment <token> header on the Server
   */
  async verifyPaymentCredential(authHeader) {
    if (!authHeader || !authHeader.startsWith('Payment ')) {
      return { valid: false, error: 'Missing or invalid Authorization header scheme' };
    }

    try {
      const base64Str = authHeader.replace(/^Payment\s+/, '').trim();
      const rawJson = Buffer.from(base64Str, 'base64').toString('utf8');
      const credential = JSON.parse(rawJson);

      if (!credential.payload || !credential.signature || !credential.payer) {
        return { valid: false, error: 'Malformed payment credential structure' };
      }

      const payloadStr = Buffer.from(credential.payload, 'base64').toString('utf8');
      const payload = JSON.parse(payloadStr);

      // 1. Check if challenge exists in active store
      const storedChallenge = this.usedChallenges.get(payload.challengeId);
      if (!storedChallenge) {
        return { valid: false, error: 'Unknown or expired challenge ID' };
      }

      if (storedChallenge.settled) {
        return { valid: false, error: 'Challenge already spent (Replay Attack detected)' };
      }

      // 2. Check challenge expiry
      const now = Math.floor(Date.now() / 1000);
      if (now > storedChallenge.expiresAt) {
        return { valid: false, error: 'Payment challenge has expired' };
      }

      // 3. Verify client signature
      const recoveredAddress = ethers.verifyMessage(payloadStr, credential.signature);
      if (recoveredAddress.toLowerCase() !== credential.payer.toLowerCase()) {
        return { valid: false, error: 'Cryptographic signature mismatch' };
      }

      // 4. Mark challenge as settled
      storedChallenge.settled = true;
      this.usedChallenges.set(payload.challengeId, storedChallenge);

      // 5. Generate Receipt
      const receiptId = `rcpt_${crypto.randomBytes(12).toString('hex')}`;
      const receiptHeader = `id="${receiptId}", status="settled", amount="${payload.amount}", currency="${payload.currency}", payer="${credential.payer}", time="${now}"`;

      return {
        valid: true,
        payer: credential.payer,
        amount: payload.amount,
        currency: payload.currency,
        receiptId,
        receiptHeader,
        challengeId: payload.challengeId,
      };
    } catch (err) {
      return { valid: false, error: `Verification failed: ${err.message}` };
    }
  }
}

export const defaultMppCore = new MppCore();
