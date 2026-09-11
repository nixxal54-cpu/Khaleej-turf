export interface EventConfig {
  id?: string;
  name: string;
  venue: string;
  date: string; // ISO format YYYY-MM-DD
  startTime: string; // e.g. "17:30"
  endTime: string; // e.g. "18:30"
  timezone: string;
  minPlayers: number;
  maxPlayers: number;
  votingDeadline: string; // ISO format time or relative? Actually, just a timestamp or time string "17:00"
  status: 'open' | 'closed' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export type PlayerResponse = 'coming' | 'maybe' | 'cant_come';

export interface PlayerPublic {
  id?: string;
  name: string;
  response: PlayerResponse;
  joinedAt: number;
  deviceToken: string;
}

export interface PlayerPrivate {
  id?: string;
  age: number;
  primaryPosition: string;
  secondaryPosition: string;
  experience: string;
  footballLevel: string;
  reasons: string[];
  deviceToken: string;
  updatedAt: number;
}

export interface TeamPlayer {
  id: string;
  name: string;
}

export interface TeamResult {
  id?: string;
  eventId: string;
  type: 'early' | 'final';
  teamA: TeamPlayer[];
  teamB: TeamPlayer[];
  substitutes: TeamPlayer[];
  generatedAt: number;
  generatedBy: string;
  status: 'active' | 'archived';
}
