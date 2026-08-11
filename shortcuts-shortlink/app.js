/**
 * 用户专属短链接音频播放系统
 *
 * 短链接格式：https://cq.imim.chat/apl/{userId}
 * 访问流程：检查次数 → 扣 1 次 → 302 重定向到音频下载地址
 * 音频下载地址由「全局 API Token + 用户 fileId」拼接而成
 */

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;

/** 数据目录 */
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

/** 主站音频下载地址前缀（与全局 Token、fileId 拼接） */
const DOWNLOAD_BASE = process.env.DOWNLOAD_BASE || 'https://cq.imim.chat/api/files';

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
app.use(cookieParser('shortcuts_shortlink_secret_v2'));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 数据层 ----------

/** 确保 data 目录、users.json、config.json 存在 */
async function initFiles() {
  await fs.ensureDir(DATA_DIR);
  if (!(await fs.pathExists(USERS_FILE))) {
    await fs.outputJson(USERS_FILE, [], { spaces: 2 });
  }
  if (!(await fs.pathExists(CONFIG_FILE))) {
    await fs.outputJson(CONFIG_FILE, { apiToken: '' }, { spaces: 2 });
  }
}

async function getUsers() {
  return await fs.readJson(USERS_FILE);
}

async function saveUsers(users) {
  await fs.writeJson(USERS_FILE, users, { spaces: 2 });
}

async function getConfig() {
  return await fs.readJson(CONFIG_FILE);
}

async function saveConfig(config) {
  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

/** 校验用户 ID */
function isValidUserId(userId) {
  return typeof userId === 'string' && USER_ID_REGEXP.test(userId);
}

/**
 * 生成符合规则的随机用户 ID（长度 2–8）
 * @param {string[]} existingIds 已占用 ID
 */
function generateRandomUserId(existingIds = []) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const existing = new Set(existingIds);
  for (let attempt = 0; attempt < 100; attempt++) {
    const length = 2 + Math.floor(Math.random() * 7); // 2..8
    let id = '';
    for (let i = 0; i < length; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!existing.has(id)) return id;
  }
  return `u${Date.now().toString(36)}`.slice(0, 8);
}

/**
 * 根据 fileId + 全局 Token 拼接真实音频下载链接
 * 格式：https://cq.imim.chat/api/files/{fileId}/download?token={apiToken}
 */
function buildDownloadUrl(fileId, apiToken) {
  const id = encodeURIComponent(String(fileId).trim());
  const token = encodeURIComponent(String(apiToken).trim());
  return `${DOWNLOAD_BASE}/${id}/download?token=${token}`;
}

/** 管理员鉴权（signed cookie） */
function authMiddleware(req, res, next) {
  if (req.signedCookies.is_admin === 'true') {
    return next();
  }
  return res.status(403).json({ success: false, message: '未授权' });
}

// ---------- 短链接播放（扣次后重定向） ----------

/**
 * GET /apl/:userId
 * 1. 查找用户
 * 2. 检查剩余次数 ≥ 1
 * 3. 检查已绑定 fileId、全局 apiToken
 * 4. remainingTimes-1 / usedTimes+1 / 更新 lastAccessTime
 * 5. 302 重定向到真实音频下载地址
 */
app.get('/apl/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidUserId(userId)) {
      return res.status(400).send('用户ID无效');
    }

    const [users, config] = await Promise.all([getUsers(), getConfig()]);
    const userIndex = users.findIndex((u) => u.userId === userId);

    if (userIndex === -1) {
      return res.status(404).send('用户不存在');
    }

    const user = users[userIndex];

    if (!user.remainingTimes || user.remainingTimes < 1) {
      return res.status(403).send('次数不足');
    }

    if (!user.fileId) {
      return res.status(404).send('该用户未绑定音频');
    }

    if (!config.apiToken) {
      return res.status(500).send('系统 Token 未配置');
    }

    // 扣次 + 统计
    user.remainingTimes -= 1;
    user.usedTimes = (user.usedTimes || 0) + 1;
    user.lastAccessTime = new Date().toISOString();
    users[userIndex] = user;
    await saveUsers(users);

    const longUrl = buildDownloadUrl(user.fileId, config.apiToken);
    return res.redirect(longUrl);
  } catch (error) {
    console.error('[短链接播放错误]', error);
    return res.status(500).send('服务器内部错误');
  }
});

// ---------- 管理员登录 ----------

/** POST /api/login */
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

/** POST /api/logout */
app.post('/api/logout', (req, res) => {
  res.clearCookie('is_admin');
  return res.json({ success: true });
});

// ---------- 全局配置（API Token） ----------

/** GET /api/config */
app.get('/api/config', authMiddleware, async (req, res) => {
  try {
    return res.json(await getConfig());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: '读取配置失败' });
  }
});

/** POST /api/config — 保存全局 API Token */
app.post('/api/config', authMiddleware, async (req, res) => {
  try {
    const apiToken = String((req.body || {}).apiToken || '').trim();
    await saveConfig({ apiToken });
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: '保存配置失败' });
  }
});

// ---------- 用户管理 API ----------

/** GET /api/users — 用户列表 */
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    return res.json(await getUsers());
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
 * body: { userId, fileId, remainingTimes }
 */
app.post('/api/users', authMiddleware, async (req, res) => {
  try {
    const { userId, fileId, remainingTimes } = req.body || {};

    if (!isValidUserId(userId)) {
      return res.status(400).json({
        success: false,
        message: '用户ID需为2-8位字母或数字（a-z、A-Z、0-9）'
      });
    }

    if (!fileId || !String(fileId).trim()) {
      return res.status(400).json({ success: false, message: '请填写音频文件ID' });
    }

    const users = await getUsers();
    if (users.some((u) => u.userId === userId)) {
      return res.status(400).json({ success: false, message: '用户ID已存在' });
    }

    const times = parseInt(remainingTimes, 10);
    const newUser = {
      userId,
      fileId: String(fileId).trim(),
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
 * PUT /api/users/:userId/file — 为用户单独切换/更换音频（fileId）
 * body: { fileId }
 */
app.put('/api/users/:userId/file', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const fileId = String((req.body || {}).fileId || '').trim();

    if (!fileId) {
      return res.status(400).json({ success: false, message: '请填写音频文件ID' });
    }

    const users = await getUsers();
    const userIndex = users.findIndex((u) => u.userId === userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    users[userIndex].fileId = fileId;
    await saveUsers(users);
    return res.json({ success: true, user: users[userIndex] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: '修改音频失败' });
  }
});

/**
 * POST /api/users/:userId/recharge — 给用户充值次数
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
    console.log(`短链接音频播放系统已启动: http://0.0.0.0:${PORT}`);
    console.log(`短链接格式: https://cq.imim.chat/apl/{userId}`);
    console.log(`管理后台: http://0.0.0.0:${PORT}/admin.html`);
    console.log(`默认管理员: admin / 123456`);
  });
});
