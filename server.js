import express from 'express';
import { WebSocketServer } from 'ws';
import TelegramBot from 'node-telegram-bot-api';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ⚠️ ضع هذه القيم في متغيرات البيئة (Environment Variables) وليس هنا
const BOT_TOKEN = process.env.BOT_TOKEN;
const TARGET_CHAT_ID = process.env.TARGET_CHAT_ID;

if (!BOT_TOKEN || !TARGET_CHAT_ID) {
  console.error('❌ يجب تعيين BOT_TOKEN و TARGET_CHAT_ID في متغيرات البيئة');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ الخادم يعمل على المنفذ ${process.env.PORT || 3000}`);
});

const wss = new WebSocketServer({ server });

// استقبال رسائل البوت من Telegram → دفعها لكل صفحات الويب المفتوحة
bot.on('message', (msg) => {
  if (msg.chat.id.toString() === TARGET_CHAT_ID) {
    const payload = JSON.stringify({
      type: 'bot',
      text: msg.text || '[رسالة غير نصية]',
      date: msg.date
    });
    wss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(payload);
    });
  }
});

// استقبال رسائل صفحة الويب → إرسالها إلى Telegram
wss.on('connection', (ws) => {
  console.log('🔌 عميل ويب جديد متصل');

  ws.on('message', async (data) => {
    try {
      const { text } = JSON.parse(data.toString());
      if (!text || !text.trim()) return;

      await bot.sendMessage(TARGET_CHAT_ID, `[Web] ${text}`);
    } catch (err) {
      console.error('خطأ في إرسال الرسالة:', err.message);
      ws.send(JSON.stringify({ type: 'error', text: 'فشل إرسال الرسالة' }));
    }
  });

  ws.on('close', () => console.log('❌ عميل ويب断开'));
});

// معالجة أخطاء البوت العامة
bot.on('polling_error', (err) => console.error('Polling error:', err.message));