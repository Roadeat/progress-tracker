let globalStaff = [];
let currentYear = '';
let currentDate = '';

function strokeCountSort(a, b) {
  return a.name.length - b.name.length || a.name.localeCompare(b.name, 'zh-Hant');
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadStaff();
  loadCurrentDate(); // ⬅ 加入這行，代入今日日期
  loadRanking();     // ⬅ 排行榜
   loadWeeklySummary(); // ⬅ 新增
});

function loadCurrentDate() {
  const now = new Date();
  currentYear = now.getFullYear().toString();
  currentDate = now.toISOString().split('T')[0];

  const display = document.getElementById('dateDisplay');
  display.textContent = `${currentYear} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`;
}

async function loadStaff() {
  try {
    const res = await fetch('/api/staff');
    globalStaff = await res.json();
    globalStaff.sort(strokeCountSort);

    const staffSelect = document.getElementById('staffSelect');
    if (staffSelect) {
      staffSelect.innerHTML = globalStaff.map(
        s => `<option value="${s.id}">${s.name}</option>`
      ).join('');
      staffSelect.addEventListener('change', fetchAllPreviousProgress);
      fetchAllPreviousProgress();
    }
  } catch (err) {
    console.error('❌ 載入 staff 失敗：', err);
  }
}

async function fetchAllPreviousProgress() {
  const staffId = document.getElementById('staffSelect')?.value;
  if (!staffId) return;

  const procurementInput = document.getElementById('procurementInput');
  const importantInput = document.getElementById('importantInput');
  const prev1 = document.getElementById('prev1');
  const prev2 = document.getElementById('prev2');

  // 採購案履約管理
  if (procurementInput && prev1) {
    procurementInput.value = '';
    prev1.innerText = '前次：載入中...';
    try {
      const res = await fetch(`/api/progress/previous?staffId=${staffId}&category=${encodeURIComponent('採購案履約管理')}`);
      const data = await res.json();
      if (data && data.content) {
        prev1.innerText = `前次：\n${data.content}`;
      } else {
        prev1.innerText = '前次：尚未填報';
      }
    } catch (err) {
      prev1.innerText = '前次：載入錯誤';
    }
  }

  // 重要工作
  if (importantInput && prev2) {
    importantInput.value = '';
    prev2.innerText = '前次：載入中...';
    try {
      const res = await fetch(`/api/progress/previous?staffId=${staffId}&category=${encodeURIComponent('重要工作')}`);
      const data = await res.json();
      if (data && data.content) {
        prev2.innerText = `前次：\n${data.content}`;
      } else {
        prev2.innerText = '前次：尚未填報';
      }
    } catch (err) {
      prev2.innerText = '前次：載入錯誤';
    }
  }
}



async function loadRanking() {
  try {
    const res = await fetch('/api/ranking');
    const list = await res.json();
    const rankingBox = document.getElementById('rankingContainer');

    if (!Array.isArray(list)) {
      rankingBox.innerText = '無法載入排行榜';
      return;
    }

    const firstSubmittedIndex = list.findIndex(s => s.status !== 'not_submitted');

    rankingBox.innerHTML = list.map((s, i) => {
      const rankNum = i + 1;
      if (s.status === 'not_submitted') {
        return `<div style="color:red;">尚未繳交 - ${s.name}</div>`;
      } else {
        const crown = (firstSubmittedIndex !== -1 && i === firstSubmittedIndex) ? '👑 ' : '';
        return `<div>${crown}${rankNum}. ${s.name}</div>`;
      }
    }).join('');
  } catch (err) {
    console.error('❌ 載入排行榜失敗：', err);
    document.getElementById('rankingContainer').innerText = '❌ 無法載入排行榜';
  }
}


async function loadWeeklySummary() {
  try {
    const res = await fetch('/api/summary');  // 路徑要跟後端對應
    const data = await res.json();

console.log('data.important:', data.important);  // <=== 加在這裡，檢查重要工作資料

    const container = document.getElementById('weeklySummary');
    if (!data || typeof data !== 'object') {
      container.innerText = '無法載入彙整進度';
      return;
    }


const renderCategory = (title, list) => {
  const lines = list.flatMap(paragraph => {
    const parts = paragraph.split('\n').map(line => line.trim()).filter(Boolean);

    return parts.flatMap((line, index) => {
      if (index === 0 && line.startsWith('🔹')) {
        // 第一行，保留 🔹，正常顯示（含換行）
        const nameMatch = line.match(/^🔹\s*(.{1,8}?)：(.*)/);
        if (nameMatch) {
          const name = nameMatch[1];
          const rest = nameMatch[2];
          return [
            `<div style="white-space: pre-wrap; margin-bottom: 6px;">🔹 ${name}：</div>`,
            `<div style="white-space: pre-wrap; margin-bottom: 6px;">${rest}</div>`
          ];
        } else {
          return [`<div style="white-space: pre-wrap; margin-bottom: 6px;">${line}</div>`];
        }
      } else {
        // 後續行，不加重複的 🔹
        return [`<div style="white-space: pre-wrap; margin-bottom: 6px;">${line}</div>`];
      }
    });
  });

  return `<h4>${title}</h4>${lines.join('')}`;
};



    container.innerHTML =
      renderCategory('📘 採購案履約管理', data.procurement || []) +
      '<br>' +
      renderCategory('📙 重要工作', data.important || []);
  } catch (err) {
    console.error('❌ 載入 weekly-summary 失敗：', err);
    document.getElementById('weeklySummary').innerText = '❌ 無法載入彙整進度';
  }
}


async function submitProgress() {
  const year = currentYear;
  const date = currentDate;
  const staffId = document.getElementById('staffSelect')?.value;
  if (!staffId) {
    alert('請選擇承辦人');
    return;
  }

  const procurementInput = document.getElementById('procurementInput');
  const importantInput = document.getElementById('importantInput');

  const data = [];

  if (procurementInput && procurementInput.value.trim()) {
    data.push({
      staffId,
      text: procurementInput.value.trim(),
      category: '採購案履約管理'
    });
  }

  if (importantInput && importantInput.value.trim()) {
    data.push({
      staffId,
      text: importantInput.value.trim(),
      category: '重要工作'
    });
  }

  if (data.length === 0) {
    alert('請至少填寫一筆「本次進度」');
    return;
  }

  try {
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, date, data }),
    });

    if (!res.ok) throw new Error('送出失敗');

    const result = await res.json();

    if (result.success) {
      document.getElementById('resultContainer').innerText = '✅ 進度已送出！';
      fetchAllPreviousProgress();
      loadRanking();
      loadWeeklySummary();
    } else {
      document.getElementById('resultContainer').innerText = '❌ 送出失敗';
    }
  } catch (err) {
    console.error('❌ 送出進度發生錯誤：', err);
    document.getElementById('resultContainer').innerText = '❌ 無法送出';
  }
}
