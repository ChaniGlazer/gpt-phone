const fs = require('fs');
const path = require('path');
const axios = require('axios');
const express = require('express');
require('dotenv').config();
const { OpenAI } = require('openai');
const FormData = require('form-data');
const util = require('util');
const textToSpeech = require('@google-cloud/text-to-speech');

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ttsClient = new textToSpeech.TextToSpeechClient();

let fileIndex = 0;
let isProcessing = false;
const results = [];

function padNumber(num) {
  return num.toString().padStart(3, '0');
}

async function checkAndProcessNextFile() {
  if (isProcessing) return;
  isProcessing = true;

  const token = process.env.YEMOT_TOKEN || '0774430795:325916039'; // שמור בטוח בקובץ .env
  const fileName = padNumber(fileIndex) + '.wav';
  const yemotPath = `ivr2:/1/${fileName}`;
  const downloadUrl = `https://www.call2all.co.il/ym/api/DownloadFile?token=${token}&path=${encodeURIComponent(yemotPath)}`;
  const uploadsDir = path.join(__dirname, 'uploads');
  const localFilePath = path.join(uploadsDir, fileName);

  try {
    // ודא שספריית uploads קיימת
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }

    const response = await axios.get(downloadUrl, { responseType: 'stream' });
    const writer = fs.createWriteStream(localFilePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`✅ קובץ ${fileName} הורד`);

    // תמלול
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(localFilePath),
      model: 'whisper-1',
    });

    console.log(`🎤 תמלול: ${transcription.text}`);

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `אתה עוזר דובר עברית, ענה בעברית בלבד, תשובות קצרות, ברורות וממוקדות, שתואמות לאורח חיים חרדי ולטעם צנוע. 
          אם מתקבלת שאלה הלכתית או שאלת הלכה, אל תענה עליה בעצמך, אלא אמור: "אני לא רב ולא פוסק הלכה, נא לפנות לרב או לפוסק הלכה מוסמך."`
        },
        { role: 'user', content: transcription.text }
      ]
    });
    
    

    const answer = chatResponse.choices[0].message.content;
    const audioFileName = padNumber(fileIndex) + '.wav';
    const audioFilePath = path.join(uploadsDir, audioFileName);

    // יצירת קובץ שמע
    const ttsRequest = {
      input: { text: answer },
      voice: { languageCode: 'he-IL', ssmlGender: 'FEMALE' },
      audioConfig: { audioEncoding: 'LINEAR16' },

    };

    const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);
    await util.promisify(fs.writeFile)(audioFilePath, ttsResponse.audioContent, 'binary');
    console.log(`🔊 קובץ שמע נוצר: ${audioFileName}`);

    // שליחה לימות
    const uploadPath = `ivr2:/3/${audioFileName}`;
    const yemotUploadUrl = `https://www.call2all.co.il/ym/api/UploadFile?token=${token}&path=${encodeURIComponent(uploadPath)}`;
    const audioFileStream = fs.createReadStream(audioFilePath);

    const formData = new FormData();
    formData.append('file', audioFileStream, { filename: audioFileName });

    const headers = formData.getHeaders();
    await axios.post(yemotUploadUrl, formData, { headers });

    console.log(`📤 קובץ ${audioFileName} נשלח לימות המשיח`);

    results.push({
      index: padNumber(fileIndex),
      transcription: transcription.text,
      answer
    });

    if (results.length > 10) results.shift();
    fileIndex++;

  } catch (err) {
    if (err.response && err.response.status === 404) {
      console.log(`🔍 קובץ ${fileName} לא נמצא, מנסה שוב...`);
    } else {
      console.error('שגיאה:', err.message);
    }
  } finally {
    isProcessing = false;
  }
}

setInterval(checkAndProcessNextFile, 1000);

app.get('/results', (req, res) => {
  res.json(results);
});

app.listen(port, () => {
  console.log(`🚀 השרת רץ על http://localhost:${port}`);
});
