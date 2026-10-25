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

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwqHkEx8bksySOqGVpRNkcgZq-TrFw6Bc3WljBSf4QnrSFxGhLKknK2x3pUzICNGGx7/exec";

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Global State
let transactions = [];
let currentBalance = 0;
let chartInstance = null;

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
    refreshData();
  } else {
    appScreen.classList.remove('active');
    authScreen.classList.add('active');
  }
});

document.getElementById('btn-login').onclick = async () => {
  try {
    authError.textContent = "Logging in...";
    await auth.signInWithEmailAndPassword(emailInput.value.trim(), passwordInput.value);
  } catch (err) { authError.textContent = err.message; }
};

document.getElementById('btn-signup').onclick = async () => {
  try {
    authError.textContent = "Creating account...";
    await auth.createUserWithEmailAndPassword(emailInput.value.trim(), passwordInput.value);
  } catch (err) { authError.textContent = err.message; }
};

document.getElementById('btn-logout').onclick = () => auth.signOut();


// --- 3. SECURE GOOGLE SHEETS API CONNECTION ---
async function api(action, data={}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please log in first.");
  
  let token = "";
  try {
     token = await user.getIdToken();
  } catch(e) {
     console.warn("Could not get Firebase token.");
  }

  let response;
  if (action === "get") {
    const params = new URLSearchParams({action, token});
    response = await fetch(SCRIPT_URL + "?" + params.toString());
  } else {
    const params = new URLSearchParams({...data, action, token});
    response = await fetch(SCRIPT_URL, {method:"POST", body:params});
  }
  
  if (!response.ok) throw new Error("Server request failed: " + response.status);
  const result = await response.json();
  if (result.status === "error") throw new Error(result.message || "Request failed.");
  return result;
}

async function refreshData() {
  try {
    // লোডিং ইফেক্ট অ্যাড করা হলো
    document.getElementById('total-balance').innerHTML = '<span style="font-size: 1.2rem; opacity: 0.8;">Loading balance... ⏳</span>';
    document.getElementById('recent-transactions-list').innerHTML = "<p class='small-text text-center' style='padding:20px;'>Fetching data...</p>";

    const result = await api("get");
    currentBalance = result.balance || 0;
    transactions = Array.isArray(result.history) ? result.history : [];
    updateUI();
  } catch (err) {
    console.error("Failed to load data:", err.message);
    document.getElementById('total-balance').textContent = "Error";
  }
}

// --- 4. TRANSACTION LOGIC (Add & Spend) ---
async function handleTransactionSubmit(type, amount, desc, btnId, modalId) {
  const btn = document.getElementById(btnId);
  try {
    btn.disabled = true;
    btn.textContent = "Saving...";
    
    const result = await api("add", { type: type, amount: String(amount), desc: desc });
    
    currentBalance = result.balance;
    await refreshData();
    closeModal(modalId);
  } catch (err) {
    alert("Error saving transaction: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Save " + type;
  }
}

document.getElementById('add-money-form').onsubmit = (e) => {
  e.preventDefault();
  handleTransactionSubmit('Credit', document.getElementById('add-amount').value, document.getElementById('add-desc').value, 'btn-save-add', 'add-money-modal');
};

document.getElementById('spend-money-form').onsubmit = (e) => {
  e.preventDefault();
  handleTransactionSubmit('Debit', document.getElementById('spend-amount').value, document.getElementById('spend-desc').value, 'btn-save-spend', 'spend-money-modal');
};

document.getElementById('send-money-form').onsubmit = (e) => {
  e.preventDefault();
  handleTransactionSubmit('Debit', document.getElementById('send-amount').value, "Transfer to: " + document.getElementById('send-recipient').value, 'btn-save-send', 'send-money-modal');
};


// --- 5. UI & RENDER LOGIC ---
function formatMoney(value) {
  return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(Number(value)||0);
}

function updateUI() {
  document.getElementById('total-balance').textContent = formatMoney(currentBalance);
  
  renderHistory('all');
  
  const recentList = document.getElementById('recent-transactions-list');
  recentList.innerHTML = '';
  transactions.slice(0, 3).forEach(tx => {
    recentList.appendChild(createTxElement(tx));
  });
  
  updateGoalProgress();
}

function renderHistory(filter) {
  const list = document.getElementById('full-history-list');
  list.innerHTML = '';
  
  if (transactions.length === 0) {
      list.innerHTML = "<p class='small-text text-center' style='padding:20px;'>No transactions found.</p>";
      return;
  }
  
  let filtered = transactions;
  if (filter !== 'all') {
    filtered = transactions.filter(t => t.type.toLowerCase() === filter);
  }
  
  filtered.forEach(tx => {
    list.appendChild(createTxElement(tx));
  });
}

function createTxElement(tx) {
  const li = document.createElement('li');
  li.className = 'tx-item glass-panel'; 
  li.style.padding = "16px";
  const isCredit = tx.type === 'Credit';
  
  let dateStr = tx.date;
  const d = new Date(tx.date);
  if (!Number.isNaN(d.getTime())) dateStr = d.toLocaleDateString();
  
  li.innerHTML = `
    <div class="tx-info">
      <h4 style="margin-bottom: 4px;">${tx.description}</h4>
      <small class="small-text">${dateStr} • ${tx.type}</small>
    </div>
    <div class="tx-amount ${tx.type}">
      ${isCredit ? '+' : '-'}${formatMoney(tx.amount)}
    </div>
  `;
  return li;
}

// --- 6. NAVIGATION & MODERN DIALOGS ---
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    e.target.classList.add('active');
    document.getElementById(e.target.dataset.target).classList.add('active');
    
    if (e.target.dataset.target === 'tab-insights') renderChart();
  });
});

