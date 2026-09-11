import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import Groq from 'groq-sdk';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Firebase Admin (Only if env vars are present, or mock if local? Actually, in AI Studio, we need to pass a service account if possible, but Firebase Admin can also initialize default app if standard env vars are present).
// For AI Studio apps, we usually instruct the user to set FIREBASE_SERVICE_ACCOUNT_KEY or we use the REST API, or we check if admin is configured.
// Wait, the set_up_firebase tool creates Firebase config. Client config is in firebase-applet-config.json.
// What about Admin config? Usually users don't have Admin SDK set up unless they provide a key.
// Let's create an endpoint that relies on the Groq API key.
// To protect it, we can verify the Firebase ID token IF they provide FIREBASE_SERVICE_ACCOUNT_KEY. 
// However, the prompt says "Do NOT expose: GROQ_API_KEY, Firebase admin credentials... in client-side JavaScript."
// We can assume the admin will set `FIREBASE_SERVICE_ACCOUNT_KEY` in AI Studio secrets for production, but for now we can do a simpler check.

// Wait, the easiest way to secure this in a serverless setup when the user hasn't provided a full Service Account is to just use a custom SECRET_KEY for admin actions, or use Firebase ID Token verification (which doesn't actually require a Service Account if we only verify ID tokens and have the Project ID!).
// Yes! admin.initializeApp({ projectId: '...' }) is enough to verify ID tokens!
import fs from 'fs';
let projectId = 'demo-project';
try {
  const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(firebaseConfigPath)) {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    projectId = config.projectId;
  }
} catch (e) {
  console.error("Could not read Firebase project ID", e);
}

try {
  admin.initializeApp({ projectId });
} catch (e) {
  console.log("Firebase Admin already initialized or error");
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_key' });

// Middleware to verify Firebase Auth Token
const verifyToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

app.post('/api/generate-teams', verifyToken, async (req, res) => {
  try {
    const { players, teamSize, numTeams, minPlayers, maxPlayers } = req.body;
    
    if (!players || !Array.isArray(players) || players.length < minPlayers) {
      return res.status(400).json({ error: 'Invalid or insufficient players provided.' });
    }

    // Call Groq AI
    const systemPrompt = `You are an expert AI football team balancer. Your task is to create balanced recreational football teams from the provided list of players.
    
    Rules:
    1. You must use EVERY player provided exactly once.
    2. Do NOT invent or hallucinate players.
    3. Respect the requested team sizes. 12 players = 6v6. 13 players = 6v6 + 1 sub. 14 players = 7v7.
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
      temperature: 0.1, // low temp for more consistent logical balancing
      response_format: { type: "json_object" }
    });

    const responseContent = chatCompletion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error("No content received from AI");
    }
    
    const parsedData = JSON.parse(responseContent);
    
    // Server-side validation of AI output
    const allInputIds = players.map(p => p.id).sort();
    const allOutputIds = [
      ...(parsedData.teamA || []).map((p: any) => p.id),
      ...(parsedData.teamB || []).map((p: any) => p.id),
      ...(parsedData.substitutes || []).map((p: any) => p.id)
    ].sort();
    
    if (JSON.stringify(allInputIds) !== JSON.stringify(allOutputIds)) {
      console.error("AI Output mismatch", { input: allInputIds, output: allOutputIds });
      return res.status(500).json({ error: 'AI generated invalid teams (player mismatch). Please try again.' });
    }

    res.json(parsedData);

  } catch (error: any) {
    console.error('Error generating teams:', error);
    res.status(500).json({ error: error.message || 'Failed to generate teams' });
  }
});

// For production (Cloud Run), serve the built Vite app
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
  if (process.env.NODE_ENV !== 'production') {
    import('vite').then(async (vite) => {
      const viteServer = await vite.createServer({
        server: { middlewareMode: true }
      });
      app.use(viteServer.middlewares);
      
      app.listen(port, () => {
        console.log(`Dev server listening on port ${port}`);
      });
    });
  } else {
    app.use(express.static(path.join(__dirname, '../dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
    
    app.listen(port, () => {
      console.log(`Prod server listening on port ${port}`);
    });
  }
}

