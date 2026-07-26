const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// 管理员账号密码
const ADMIN_CONFIG = {
    username: 'admin',
    password: '123456'
};

// 中间件配置
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser('secret_key_for_shortcuts_v4'));
app.use(express.static('public'));

// 确保目录和文件存在
async function initFiles() {
    await fs.ensureDir(DATA_DIR);
    if (!await fs.pathExists(USERS_FILE)) await fs.outputJson(USERS_FILE, []);
    if (!await fs.pathExists(CONFIG_FILE)) await fs.outputJson(CONFIG_FILE, { apiToken: '' });
}

// 数据操作
async function getUsers() { return await fs.readJson(USERS_FILE); }
async function saveUsers(users) { await fs.writeJson(USERS_FILE, users, { spaces: 2 }); }
async function getConfig() { return await fs.readJson(CONFIG_FILE); }
async function saveConfig(config) { await fs.writeJson(CONFIG_FILE, config, { spaces: 2 }); }

// 用户ID校验：2-8位字母数字
function isValidUserId(userId) {
    return /^[a-zA-Z0-9]{2,8}$/.test(userId);
}

// 统一的短链接处理逻辑
async function handleShortLink(req, res) {
    try {
        const { userId } = req.params;
        const [users, config] = await Promise.all([getUsers(), getConfig()]);
        const userIndex = users.findIndex(u => u.userId === userId);

        if (userIndex === -1) return res.status(404).send('用户不存在');
        const user = users[userIndex];

        // 检查次数
        if (!user.remainingTimes || user.remainingTimes < 1) {
            return res.status(403).send('次数不足，请充值');
        }

        // 检查配置
        if (!user.fileId) return res.status(404).send('该用户未绑定音频');
        if (!config.apiToken) return res.status(500).send('系统 Token 未配置');

        // 扣费与统计
        user.remainingTimes -= 1;
        user.usedTimes = (user.usedTimes || 0) + 1;
        user.lastAccessTime = new Date().toISOString();
        await saveUsers(users);

        // 自动拼接长链接并重定向
        const longUrl = `https://cq.imim.chat/api/files/${user.fileId}/download?token=${config.apiToken}`;
        res.redirect(longUrl);
    } catch (error) {
        console.error(error);
        res.status(500).send('服务器内部错误');
    }
}

// --- 路由 ---

// 1. 短链接重定向（最终格式）
app.get('/apl/:userId', handleShortLink);

// 2. 管理员登录
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password) {
        res.cookie('is_admin', 'true', { signed: true, httpOnly: true });
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: '账号或密码错误' });
    }
});

const authMiddleware = (req, res, next) => {
    if (req.signedCookies.is_admin === 'true') next();
    else res.status(403).json({ success: false, message: '未授权' });
};

// 3. 全局配置接口
app.get('/api/config', authMiddleware, async (req, res) => {
    res.json(await getConfig());
});

app.post('/api/config', authMiddleware, async (req, res) => {
    const { apiToken } = req.body;
    await saveConfig({ apiToken });
    res.json({ success: true });
});

// 4. 用户列表
app.get('/api/users', authMiddleware, async (req, res) => {
    res.json(await getUsers());
});

// 5. 添加/修改用户
app.post('/api/users', authMiddleware, async (req, res) => {
    const { userId, fileId, initialTimes } = req.body;
    if (!isValidUserId(userId)) {
        return res.status(400).json({ success: false, message: '用户ID需为2-8位字母或数字' });
    }
    if (!fileId) return res.status(400).json({ success: false, message: '请输入音频文件ID' });

    const users = await getUsers();
    const existingIndex = users.findIndex(u => u.userId === userId);

    if (existingIndex > -1) {
        // 修改已有用户
        users[existingIndex].fileId = fileId;
    } else {
        // 添加新用户
        users.push({
            userId,
            fileId,
            remainingTimes: parseInt(initialTimes) || 0,
            usedTimes: 0,
            lastAccessTime: null,
            createdAt: new Date().toISOString()
        });
    }

    await saveUsers(users);
    res.json({ success: true });
});

// 6. 充值次数
app.post('/api/users/recharge', authMiddleware, async (req, res) => {
    const { userId, times } = req.body;
    const users = await getUsers();
    const userIndex = users.findIndex(u => u.userId === userId);
    if (userIndex === -1) return res.status(404).json({ success: false, message: '用户不存在' });

    users[userIndex].remainingTimes = (users[userIndex].remainingTimes || 0) + parseInt(times);
    await saveUsers(users);
    res.json({ success: true });
});

// 7. 删除用户
app.delete('/api/users/:userId', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    let users = await getUsers();
    users = users.filter(u => u.userId !== userId);
    await saveUsers(users);
    res.json({ success: true });
});

initFiles().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`短链接格式: https://cq.imim.chat/apl/{userId}`);
    });
});
