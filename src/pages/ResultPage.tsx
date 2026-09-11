import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { TeamResult, EventConfig } from '../lib/types';
import { format, parseISO } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'motion/react';

export default function ResultPage() {
  const { resultId } = useParams();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');
  const [result, setResult] = useState<TeamResult | null>(null);
  const [event, setEvent] = useState<EventConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      if (!resultId || !eventId) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, `events/${eventId}/teamResults/${resultId}`));
        if (snap.exists()) {
          setResult({ id: snap.id, ...snap.data() } as TeamResult);
          
          const eventSnap = await getDoc(doc(db, 'events', eventId));
          if (eventSnap.exists()) {
            setEvent({ id: eventSnap.id, ...eventSnap.data() } as EventConfig);
          }
        }
      } catch (err) {
        console.error("Error fetching result", err);
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [resultId, eventId]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;

  if (!result || !event) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">Result not found or invalid link.</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="px-4 py-4 flex items-center gap-4 bg-white border-b border-slate-100 max-w-lg mx-auto">
        <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-slate-100">
          <ArrowLeft size={20} className="text-slate-600" />
        </Link>
        <h1 className="font-bold text-lg text-slate-800">Match Result</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 mt-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm relative overflow-hidden">
          <div className="text-center mb-6">
            <h3 className="text-3xl font-black tracking-tight text-slate-900">KHALEEJ ⚽</h3>
            <p className="text-slate-500 font-medium mt-1">{format(parseISO(event.date), 'MMM do, yyyy')} • {event.startTime}–{event.endTime}</p>
            <span className={clsx("inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold", result.type === 'final' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
              {result.type === 'final' ? 'FINAL MATCH SHEET' : 'EARLY DRAFT'}
            </span>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <h4 className="font-bold text-center text-lg mb-4 text-slate-800 border-b border-slate-200 pb-2">TEAM A</h4>
              <ul className="space-y-3">
                {result.teamA?.map((p,i) => <li key={p.id} className="font-medium text-slate-700 flex gap-3 text-lg"><span className="text-slate-400 w-5">{i+1}.</span> {p.name}</li>)}
              </ul>
            </div>
            
            <div className="text-center font-black text-slate-300 italic">VS</div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <h4 className="font-bold text-center text-lg mb-4 text-slate-800 border-b border-slate-200 pb-2">TEAM B</h4>
              <ul className="space-y-3">
                {result.teamB?.map((p,i) => <li key={p.id} className="font-medium text-slate-700 flex gap-3 text-lg"><span className="text-slate-400 w-5">{i+1}.</span> {p.name}</li>)}
              </ul>
            </div>
          </div>
          
          {result.substitutes?.length > 0 && (
             <div className="mt-6 bg-slate-50 rounded-2xl p-5 border border-slate-100 text-center">
               <h4 className="font-bold text-sm text-slate-500 mb-2 tracking-wider">SUBSTITUTES</h4>
               <p className="font-medium text-slate-700 text-lg">{result.substitutes?.map(p=>p.name).join(', ')}</p>
             </div>
          )}
          <div className="mt-8 text-center text-sm text-slate-400 font-medium">Balanced by Groq AI</div>
        </motion.div>
      </main>
    </div>
  );
}
