import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getDeviceToken, getSavedPlayerProfile, savePlayerProfile } from '../lib/storage';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const response = searchParams.get('response') || 'coming';
  const eventId = searchParams.get('eventId');
  
  const savedProfile = getSavedPlayerProfile() || {};
  
  const [name, setName] = useState(savedProfile.name || '');
  const [age, setAge] = useState(savedProfile.age || '');
  const [primaryPosition, setPrimaryPosition] = useState(savedProfile.primaryPosition || 'Forward');
  const [secondaryPosition, setSecondaryPosition] = useState(savedProfile.secondaryPosition || 'None');
  const [experience, setExperience] = useState(savedProfile.experience || '1-2 years');
  const [footballLevel, setFootballLevel] = useState(savedProfile.footballLevel || 'Casual');
  const [reasons, setReasons] = useState<string[]>(savedProfile.reasons || []);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const positions = ['Forward', 'Winger', 'Midfielder', 'Defender', 'Goalkeeper'];
  const secPositions = ['None', 'Forward', 'Winger', 'Midfielder', 'Defender', 'Goalkeeper', 'Any position'];
  const expLevels = ['Less than 1 year', '1-2 years', '3-5 years', '5-10 years', '10+ years'];
  const playLevels = ['Beginner', 'Casual', 'Good', 'Very good', 'Very strong'];
  const reasonOptions = ['Just for fun / Timepass', 'I want to play', 'Practice', 'Improve my skills', 'Want to win', 'Play with friends', 'Try my position', 'Love football', 'Just enjoy the game'];

  const toggleReason = (r: string) => {
    setReasons(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    
    if (!name.trim()) return;

    setLoading(true);
    const deviceToken = getDeviceToken();
    // Allow users to keep their previous UUID if editing? Yes, save it in local storage.
    let playerId = savedProfile.id;
    if (!playerId) {
      playerId = uuidv4();
    }
    
    const profile = {
      id: playerId,
      name: name.trim(),
      age: Number(age),
      primaryPosition,
      secondaryPosition,
      experience,
      footballLevel,
      reasons,
    };
    
    savePlayerProfile(profile);
    
    try {
      // 1. Save public record
      await setDoc(doc(db, `events/${eventId}/players/${playerId}`), {
        name: profile.name,
        response,
        joinedAt: Date.now(),
        deviceToken
      });
      
      // 2. Save private record
      await setDoc(doc(db, `events/${eventId}/playerDetails/${playerId}`), {
        ...profile,
        deviceToken,
        updatedAt: Date.now()
      });
      
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (error) {
      console.error(error);
      alert('Could not save your response. Please try again.');
      setLoading(false);
    }
  };

  if (!eventId) {
    return <div className="p-4 text-center">Invalid link.</div>;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
          <CheckCircle2 size={64} className="text-emerald-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800">You're confirmed!</h2>
          <p className="text-slate-500 mt-2">Redirecting back...</p>
        </motion.div>
      </div>
    );
  }

  const isComing = response === 'coming' || response === 'waitlist';

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="px-4 py-4 flex items-center gap-4 bg-white border-b border-slate-100 max-w-lg mx-auto">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <h1 className="font-bold text-lg text-slate-800">Register</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 mt-6">
        <form onSubmit={submit} className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Name</label>
              <input 
                type="text" 
                required 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                placeholder="Your full name"
              />
            </div>
            
            {!isComing && (
              <div className="pt-4">
                <p className="text-slate-500 text-sm mb-4">You are marking your status as <strong className="uppercase">{response.replace('_', ' ')}</strong>.</p>
              </div>
            )}

            {isComing && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Age</label>
                  <input 
                    type="number" 
                    required 
                    min="10" max="80"
                    value={age} 
                    onChange={e => setAge(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-all"
                    placeholder="E.g. 24"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Primary Position</label>
                    <select value={primaryPosition} onChange={e => setPrimaryPosition(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500">
                      {positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Secondary</label>
                    <select value={secondaryPosition} onChange={e => setSecondaryPosition(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500">
                      {secPositions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Football Experience</label>
                  <select value={experience} onChange={e => setExperience(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500">
                    {expLevels.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Level (Optional)</label>
                  <select value={footballLevel} onChange={e => setFootballLevel(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500">
                    {playLevels.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <p className="text-xs text-slate-400 mt-2">This helps the AI create balanced teams.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Why are you playing tomorrow?</label>
                  <div className="flex flex-wrap gap-2">
                    {reasonOptions.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleReason(r)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${reasons.includes(r) ? 'bg-emerald-100 text-emerald-800 border-emerald-200 border' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading || !name.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-lg py-4 rounded-2xl transition-transform active:scale-95"
          >
            {loading ? 'Saving...' : 'Confirm'}
          </button>
        </form>
      </main>
    </div>
  );
}
