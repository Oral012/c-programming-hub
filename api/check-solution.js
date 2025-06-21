export default async function handler(req, res) {
  // Enable CORS
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

  const { exerciseId, userCode, expectedSolution, problemDescription, maxPoints, difficulty } = req.body;

  if (!userCode || !expectedSolution || !problemDescription) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // SIMPLIFIED PROMPT - Less complex for the model
  const prompt = `Evaluate this C programming solution. Give a score out of ${maxPoints} points.

Problem: ${problemDescription}

Expected solution:
${expectedSolution}

Student solution:
${userCode}

Respond ONLY with this JSON format:
{
  "score": <number 0-${maxPoints}>,
  "maxScore": ${maxPoints},
  "percentage": <percentage>,
  "strengths": "Mr.Shadow lets me to evaluate your code. <what they did well>",
  "issues": "<problems or null>",
  "suggestions": "<improvements or null>"
}`;

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey || apiKey === 'undefined') {
      return res.status(500).json({ 
        error: 'Configuration error',
        fix: 'Set OPENROUTER_API_KEY in Vercel environment variables'
      });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://c-programming-hub.vercel.app',
        'X-Title': 'C Programming Hub'
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1-0528:free",
        messages: [
          {
            role: "user",  // NO SYSTEM MESSAGE - just user
            content: prompt
          }
        ],
        temperature: 0.3,  // Lower temperature for more consistent JSON
        max_tokens: 300    // Reduced tokens
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('OpenRouter error:', responseText);
      return res.status(500).json({ 
        error: 'API call failed',
        status: response.status,
        details: responseText
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({ 
        error: 'Invalid API response',
        response: responseText
      });
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.status(500).json({ 
        error: 'No response from AI',
        data: data
      });
    }

    const content = data.choices[0].message.content;
    
    if (!content || content.trim() === '') {
      // Try a different model if this one returns empty
      return res.status(500).json({ 
        error: 'Model returned empty response',
        suggestion: 'Try changing model to "meta-llama/llama-3.2-3b-instruct:free"'
      });
    }
    
    let feedback;
    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        feedback = JSON.parse(jsonMatch[0]);
      } else {
        feedback = JSON.parse(content);
      }
    } catch (parseError) {
      return res.status(500).json({ 
        error: 'Could not parse AI response',
        content: content
      });
    }

    // Ensure required fields
    feedback.score = Math.max(0, Math.min(maxPoints || 100, feedback.score || 0));
    feedback.maxScore = maxPoints || 100;
    feedback.percentage = feedback.percentage || Math.round((feedback.score / feedback.maxScore) * 100);

    res.status(200).json(feedback);

  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}