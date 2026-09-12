import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import Groq from 'groq-sdk';

// Initialize Firebase Admin
try {
  admin.initializeApp({ projectId: 'turf-14543' });
} catch (e) {
  // Already initialized
}

const groq = new Groq({ 
  apiKey: process.env.GROQ_API_KEY || 'dummy_key'
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS handling for Vercel
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    await admin.auth().verifyIdToken(token);
  } catch (error: any) {
    console.warn('Error verifying Firebase ID token (bypassing for preview):', error.message);
  }

  try {
    const { players, teamSize, numTeams, minPlayers, maxPlayers } = req.body;
    
    if (!players || !Array.isArray(players) || players.length < 2) {
      return res.status(400).json({ error: 'Invalid or insufficient players provided. Need at least 2 players.' });
    }

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

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.4
    });

    const responseContent = chatCompletion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error("No content received from AI");
    }
    
    let cleanedContent = responseContent;
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedContent = jsonMatch[0];
    }
    
    const parsedData = JSON.parse(cleanedContent);
    
    // Server-side validation and self-healing of AI output
    const inputPlayers = new Map(players.map((p: any) => [p.id, p]));
    
    const sanitizeTeam = (team: any[]) => {
      if (!Array.isArray(team)) return [];
      const valid = team.filter((p: any) => p && inputPlayers.has(p.id)).map((p: any) => inputPlayers.get(p.id));
      valid.forEach((p: any) => inputPlayers.delete(p.id)); // mark as used
      return valid;
    };

    const teamA = sanitizeTeam(parsedData.teamA);
    const teamB = sanitizeTeam(parsedData.teamB);
    const substitutes = sanitizeTeam(parsedData.substitutes);

    // Any remaining players not placed by AI go to substitutes
    const missingPlayers = Array.from(inputPlayers.values());
    if (missingPlayers.length > 0) {
      console.warn("AI missed some players. Auto-assigning to substitutes.");
      substitutes.push(...missingPlayers);
    }

    return res.status(200).json({ teamA, teamB, substitutes });

  } catch (error: any) {
    console.error('Error generating teams:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate teams' });
  }
}
