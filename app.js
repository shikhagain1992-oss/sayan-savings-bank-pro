// Sayan's Savings Bank Pro - Main Logic

// --- 1. CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCjOtHnKPFS2821_jQT6DllaSAqfYDF-iE",
  authDomain: "sayan-savings-bank-pro.firebaseapp.com",
  projectId: "sayan-savings-bank-pro",
  storageBucket: "sayan-savings-bank-pro.firebasestorage.app",
  messagingSenderId: "575662816526",
  appId: "1:575662816526:web:e18c6628561d58830bab5f"
};

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwqHkEx8bksySOqGVpRNkcgZq-TrFw6Bc3WljBSf4QnrSFxGhLKknK2x3pUzICNGGx7/exec";

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Global State
let transactions = [];
let balance = 0;

// --- 2. AUTHENTICATION LOGIC ---
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');

auth.onAuthStateChanged((user) => {
  if (user) {
    authScreen.classList.remove('active');
    appScreen.classList.add('active');
    document.getElementById('user-email-display').textContent = user.email;
    document.getElementById('profile-email').textContent = user.email;
    fetchData(); // Load data on login
  } else {
    appScreen.classList.remove('active');
    authScreen.classList.add('active');
  }
});

document.getElementById('btn-login').addEventListener('click', () => {
  auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value)
    .catch(error => authError.textContent = error.message);
});

document.getElementById('btn-signup').addEventListener('click', () => {
  auth.createUserWithEmailAndPassword(emailInput.value, passwordInput.value)
    .catch(error => authError.textContent = error.message);
});

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut();
});

// --- 3. UI & NAVIGATION ---
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    e.target.classList.add('active');
    document.getElementById(e.target.dataset.target).classList.add('active');
    
    if (e.target.dataset.target === 'tab-insights') renderChart();
  });
});

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { 
  document.getElementById(id).classList.remove('active'); 
  document.getElementById(id).querySelector('form')?.reset();
}

// --- 4. DATA FETCHING (GAS Backend) ---
async function fetchData() {
  try {
    // Note: Due to standard GAS CORS rules, simple GET is allowed if configured right.
    const response = await fetch(GAS_WEB_APP_URL + "?action=getTransactions");
    if (response.ok) {
       const data = await response.json();
       transactions = data.transactions || [];
    } else {
       // Mock data fallback if GAS needs CORS configuration / auth
       transactions = JSON.parse(localStorage.getItem('mock_tx')) || [];
    }
  } catch (error) {
    console.log("Using local fallback due to GAS CORS/network error.");
    transactions = JSON.parse(localStorage.getItem('mock_tx')) || [];
  }
  updateUI();
}

// --- 5. TRANSACTION LOGIC ---
async function saveTransaction(type, amount, desc) {
  const newTx = {
    Date: new Date().toISOString(),
    Type: type,
    Amount: parseFloat(amount),
    Description: desc
  };
  
  // Optimistic UI Update / Mock Fallback
  transactions.push(newTx);
  localStorage.setItem('mock_tx', JSON.stringify(transactions));
  updateUI();

  // Try saving to backend
  try {
    await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      mode: 'no-cors', // Standard for GAS POST without preflight
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTx)
    });
  } catch(e) {
    console.error("Backend save failed. Preserved locally.", e);
  }
}

document.getElementById('add-money-form').addEventListener('submit', (e) => {
  e.preventDefault();
  saveTransaction('Income', document.getElementById('add-amount').value, document.getElementById('add-desc').value);
  closeModal('add-money-modal');
});

document.getElementById('spend-money-form').addEventListener('submit', (e) => {
  e.preventDefault();
  saveTransaction('Expense', document.getElementById('spend-amount').value, document.getElementById('spend-desc').value);
  closeModal('spend-money-modal');
});

document.getElementById('send-money-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const recipient = document.getElementById('send-recipient').value;
  saveTransaction('Expense', document.getElementById('send-amount').value, "Transfer to: " + recipient);
  closeModal('send-money-modal');
});

// --- 6. RENDER LOGIC ---
function updateUI() {
  // Calculate Balance
  balance = transactions.reduce((acc, tx) => {
    return tx.Type === 'Income' ? acc + tx.Amount : acc - tx.Amount;
  }, 0);
  
  document.getElementById('total-balance').textContent = `₹${balance.toFixed(2)}`;
  
  // Render Lists
  renderHistory('all');
  
  // Render Recent Preview (last 3)
  const recentList = document.getElementById('recent-transactions-list');
  recentList.innerHTML = '';
  transactions.slice(-3).reverse().forEach(tx => {
    recentList.appendChild(createTxElement(tx));
  });
}

function renderHistory(filter) {
  const list = document.getElementById('full-history-list');
  list.innerHTML = '';
  
  let filtered = transactions;
  if (filter !== 'all') {
    filtered = transactions.filter(t => t.Type.toLowerCase() === filter);
  }
  
  filtered.slice().reverse().forEach(tx => {
    list.appendChild(createTxElement(tx));
  });
}

function createTxElement(tx) {
  const li = document.createElement('li');
  li.className = 'tx-item';
  const isIncome = tx.Type === 'Income';
  const dateStr = new Date(tx.Date).toLocaleDateString();
  
  li.innerHTML = `
    <div class="tx-info">
      <h4>${tx.Description}</h4>
      <small>${dateStr} • ${tx.Type}</small>
    </div>
    <div class="tx-amount ${isIncome ? 'income' : 'expense'}">
      ${isIncome ? '+' : '-'}₹${tx.Amount.toFixed(2)}
    </div>
  `;
  return li;
}

// --- 7. UTILITIES & THEME ---
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
}

function exportCSV() {
  if (transactions.length === 0) return alert("No data to export");
  const headers = "Date,Type,Amount,Description\n";
  const rows = transactions.map(t => `${t.Date},${t.Type},${t.Amount},"${t.Description}"`).join("\n");
  const blob = new Blob([headers + rows], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sayan-savings-transactions.csv';
  a.click();
}

function generateAssistantInsight() {
  const income = transactions.filter(t => t.Type === 'Income').reduce((s, t) => s + t.Amount, 0);
  const expense = transactions.filter(t => t.Type === 'Expense').reduce((s, t) => s + t.Amount, 0);
  document.getElementById('assistant-message').innerText = 
    `You have recorded ₹${income} in income and ₹${expense} in expenses. Your current tracker balance is ₹${balance}. Great job managing your finances!`;
}

// --- 8. CHARTS ---
let chartInstance = null;
function renderChart() {
  const ctx = document.getElementById('incomeExpenseChart').getContext('2d');
  const income = transactions.filter(t => t.Type === 'Income').reduce((s, t) => s + t.Amount, 0);
  const expense = transactions.filter(t => t.Type === 'Expense').reduce((s, t) => s + t.Amount, 0);
  
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{
        data: [income, expense],
        backgroundColor: ['#10B981', '#EF4444']
      }]
    }
  });
}
