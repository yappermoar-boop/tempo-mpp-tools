# ⚡ Tempo MPP Tools & Testnet Studio

[![CI](https://github.com/yappermoar-boop/tempo-mpp-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/yappermoar-boop/tempo-mpp-tools)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Network: Tempo Moderato](https://img.shields.io/badge/Network-Tempo%20Moderato%20(42431)-6366f1.svg)](https://explore.testnet.tempo.xyz)
[![Standard: HTTP 402 MPP](https://img.shields.io/badge/Standard-HTTP%20402%20MPP-10b981.svg)](https://mpp.dev)

A comprehensive toolkit, testnet automation bot, SDK, and interactive testing suite for the **Machine Payments Protocol (MPP)** on the **Tempo Layer-1 Blockchain** (Moderato Testnet).

---

## 🌟 Features

- ⚡ **Complete MPP Core SDK**: Full implementation of the `HTTP 402 Payment Required` negotiation standard (`WWW-Authenticate: Payment` & `Authorization: Payment`).
- 🤖 **AI Agent Client SDK (`MppAgentClient`)**: Autonomous HTTP client that automatically detects 402 challenges, signs payment credentials with a Tempo wallet, and settles micro-transactions.
- 🛡️ **Express Server Middleware (`mppPaymentRequired`)**: Turn any REST or streaming endpoint into a paid machine resource with 1 line of code.
- 💧 **Tempo Moderato Faucet Bot**: Direct JSON-RPC integration with `tempo_fundAddress` to fund accounts with native gas and **1,000,000 TIP-20 tokens** (`pathUSD`, `AlphaUSD`, `BetaUSD`).
- 🚀 **On-Chain Testnet Activity Bot**: Automated inter-wallet TIP-20 transfer and protocol transaction generator to build organic on-chain activity for potential testnet rewards / airdrops.
- 🧪 **MPP Conformance & Test Suite**: Conformance validation testing challenge integrity, double-spend replay prevention, signature verification, and RPC responsiveness.
- 💻 **Modern Glassmorphic Web Studio**: Real-time browser studio featuring live block monitoring, one-click faucet claims, interactive MPP step-by-step visual debugger, and test results.
- ⌨️ **Universal CLI Tool (`tempo-mpp`)**: Powerful command-line utility for wallets, faucet, token balances, transfers, and daemon bots.

---

## ⛓️ Tempo Moderato Network Details

| Parameter | Value |
|---|---|
| **Network Name** | Tempo Testnet (Moderato) |
| **Chain ID** | `42431` (Hex: `0xa5bf`) |
| **RPC Endpoint** | `https://rpc.moderato.tempo.xyz` |
| **WebSocket URL** | `wss://rpc.moderato.tempo.xyz` |
| **Block Explorer** | [https://explore.testnet.tempo.xyz](https://explore.testnet.tempo.xyz) |
| **Native Currency** | USD (18 Decimals) |
| **Faucet RPC Method** | `tempo_fundAddress` |

### Enshrined TIP-20 Stablecoins
- **pathUSD**: `0x20c0000000000000000000000000000000000000`
- **AlphaUSD**: `0x20c0000000000000000000000000000000000001`
- **BetaUSD**: `0x20c0000000000000000000000000000000000002`
- **ThetaUSD**: `0x20c0000000000000000000000000000000000003`

---

## 📦 Quick Start

### 1. Install Dependencies
```bash
git clone https://github.com/yappermoar-boop/tempo-mpp-tools.git
cd tempo-mpp-tools
npm install
```

### 2. Launch Interactive Web Studio
```bash
npm start
# Open http://localhost:3402 in your browser
```

---

## ⌨️ CLI Usage (`tempo-mpp`)

The CLI provides instant access to all Tempo blockchain and MPP functions:

```bash
# Generate a new Tempo EVM Wallet
node bin/tempo-mpp.js wallet new

# List saved wallets
node bin/tempo-mpp.js wallet list

# Claim 1,000,000 test tokens from Moderato Faucet (tempo_fundAddress)
node bin/tempo-mpp.js faucet 0xYourAddressHere

# Check native gas & TIP-20 stablecoin balances
node bin/tempo-mpp.js balance 0xYourAddressHere

# Send TIP-20 pathUSD transfer on testnet
node bin/tempo-mpp.js transfer 0xRecipientAddress 5.0 pathUSD

# Run automated testnet activity & airdrop cycle
node bin/tempo-mpp.js bot 3 2

# Run MPP Protocol Conformance Test Suite
node bin/tempo-mpp.js test

# Autonomous AI Agent fetch with auto-payment
node bin/tempo-mpp.js agent http://localhost:3402/api/mpp/protected-ai-data
```

---

## 🔄 Machine Payments Protocol (MPP) Architecture

```
[ AI Agent / Client ]                             [ MPP Protected Server ]
         |                                                   |
         | -------- 1. GET /api/data (No Auth) ------------> |
         |                                                   |
         | <------- 2. HTTP 402 Payment Required ------------ |
         |             WWW-Authenticate: Payment             |
         |             (amount="0.05", currency="pathUSD")   |
         |                                                   |
   [ Signs Credential ]                                      |
   [ with Tempo Wallet]                                      |
         |                                                   |
         | -------- 3. GET /api/data ----------------------> |
         |             Authorization: Payment <credential>   |
         |                                                   |
         |                                           [ Verify Signature ]
         |                                           [ & Settle On-Chain]
         |                                                   |
         | <------- 4. HTTP 200 OK ------------------------- |
         |             Payment-Receipt: id="rcpt_..."        |
         |             { "data": "Unlocked Resource" }       |
```

### Code Example: Protecting an API Route (Server)
```javascript
import express from 'express';
import { mppPaymentRequired } from './src/server/mpp-middleware.js';

const app = express();

app.get('/api/premium-weather', 
  mppPaymentRequired({
    amount: '0.02',
    currency: 'pathUSD',
    recipient: '0xYourSettlementAddress...',
    intent: 'charge'
  }), 
  (req, res) => {
    res.json({ weather: 'Sunny, 24°C', receipt: req.mppPayment.receiptId });
  }
);
```

### Code Example: Autonomous AI Agent Fetch (Client)
```javascript
import { MppAgentClient } from './src/client/mpp-agent.js';

const agent = new MppAgentClient('0xYourPrivateKey...');

// Automatically intercepts HTTP 402, signs payment, and returns 200 OK + receipt!
const result = await agent.fetch('http://localhost:3402/api/premium-weather');
const data = await result.response.json();

console.log('Payment Receipt:', result.receipt);
console.log('Resource Data:', data);
```

---

## 🧪 Conformance & Benchmark Test Suite

Run the full protocol test suite:
```bash
npm run test:conformance
```

Tests include:
- `MPP-CONF-001`: Standard `WWW-Authenticate` 402 Challenge Format
- `MPP-CONF-002`: Parsing `WWW-Authenticate` Header
- `MPP-CONF-003`: Client Credential Generation & Cryptographic Verification
- `MPP-CONF-004`: Replay Protection (Double Spending Rejection)
- `MPP-CONF-005`: Expired Challenge Rejection
- `MPP-CONF-006`: Tampered Payload / Signature Rejection
- `MPP-CONF-007`: Tempo Moderato RPC Connectivity & Chain ID Validation

---

## 🚀 How to Publish to GitHub

1. Create a new repository on your GitHub account (e.g. `tempo-mpp-tools`).
2. Run the following commands in this directory:
```bash
git init
git add .
git commit -m "feat: initial commit of Tempo MPP Tools and Testnet Suite"
git branch -M main
git remote add origin https://github.com/yappermoar-boop/tempo-mpp-tools.git
git push -u origin main
```

---

## 📄 License
This project is open-source software licensed under the [MIT License](LICENSE).
