import { useMemo, useState } from 'react'

const STORAGE_KEY = 'life-gamification-tracker-v1'

const XP_RULES = {
  achievement: 10,
  gratitude: 5,
  goalNote: 15,
  moodEnergy: 5,
  lesson: 20,
}

const todayString = () => new Date().toISOString().split('T')[0]

const defaultState = {
  goals: [],
  entries: {},
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return defaultState

  try {
    const parsed = JSON.parse(saved)
    return {
      goals: parsed.goals ?? [],
      entries: parsed.entries ?? {},
    }
  } catch {
    return defaultState
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function calculateEntryXP(entry) {
  if (!entry) return 0

  const achievementXP = entry.achievements.length * XP_RULES.achievement
  const gratitudeXP = entry.gratitude.length * XP_RULES.gratitude
  const goalNoteXP = entry.goalNotes.length * XP_RULES.goalNote
  const moodEnergyXP = entry.mood && entry.energy ? XP_RULES.moodEnergy : 0
  const lessonXP = entry.lesson.trim() ? XP_RULES.lesson : 0

  return achievementXP + gratitudeXP + goalNoteXP + moodEnergyXP + lessonXP
}

function createEmptyGoal() {
  return {
    id: crypto.randomUUID(),
    name: '',
    category: '',
    description: '',
    progress: 0,
    target: 100,
    status: 'Not started',
  }
}

function App() {
  const [data, setData] = useState(loadData)
  const [activePage, setActivePage] = useState('dashboard')
  const [goalDraft, setGoalDraft] = useState(createEmptyGoal)
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [achievementInput, setAchievementInput] = useState('')
  const [gratitudeInput, setGratitudeInput] = useState('')
  const [goalNoteInput, setGoalNoteInput] = useState('')

  const today = todayString()

  const todayEntry = data.entries[today] || {
    achievements: [],
    gratitude: [],
    goalNotes: [],
    mood: 5,
    energy: 5,
    lesson: '',
  }

  const totalXP = useMemo(() => {
    return Object.values(data.entries).reduce((sum, entry) => sum + calculateEntryXP(entry), 0)
  }, [data.entries])

  const level = Math.floor(totalXP / 100) + 1

  const updateData = (nextData) => {
    setData(nextData)
    saveData(nextData)
  }

  const updateTodayEntry = (updatedEntry) => {
    updateData({
      ...data,
      entries: {
        ...data.entries,
        [today]: updatedEntry,
      },
    })
  }

  const addListItem = (field, value, setValue) => {
    if (!value.trim()) return
    updateTodayEntry({
      ...todayEntry,
      [field]: [...todayEntry[field], value.trim()],
    })
    setValue('')
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-800">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold">Personal Life Gamification Tracker</h1>
          <p className="mt-2 text-slate-600">Track your habits, reflections, and progress one day at a time.</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span className="rounded-full bg-indigo-100 px-4 py-2 font-semibold text-indigo-700">Total XP: {totalXP}</span>
            <span className="rounded-full bg-emerald-100 px-4 py-2 font-semibold text-emerald-700">Level: {level}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setActivePage('dashboard')}
              className={`rounded-lg px-4 py-2 font-semibold ${activePage === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActivePage('goals')}
              className={`rounded-lg px-4 py-2 font-semibold ${activePage === 'goals' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}
            >
              Goals Page
            </button>
          </div>
        </header>

        {activePage === 'dashboard' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">1. Today Entry ({today})</h2>
              <div className="mt-4 space-y-4">
                <EntryInput label="Achievements" value={achievementInput} setValue={setAchievementInput} onAdd={() => addListItem('achievements', achievementInput, setAchievementInput)} items={todayEntry.achievements} xpText="+10 XP each" />
                <EntryInput label="Gratitude" value={gratitudeInput} setValue={setGratitudeInput} onAdd={() => addListItem('gratitude', gratitudeInput, setGratitudeInput)} items={todayEntry.gratitude} xpText="+5 XP each" />
                <EntryInput label="Goal Progress Notes" value={goalNoteInput} setValue={setGoalNoteInput} onAdd={() => addListItem('goalNotes', goalNoteInput, setGoalNoteInput)} items={todayEntry.goalNotes} xpText="+15 XP each" />
                <div className="grid grid-cols-2 gap-4">
                  <ScoreInput label="Mood Score" value={todayEntry.mood} onChange={(value) => updateTodayEntry({ ...todayEntry, mood: value })} />
                  <ScoreInput label="Energy Score" value={todayEntry.energy} onChange={(value) => updateTodayEntry({ ...todayEntry, energy: value })} />
                </div>
                <p className="text-xs text-slate-500">Mood + Energy logging together: +5 XP</p>
                <div>
                  <label className="mb-1 block font-medium">Lesson of the Day (+20 XP)</label>
                  <textarea value={todayEntry.lesson} onChange={(e) => updateTodayEntry({ ...todayEntry, lesson: e.target.value })} className="w-full rounded-lg border border-slate-300 p-2" rows={3} placeholder="What did you learn today?" />
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">2. Goals</h2>
              <p className="mt-2 text-sm text-slate-600">Use the Goals Page to create and manage your goals.</p>
              <ul className="mt-4 space-y-2">
                {data.goals.slice(0, 4).map((goal) => (
                  <li key={goal.id} className="rounded-lg bg-slate-100 p-3 text-sm">
                    <p className="font-semibold">{goal.name}</p>
                    <p className="text-slate-600">{goal.progress}/{goal.target} • {goal.status}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">3. Progress Dashboard</h2>
              <div className="mt-4 space-y-2 text-sm">
                <Stat label="Days Logged" value={Object.keys(data.entries).length} />
                <Stat label="Total Achievements" value={sumCount(data.entries, 'achievements')} />
                <Stat label="Total Gratitude Items" value={sumCount(data.entries, 'gratitude')} />
                <Stat label="Total Goal Notes" value={sumCount(data.entries, 'goalNotes')} />
                <Stat label="Average Mood" value={averageScore(data.entries, 'mood')} />
                <Stat label="Average Energy" value={averageScore(data.entries, 'energy')} />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">4. History</h2>
              <div className="mt-4 space-y-3 text-sm">
                {Object.keys(data.entries).sort((a, b) => b.localeCompare(a)).map((date) => (
                  <div key={date} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold">{date}</p>
                    <p>XP: {calculateEntryXP(data.entries[date])}</p>
                  </div>
                ))}
                {Object.keys(data.entries).length === 0 && <p className="text-slate-500">No history yet. Add your first entry today.</p>}
              </div>
            </section>
          </div>
        )}

        {activePage === 'goals' && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Goals Page</h2>
            <p className="mt-1 text-sm text-slate-600">Create, edit, and delete goals. Data is saved in localStorage.</p>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                <h3 className="font-semibold">{isEditingGoal ? 'Edit Goal' : 'Create Goal'}</h3>
                <input className="w-full rounded-lg border border-slate-300 p-2" placeholder="Name" value={goalDraft.name} onChange={(e) => setGoalDraft({ ...goalDraft, name: e.target.value })} />
                <input className="w-full rounded-lg border border-slate-300 p-2" placeholder="Category" value={goalDraft.category} onChange={(e) => setGoalDraft({ ...goalDraft, category: e.target.value })} />
                <textarea className="w-full rounded-lg border border-slate-300 p-2" rows={3} placeholder="Description" value={goalDraft.description} onChange={(e) => setGoalDraft({ ...goalDraft, description: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" className="w-full rounded-lg border border-slate-300 p-2" placeholder="Current progress" value={goalDraft.progress} onChange={(e) => setGoalDraft({ ...goalDraft, progress: Number(e.target.value) })} />
                  <input type="number" className="w-full rounded-lg border border-slate-300 p-2" placeholder="Target" value={goalDraft.target} onChange={(e) => setGoalDraft({ ...goalDraft, target: Number(e.target.value) })} />
                </div>
                <select className="w-full rounded-lg border border-slate-300 p-2" value={goalDraft.status} onChange={(e) => setGoalDraft({ ...goalDraft, status: e.target.value })}>
                  <option>Not started</option>
                  <option>In progress</option>
                  <option>Completed</option>
                  <option>On hold</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={saveGoal} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">{isEditingGoal ? 'Save Changes' : 'Add Goal'}</button>
                  {isEditingGoal && <button onClick={() => { setGoalDraft(createEmptyGoal()); setIsEditingGoal(false) }} className="rounded-lg bg-slate-200 px-4 py-2">Cancel</button>}
                </div>
              </div>

              <div className="space-y-4">
                {data.goals.map((goal) => {
                  const percent = goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0
                  return (
                    <div key={goal.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{goal.name}</h4>
                          <p className="text-sm text-slate-600">{goal.category} • {goal.status}</p>
                        </div>
                        <div className="flex gap-2 text-sm">
                          <button onClick={() => editGoal(goal)} className="rounded bg-slate-100 px-2 py-1">Edit</button>
                          <button onClick={() => deleteGoal(goal.id)} className="rounded bg-rose-100 px-2 py-1 text-rose-700">Delete</button>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{goal.description || 'No description added yet.'}</p>
                      <div className="mt-3 h-3 w-full rounded-full bg-slate-200">
                        <div className="h-3 rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
                      </div>
                      <p className="mt-1 text-sm">{goal.progress} / {goal.target} ({percent}%)</p>
                    </div>
                  )
                })}
                {data.goals.length === 0 && <p className="text-slate-500">No goals yet. Create your first goal.</p>}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function EntryInput({ label, value, setValue, onAdd, items, xpText }) { return <div><label className="mb-1 block font-medium">{label} ({xpText})</label><div className="flex gap-2"><input value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" placeholder={`Add ${label.toLowerCase()}`} /><button onClick={onAdd} className="rounded-lg bg-slate-800 px-3 py-2 text-white">Add</button></div><ul className="mt-2 list-disc space-y-1 pl-6 text-sm">{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div> }
function ScoreInput({ label, value, onChange }) { return <div><label className="mb-1 block font-medium">{label} (1-10)</label><input type="range" min="1" max="10" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" /><p className="text-center text-sm">{value}</p></div> }
function Stat({ label, value }) { return <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2"><span>{label}</span><span className="font-semibold">{value}</span></div> }
function sumCount(entries, field) { return Object.values(entries).reduce((sum, entry) => sum + entry[field].length, 0) }
function averageScore(entries, field) { const values = Object.values(entries).map((entry) => entry[field]).filter(Boolean); if (!values.length) return '-'; return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) }

export default App
