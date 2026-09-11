import { addDays, setHours, setMinutes, formatISO } from 'date-fns';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { EventConfig } from './types';

export async function bootstrapDefaultEvent() {
  const tomorrow = addDays(new Date(), 1);
  const startTime = '17:30';
  const endTime = '18:30';
  const deadline = setMinutes(setHours(tomorrow, 17), 0); // 17:00 tomorrow

  const event: EventConfig = {
    name: 'Khaleej',
    venue: 'Khaleej Turf',
    date: formatISO(tomorrow, { representation: 'date' }),
    startTime,
    endTime,
    timezone: 'Asia/Kolkata',
    minPlayers: 12,
    maxPlayers: 14,
    votingDeadline: formatISO(deadline),
    status: 'open',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await addDoc(collection(db, 'events'), event);
}
