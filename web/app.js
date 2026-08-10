/**
 * Tempo MPP Web Studio Front-End Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initNetworkStatus();
  loadWallets();
  initEventListeners();
  startLogPolling();
});

// 1. Tab Navigation
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      switchTab(target);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${tabId}`);
  });
}
window.switchTab = switchTab;

// 2. Network Status Polling
async function initNetworkStatus() {
  async function fetchStatus() {
    try {
      const res = await fetch('/api/network/status');
      const data = await res.json();

      const blockEl = document.getElementById('stat-block');
      const netBlockEl = document.getElementById('network-block');
      const netNameEl = document.getElementById('network-name');

      if (data.online) {
        blockEl.textContent = `#${data.blockNumber.toLocaleString()}`;
        netBlockEl.textContent = `#${data.blockNumber}`;
        netNameEl.textContent = `Tempo Moderato (Chain ${data.chainId})`;
      } else {
        blockEl.textContent = 'Offline';
        netNameEl.textContent = 'Disconnected';
      }
    } catch (e) {
      console.warn('Network status error:', e);
    }
  }

  fetchStatus();
  setInterval(fetchStatus, 8000);
}

// 3. Wallets & Faucet Management
let loadedWallets = [];

async function loadWallets() {
  const container = document.getElementById('wallets-list');
  const senderSelect = document.getElementById('transfer-sender');

  try {
    const res = await fetch('/api/wallets');
    const wallets = await res.json();
    loadedWallets = wallets;

    if (wallets.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          No Tempo wallets found. Click "+ Generate New Wallet" above to create your first wallet!
        </div>
      `;
      senderSelect.innerHTML = '<option value="">No wallets available</option>';
      return;
    }

    container.innerHTML = '';
    senderSelect.innerHTML = '';

    for (const w of wallets) {
      // Option for transfer dropdown
      const opt = document.createElement('option');
      opt.value = w.privateKey;
      opt.textContent = `${w.label} (${w.address.slice(0, 6)}...${w.address.slice(-4)})`;
      senderSelect.appendChild(opt);

      // Card item
      const card = document.createElement('div');
      card.className = 'wallet-card';
      card.id = `wallet-${w.address}`;
      card.innerHTML = `
        <div class="wallet-meta">
          <span class="wallet-label">${w.label}</span>
          <span class="wallet-address">${w.address}</span>
        </div>
        <div class="wallet-balances" id="bal-${w.address}">
          <div class="bal-pill">
            <span class="b-lbl">Native Gas</span>
            <span class="b-val" id="native-${w.address}">...</span>
          </div>
          <div class="bal-pill">
            <span class="b-lbl">pathUSD</span>
            <span class="b-val" id="pathusd-${w.address}">...</span>
          </div>
        </div>
        <div class="wallet-actions">
          <button class="btn btn-primary btn-sm" onclick="claimFaucet('${w.address}')">
            💧 Claim Faucet
          </button>
          <a href="https://explore.testnet.tempo.xyz/address/${w.address}" target="_blank" class="btn btn-secondary btn-sm">
            Explorer ↗
          </a>
        </div>
      `;
      container.appendChild(card);

      // Fetch balances
      fetchWalletBalances(w.address);
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state error">Failed to load wallets: ${err.message}</div>`;
  }
}

async function fetchWalletBalances(address) {
  try {
    const res = await fetch(`/api/wallets/${address}/balances`);
    const data = await res.json();

    const nativeEl = document.getElementById(`native-${address}`);
    const pathUsdEl = document.getElementById(`pathusd-${address}`);

    if (nativeEl && data.native) {
      nativeEl.textContent = `${data.native.formatted} USD`;
    }
    if (pathUsdEl && data.tokens && data.tokens.pathUSD) {
      pathUsdEl.textContent = `${data.tokens.pathUSD.formatted} pathUSD`;
    }
  } catch (e) {
    console.warn(`Balance load error for ${address}:`, e);
  }
}

window.claimFaucet = async function(address) {
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Funding...';
  }

  try {
    const res = await fetch('/api/faucet/fund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    const data = await res.json();

    if (data.success) {
      alert(`🎉 Faucet Claimed Successfully!\n\nFunded address ${address} with testnet USD and TIP-20 tokens via tempo_fundAddress.`);
      fetchWalletBalances(address);
    } else {
      alert(`Faucet error: ${data.error || 'Failed'}`);
    }
  } catch (e) {
    alert(`Faucet request failed: ${e.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '💧 Claim Faucet';
    }
  }
};

// 4. Event Listeners & Transfer
function initEventListeners() {
  // Generate Wallet
  document.getElementById('btn-create-wallet').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/wallets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: `Tempo Wallet #${loadedWallets.length + 1}` }),
      });
      const data = await res.json();
      if (data.success) {
        loadWallets();
      }
    } catch (e) {
      alert(`Error generating wallet: ${e.message}`);
    }
  });

  // Transfer Form
  document.getElementById('transfer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultEl = document.getElementById('transfer-result');
    const sendBtn = document.getElementById('btn-send-tx');

    const privateKey = document.getElementById('transfer-sender').value;
    const recipient = document.getElementById('transfer-recipient').value;
    const amount = document.getElementById('transfer-amount').value;

    if (!privateKey) {
      alert('Please select a sender wallet');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = '⏳ Sending on Tempo...';
    resultEl.innerHTML = '<div class="text-muted">Submitting transaction to Moderato RPC...</div>';

    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey, recipient, amount, token: 'pathUSD' }),
      });
      const data = await res.json();

      if (data.success) {
        resultEl.innerHTML = `
          <div class="token-item" style="border-color: #10b981;">
            <div class="token-info">
              <strong style="color: #34d399;">✅ Transaction Confirmed on Tempo Moderato!</strong>
              <span class="mono">Tx Hash: ${data.txHash}</span>
              <span class="mono">Block: #${data.blockNumber}</span>
            </div>
            <a href="${data.explorerLink}" target="_blank" class="btn btn-primary btn-sm">View in Explorer ↗</a>
          </div>
        `;
        loadWallets();
      } else {
        resultEl.innerHTML = `<div class="badge red">Transfer Failed: ${data.error}</div>`;
      }
    } catch (err) {
      resultEl.innerHTML = `<div class="badge red">Error: ${err.message}</div>`;
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send Transaction ↗';
    }
  });

  // Airdrop Bot Trigger
  document.getElementById('btn-start-bot').addEventListener('click', async () => {
    const btn = document.getElementById('btn-start-bot');
    btn.disabled = true;
    try {
      const res = await fetch('/api/bot/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletCount: 3, transferCount: 2 }),
      });
      const data = await res.json();
      console.log('Bot response:', data);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => { btn.disabled = false; }, 3000);
    }
  });

  // Clear Logs
  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    document.getElementById('bot-terminal').innerHTML = '<div class="log-line info">[System] Terminal logs cleared.</div>';
  });

  // MPP 402 Simulation
  document.getElementById('btn-run-simulation').addEventListener('click', runMppSimulation);

  // Conformance Suite
  document.getElementById('btn-run-conformance').addEventListener('click', runConformanceSuite);
}

// 5. Real-Time Bot Logs Polling
let lastLogCount = 0;
function startLogPolling() {
  setInterval(async () => {
    try {
      const res = await fetch('/api/bot/logs');
      const data = await res.json();

      const statusEl = document.getElementById('bot-status-indicator');
      if (data.isRunning) {
        statusEl.textContent = 'Running Cycle...';
        statusEl.className = 'val status-running';
      } else {
        statusEl.textContent = 'Idle';
        statusEl.className = 'val status-idle';
      }

      if (data.logs && data.logs.length > lastLogCount) {
        const terminal = document.getElementById('bot-terminal');
        for (let i = lastLogCount; i < data.logs.length; i++) {
          const l = data.logs[i];
          const div = document.createElement('div');
          div.className = `log-line ${l.type}`;
          div.textContent = `[${l.timestamp.split('T')[1].split('.')[0]}] [${l.type.toUpperCase()}] ${l.message}`;
          terminal.appendChild(div);
        }
        lastLogCount = data.logs.length;
        terminal.scrollTop = terminal.scrollHeight;
      }
    } catch (e) {}
  }, 2000);
}

// 6. Interactive MPP Simulation
async function runMppSimulation() {
  if (loadedWallets.length === 0) {
    alert('Please generate at least one wallet in the Wallets tab first!');
    switchTab('wallet-faucet');
    return;
  }

  const wallet = loadedWallets[0];
  const steps = [
    document.getElementById('step-1'),
    document.getElementById('step-2'),
    document.getElementById('step-3'),
    document.getElementById('step-4'),
  ];
  const inspector = document.getElementById('sim-output');
  const badge = document.getElementById('sim-status-badge');

  steps.forEach(s => s.classList.remove('active'));
  badge.textContent = 'Executing Step 1...';
  badge.className = 'badge purple';

  // Step 1 Highlight
  steps[0].classList.add('active');
  inspector.textContent = `[STEP 1: INITIAL CLIENT REQUEST]\n> GET /api/mpp/protected-ai-data HTTP/1.1\n> Host: localhost:3402\n> Accept: application/json\n(No Payment authorization included)\n\nSending request to server...`;

  await new Promise(r => setTimeout(r, 700));

  // Step 2 Highlight
  steps[1].classList.add('active');
  badge.textContent = 'Step 2: 402 Challenge Received';
  badge.className = 'badge red';
  inspector.textContent += `\n\n[STEP 2: SERVER 402 PAYMENT REQUIRED]\n< HTTP/1.1 402 Payment Required\n< WWW-Authenticate: Payment realm="Tempo API Services", amount="0.05", currency="pathUSD", recipient="0x20c0...", intent="charge"\n< Content-Type: application/json\n\nInterception triggered! Agent is analyzing payment requirements...`;

  await new Promise(r => setTimeout(r, 800));

  // Step 3 Highlight
  steps[2].classList.add('active');
  badge.textContent = 'Step 3: Signing Credential';
  badge.className = 'badge purple';
  inspector.textContent += `\n\n[STEP 3: AUTONOMOUS AGENT SIGNATURE]\n> Signer Address: ${wallet.address}\n> Generating ECDSA EIP-191 payment authorization...\n> Header: Authorization: Payment eyJ2ZXJzaW9uIjoiMS4wIiw...`;

  // Real backend call
  try {
    const res = await fetch('/api/mpp/simulate-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privateKey: wallet.privateKey }),
    });
    const result = await res.json();

    await new Promise(r => setTimeout(r, 600));

    // Step 4 Highlight
    steps[3].classList.add('active');
    badge.textContent = 'Step 4: Settled (200 OK)';
    badge.className = 'badge green';

    inspector.textContent += `\n\n[STEP 4: SETTLEMENT & RESOURCE UNLOCKED]\n< HTTP/1.1 200 OK\n< Payment-Receipt: ${result.receipt}\n< Payload Response:\n` + JSON.stringify(result.data, null, 2);
  } catch (err) {
    badge.textContent = 'Simulation Error';
    badge.className = 'badge red';
    inspector.textContent += `\n\n[ERROR] Simulation failed: ${err.message}`;
  }
}

// 7. Conformance Suite Runner
async function runConformanceSuite() {
  const container = document.getElementById('conformance-results');
  const summaryBox = document.getElementById('conformance-summary');
  const btn = document.getElementById('btn-run-conformance');

  btn.disabled = true;
  btn.textContent = '⏳ Executing Conformance Tests...';
  container.innerHTML = '<div class="empty-state">Running test specifications against Tempo & MPP...</div>';

  try {
    const res = await fetch('/api/conformance/run', { method: 'POST' });
    const data = await res.json();

    summaryBox.style.display = 'grid';
    document.getElementById('conf-passed').textContent = data.passed;
    document.getElementById('conf-failed').textContent = data.failed;
    document.getElementById('conf-total').textContent = data.total;

    container.innerHTML = '';
    data.details.forEach(item => {
      const row = document.createElement('div');
      const isPass = item.status === 'PASSED';
      row.className = `test-row ${isPass ? 'pass' : 'fail'}`;
      row.innerHTML = `
        <span class="test-name">${item.name}</span>
        <div class="test-meta">
          <span class="duration-tag">${item.durationMs}ms</span>
          <span class="badge ${isPass ? 'green' : 'red'}">${item.status}</span>
        </div>
      `;
      container.appendChild(row);
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state error">Test Suite Error: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Full Test Suite';
  }
}
