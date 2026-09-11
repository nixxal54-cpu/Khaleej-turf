import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveEvent } from '../hooks/useEvent';
import { usePlayers } from '../hooks/usePlayers';
import { getDeviceToken, getSavedPlayerProfile } from '../lib/storage';
import { format, isPast, parseISO, differenceInSeconds } from 'date-fns';
import { Globe, Users, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { motion } from 'motion/react';

export default function Home() {
  const { t, i18n } = useTranslation();
  const { event, loading: eventLoading } = useActiveEvent();
  const { players, loading: playersLoading } = usePlayers(event?.id);
  const [countdown, setCountdown] = useState<string>('');
  const [isClosed, setIsClosed] = useState(false);

  const toggleLanguage = () => {
    const nextLng = i18n.language === 'en' ? 'ml' : 'en';
    i18n.changeLanguage(nextLng);
    localStorage.setItem('khaleej_lang', nextLng);
  };

  useEffect(() => {
    if (!event) return;
    
    // Assume event.votingDeadline is a time string like "17:00" for the event date.
    // Wait, let's just make votingDeadline a full ISO string for ease of logic.
    const deadlineTime = event.votingDeadline ? parseISO(event.votingDeadline) : new Date();
    
    const timer = setInterval(() => {
      const now = new Date();
      if (isPast(deadlineTime)) {
        setIsClosed(true);
        setCountdown('');
        clearInterval(timer);
      } else {
        const diff = differenceInSeconds(deadlineTime, now);
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setCountdown(`${h}h ${m}m ${s}s`);
        setIsClosed(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [event]);

  if (eventLoading || playersLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">{t('KHALEEJ')}</h1>
        <p className="text-slate-500">No active match currently.</p>
        <Link to="/admin" className="mt-8 text-sm text-slate-400 hover:text-slate-600">{t('Admin')}</Link>
      </div>
    );
  }

  const comingCount = players.filter(p => p.response === 'coming').length;
  const isFull = comingCount >= event.maxPlayers;

  let statusMsg = '';
  if (comingCount < 6) statusMsg = t('Need more players');
  else if (comingCount < event.minPlayers) statusMsg = t('Almost there — need {{count}} more', { count: event.minPlayers - comingCount });
  else if (comingCount < event.maxPlayers) statusMsg = t('Enough players for a match!');
  else statusMsg = t('Full — {{count}}/{{max}}', { count: comingCount, max: event.maxPlayers });

  if (isClosed) statusMsg = t('Voting closed');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="px-6 py-4 flex justify-between items-center max-w-lg mx-auto">
        <h1 className="text-xl font-extrabold tracking-tight">KHALEEJ</h1>
        <button 
          onClick={toggleLanguage}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors"
        >
          <Globe size={16} />
          {i18n.language === 'en' ? 'മലയാളം' : 'English'}
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 mt-4 space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">{t('Tomorrow')}</h2>
              <p className="text-slate-500 font-medium mt-1">{event.startTime} – {event.endTime}</p>
            </div>
            <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold">
              {event.minPlayers}–{event.maxPlayers} {t('Players')}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{t('Live player count')}</p>
                <div className="text-4xl font-black mt-1">
                  {comingCount} <span className="text-slate-300">/ {event.maxPlayers}</span>
                </div>
              </div>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className={clsx("h-2.5 rounded-full transition-all duration-1000", 
                  comingCount >= event.minPlayers ? 'bg-emerald-500' : 'bg-amber-400'
                )}
                style={{ width: `${Math.min(100, (comingCount / event.maxPlayers) * 100)}%` }}
              ></div>
            </div>

            <p className={clsx("font-medium", isClosed ? 'text-rose-600' : 'text-slate-700')}>
              {statusMsg}
            </p>

            {!isClosed && countdown && (
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-2xl">
                <Clock size={16} className="text-slate-400" />
                <span>{t('Voting closes in')} <span className="font-semibold text-slate-700">{countdown}</span></span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Action Buttons */}
        {!isClosed && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 gap-3">
            <Link to={`/register?response=${isFull ? 'waitlist' : 'coming'}&eventId=${event.id}`} className={clsx("flex justify-between items-center p-4 rounded-2xl font-bold text-lg text-white transition-transform active:scale-95", isFull ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700')}>
              <span>{isFull ? '🕒 Join Waitlist' : `🟢 ${t("I'm Coming")}`}</span>
              <ArrowRight size={20} />
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link to={`/register?response=maybe&eventId=${event.id}`} className="flex justify-center items-center p-4 rounded-2xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-transform active:scale-95">
                🟡 {t("Maybe")}
              </Link>
              <Link to={`/register?response=cant_come&eventId=${event.id}`} className="flex justify-center items-center p-4 rounded-2xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-transform active:scale-95">
                🔴 {t("Can't come")}
              </Link>
            </div>
          </motion.div>
        )}

        {/* Players List */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mt-6">
           {/* Coming List */}
           <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">🟢 {t('Coming')} ({comingCount})</h3>
           <ul className="space-y-2 mb-6">
             {players.filter(p => p.response === 'coming').map((p, i) => (
               <li key={p.id} className="flex gap-3 text-slate-800 font-medium">
                 <span className="text-slate-400 w-5">{i + 1}.</span> {p.name}
               </li>
             ))}
             {comingCount === 0 && <li className="text-slate-400 italic text-sm">No players yet.</li>}
           </ul>

           {/* Waitlist */}
           {players.filter(p => p.response === 'waitlist').length > 0 && (
             <>
               <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4">🕒 Waitlist</h3>
               <ul className="space-y-2 mb-6">
                 {players.filter(p => p.response === 'waitlist').map((p, i) => (
                   <li key={p.id} className="flex gap-3 text-amber-700 font-medium">
                     <span className="text-amber-300 w-5">{i + 1}.</span> {p.name}
                   </li>
                 ))}
               </ul>
             </>
           )}

           {/* Maybe List */}
           {players.filter(p => p.response === 'maybe').length > 0 && (
             <>
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">🟡 {t('Maybe')}</h3>
               <ul className="space-y-2 mb-6">
                 {players.filter(p => p.response === 'maybe').map((p, i) => (
                   <li key={p.id} className="flex gap-3 text-slate-600">
                     <span className="text-slate-300 w-5">{i + 1}.</span> {p.name}
                   </li>
                 ))}
               </ul>
             </>
           )}

           {/* Cant Come List */}
           {players.filter(p => p.response === 'cant_come').length > 0 && (
             <>
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">🔴 {t("Can't come")}</h3>
               <ul className="space-y-2">
                 {players.filter(p => p.response === 'cant_come').map((p, i) => (
                   <li key={p.id} className="flex gap-3 text-slate-400 line-through">
                     <span className="text-slate-200 w-5">{i + 1}.</span> {p.name}
                   </li>
                 ))}
               </ul>
             </>
           )}
        </motion.div>
      </main>

      <div className="text-center mt-12">
        <Link to="/admin" className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">Admin Access</Link>
      </div>
    </div>
  );
}
