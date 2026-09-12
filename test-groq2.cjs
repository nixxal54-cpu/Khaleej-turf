const Groq = require('groq-sdk');
const groq = new Groq({apiKey: process.env.GROQ_API_KEY});

const players = Array.from({length: 16}).map((_, i) => ({ id: `p${i}`, name: `Player ${i}`, position: 'Any', rating: 5 }));

const systemPrompt = `You are an expert AI football team manager and tactician. Your task is to create two HIGHLY COMPETITIVE, evenly balanced recreational football teams from the provided list of players.

Rules:
1. You must use EVERY player provided exactly once.
2. Do NOT invent or hallucinate players.
3. Balance the players evenly into two teams (teamA and teamB). Any extra players (e.g., if there is an odd number of players, or if the total exceeds standard team sizes) MUST be placed in the "substitutes" array.
4. CRITICAL: Both teams must be EQUALLY POWERFUL. Distribute the top-tier players evenly so one team does not dominate the other.
5. CRITICAL: Balance positions. Ensure both teams have capable defenders, midfielders, and forwards.
6. Introduce tactical variety: explore different balanced combinations on each request to ensure fresh rosters.
7. You MUST output ONLY valid JSON. Start your response with "{" and end it with "}". Do not include any markdown formatting, preamble, or explanation.

Expected JSON Output Format:
{
  "teamA": [ { "id": "player_id", "name": "Player Name" }, ... ],
  "teamB": [ { "id": "player_id", "name": "Player Name" }, ... ],
  "substitutes": [ { "id": "player_id", "name": "Player Name" } ] // if applicable
}`;

const userPrompt = `Please balance these ${players.length} players into two highly competitive teams.

Players data:
${JSON.stringify(players, null, 2)}

Return only the JSON object.`;

groq.chat.completions.create({
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  model: 'openai/gpt-oss-120b',
  temperature: 0.4
}).then(res => {
  console.log("RESPONSE CHOICES:", JSON.stringify(res.choices, null, 2));
}).catch(console.error);
