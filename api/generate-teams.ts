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

    const systemPrompt = `You are an expert AI football team balancer. Your task is to create balanced recreational football teams from the provided list of players.
    
    Rules:
    1. You must use EVERY player provided exactly once.
    2. Do NOT invent or hallucinate players.
    3. Balance the players evenly into two teams (teamA and teamB). Any extra players (e.g., if there is an odd number of players, or if the total exceeds standard team sizes) MUST be placed in the "substitutes" array.
    4. Consider positions (balance forwards, midfielders, defenders, and goalkeepers).
    5. Consider self-reported level and experience as approximate signals.
    6. Balance attacking and defensive capabilities.
    7. Return strict JSON ONLY. No markdown formatting outside of the JSON block, or just raw JSON.
    
    Expected JSON Output Format:
    {
      "teamA": [ { "id": "player_id", "name": "Player Name" }, ... ],
      "teamB": [ { "id": "player_id", "name": "Player Name" }, ... ],
      "substitutes": [ { "id": "player_id", "name": "Player Name" } ] // if applicable
    }`;

    const userPrompt = `Please balance these ${players.length} players into two teams.
    
    Players data:
    ${JSON.stringify(players, null, 2)}
    
    Return only the JSON object.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const responseContent = chatCompletion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error("No content received from AI");
    }
    
    const parsedData = JSON.parse(responseContent);
    
    const allInputIds = players.map((p:any) => p.id).sort();
    const allOutputIds = [
      ...(parsedData.teamA || []).map((p: any) => p.id),
      ...(parsedData.teamB || []).map((p: any) => p.id),
      ...(parsedData.substitutes || []).map((p: any) => p.id)
    ].sort();
    
    if (JSON.stringify(allInputIds) !== JSON.stringify(allOutputIds)) {
      console.error("AI Output mismatch", { input: allInputIds, output: allOutputIds });
      return res.status(500).json({ error: 'AI generated invalid teams (player mismatch). Please try again.' });
    }

    return res.status(200).json(parsedData);

  } catch (error: any) {
    console.error('Error generating teams:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate teams' });
  }
}
