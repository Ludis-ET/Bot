import express from "express";
import TelegramBot, { Message } from "node-telegram-bot-api";
import dotenv from "dotenv";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 5000;

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error(
    "TELEGRAM_BOT_TOKEN is not defined in the environment variables"
  );
}
const bot = new TelegramBot(token, { polling: true });

app.use(express.json());

const welcomeImageUrl =
  "https://img.freepik.com/free-vector/retro-colorful-pixel-pro-gaming-profile-picture_742173-12362.jpg?t=st=1730800898~exp=1730804498~hmac=e027eedd2f1f9153a341bab3612555f892c2156f0485ecb9965a28c1312181d8&w=740";

bot.onText(/\/start/, (msg: Message) => {
  const chatId = msg.chat.id;
  const userName = msg.from?.first_name || "User";

  const welcomeMessage = `
    Welcome, ${userName}! 🎉
    
    Get ready to test your typing skills with our exciting game! 🕹️
    - **Game Objective:** Type the given text as fast and accurately as possible.
    - **Features:** Track your WPM, accuracy, and challenge yourself with various levels!
    
    Click the button below to start the mini app and show off your skills!`;

  bot.sendPhoto(chatId, welcomeImageUrl, {
    caption: welcomeMessage,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Start Game",
            callback_data: JSON.stringify({
              action: "start_game",
              userId: msg.from?.id,
              userName,
            }),
          },
        ],
      ],
    },
  });
});

bot.on("callback_query", async (query) => {
  if (query.message) {
    const chatId = query.message.chat.id;
    let action, userId, userName;
    if (query.data) {
      ({ action, userId, userName } = JSON.parse(query.data));
    }

    if (action === "start_game") {
      bot.sendMessage(chatId, "The game is starting... 🚀");
      await axios.post("http://your-frontend-url/api/start-game", {
        userId,
        userName,
      });
      bot.sendMessage(
        chatId,
        "Click here to play the game: [Play Now](http://your-frontend-url)"
      );
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
