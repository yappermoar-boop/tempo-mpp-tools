/**
 * Tempo & Machine Payments Protocol (MPP) Configuration
 */

export const TEMPO_CONFIG = {
  network: {
    name: 'Tempo Testnet (Moderato)',
    chainId: 42431,
    chainIdHex: '0xa5bf',
    rpcUrl: process.env.TEMPO_RPC_URL || 'https://rpc.moderato.tempo.xyz',
    wsUrl: process.env.TEMPO_WS_URL || 'wss://rpc.moderato.tempo.xyz',
    explorerUrl: 'https://explore.testnet.tempo.xyz',
    nativeCurrency: {
      name: 'Tempo USD',
      symbol: 'USD',
      decimals: 18,
    },
  },
  mainnet: {
    name: 'Tempo Mainnet',
    chainId: 4217,
    rpcUrl: 'https://rpc.tempo.xyz',
    explorerUrl: 'https://explore.tempo.xyz',
  },
  tokens: {
    pathUSD: {
      address: '0x20c0000000000000000000000000000000000000',
      name: 'Path USD',
      symbol: 'pathUSD',
      decimals: 6,
    },
    AlphaUSD: {
      address: '0x20c0000000000000000000000000000000000001',
      name: 'Alpha USD',
      symbol: 'AlphaUSD',
      decimals: 6,
    },
    BetaUSD: {
      address: '0x20c0000000000000000000000000000000000002',
      name: 'Beta USD',
      symbol: 'BetaUSD',
      decimals: 6,
    },
    ThetaUSD: {
      address: '0x20c0000000000000000000000000000000000003',
      name: 'Theta USD',
      symbol: 'ThetaUSD',
      decimals: 6,
    },
  },
  mpp: {
    protocolVersion: '1.0',
    authScheme: 'Payment',
    intents: {
      CHARGE: 'charge',
      SESSION: 'session',
    },
    defaultCurrency: 'pathUSD',
    defaultMethod: 'tempo',
    challengeExpirySeconds: 300, // 5 minutes
  },
};

// TIP-20 / ERC-20 Standard Interface ABI
export const TIP20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];
