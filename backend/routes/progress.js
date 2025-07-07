const express = require('express');
const router = express.Router();

// 1. 查詢所有承辦人（排序 by name）
router.get('/staff', async (req, res) => {
  try {
    const result = await req.db.query('SELECT id, name FROM staff ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('查詢 staff 錯誤', err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 1-1. 承辦人填報排行榜（每週四之後填報時間排序）
router.get('/staff/rankings', async (req, res) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = today.getDay();
  const thisThursday = new Date(today);
  thisThursday.setDate(today.getDate() - day + 4); // 本週四
  thisThursday.setHours(0, 0, 0, 0);

  try {
    const result = await req.db.query(`
      SELECT s.id, s.name, MAX(p.updated_at) AS latest
      FROM staff s
      LEFT JOIN progress p ON p.staff_id = s.id AND p.updated_at >= $1
      GROUP BY s.id, s.name
      ORDER BY latest ASC NULLS LAST
    `, [thisThursday]);

    res.json(result.rows);
  } catch (err) {
    console.error('排行榜查詢失敗：', err);
    res.status(500).json({ error: '排行榜查詢失敗' });
  }
});

// 2. 查詢某人、某類別、某日期「之前」的前次進度
router.get('/progress/previous', async (req, res) => {
  const { staffId, category, currentDate } = req.query; // <-- 新增 currentDate
  if (!staffId || !category || !currentDate) { // <-- 檢查 currentDate 是否存在
      return res.status(400).json({ error: '缺少必要參數 (staffId, category, 或 currentDate)' });
  }

  try {
    const result = await req.db.query(
      `SELECT content FROM progress
       WHERE staff_id = $1
       AND category = $2
       AND date < $3::date -- <-- 新增條件：只找日期小於前端傳入日期的記錄
       ORDER BY date DESC, updated_at DESC
       LIMIT 1`,
      [staffId, category, currentDate] // <-- 傳遞 currentDate 作為第三個參數
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('查詢前次進度錯誤', err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// 3. 儲存進度資料
router.post('/progress', async (req, res) => {
  const { year, date, collectorId, data } = req.body;
  if (!year || !date || !Array.isArray(data)) {
    return res.status(400).json({ error: '缺少必要欄位' });
  }

  console.log('收到進度資料：', data);
  const client = await req.db.connect();

  try {
    await client.query('BEGIN');

    for (const entry of data) {
      let staffId = entry.staffId;

      if (!staffId && entry.staffName) {
        const search = await client.query('SELECT id FROM staff WHERE name = $1', [entry.staffName]);
        if (search.rows.length > 0) {
          staffId = search.rows[0].id;
        } else {
          const insert = await client.query('INSERT INTO staff (name) VALUES ($1) RETURNING id', [entry.staffName]);
          staffId = insert.rows[0].id;
        }
      }

      await client.query(
        `INSERT INTO progress (year, date, collector_id, staff_id, content, category)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (staff_id, date, category)
         DO UPDATE SET 
           content = EXCLUDED.content,
           year = EXCLUDED.year,
           collector_id = EXCLUDED.collector_id,
           updated_at = NOW()`,
        [year, date, null, staffId, entry.text, entry.category || null]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 儲存進度錯誤：', err);
    res.status(500).json({ error: '儲存失敗' });
  } finally {
    client.release();
  }
});

// 4. 排行榜
router.get('/ranking', async (req, res) => {
  try {
    const now = new Date();
    const currentDay = now.getDay();
    const daysSinceFriday = (currentDay + 7 - 5) % 7;
    const thisFriday = new Date(now);
    thisFriday.setDate(now.getDate() - daysSinceFriday);
    thisFriday.setHours(0, 0, 0, 0);

    const staffResult = await req.db.query(`SELECT id, name FROM staff ORDER BY name`);
    const staffMap = new Map(staffResult.rows.map(s => [s.id, s.name]));

    const progressResult = await req.db.query(`
      SELECT staff_id, category, MAX(updated_at) AS updated_at
      FROM progress
      WHERE updated_at >= $1
        AND TRIM(COALESCE(content, '')) <> ''
      GROUP BY staff_id, category
    `, [thisFriday]);

    const progressMap = new Map();
    for (const row of progressResult.rows) {
      const sid = Number(row.staff_id);
      const cat = row.category;
      const time = new Date(row.updated_at);
      if (!progressMap.has(sid)) progressMap.set(sid, {});
      progressMap.get(sid)[cat] = time;
    }

    const ranking = [];

    for (const [id, name] of staffMap) {
      const catTimes = progressMap.get(id);
      const hasProcurement = catTimes?.['採購案履約管理'];
      const hasImportant = catTimes?.['重要工作'];

      if (hasProcurement || hasImportant) {
        const latest = new Date(Math.max(
          hasProcurement?.getTime() || 0,
          hasImportant?.getTime() || 0
        ));
        ranking.push({
          id,
          name,
          status: 'submitted',
          submittedAt: latest
        });
      } else {
        ranking.push({
          id,
          name,
          status: 'not_submitted'
        });
      }
    }

    ranking.sort((a, b) => {
      if (a.status === 'submitted' && b.status === 'submitted') {
        return a.submittedAt.getTime() - b.submittedAt.getTime();
      } else if (a.status === 'submitted') {
        return -1;
      } else if (b.status === 'submitted') {
        return 1;
      } else {
        return a.name.localeCompare(b.name, 'zh-Hant');
      }
    });

    res.json(ranking);
  } catch (err) {
    console.error('❌ 查詢排行榜錯誤：', err);
    res.status(500).json({ error: '排行榜查詢失敗' });
  }
});

// 5. 彙整本週填報內容
router.get('/summary', async (req, res) => {
  try {
    const now = new Date();
    const currentDay = now.getDay();
    const daysSinceFriday = (currentDay + 7 - 5) % 7;
    const thisFriday = new Date(now);
    thisFriday.setDate(now.getDate() - daysSinceFriday);
    thisFriday.setHours(0, 0, 0, 0);

    const result = await req.db.query(`
SELECT DISTINCT ON (p.staff_id, p.category)
  s.name AS staff_name,
  p.category,
  p.content,
  p.updated_at
FROM progress p
JOIN staff s ON s.id = p.staff_id
WHERE p.updated_at >= $1
  AND TRIM(COALESCE(p.content, '')) <> ''
ORDER BY p.staff_id, p.category, p.updated_at DESC
    `, [thisFriday]);

    const procurement = [];
    const important = [];

    for (const row of result.rows) {
      const line = `🔹 ${row.staff_name}：${row.content}`;
      if (row.category === '採購案履約管理') {
        procurement.push(line);
      } else if (row.category === '重要工作') {
        important.push(line);
      }
    }

    res.json({
      procurement,
      important
    });
  } catch (err) {
    console.error('❌ 本週進度彙整錯誤：', err);
    res.status(500).json({ error: '無法取得彙整資料' });
  }
});

module.exports = router;
