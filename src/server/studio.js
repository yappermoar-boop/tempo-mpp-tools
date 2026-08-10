/**
 * Tempo MPP Web Studio & API Server
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { TEMPO_CONFIG } from '../core/config.js';
import { defaultRpcClient } from '../core/rpc.js';
import { defaultWalletManager } from '../core/wallet.js';
import { defaultTip20Client } from '../core/tip20.js';
import { mppPaymentRequired } from './mpp-middleware.js';
import { MppAgentClient } from '../client/mpp-agent.js';
import { defaultActivityBot } from '../bot/activity-bot.js';
import { defaultConformanceSuite } from '../conformance/suite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.join(__dirname, '../../web');

const app = express();
const PORT = process.env.PORT || 3402;

app.use(cors());
app.use(express.json());
app.use(express.static(WEB_ROOT));

// 1. Network Status
app.get('/api/network/status', async (req, res) => {
  try {
    const status = await defaultRpcClient.getNetworkStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Wallets
app.get('/api/wallets', (req, res) => {
  const wallets = defaultWalletManager.loadWallets();
  res.json(wallets);
});

app.post('/api/wallets/create', (req, res) => {
  const label = req.body.label || `Tempo Account #${Date.now().toString().slice(-4)}`;
  const wallet = defaultWalletManager.createWallet(label);
  defaultWalletManager.saveWallet(wallet);
  res.json({ success: true, wallet });
});

app.post('/api/wallets/import', (req, res) => {
  const { privateKey, label } = req.body;
  if (!privateKey) {
    return res.status(400).json({ error: 'Private key is required' });
  }
  try {
    const wallet = defaultWalletManager.importFromPrivateKey(privateKey, label || 'Imported Wallet');
    defaultWalletManager.saveWallet(wallet);
    res.json({ success: true, wallet });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Faucet (tempo_fundAddress)
app.post('/api/faucet/fund', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }
  try {
    const result = await defaultRpcClient.fundAddress(address);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Balances
app.get('/api/wallets/:address/balances', async (req, res) => {
  const { address } = req.params;
  try {
    const [native, tip20] = await Promise.all([
      defaultRpcClient.getNativeBalance(address).catch(e => ({ formatted: '0.00', symbol: 'USD', error: e.message })),
      defaultTip20Client.getAllBalances(address).catch(e => ({})),
    ]);
    res.json({ address, native, tokens: tip20 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Transfer TIP-20
app.post('/api/transfer', async (req, res) => {
  const { privateKey, recipient, amount, token = 'pathUSD' } = req.body;
  if (!privateKey || !recipient || !amount) {
    return res.status(400).json({ error: 'Missing required parameters (privateKey, recipient, amount)' });
  }
  try {
    const result = await defaultTip20Client.transfer(token, privateKey, recipient, amount);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. MPP Protected Demo API Endpoints
app.get(
  '/api/mpp/protected-ai-data',
  mppPaymentRequired({
    amount: '0.05',
    currency: 'pathUSD',
    recipient: '0x20c0000000000000000000000000000000000000',
    intent: 'charge',
  }),
  (req, res) => {
    res.json({
      status: 'unlocked',
      message: 'Access granted to premium machine data stream!',
      payment: req.mppPayment,
      data: {
        tempoAirdropInsight: 'Active testnet transactions and MPP protocol calls on Tempo Moderato build on-chain score.',
        blockTimestamp: Date.now(),
        aiTokensProcessed: 1420,
        premiumMetrics: {
          tps: '15,000+',
          settlementTime: '250ms',
          gasFee: '$0.0001 (pathUSD)',
        },
      },
    });
  }
);

// 7. Simulate AI Agent Fetch (Client calls 402 endpoint automatically)
app.post('/api/mpp/simulate-agent', async (req, res) => {
  const { privateKey } = req.body;
  if (!privateKey) {
    return res.status(400).json({ error: 'Private key is required for simulation' });
  }
  try {
    const agent = new MppAgentClient(privateKey);
    const targetUrl = `http://localhost:${PORT}/api/mpp/protected-ai-data`;

    const result = await agent.fetch(targetUrl);
    const jsonBody = await result.response.json();

    res.json({
      success: true,
      paid: result.paid,
      status: result.status,
      receipt: result.receipt,
      challenge: result.challenge,
      data: jsonBody,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Conformance Suite Runner
app.post('/api/conformance/run', async (req, res) => {
  try {
    const results = await defaultConformanceSuite.runAll();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Activity Bot Trigger
app.post('/api/bot/trigger', async (req, res) => {
  const walletCount = req.body.walletCount || 2;
  const transferCount = req.body.transferCount || 1;

  if (defaultActivityBot.isRunning) {
    return res.json({ status: 'running', message: 'Activity bot is already processing a cycle.' });
  }

  // Run in background and return immediately
  defaultActivityBot.runCycle(walletCount, transferCount).catch(err => {
    console.error('Bot cycle error:', err);
  });

  res.json({
    status: 'started',
    message: `Activity bot started cycle with ${walletCount} wallets and ${transferCount} transfers.`,
  });
});

app.get('/api/bot/logs', (req, res) => {
  res.json({
    isRunning: defaultActivityBot.isRunning,
    logs: defaultActivityBot.logs,
  });
});

// Start listening if run directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Tempo MPP Studio & Toolkit Server Running!`);
    console.log(`🌐 Web Dashboard: http://localhost:${PORT}`);
    console.log(`⛓️  Connected to: ${TEMPO_CONFIG.network.name}`);
    console.log(`======================================================\n`);
  });
}

export default app;
