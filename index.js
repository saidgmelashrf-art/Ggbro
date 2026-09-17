const mineflayer = require('mineflayer');
const express = require('express');
const { Client } = require('aternos-api');

// --- 1. سيرفر HTTP لضمان استمرار عمل البوت 24/7 على Railway ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('iRestart Bot is Active 24/7!');
});

app.listen(PORT, () => console.log(`[HTTP] Keep-Alive running on port ${PORT}`));

// --- 2. سحب البيانات الحساسة من متغيرات البيئة ---
const CONFIG = {
    host: process.env.SERVER_HOST || 'Progamer-Smp.aternos.me',
    port: parseInt(process.env.SERVER_PORT) || 29801,
    username: process.env.BOT_USERNAME || 'iRestart',
    password: process.env.BOT_PASSWORD || '', // كلمة المرور من Variables
    aternosSession: process.env.ATERNOS_SESSION,
    aternosServerId: process.env.ATERNOS_SERVER_ID,
    restartIntervalHours: 3.5
};

let bot = null;
let restartTimer = null;
let actionInterval = null;

// --- 3. تهيئة عميل Aternos API ---
const aternosClient = CONFIG.aternosSession ? new Client(CONFIG.aternosSession) : null;

async function ensureServerIsOnline() {
    if (!aternosClient || !CONFIG.aternosServerId) {
        console.log('[Aternos API] لم يتم إدخال كود Aternos Session، سيتم الاتصال المباشر.');
        return;
    }

    console.log('[Aternos API] جارٍ التحقق من حالة السيرفر...');
    try {
        const server = aternosClient.getServer(CONFIG.aternosServerId);
        let status = await server.getStatus();
        
        if (status === 'offline') {
            console.log('[Aternos API] السيرفر مغلق، جارٍ إرسال أمر التشغيل (Start)...');
            await server.start();
        }

        while (status !== 'online') {
            console.log(`[Aternos API] الحالة الحالية: (${status})... انتظار 30 ثانية.`);
            await new Promise(res => setTimeout(res, 30000));
            status = await server.getStatus();
        }

        console.log('[Aternos API] السيرفر متصل وجاهز الآن!');
    } catch (err) {
        console.error('[Aternos API Error]:', err.message);
        await new Promise(res => setTimeout(res, 60000));
        return ensureServerIsOnline();
    }
}

// --- 4. نظام الحركات الذكية (Anti-AFK) ---
function startSmartAFK(botInstance) {
    if (actionInterval) clearInterval(actionInterval);

    actionInterval = setInterval(async () => {
        if (!botInstance || !botInstance.entity) return;

        const actions = ['jump', 'sneak', 'lookAround', 'walk', 'swingArm'];
        const chosenAction = actions[Math.floor(Math.random() * actions.length)];

        try {
            switch (chosenAction) {
                case 'jump':
                    botInstance.setControlState('jump', true);
                    setTimeout(() => { if (botInstance) botInstance.setControlState('jump', false); }, 400);
                    break;
                case 'sneak':
                    botInstance.setControlState('sneak', true);
                    setTimeout(() => { if (botInstance) botInstance.setControlState('sneak', false); }, 1000);
                    break;
                case 'lookAround':
                    const yaw = (Math.random() * 360 - 180) * (Math.PI / 180);
                    const pitch = (Math.random() * 90 - 45) * (Math.PI / 180);
                    await botInstance.look(yaw, pitch, true);
                    break;
                case 'walk':
                    const dir = Math.random() > 0.5 ? 'forward' : 'back';
                    botInstance.setControlState(dir, true);
                    setTimeout(() => { if (botInstance) botInstance.setControlState(dir, false); }, Math.floor(Math.random() * 1500) + 500);
                    break;
                case 'swingArm':
                    botInstance.swingArm('mainhand');
                    break;
            }
        } catch (e) {}
    }, Math.floor(Math.random() * 5000) + 5000);
}

// --- 5. جدول تنبيهات وإرسال أمر /restart ---
function initiateRestartSequence() {
    if (!bot) return;

    bot.chat('§c[iRestart] §fسيتم إعادة تشغيل السيرفر خلال §e5 دقائق§f لتجديد الجلسة وتنظيف الرام.');
    
    setTimeout(() => {
        if (bot) bot.chat('§c[iRestart] §fبقي §eدقيقة واحدة §fعلى إعادة التشغيل!');
    }, 4 * 60 * 1000);

    setTimeout(() => {
        if (bot) bot.chat('§c[iRestart] §fإعادة التشغيل خلال §e10 ثوانٍ§f...');
    }, 4 * 60 * 1000 + 50 * 1000);

    setTimeout(() => {
        if (bot) {
            console.log('[iRestart] إرسال أمر /restart للسيرفر...');
            bot.chat('/restart');
        }
    }, 5 * 60 * 1000);
}

// --- 6. تشغيل البوت الموحد ---
function startBot() {
    console.log(`[iRestart] جارٍ تشغيل البوت: ${CONFIG.username}...`);

    bot = mineflayer.createBot({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.username,
        version: false
    });

    bot.on('spawn', () => {
        console.log(`[iRestart] ${CONFIG.username} دخل السيرفر بنجاح!`);

        // تسجيل الدخول التلقائي في حال وجود كلمة مرور
        if (CONFIG.password) {
            setTimeout(() => {
                bot.chat(`/register ${CONFIG.password} ${CONFIG.password}`);
                bot.chat(`/login ${CONFIG.password}`);
            }, 2000);
        }

        startSmartAFK(bot);

        if (restartTimer) clearTimeout(restartTimer);
        const RESTART_MS = CONFIG.restartIntervalHours * 60 * 60 * 1000;
        restartTimer = setTimeout(() => initiateRestartSequence(), RESTART_MS);
    });

    bot.on('end', async (reason) => {
        console.warn(`[iRestart] فصل الاتصال: ${reason}. إعطاء مهلة قبل إعادة الاتصال...`);
        if (actionInterval) clearInterval(actionInterval);
        if (restartTimer) clearTimeout(restartTimer);

        setTimeout(async () => {
            await ensureServerIsOnline();
            startBot();
        }, 30000);
    });

    bot.on('error', (err) => {
        console.error('[iRestart Error]:', err.message);
    });
}

// حماية السيرفر من الانهيار
process.on('unhandledRejection', err => console.error('Unhandled Error:', err));
process.on('uncaughtException', err => console.error('Uncaught Error:', err));

// نقطة الانطلاق
(async () => {
    await ensureServerIsOnline();
    startBot();
})();
                   
