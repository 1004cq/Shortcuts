const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;
const DATA_FILE = path.join(__dirname, 'data', 'users.json');

// 管理员账号密码
const ADMIN_CONFIG = {
    username: 'admin',
    password: '123456'
};

// 中间件配置
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser('secret_key_for_shortcuts_times'));
app.use(express.static('public'));

// 确保数据文件存在
async function ensureDataFile() {
    if (!await fs.pathExists(DATA_FILE)) {
        await fs.outputJson(DATA_FILE, []);
    }
}

// 读取数据
async function getUsers() {
    return await fs.readJson(DATA_FILE);
}

// 写入数据
async function saveUsers(users) {
    await fs.writeJson(DATA_FILE, users, { spaces: 2 });
}

// --- 路由 ---

// 1. 短链接重定向（扣除次数逻辑）
app.get('/apl/gt/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const users = await getUsers();
        const userIndex = users.findIndex(u => u.userId === userId);

        if (userIndex === -1) {
            return res.status(404).send('User not found');
        }

        const user = users[userIndex];
        
        // 检查剩余次数
        if (!user.remainingTimes || user.remainingTimes < 1) {
            return res.status(403).send('次数不足，请联系管理员充值次数');
        }

        if (!user.audioUrl) {
            return res.status(404).send('No audio bound to this user');
        }

        // 扣除次数与统计已使用次数
        user.remainingTimes = (user.remainingTimes || 0) - 1;
        user.usedTimes = (user.usedTimes || 0) + 1;
        user.lastAccessTime = new Date().toISOString();
        
        await saveUsers(users);

        // 重定向到音频地址
        res.redirect(user.audioUrl);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// 2. 管理员登录接口
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password) {
        res.cookie('is_admin', 'true', { signed: true, httpOnly: true });
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// 登录校验中间件
const authMiddleware = (req, res, next) => {
    if (req.signedCookies.is_admin === 'true') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Unauthorized' });
    }
};

// 3. 用户列表获取
app.get('/api/users', authMiddleware, async (req, res) => {
    const users = await getUsers();
    res.json(users);
});

// 4. 添加/修改用户
app.post('/api/users', authMiddleware, async (req, res) => {
    const { userId, audioUrl, initialTimes } = req.body;
    if (!userId || !audioUrl) {
        return res.status(400).json({ success: false, message: 'Missing userId or audioUrl' });
    }

    const users = await getUsers();
    const existingIndex = users.findIndex(u => u.userId === userId);

    if (existingIndex > -1) {
        // 更新音频
        users[existingIndex].audioUrl = audioUrl;
    } else {
        // 新增
        users.push({
            userId,
            audioUrl,
            remainingTimes: parseInt(initialTimes) || 0,
            usedTimes: 0,
            lastAccessTime: null,
            createdAt: new Date().toISOString()
        });
    }

    await saveUsers(users);
    res.json({ success: true });
});

// 5. 增加次数（充值）接口
app.post('/api/users/recharge', authMiddleware, async (req, res) => {
    const { userId, times } = req.body;
    if (!userId || isNaN(times)) {
        return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    const users = await getUsers();
    const userIndex = users.findIndex(u => u.userId === userId);

    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    users[userIndex].remainingTimes = (users[userIndex].remainingTimes || 0) + parseInt(times);
    await saveUsers(users);
    res.json({ success: true });
});

// 6. 删除用户
app.delete('/api/users/:userId', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    let users = await getUsers();
    users = users.filter(u => u.userId !== userId);
    await saveUsers(users);
    res.json({ success: true });
});

// 启动服务器
ensureDataFile().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on http://0.0.0.0:${PORT}`);
    });
});
