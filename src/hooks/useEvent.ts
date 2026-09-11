import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { EventConfig } from '../lib/types';
import { addDays, format, setHours, setMinutes } from 'date-fns';

export function useActiveEvent() {
  const [event, setEvent] = useState<EventConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'events'),
      where('status', 'in', ['open', 'closed']),
      orderBy('date', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // We shouldn't auto-create from client typically, but for the sake of the demo
        // let's just return null and let admin create it.
        setEvent(null);
        setLoading(false);
      } else {
        const docSnap = snapshot.docs[0];
        setEvent({ id: docSnap.id, ...docSnap.data() } as EventConfig);
        setLoading(false);
      }
    }, (err) => {
      console.error("Error fetching event:", err);
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { event, loading, error };
}
