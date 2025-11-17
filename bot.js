const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

console.log('🚀 Starting WhatsApp Bot...');

const client = new Client({
    authStrategy: new LocalAuth()
});

// Show QR Code
client.on('qr', (qr) => {
    console.log('📱 SCAN THIS QR CODE WITH YOUR WHATSAPP:');
    qrcode.generate(qr, { small: true });
    console.log('👉 Go to WhatsApp → Settings → Linked Devices → Link a Device');
});

// Bot is ready
client.on('ready', () => {
    console.log('✅ Bot is ready and connected!');
    console.log('🤖 Try sending "!hello" to your bot');
});

// Handle messages
client.on('message', message => {
    console.log(`📩 Message from ${message.from}: ${message.body}`);
    
    const command = message.body.toLowerCase();
    
    if (command === '!hello') {
        message.reply('👋 Hello! I am your WhatsApp bot from GitHub!');
    }
    else if (command === '!time') {
        const time = new Date().toLocaleString();
        message.reply(`⏰ Current time: ${time}`);
    }
    else if (command === '!help') {
        message.reply('🛠️ *Bot Commands:*\n!hello - Greeting\n!time - Current time\n!help - This menu');
    }
    else if (command === 'ping') {
        message.reply('🏓 Pong!');
    }
});

// Start the bot
client.initialize();
