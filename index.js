const fs = require('fs');
const path = require('path');
const axios = require('axios');
const express = require('express');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// משתנה סופר
let fileIndex = 0;

function padNumber(num) {
  return num.toString().padStart(3, '0');
}

async function checkAndProcessNextFile() {
  const token = '0774430795:325916039';
  const fileName = padNumber(fileIndex) + '.wav';
  const pathFromYemot = `ivr2:/1/${fileName}`;
  const downloadUrl = `https://www.call2all.co.il/ym/api/DownloadFile?token=${token}&path=${encodeURIComponent(pathFromYemot)}`;
  const localFilePath = path.join(__dirname, 'uploads', fileName);

  try {
    const response = await axios.get(downloadUrl, { responseType: 'stream' });

    // אם קיבלנו תשובה תקינה נוריד את הקובץ
    const writer = fs.createWriteStream(localFilePath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`✅ קובץ ${fileName} הורד בהצלחה`);

    // תמלול עם Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(localFilePath),
      model: 'whisper-1',
    });

    console.log(`🎤 תמלול: ${transcription.text}`);

    // שיחה עם GPT
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'אתה עוזר דובר עברית, ענה בעברית בלבד, תשובות קצרות, ברורות וממוקדות.'
        },
        {
          role: 'user',
          content: transcription.text
        }
      ]
    });

    const answer = chatResponse.choices[0].message.content;

    console.log(`🤖 תשובה: ${answer}`);

    // העלאה של המספר לקובץ הבא
    fileIndex++;

  } catch (err) {
    // אם הקובץ לא קיים - לא עושים כלום, ננסה שוב באותו מספר
    if (err.response && err.response.status === 404) {
      console.log(`🔍 קובץ ${fileName} לא נמצא, מנסה שוב עוד רגע...`);
    } else {
      console.error('שגיאה כללית:', err.message);
    }
  }
}

// הפעלת הבדיקה כל שנייה
setInterval(checkAndProcessNextFile, 1000);

app.listen(port, () => {
  console.log(`🚀 השרת רץ על http://localhost:${port}`);
});
