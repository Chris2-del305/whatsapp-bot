require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const readline = require('readline'); // We'll use this to input the pairing code
const OpenAI = require('openai');

// ========== CONFIG ==========
const PREFIX = '!';
const MAX_HISTORY = 10;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Store conversations per chat
const conversations = new Map();

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// ========== CLIENT ==========
const client = new Client({
    authStrategy: new LocalAuth(), // Saves session so you don't need to pair again
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Handle pairing code instead of QR
client.on('qr', (qr) => {
    console.log('QR code received (but we're using pairing code instead)');
    // We'll ignore QR and use pairing code
});

client.on('ready', () => {
    console.log('✅ Bot is ready!');
    rl.close();
});

client.on('auth_failure', msg => {
    console.error('❌ Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

// Initialize and request pairing code
console.log('🤖 Starting WhatsApp Bot...');
console.log('Requesting pairing code...');

client.initialize();

// After a short delay, request the pairing code
setTimeout(async () => {
    // Check if we're already authenticated
    if (client.info) {
        console.log('Already authenticated!');
        return;
    }

    // Ask for phone number
    rl.question('📱 Enter your phone number (with country code, e.g., 255123456789): ', async (phoneNumber) => {
        try {
            // Remove any spaces or special characters
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            
            if (!phoneNumber) {
                console.error('❌ No phone number provided');
                process.exit(1);
            }

            console.log(`Requesting pairing code for: ${phoneNumber}`);
            
            // Request the pairing code
            const pairingCode = await client.requestPairingCode(phoneNumber);
            
            console.log('\n=================================');
            console.log('🔐 YOUR PAIRING CODE:', pairingCode);
            console.log('=================================');
            console.log('Check your WhatsApp for the code notification!');
            console.log('Once you enter the code, the bot will connect.\n');
        } catch (error) {
            console.error('❌ Error requesting pairing code:', error.message);
            if (error.message.includes('not a function')) {
                console.log('\n⚠️  Your whatsapp-web.js version might be too old.');
                console.log('Run this command to update:');
                console.log('npm install github:pedroslopez/whatsapp-web.js#webpack-exodus\n');
            }
            process.exit(1);
        }
    });
}, 5000); // Wait 5 seconds before requesting

// ========== MESSAGE HANDLER (same as before) ==========
client.on('message', async message => {
    if (message.from === 'status@broadcast') return;

    // Command handling
    if (message.body.startsWith(PREFIX)) {
        await handleCommand(message);
    } else {
        await handleChatbot(message);
    }
});

// ========== COMMANDS (same as before) ==========
async function handleCommand(message) {
    const args = message.body.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    switch (cmd) {
        case 'help':
            await message.reply(
                '*Commands:*\n' +
                '!help - This menu\n' +
                '!ping - Check latency\n' +
                '!info - Bot info\n' +
                '!echo <text> - Repeat\n' +
                '!time - Current time\n' +
                '!quote - Random quote\n' +
                '!joke - Random joke\n' +
                '!clear - Clear memory\n' +
                '!say <text> - Admin only'
            );
            break;

        case 'ping':
            const start = Date.now();
            await message.reply('Pong!');
            const end = Date.now();
            await message.reply(`⏱️ ${end - start}ms`);
            break;

        case 'info':
            await message.reply(
                `🤖 *Bot Info*\n` +
                `AI Chatbot with memory\n` +
                `Uptime: ${Math.floor(process.uptime())}s`
            );
            break;

        case 'echo':
            if (!args.length) return message.reply('Say something!');
            await message.reply(args.join(' '));
            break;

        case 'time':
            await message.reply(`🕒 ${new Date().toLocaleString()}`);
            break;

        case 'quote':
            try {
                const res = await fetch('https://api.quotable.io/random');
                const data = await res.json();
                await message.reply(`"${data.content}" — *${data.author}*`);
            } catch {
                await message.reply('Could not fetch quote.');
            }
            break;

        case 'joke':
            try {
                const res = await fetch('https://v2.jokeapi.dev/joke/Any?type=single');
                const data = await res.json();
                await message.reply(data.joke);
            } catch {
                await message.reply('No joke today.');
            }
            break;

        case 'clear':
            if (conversations.delete(message.from)) {
                await message.reply('🧹 Memory cleared.');
            } else {
                await message.reply('No memory to clear.');
            }
            break;

        case 'say':
            // Replace with your WhatsApp number (include @c.us)
            const admin = '1234567890@c.us'; // <-- CHANGE THIS AFTER FINDING YOUR NUMBER
            if (message.from !== admin) {
                return message.reply('Unauthorized.');
            }
            if (!args.length) return message.reply('What should I say?');
            await message.reply(args.join(' '));
            break;

        default:
            await message.reply(`Unknown. Type ${PREFIX}help`);
    }
}

// ========== CHATBOT (same as before) ==========
async function handleChatbot(message) {
    const chatId = message.from;
    const userText = message.body;

    if (!conversations.has(chatId)) {
        conversations.set(chatId, [
            { role: 'system', content: 'You are a helpful WhatsApp assistant. Keep replies friendly and concise.' }
        ]);
    }
    const history = conversations.get(chatId);
    history.push({ role: 'user', content: userText });

    // Keep last MAX_HISTORY exchanges
    if (history.length > MAX_HISTORY * 2 + 1) {
        history.splice(1, 2);
    }

    try {
        await message.sendTyping();
        const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: history,
            max_tokens: 300,
        });
        const reply = completion.choices[0].message.content;
        history.push({ role: 'assistant', content: reply });
        await message.reply(reply);
    } catch (error) {
        console.error('OpenAI error:', error);
        await message.reply('❌ Error getting response. Check API key or try again.');
    }
        }
