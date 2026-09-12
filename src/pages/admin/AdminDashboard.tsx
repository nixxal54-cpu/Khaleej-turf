import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { useActiveEvent } from '../../hooks/useEvent';
import { usePlayers } from '../../hooks/usePlayers';
import { bootstrapDefaultEvent, safeFormatDate } from '../../lib/utils';
import { LogOut, RefreshCw, Trash2, Edit3, Image as ImageIcon, Copy, ArrowLeft, Share2 } from 'lucide-react';
import { doc, getDocs, collection, updateDoc, deleteDoc, addDoc, setDoc, getDoc } from 'firebase/firestore';
import { PlayerPublic, PlayerPrivate, TeamResult } from '../../lib/types';
import { format, parseISO } from 'date-fns';
import { toPng } from 'html-to-image';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export default function AdminDashboard() {
  const { user, isAdmin, loading: authLoading, logout } = useAuth();
  const { event, loading: eventLoading } = useActiveEvent();
  const { players, loading: playersLoading } = usePlayers(event?.id);
  
  const [loginError, setLoginError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [privateDetails, setPrivateDetails] = useState<Record<string, PlayerPrivate>>({});
  const [teams, setTeams] = useState<TeamResult | null>(null);

  const handleGoogleLogin = async () => {
    setLoginError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if they are already an admin
      const adminDocRef = doc(db, 'admins', result.user.uid);
      const adminDoc = await getDoc(adminDocRef);
      
      if (!adminDoc.exists()) {
        // Automatically make them an admin (since this is a personal app/tool and rules allow it)
        await setDoc(adminDocRef, {
          email: result.user.email,
          createdAt: Date.now()
        });
        alert('Admin access granted! Refreshing...');
        window.location.reload();
      }
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  useEffect(() => {
    if (isAdmin && event) {
      const fetchPrivate = async () => {
        const snap = await getDocs(collection(db, `events/${event.id}/playerDetails`));
        const details: Record<string, PlayerPrivate> = {};
        snap.forEach(d => {
          details[d.id] = d.data() as PlayerPrivate;
        });
        setPrivateDetails(details);
      };
      fetchPrivate();

      const fetchTeams = async () => {
        const snap = await getDocs(collection(db, `events/${event.id}/teamResults`));
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as TeamResult));
        if (results.length > 0) {
          const active = results.find(r => r.status === 'active') || results[0];
          setTeams(active);
        }
      };
      fetchTeams();
    }
  }, [isAdmin, event]);

  const generateTeams = async (type: 'final' | 'early' | 'test') => {
    if (!event) return;
    const confirmedPlayers = players.filter(p => p.response === 'coming');
    if (confirmedPlayers.length < event.minPlayers && type === 'final') {
      alert(`Cannot generate teams: Need at least ${event.minPlayers} players.`);
      return;
    }
    
    if (type === 'early' && !window.confirm("Generate early draft teams? Players may still join.")) return;

    setIsGenerating(true);
    try {
      const fullPlayerData = confirmedPlayers.map(p => {
        const priv = privateDetails[p.id!] || {};
        return {
          id: p.id,
          name: p.name,
          age: priv.age || 0,
          primaryPosition: priv.primaryPosition || 'Unknown',
          secondaryPosition: priv.secondaryPosition || 'Unknown',
          experience: priv.experience || 'Unknown',
          footballLevel: priv.footballLevel || 'Unknown',
          reasons: priv.reasons || []
        };
      });

      const token = await user?.getIdToken();
      const res = await fetch('/api/generate-teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          players: fullPlayerData,
          teamSize: event.maxPlayers === 14 ? 7 : 6,
          numTeams: 2,
          minPlayers: event.minPlayers,
          maxPlayers: event.maxPlayers
        })
      });

      if (!res.ok) {
        let err;
        const text = await res.text();
        try {
          err = JSON.parse(text);
          throw new Error(err.error || 'Failed to generate');
        } catch (e) {
          if (e.message !== 'Failed to generate') {
             throw new Error('Server returned HTML or invalid JSON. Status: ' + res.status + '. Body: ' + text.substring(0, 100));
          }
          throw e;
        }
      }

      const generatedData = await res.json();

      const resultData: TeamResult = {
        eventId: event.id!,
        type: type === 'test' ? 'early' : type,
        teamA: generatedData.teamA || [],
        teamB: generatedData.teamB || [],
        substitutes: generatedData.substitutes || [],
        generatedAt: Date.now(),
        generatedBy: user!.uid,
        status: 'active'
      };

      if (type === 'test') {
        setTeams({ id: 'test_id', ...resultData });
        alert("Test generation complete. Result will disappear in 30 seconds.");
        setTimeout(() => {
          setTeams(prev => {
            if (prev?.id === 'test_id') {
              const fetchTeams = async () => {
                const snap = await getDocs(collection(db, `events/${event.id}/teamResults`));
                const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as TeamResult));
                if (results.length > 0) {
                  const active = results.find(r => r.status === 'active') || results[0];
                  setTeams(active);
                } else {
                  setTeams(null);
                }
              };
              fetchTeams();
              return null;
            }
            return prev;
          });
        }, 30000);
      } else {
        const docRef = await addDoc(collection(db, `events/${event.id}/teamResults`), resultData);
        setTeams({ id: docRef.id, ...resultData });
      }

    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const removePlayer = async (playerId: string) => {
    if (!event || !window.confirm("Remove this player?")) return;
    await deleteDoc(doc(db, `events/${event.id}/players/${playerId}`));
    await deleteDoc(doc(db, `events/${event.id}/playerDetails/${playerId}`));
  };

  const saveAsImage = async () => {
    const el = document.getElementById('team-sheet');
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { quality: 0.95, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `khaleej-teams-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Failed to generate image.');
    }
  };

  const saveRosterAsImage = async () => {
    const el = document.getElementById('roster-sheet');
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { 
        quality: 0.95, 
        backgroundColor: '#ffffff',
        filter: (node) => {
          if (node instanceof Element) {
            return !node.classList.contains('hide-on-export');
          }
          return true;
        }
      });
      const link = document.createElement('a');
      link.download = `khaleej-roster-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Failed to generate image.');
    }
  };

  const copyWhatsappSheet = () => {
    if (!teams) return;
    let text = `⚽ KHALEEJ TURF\n📅 ${safeFormatDate(event!.date, 'MMM do')}\n⏰ ${event!.startTime}–${event!.endTime}\n👥 ${(teams.teamA?.length || 0) + (teams.teamB?.length || 0)} PLAYERS\n\nTEAM A\n`;
    if (Array.isArray(teams.teamA)) teams.teamA.forEach((p, i) => text += `${i+1}. ${p.name}\n`);
    text += `\nTEAM B\n`;
    if (Array.isArray(teams.teamB)) teams.teamB.forEach((p, i) => text += `${i+1}. ${p.name}\n`);
    if (Array.isArray(teams.substitutes) && teams.substitutes.length > 0) {
      text += `\nSUBSTITUTES\n`;
      teams.substitutes.forEach((p, i) => text += `${i+1}. ${p.name}\n`);
    }
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const shareTeamsLink = async () => {
    if (!teams) return;
    const url = `${window.location.origin}/match/${teams.id}?eventId=${event!.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Khaleej Turf Teams',
          text: `Check out the teams for ${safeFormatDate(event!.date, 'MMM do')}`,
          url: url
        });
      } catch (err) {
        console.log(err);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  if (authLoading) return <div className="p-8 text-center">Loading...</div>;

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        {user && !isAdmin && (
           <div className="mb-4 bg-amber-100 text-amber-800 p-4 rounded-xl max-w-sm w-full text-center text-sm font-medium">
             You are logged in, but not an admin. <button onClick={logout} className="underline">Logout</button>
           </div>
        )}
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-sm w-full space-y-6">
          <h2 className="text-2xl font-bold text-center text-slate-800">Admin Access</h2>
          {loginError && <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg border border-red-100">{loginError}</div>}
          
          <button 
            onClick={handleGoogleLogin} 
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 p-3 rounded-xl font-medium transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>
          
          <div className="text-center pt-2">
            <Link to="/" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">Back to Public Page</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-slate-400 hover:text-white"><ArrowLeft size={20}/></Link>
          <h1 className="font-bold text-lg tracking-wide">KHALEEJ ADMIN</h1>
        </div>
        <button onClick={logout} className="text-sm text-slate-300 hover:text-white flex items-center gap-2"><LogOut size={16}/> Logout</button>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {!event ? (
          <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
            <h2 className="text-xl font-bold mb-4">No Active Match</h2>
            <button onClick={bootstrapDefaultEvent} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-medium">Create Default Event (Tomorrow)</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm md:col-span-1 border border-slate-200 border-l-4 border-l-emerald-500">
                <p className="text-sm font-medium text-slate-500">Confirmed</p>
                <p className="text-3xl font-black">{players.filter(p=>p.response==='coming').length} <span className="text-slate-400 text-xl">/ {event.maxPlayers}</span></p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-sm font-medium text-slate-500">Maybe</p>
                <p className="text-3xl font-black text-slate-700">{players.filter(p=>p.response==='maybe').length}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <p className="text-sm font-medium text-slate-500">Can't Come</p>
                <p className="text-3xl font-black text-slate-700">{players.filter(p=>p.response==='cant_come').length}</p>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm flex flex-col justify-center items-center">
                <button 
                  onClick={() => generateTeams('final')} 
                  disabled={isGenerating || players.filter(p=>p.response==='coming').length < event.minPlayers}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
                  🤖 Generate Final Teams
                </button>
                <div className="flex gap-4 mt-3">
                  <button onClick={() => generateTeams('early')} disabled={isGenerating} className="text-xs text-slate-400 underline hover:text-slate-300">Generate Early Draft</button>
                  <button onClick={() => generateTeams('test')} disabled={isGenerating} className="text-xs text-amber-400 underline hover:text-amber-300">Test AI Generator</button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
               <details className="group">
                  <summary className="px-6 py-4 font-bold text-slate-800 bg-slate-50 cursor-pointer flex justify-between items-center outline-none select-none">
                     Edit Event Settings <Edit3 size={18} className="text-slate-400" />
                  </summary>
                  <form className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100" onSubmit={async (e) => {
                     e.preventDefault();
                     const fd = new FormData(e.currentTarget);
                     const updates = {
                        name: fd.get('name') as string,
                        date: fd.get('date') as string,
                        startTime: fd.get('startTime') as string,
                        endTime: fd.get('endTime') as string,
                        minPlayers: Number(fd.get('minPlayers')),
                        maxPlayers: Number(fd.get('maxPlayers')),
                        votingDeadline: fd.get('votingDeadline') as string + ':00' // rudimentary iso format fix
                     };
                     await updateDoc(doc(db, 'events', event.id!), updates);
                     alert('Event updated');
                  }}>
                     <div><label className="block text-xs font-medium text-slate-500 mb-1">Turf Name</label><input name="name" defaultValue={event.name} className="w-full border border-slate-200 p-2 rounded-lg" required /></div>
                     <div><label className="block text-xs font-medium text-slate-500 mb-1">Date</label><input name="date" type="date" defaultValue={event.date?.substring(0,10)} className="w-full border border-slate-200 p-2 rounded-lg" required /></div>
                     <div><label className="block text-xs font-medium text-slate-500 mb-1">Start Time</label><input name="startTime" type="time" defaultValue={event.startTime} className="w-full border border-slate-200 p-2 rounded-lg" required /></div>
                     <div><label className="block text-xs font-medium text-slate-500 mb-1">End Time</label><input name="endTime" type="time" defaultValue={event.endTime} className="w-full border border-slate-200 p-2 rounded-lg" required /></div>
                     <div><label className="block text-xs font-medium text-slate-500 mb-1">Min Players</label><input name="minPlayers" type="number" defaultValue={event.minPlayers} className="w-full border border-slate-200 p-2 rounded-lg" required /></div>
                     <div><label className="block text-xs font-medium text-slate-500 mb-1">Max Players</label><input name="maxPlayers" type="number" defaultValue={event.maxPlayers} className="w-full border border-slate-200 p-2 rounded-lg" required /></div>
                     <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-500 mb-1">Voting Deadline (ISO String)</label><input name="votingDeadline" type="datetime-local" defaultValue={event.votingDeadline?.substring(0,16)} className="w-full border border-slate-200 p-2 rounded-lg" required /></div>
                     <div className="sm:col-span-2 text-right"><button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium text-sm">Save Changes</button></div>
                  </form>
               </details>
            </div>

            {teams && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    🤖 {teams.type === 'final' ? 'Final Teams' : 'Early Draft'}
                  </h2>
                  <div className="flex gap-2">
                    <button onClick={saveAsImage} title="Save Image" className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-lg"><ImageIcon size={18}/></button>
                    <button onClick={copyWhatsappSheet} title="Copy Text" className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-lg"><Copy size={18}/></button>
                    <button onClick={shareTeamsLink} title="Share Link" className="p-2 text-slate-500 hover:text-indigo-600 bg-indigo-50 rounded-lg"><Share2 size={18}/></button>
                  </div>
                </div>

                <div id="team-sheet" className="p-6 bg-white border-2 border-slate-100 rounded-2xl relative overflow-hidden">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-black tracking-tight">KHALEEJ ⚽</h3>
                    <p className="text-slate-500 font-medium">{safeFormatDate(event.date, 'MMM do, yyyy')} • {event.startTime}–{event.endTime}</p>
                    <span className={clsx("inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold", teams.type === 'final' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                      {teams.type === 'final' ? 'FINAL MATCH SHEET' : 'EARLY DRAFT'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <h4 className="font-bold text-center text-lg mb-4 text-slate-800 border-b pb-2">TEAM A</h4>
                      <ul className="space-y-2">
                        {Array.isArray(teams.teamA) ? teams.teamA.map((p,i) => <li key={p.id} className="font-medium text-slate-700 flex gap-2"><span className="text-slate-400 w-4">{i+1}.</span> {p.name}</li>) : <li className="text-red-500 text-sm">Invalid team format</li>}
                      </ul>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <h4 className="font-bold text-center text-lg mb-4 text-slate-800 border-b pb-2">TEAM B</h4>
                      <ul className="space-y-2">
                        {Array.isArray(teams.teamB) ? teams.teamB.map((p,i) => <li key={p.id} className="font-medium text-slate-700 flex gap-2"><span className="text-slate-400 w-4">{i+1}.</span> {p.name}</li>) : <li className="text-red-500 text-sm">Invalid team format</li>}
                      </ul>
                    </div>
                  </div>
                  {teams.substitutes?.length > 0 && (
                     <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                       <h4 className="font-bold text-sm text-slate-500 mb-2">SUBSTITUTES</h4>
                       <p className="font-medium text-slate-700">{Array.isArray(teams.substitutes) ? teams.substitutes.map(p=>p.name).join(', ') : ''}</p>
                     </div>
                  )}
                  <div className="mt-6 text-center text-xs text-slate-400 font-medium">Balanced by Groq AI</div>
                </div>
              </div>
            )}

            <div id="roster-sheet" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">
                  Player Roster <span className="text-sm font-normal text-slate-500 ml-2">({players.filter(p => p.response === 'coming').length} Confirmed)</span>
                </h3>
                <button onClick={saveRosterAsImage} title="Download Roster" className="hide-on-export p-2 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 shadow-sm rounded-lg flex items-center gap-2 text-sm font-medium">
                  <ImageIcon size={16}/> <span className="hidden sm:inline">Save Image</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Position</th>
                      <th className="px-6 py-3 font-medium">Level</th>
                      <th className="hide-on-export px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {players.map(p => {
                      const priv = privateDetails[p.id!] || {};
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-medium text-slate-900">{p.name}</td>
                          <td className="px-6 py-4">
                            <span className={clsx("px-2 py-1 rounded-full text-xs font-semibold", 
                              p.response === 'coming' ? 'bg-emerald-100 text-emerald-700' : 
                              p.response === 'maybe' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                            )}>
                              {p.response?.replace('_', ' ') || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{priv.primaryPosition || '-'}</td>
                          <td className="px-6 py-4 text-slate-600">{priv.footballLevel || '-'}</td>
                          <td className="hide-on-export px-6 py-4 text-right">
                            <button onClick={() => removePlayer(p.id!)} className="text-slate-400 hover:text-rose-500 transition-colors p-2 rounded-lg hover:bg-rose-50"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      )
                    })}
                    {players.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No players registered yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
