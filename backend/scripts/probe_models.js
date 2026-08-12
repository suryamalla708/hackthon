require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const models = [
  'gemini-3.5-flash',
  'gemini-3.5-pro',
  'gemini-3.0-flash',
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-flash-preview-04-17',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

async function check() {
  for (const m of models) {
    try {
      const r = await ai.models.generateContent({ model: m, contents: 'reply: pong' });
      console.log('WORKS:', m, '|', r.text.trim().slice(0, 30));
    } catch(e) {
      const msg = e.message || '';
      if (msg.includes('429')) {
        const wait = msg.match(/retry in ([\d.]+)s/);
        console.log('QUOTA_LIMIT:', m, wait ? `(wait ${wait[1]}s)` : '');
      } else if (msg.includes('404')) {
        console.log('NOT_FOUND:', m);
      } else {
        console.log('ERROR:', m, msg.slice(0, 60));
      }
    }
  }
}

check();