function openModal(id) { 
  document.getElementById(id).showModal(); 
}
function closeModal(id) { 
  const modal = document.getElementById(id);
  modal.close(); 
  modal.querySelector('form')?.reset();
}


// --- 7. SAVINGS GOALS ---
document.getElementById('goal-form').onsubmit = (e) => {
  e.preventDefault();
  const name = document.getElementById("goal-name").value.trim();
  const target = Number(document.getElementById("goal-amount").value);
  
  localStorage.setItem("savingsGoal", JSON.stringify({name,target}));
  updateGoalProgress(); 
  closeModal('add-goal-modal');
  alert("Goal saved on this device.");
};

function updateGoalProgress() {
  const raw = localStorage.getItem("savingsGoal");
  if (!raw) return;
  const goal = JSON.parse(raw);
  document.getElementById("savedGoalName").textContent = goal.name;
  
  const pct = Math.min(100, Math.max(0, currentBalance / goal.target * 100));
  document.getElementById("goalProgress").textContent = formatMoney(currentBalance) + " of " + formatMoney(goal.target) + " (" + pct.toFixed(1) + "%)";
  document.getElementById("goalBar").value = pct;
}

(function loadGoal(){
  try {
    const goal = JSON.parse(localStorage.getItem("savingsGoal")||"null");
    if (goal) { 
      document.getElementById("goal-name").value = goal.name; 
      document.getElementById("goal-amount").value = goal.target; 
    }
  } catch (_) {}
})();

// --- 8. UTILITIES, CSV & CHARTS ---
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
}

function exportCSV() {
  if (transactions.length === 0) return alert("No data to export");
  const quote = v => '"' + String(v ?? "").replace(/"/g,'""') + '"';
  const rows = [["Date","Type","Amount","Balance","Description"],
    ...transactions.map(x=>[x.date,x.type,x.amount,x.balance,x.description])];
  const csv = "\uFEFF" + rows.map(r=>r.map(quote).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  const a = document.createElement("a"); a.href=url; a.download="savings-history.csv"; a.click();
  URL.revokeObjectURL(url);
}

function generateAssistantInsight() {
  const goal = JSON.parse(localStorage.getItem("savingsGoal")||"null");
  let answer = "";
  if (goal) {
    const remaining = Math.max(0, goal.target - currentBalance);
    answer = "For your goal '" + goal.name + "', you still need " + formatMoney(remaining) + ". Try saving a small, realistic amount regularly.";
  } else {
    answer = "You have a balance of " + formatMoney(currentBalance) + ". Set a realistic savings goal to start tracking your progress!";
  }
  document.getElementById('assistant-message').innerText = answer;
}

function renderChart() {
  const credits = transactions.filter(x=>x.type==="Credit").reduce((s,x)=>s+Number(x.amount||0),0);
  const debits = transactions.filter(x=>x.type==="Debit").reduce((s,x)=>s+Number(x.amount||0),0);
  
  if (chartInstance) chartInstance.destroy();
  const ctx = document.getElementById('incomeExpenseChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Credit (In)', 'Debit (Out)'],
      datasets: [{
        data: [credits, debits],
        backgroundColor: ['#10B981', '#EF4444']
      }]
    }
  });
}
