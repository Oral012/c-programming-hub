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

  const prompt = `You are a C programming teacher evaluating a student's code solution.

Problem Description:
${problemDescription}

Difficulty Level: ${difficulty}
Maximum Points: ${maxPoints}

Expected Solution:
\`\`\`c
${expectedSolution}
\`\`\`

Student's Solution:
\`\`\`c
${userCode}
\`\`\`

Please evaluate the student's solution and provide:
1. A score out of ${maxPoints} points based on:
   - Correctness (most important)
   - Code quality and style
   - Efficiency
2. What they did well (be encouraging)
3. Any issues or errors in their code
4. Suggestions for improvement

IMPORTANT: When giving the strengths feedback, always start with "Mr.Shadow lets me to evaluate your code. " followed by what they did well.

If the student submission is not C code (e.g., questions, random text), respond with:
{
  "score": 0,
  "strengths": "No code was submitted to evaluate, YOU BASTARD!!! 😠",
  "issues": "Please submit C programming code, not questions or other text",
  "suggestions": "Write your solution to the exercise in C language"
}

Scoring Guide:
- Perfect solution: ${maxPoints} points
Scoring Guide:
- Perfect solution: ${maxPoints} points
- Minor issues (style, efficiency): ${Math.round(maxPoints * 0.9)}-${Math.round(maxPoints * 0.95)} points
- Works but has problems: ${Math.round(maxPoints * 0.7)}-${Math.round(maxPoints * 0.85)} points
- Partial solution: ${Math.round(maxPoints * 0.4)}-${Math.round(maxPoints * 0.6)} points
- Attempted but incorrect: ${Math.round(maxPoints * 0.1)}-${Math.round(maxPoints * 0.3)} points

Respond in this exact JSON format:
{
  "score": <number between 0-${maxPoints}>,
  "maxScore": ${maxPoints},
  "percentage": <percentage score 0-100>,
  "strengths": "Mr.Shadow lets me to evaluate your code. <what the student did well>",
  "issues": "<any problems found, or null if perfect>",
  "suggestions": "<how to improve, or null if perfect>"
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://c-programming-hub.vercel.app',
        'X-Title': 'C Programming Hub'
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1-0528:free",  // FREE model!
        messages: [
          {
            role: "system",
            content: "You are a helpful C programming instructor. You evaluate code fairly but encouragingly. Always respond with valid JSON only, no additional text."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('DeepSeek API error:', error);
      return res.status(500).json({ error: 'Failed to check solution' });
    }

    const data = await response.json();
    
    // Extract the content from the API response
    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    let feedback;
    try {
      feedback = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return res.status(500).json({ error: 'Invalid response from AI' });
    }

    // Ensure score is within valid range
    feedback.score = Math.max(0, Math.min(maxPoints || 100, feedback.score));
    
    // Calculate percentage if not provided
    if (!feedback.percentage) {
      feedback.percentage = Math.round((feedback.score / (maxPoints || 100)) * 100);
    }

    res.status(200).json(feedback);

  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    res.status(500).json({ error: 'Failed to process solution' });
  }
}