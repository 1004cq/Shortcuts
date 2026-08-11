/**
 * 用户专属短链接音频控制系统（带次数计费）
 *
 * 短链接格式：https://cq.imim.chat/apl/gt/{userId}
 * 每次成功播放扣除 1 次，次数不足返回「次数不足」
 */

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;

/** 数据目录与用户 JSON 文件 */
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

/** 管理员账号密码（写死） */
const ADMIN_CONFIG = {
  username: 'admin',
  password: '123456'
};

/** 用户 ID：2–8 位字母或数字 */
const USER_ID_REGEXP = /^[a-zA-Z0-9]{2,8}$/;

// ---------- 中间件 ----------
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser('shortcuts_shortlink_secret_v1'));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 数据层 ----------

/** 确保 data 目录与 users.json 存在 */
async function initFiles() {
  await fs.ensureDir(DATA_DIR);
  if (!(await fs.pathExists(USERS_FILE))) {
    await fs.outputJson(USERS_FILE, [], { spaces: 2 });
  }
}

/** 读取全部用户 */
async function getUsers() {
  return await fs.readJson(USERS_FILE);
}

/** 保存全部用户 */
async function saveUsers(users) {
  await fs.writeJson(USERS_FILE, users, { spaces: 2 });
}

/** 校验用户 ID 规则 */
function isValidUserId(userId) {
  return typeof userId === 'string' && USER_ID_REGEXP.test(userId);
}

/**
 * 生成符合规则的随机用户 ID（长度 2–8）
 * @param {string[]} existingIds 已占用 ID，用于避免冲突
 */
function generateRandomUserId(existingIds = []) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const existing = new Set(existingIds);
  // 最多尝试若干次，避免极端冲突
  for (let attempt = 0; attempt < 100; attempt++) {
    const length = 2 + Math.floor(Math.random() * 7); // 2..8
    let id = '';
    for (let i = 0; i < length; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!existing.has(id)) return id;
  }
  // 兜底：固定 8 位 + 时间戳尾部（仍尽量满足字母数字）
  const fallback = `u${Date.now().toString(36)}`.slice(0, 8);
  return fallback;
}

/** 管理员鉴权中间件（基于 signed cookie） */
function authMiddleware(req, res, next) {
  if (req.signedCookies.is_admin === 'true') {
    return next();
  }
  return res.status(403).json({ success: false, message: '未授权' });
}

// ---------- 短链接播放（扣次） ----------

/**
 * GET /apl/gt/:userId
 * 1. 查找用户
 * 2. 检查剩余次数 ≥ 1
 * 3. 不足 →「次数不足」
 * 4. 足够 → remaining-1 / used+1 / 更新 lastAccessTime
 * 5. 302 重定向到当前 audioUrl
 */
app.get('/apl/gt/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidUserId(userId)) {
      return res.status(400).send('用户ID无效');
    }

    const users = await getUsers();
    const userIndex = users.findIndex((u) => u.userId === userId);

    if (userIndex === -1) {
      return res.status(404).send('用户不存在');
    }

    const user = users[userIndex];

    // 次数不足
    if (!user.remainingTimes || user.remainingTimes < 1) {
      return res.status(403).send('次数不足');
    }

    // 未配置音频
    if (!user.audioUrl || typeof user.audioUrl !== 'string') {
      return res.status(404).send('该用户未绑定音频');
    }

    // 扣次 + 统计
    user.remainingTimes -= 1;
    user.usedTimes = (user.usedTimes || 0) + 1;
    user.lastAccessTime = new Date().toISOString();
    users[userIndex] = user;
    await saveUsers(users);

    // 重定向到当前音频 URL
    return res.redirect(user.audioUrl);
  } catch (error) {
    console.error('[短链接播放错误]', error);
    return res.status(500).send('服务器内部错误');
  }
});

// ---------- 管理员登录 ----------

/** POST /api/login — 简单账号密码登录 */
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password) {
    res.cookie('is_admin', 'true', {
      signed: true,
      httpOnly: true,
      sameSite: 'lax'
    });
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, message: '账号或密码错误' });
});

/** POST /api/logout — 退出登录 */
app.post('/api/logout', (req, res) => {
  res.clearCookie('is_admin');
  return res.json({ success: true });
});

// ---------- 管理 API ----------

/** GET /api/users — 用户列表 */
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const users = await getUsers();
    return res.json(users);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: '读取用户失败' });
  }
});

/** GET /api/users/random-id — 一键随机生成可用用户 ID */
app.get('/api/users/random-id', authMiddleware, async (req, res) => {
  try {
    const users = await getUsers();
    const userId = generateRandomUserId(users.map((u) => u.userId));
    return res.json({ success: true, userId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: '生成失败' });
  }
});

/**
 * POST /api/users — 添加新用户
 * body: { userId, audioUrl, remainingTimes }
 */
app.post('/api/users', authMiddleware, async (req, res) => {
  try {
    const { userId, audioUrl, remainingTimes } = req.body || {};

    if (!isValidUserId(userId)) {
      return res.status(400).json({
        success: false,
        message: '用户ID需为2-8位字母或数字（a-z、A-Z、0-9）'
      });
    }

    if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.trim()) {
      return res.status(400).json({ success: false, message: '请填写音频URL' });
    }

    const users = await getUsers();
    if (users.some((u) => u.userId === userId)) {
      return res.status(400).json({ success: false, message: '用户ID已存在' });
    }

    const times = parseInt(remainingTimes, 10);
    const newUser = {
      userId,
      audioUrl: audioUrl.trim(),
      remainingTimes: Number.isFinite(times) && times >= 0 ? times : 0,
      usedTimes: 0,
      lastAccessTime: null,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await saveUsers(users);
    return res.json({ success: true, user: newUser });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: '添加用户失败' });
  }
});

/**
 * PUT /api/users/:userId/audio — 修改用户音频 URL
 * body: { audioUrl }
 */
app.put('/api/users/:userId/audio', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { audioUrl } = req.body || {};

    if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.trim()) {
      return res.status(400).json({ success: false, message: '请填写音频URL' });
    }

    const users = await getUsers();
    const userIndex = users.findIndex((u) => u.userId === userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    users[userIndex].audioUrl = audioUrl.trim();
    await saveUsers(users);
    return res.json({ success: true, user: users[userIndex] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: '修改音频失败' });
  }
});

/**
 * POST /api/users/:userId/recharge — 给用户增加次数（充值）
 * body: { times }
 */
app.post('/api/users/:userId/recharge', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const times = parseInt((req.body || {}).times, 10);

    if (!Number.isFinite(times) || times <= 0) {
      return res.status(400).json({ success: false, message: '充值次数必须为正整数' });
    }

    const users = await getUsers();
    const userIndex = users.findIndex((u) => u.userId === userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    users[userIndex].remainingTimes = (users[userIndex].remainingTimes || 0) + times;
    await saveUsers(users);
    return res.json({ success: true, user: users[userIndex] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: '充值失败' });
  }
});

/** DELETE /api/users/:userId — 删除用户 */
app.delete('/api/users/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const users = await getUsers();
    const next = users.filter((u) => u.userId !== userId);

    if (next.length === users.length) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    await saveUsers(next);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: '删除失败' });
  }
});

// ---------- 启动 ----------

initFiles().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`短链接音频控制系统已启动: http://0.0.0.0:${PORT}`);
    console.log(`短链接格式: https://cq.imim.chat/apl/gt/{userId}`);
    console.log(`管理后台: http://0.0.0.0:${PORT}/admin.html`);
    console.log(`默认管理员: admin / 123456`);
  });
});
