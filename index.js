const mineflayer = require('mineflayer');
const { Client } = require('aternos-api');

const CONFIG = {
    host: process.env.SERVER_HOST || 'Progamer-Smp.aternos.me',
    port: parseInt(process.env.SERVER_PORT) || 29801,
    username: process.env.BOT_USERNAME || 'iRestart',
    version: '1.20.6',
    aternosSession: process.env.ATERNOS_SESSION,
    aternosServerId: process.env.ATERNOS_SERVER_ID,
    restartIntervalHours: 3.5
};

let bot = null;
let restartTimer = null;

const aternosClient = new Client(CONFIG.aternosSession);

async function ensureServerIsOnline() {
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
        return true;
    } catch (err) {
        console.error('[Aternos API Error]:', err.message);
        await new Promise(res => setTimeout(res, 60000));
        return ensureServerIsOnline();
    }
}

function startSmartAFKSystem(bot) {
    console.log('[Anti-AFK] تم تفعيل نظام الحركة والكسر والبناء لـ iRestart.');
    const loop = setInterval(async () => {
        if (!bot || !bot.entity) {
            clearInterval(loop);
            return;
        }
        const actionType = Math.floor(Math.random() * 4);
        try {
            switch (actionType) {
                case 0: // حركة عشوائية
                    const controls = ['forward', 'back', 'left', 'right', 'jump', 'sneak'];
                    const rc = controls[Math.floor(Math.random() * controls.length)];
                    bot.setControlState(rc, true);
                    setTimeout(() => { if (bot) bot.setControlState(rc, false); }, Math.random() * 1500 + 500);
                    break;
                case 1: // التفات النظر
                    await bot.look((Math.random() * Math.PI * 2) - Math.PI, (Math.random() * Math.PI / 2) - (Math.PI / 4), true);
                    break;
                case 2: // كسر بلوكة
                    const targetBlock = bot.findBlock({
                        matching: b => b && b.diggable && b.name !== 'bedrock' && b.name !== 'air',
                        maxDistance: 3
                    });
                    if (targetBlock && bot.canDigBlock(targetBlock)) await bot.dig(targetBlock);
                    break;
                case 3: // بناء أو ضرب الهواء
                    const item = bot.inventory.items().find(i => i.name.includes('dirt') || i.name.includes('stone') || i.name.includes('cobblestone'));
                    if (item) {
                        await bot.equip(item, 'hand');
                        const ref = bot.findBlock({ matching: b => b && b.name !== 'air', maxDistance: 3 });
                        if (ref) await bot.placeBlock(ref, { x: 0, y: 1, z: 0 }).catch(() => {});
                    } else {
                        bot.swingArm('mainhand');
                    }
                    break;
            }
        } catch (e) {}
    }, Math.random() * 3000 + 3000);
}

function startBot() {
    console.log(`[iRestart Bot] جارٍ الاتصال بالسيرفر...`);
    bot = mineflayer.createBot({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.username,
        version: CONFIG.version
    });

    bot.on('spawn', () => {
        console.log('[iRestart Bot] دخل السيرفر بنجاح.');
        startSmartAFKSystem(bot);

        if (restartTimer) clearTimeout(restartTimer);
        const RESTART_MS = CONFIG.restartIntervalHours * 60 * 60 * 1000;
        restartTimer = setTimeout(() => initiateRestartSequence(), RESTART_MS);
        console.log(`[Timer] تم جدولة إعادة التشغيل القادمة بعد ${CONFIG.restartIntervalHours} ساعات.`);
    });

    bot.on('end', async (reason) => {
        console.log(`[iRestart Bot] انقطع الاتصال: ${reason}`);
        if (restartTimer) clearTimeout(restartTimer);
        setTimeout(async () => {
            await ensureServerIsOnline();
            startBot();
        }, 60000);
    });

    bot.on('error', err => console.error('[iRestart Error]', err.message));
}

function initiateRestartSequence() {
    if (!bot) return;
    bot.chat('§c[iRestart] §fسيتم إعادة تشغيل السيرفر خلال §e5 دقائق§f لتجديد الجلسة وتنظيف الرام.');
    
    setTimeout(() => {
        if (bot) bot.chat('§c[iRestart] §fبقي §eدقيقة واحدة §fعلى إعادة التشغيل!');
    }, 4 * 60 * 1000);

    setTimeout(() => {
        if (bot) {
            console.log('[iRestart] إرسال أمر /restart...');
            bot.chat('/restart');
        }
    }, 5 * 60 * 1000);
}

(async () => {
    if (!CONFIG.aternosSession || !CONFIG.aternosServerId) {
        console.error('خطأ: يجب ضبط المتغيرات في البيئة أولاً!');
        process.exit(1);
    }
    await ensureServerIsOnline();
    startBot();
})();
