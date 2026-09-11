import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { PlayerPublic } from '../lib/types';

export function usePlayers(eventId?: string) {
  const [players, setPlayers] = useState<PlayerPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, `events/${eventId}/players`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: PlayerPublic[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as PlayerPublic);
      });
      // Sort by joinedAt
      data.sort((a, b) => a.joinedAt - b.joinedAt);
      setPlayers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [eventId]);

  return { players, loading };
}
