module.exports = exports = async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { company, ticker, investor, reportText } = req.body;
  
  if (!company || !investor) {
    return res.status(400).json({ error: 'Missing company or investor parameters' });
  }

  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyD3vNuVHR4CrFsb3C4SD06pbL1EF3wV90U';

  let prompt = `You are a professional equity research assistant.
You are acting as the legendary investor ${investor}. Provide an equity research report for ${company} (${ticker || 'Unknown Ticker'}) based on your investment philosophy.`;

  if (reportText) {
      prompt += `\n\nIMPORTANT: The user has uploaded an official financial report for this company. You MUST base your analysis heavily on the data provided in this document.\n\n--- FINANCIAL REPORT START ---\n${reportText}\n--- FINANCIAL REPORT END ---\n`;
  }

  prompt += `\nYour response MUST be strictly in the following JSON format. Do not include any text outside the JSON. Do not wrap in markdown code blocks.
{
  "verdict": "Buy | Watch | Sell | Hold",
  "overallScore": <number between 0 and 100>,
  "criteria": [
    { "label": "<Criteria like 'Business Understanding', 'Moat', 'Management'>", "status": "pass|fail|partial", "description": "<brief reason>" },
    { "label": "<Criteria>", "status": "pass|fail|partial", "description": "<brief reason>" },
    { "label": "<Criteria>", "status": "pass|fail|partial", "description": "<brief reason>" },
    { "label": "<Criteria>", "status": "pass|fail|partial", "description": "<brief reason>" }
  ],
  "scores": [
    { "label": "Fundamentals", "value": <number>, "max": 100 },
    { "label": "Risk", "value": <number>, "max": 100 },
    { "label": "Valuation", "value": <number>, "max": 100 }
  ],
  "metrics": {
    "pe": <estimated PE ratio as a number, use 0 if n/a>,
    "pb": <estimated Price-to-Book ratio as a number, use 0 if n/a>,
    "roc": <estimated Return on Capital % as a number, e.g., 15 for 15%>,
    "roce": <estimated Return on Capital Employed % as a number, e.g., 20 for 20%>
  },
  "analysis": "<3-4 sentences of deep analysis from the perspective of ${investor}>",
  "quote": "<A real famous quote by ${investor} that applies to this situation>"
}`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error("Gemini API Error:", data);
        return res.status(500).json({ error: data.error?.message || "Failed to generate analysis" });
    }

    let resultText = data.candidates[0].content.parts[0].text.trim();
    
    // In case the model still returns markdown
    if (resultText.startsWith("\`\`\`json")) {
      resultText = resultText.replace(/^\`\`\`json\n?/, "").replace(/\n?\`\`\`$/, "");
    } else if (resultText.startsWith("\`\`\`")) {
      resultText = resultText.replace(/^\`\`\`\n?/, "").replace(/\n?\`\`\`$/, "");
    }
    
    const parsed = JSON.parse(resultText);
    return res.status(200).json(parsed);
  } catch (error) {
    console.error("Error calling Gemini or parsing JSON:", error);
    return res.status(500).json({ error: "Failed to generate analysis. Please try again." });
  }
};
