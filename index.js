const fs = require('fs');
const path = require('path');
const axios = require('axios');
const express = require('express');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get('/yemot-manual-download', async (req, res) => {
  const token = '0774430795:325916039';
  const pathFromYemot = 'ivr2:/1/000.wav';

  const downloadUrl = `https://www.call2all.co.il/ym/api/DownloadFile?token=${token}&path=${encodeURIComponent(pathFromYemot)}`;
  const localFilePath = path.join(__dirname, 'uploads', '000.wav');

  try {
    const writer = fs.createWriteStream(localFilePath);
    const response = await axios.get(downloadUrl, { responseType: 'stream' });
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // תמלול עם Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(localFilePath),
      model: 'whisper-1',
    });

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

    res.send({
      transcription: transcription.text,
      answer
    });

  } catch (err) {
    console.error('שגיאה:', err.message);
    res.status(500).send('שגיאה: ' + err.message);
  }
});

console.log('מוריד קובץ מ:', downloadUrl);
console.log('שומר אל:', localFilePath);

app.listen(port, () => {
  console.log(`🚀 השרת רץ על http://localhost:${port}`);
});
