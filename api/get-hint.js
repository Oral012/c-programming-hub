const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { exerciseId, userCode, problemDescription, hints } = req.body;
    
    const prompt = `You are a helpful C programming tutor. A student is working on this problem:

${problemDescription}

Their current code:
\`\`\`c
${userCode}
\`\`\`

Analyze their code and provide ONE helpful hint to guide them in the right direction. 
- Don't give away the solution
- Point out if they're on the right track
- Suggest what to think about next
- Be encouraging
- Keep it short (2-3 sentences max)

If their code is empty or completely wrong, guide them to start with the struct definition.

Respond in JSON format:
{
  "hint": "Your personalized hint here",
  "encouragement": "Optional encouraging message if they're close"
}`;
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "mistralai/mistral-small-3.2-24b-instruct:free",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful programming tutor. Always respond with valid JSON only."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 200
            })
        });
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Parse JSON response
        let hint;
        try {
            hint = JSON.parse(content);
        } catch {
            // Extract JSON if wrapped
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            hint = jsonMatch ? JSON.parse(jsonMatch[0]) : { hint: "Check your struct definition and make sure you're using the correct syntax." };
        }
        
        res.status(200).json(hint);
        
    } catch (error) {
        console.error('Error getting AI hint:', error);
        res.status(500).json({ 
            hint: "Start by defining the struct as shown in the exercise. Then implement the function step by step."
        });
    }
}