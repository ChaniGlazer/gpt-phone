const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// פרסור נתוני JSON ו-urlencoded (חשוב לקבל נתונים ב-POST)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// הקוד הקיים שלך לקבלת קובץ דרך טופס
app.post('/upload', upload.single('audio'), async (req, res) => {
  console.log('קיבלנו בקשה להעלאת קובץ');

  if (!req.file) {
    console.log('אין קובץ בבקשה');
    return res.status(400).send('לא התקבל קובץ');
  }

  const originalExtension = path.extname(req.file.originalname) || '.mp3';
  const newPath = req.file.path + originalExtension;

  // שנה את שם הקובץ עם סיומת
  fs.renameSync(req.file.path, newPath);
  console.log('נתיב הקובץ עם סיומת:', newPath);

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(newPath),
      model: 'whisper-1',
    });

    console.log('המרה הצליחה:', transcription.text);

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
      ],
    });

    const answer = chatResponse.choices[0].message.content;
    console.log('תשובת הצ׳אט:', answer);

    res.send({
      transcription: transcription.text,
      answer: answer,
    });
  } catch (err) {
    console.error('שגיאה בקריאת OpenAI:', err);
    res.status(500).send('שגיאה בעיבוד הקובץ: ' + err.message);
  }
});

// הוספה: endpoint לקבלת קריאות מה-API של ימות המשיח
app.all('/YemotApi', async (req, res) => {
  const params = req.method === 'GET' ? req.query : req.body;

  console.log('קיבלנו בקשה מימות המשיח:', params);

  // זיהוי ניתוק שיחה
  if (params.hangup === 'yes') {
    console.log('שיחה נותקה בשלוחה:', params.ApiHangupExtension);
    return res.send('OK');
  }

  // להחליף את שם הפרמטר לפי תיעוד ימות המשיח המדויק
  const audioUrl = params.audio_url || params.audioUrl;

  if (!audioUrl) {
    return res.status(400).send('לא נשלח URL של קובץ שמע');
  }

  try {
    const tempFilePath = path.join(__dirname, 'uploads', 'audio_from_yemot.mp3');

    // הורדת קובץ השמע מה-URL שנשלח
    const writer = fs.createWriteStream(tempFilePath);
    const response = await axios.get(audioUrl, { responseType: 'stream' });
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // תמלול עם Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
    });

    console.log('תמלול ימות המשיח:', transcription.text);

    // שליחת הטקסט ל-ChatGPT
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
      ],
    });

    const answer = chatResponse.choices[0].message.content;
    console.log('תשובת ChatGPT לימות המשיח:', answer);

    // כאן אפשר להחזיר תשובה למערכת ימות המשיח (אם צריך)
    res.send('OK');

  } catch (err) {
    console.error('שגיאה בטיפול בקריאת ימות המשיח:', err);
    res.status(500).send('שגיאה בעיבוד הקובץ');
  }
});

app.listen(port, () => {
  console.log(`🚀 השרת רץ על http://localhost:${port}`);
});
