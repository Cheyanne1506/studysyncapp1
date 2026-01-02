import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import fetch from "node-fetch";

const app = express();
const upload = multer();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/* ================================
   HELPERS
================================ */
function splitText(text, maxLength = 3000) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    chunks.push(text.slice(start, start + maxLength));
    start += maxLength;
  }

  return chunks;
}

/* ================================
   PDF → AI
================================ */
app.post("/api/generate-from-pdf", upload.single("pdf"), async (req, res) => {
  try {
    const pdfData = await pdfParse(req.file.buffer);
    const rawText = pdfData.text.replace(/\s+/g, " ").trim();

    const topics = JSON.parse(req.body.topics);
    const chunks = splitText(rawText);

    const results = [];

    for (const topic of topics) {
      let combinedNotes = "";

      for (const chunk of chunks) {
        const prompt = `
You are a study assistant.
Extract ONLY information related to: "${topic}"

Then:
1. Write clear notes
2. Create 3 test questions
3. Provide answers

TEXT:
${chunk}
`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        );

        const data = await response.json();
        const output =
          data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        combinedNotes += "\n" + output;
      }

      results.push({
        topic,
        content: combinedNotes.trim()
      });
    }

    res.json({ success: true, data: results });

  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

app.listen(3000, () =>
  console.log("🚀 AI server running on port 3000")
);
