/**
 * Express Middleware for Machine Payments Protocol (MPP) HTTP 402 Protection
 */

import { defaultMppCore } from '../core/mpp.js';

/**
 * Creates an Express middleware that protects a route with MPP HTTP 402 payment
 * @param {Object} options
 * @param {string} options.amount - e.g. "0.05"
 * @param {string} options.currency - e.g. "pathUSD"
 * @param {string} options.recipient - 0x address
 * @param {string} options.intent - "charge" | "session"
 */
export function mppPaymentRequired(options = {}) {
  const mpp = options.mppCore || defaultMppCore;
  const amount = options.amount || '0.01';
  const currency = options.currency || 'pathUSD';
  const recipient = options.recipient || '0x20c0000000000000000000000000000000000000';
  const intent = options.intent || 'charge';

  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    // 1. If no authorization header or not Payment scheme, issue 402 Challenge
    if (!authHeader || !authHeader.startsWith('Payment ')) {
      const challenge = mpp.createChallenge({
        amount,
        currency,
        recipient,
        intent,
      });

      res.setHeader('WWW-Authenticate', challenge.headerValue);
      return res.status(402).json({
        error: 'Payment Required',
        protocol: 'Machine Payments Protocol (MPP)',
        message: 'This resource requires an MPP micropayment.',
        challenge: challenge.data,
      });
    }

    // 2. Verify payment credential
    const verification = await mpp.verifyPaymentCredential(authHeader);

    if (!verification.valid) {
      // Re-issue a fresh challenge with error explanation
      const freshChallenge = mpp.createChallenge({
        amount,
        currency,
        recipient,
        intent,
      });

      res.setHeader('WWW-Authenticate', freshChallenge.headerValue);
      return res.status(402).json({
        error: 'Payment Verification Failed',
        details: verification.error,
        retryChallenge: freshChallenge.data,
      });
    }

    // 3. Payment is valid! Inject receipt and proceed
    res.setHeader('Payment-Receipt', verification.receiptHeader);
    req.mppPayment = verification;

    next();
  };
}
