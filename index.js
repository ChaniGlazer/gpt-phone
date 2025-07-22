const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// app.post('/upload', upload.single('audio'), async (req, res) => {
//   try {
//     const filePath = req.file.path;

//     const transcription = await openai.audio.transcriptions.create({
//       file: fs.createReadStream(filePath),
//       model: 'whisper-1',
//     });

//     res.send({ text: transcription.text });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send('שגיאה בעיבוד הקובץ');
//   }
// });
const path = require('path');

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
    res.send({ text: transcription.text });
  } catch (err) {
    console.error('שגיאה בקריאת OpenAI:', err);
    res.status(500).send('שגיאה בעיבוד הקובץ: ' + err.message);
  }
});

  
  
app.listen(port, () => {
  console.log(`🚀 השרת רץ על http://localhost:${port}`);
});
