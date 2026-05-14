import { useEffect, useMemo, useState } from 'react'

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
  dailyPlans: {},
}


function createEmptyEntry(date) {
  return {
    date,
    achievements: [],
    gratitude: [],
    goalNotes: [],
    mood: 5,
    energy: 5,
    lesson: '',
    xpEarned: 0,
  }
}

function normalizeEntry(rawEntry, date) {
  const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry : {}
  const normalized = {
    date,
    achievements: Array.isArray(entry.achievements) ? entry.achievements : [],
    gratitude: Array.isArray(entry.gratitude) ? entry.gratitude : [],
    goalNotes: Array.isArray(entry.goalNotes) ? entry.goalNotes : [],
    mood: Number(entry.mood) || 5,
    energy: Number(entry.energy) || 5,
    lesson: typeof entry.lesson === 'string' ? entry.lesson : '',
    xpEarned: Number(entry.xpEarned) || 0,
  }
  normalized.xpEarned = calculateEntryXP(normalized)
  return normalized
}

function safeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeGoal(rawGoal) {
  if (typeof rawGoal === 'string') {
    return {
      id: safeId(),
      name: rawGoal,
      category: 'General',
      description: '',
      currentProgress: 0,
      targetProgress: 100,
      status: 'Not started',
      completedAt: null,
    }
  }

  if (!rawGoal || typeof rawGoal !== 'object') return null

  return {
    id: rawGoal.id || safeId(),
    name: rawGoal.name || 'Untitled goal',
    category: rawGoal.category || 'General',
    description: rawGoal.description || '',
    currentProgress: Number(rawGoal.currentProgress ?? rawGoal.progress) || 0,
    targetProgress: Number(rawGoal.targetProgress ?? rawGoal.target) > 0 ? Number(rawGoal.targetProgress ?? rawGoal.target) : 100,
    status: rawGoal.status || 'Not started',
    completedAt: rawGoal.completedAt || null,
  }
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return defaultState

  try {
    const parsed = JSON.parse(saved)
    const normalizedGoals = Array.isArray(parsed.goals)
      ? parsed.goals.map(normalizeGoal).filter(Boolean)
      : []

    const rawEntries = parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {}
    const normalizedEntries = Object.fromEntries(Object.entries(rawEntries).map(([date, entry]) => [date, normalizeEntry(entry, date)]))

    const rawPlans = parsed.dailyPlans && typeof parsed.dailyPlans === 'object' ? parsed.dailyPlans : {}
    const normalizedPlans = Object.fromEntries(
      Object.entries(rawPlans).map(([date, tasks]) => [
        date,
        Array.isArray(tasks)
          ? tasks.map((task) => ({
              id: task?.id || safeId(),
              text: typeof task?.text === 'string' ? task.text : '',
              completed: Boolean(task?.completed),
              createdAt: task?.createdAt || new Date().toISOString(),
            })).filter((task) => task.text.trim())
          : [],
      ]),
    )

    return {
      goals: normalizedGoals,
      entries: normalizedEntries,
      dailyPlans: normalizedPlans,
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


function calculateCurrentStreak(entries) {
  const dates = new Set(Object.keys(entries))
  let streak = 0
  const current = new Date()

  while (true) {
    const dateKey = current.toISOString().split('T')[0]
    if (!dates.has(dateKey)) {
      if (streak === 0) {
        current.setDate(current.getDate() - 1)
        const yesterdayKey = current.toISOString().split('T')[0]
        if (!dates.has(yesterdayKey)) return 0
        streak += 1
      } else {
        break
      }
    } else {
      streak += 1
    }
    current.setDate(current.getDate() - 1)
  }

  return streak
}

function calculateWeeklyXP(entries) {
  const today = new Date()
  const weekAgo = new Date()
  weekAgo.setDate(today.getDate() - 6)

  return Object.entries(entries).reduce((sum, [date, entry]) => {
    const entryDate = new Date(`${date}T00:00:00`)
    if (entryDate >= weekAgo && entryDate <= today) {
      return sum + calculateEntryXP(entry)
    }
    return sum
  }, 0)
}

function goalSummary(goals) {
  if (!goals.length) return { completed: 0, total: 0, avg: 0 }
  const completed = goals.filter((goal) => goal.status === 'Completed').length
  const avg = Math.round(goals.reduce((sum, goal) => {
    const percent = goal.targetProgress > 0 ? Math.min(100, (goal.currentProgress / goal.targetProgress) * 100) : 0
    return sum + percent
  }, 0) / goals.length)
  return { completed, total: goals.length, avg }
}
function createEmptyGoal() {
  return {
    id: safeId(),
    name: '',
    category: '',
    description: '',
    currentProgress: 0,
    targetProgress: 100,
    status: 'Not started',
    completedAt: null,
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
  const [planTaskInput, setPlanTaskInput] = useState('')
  const [planCategoryInput, setPlanCategoryInput] = useState('General')
  const [planXpInput, setPlanXpInput] = useState(10)

  const [dashboardEditingGoalId, setDashboardEditingGoalId] = useState(null)

  const today = todayString()
  const [selectedDate, setSelectedDate] = useState(today)
  const [historyDate, setHistoryDate] = useState(today)
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null)
  const [isHistoryEditMode, setIsHistoryEditMode] = useState(false)
  const [historyDraft, setHistoryDraft] = useState(null)

  const todayEntry = data.entries[selectedDate] || createEmptyEntry(selectedDate)


  const planForSelectedDate = data.dailyPlans?.[selectedDate] || []

  const addPlanTask = () => {
    if (!planTaskInput.trim()) return
    const nextTask = {
      id: safeId(),
      text: planTaskInput.trim(),
      completed: false,
      category: planCategoryInput || 'General',
      xp: Number(planXpInput) >= 0 ? Number(planXpInput) : 10,
      createdAt: new Date().toISOString(),
    }
    updateData({
      ...data,
      dailyPlans: {
        ...data.dailyPlans,
        [selectedDate]: [...planForSelectedDate, nextTask],
      },
    })
    setPlanTaskInput('')
    setPlanXpInput(10)
  }

  const updatePlanTask = (taskId, updates) => {
    updateData({
      ...data,
      dailyPlans: {
        ...data.dailyPlans,
        [selectedDate]: planForSelectedDate.map((task) =>
          task.id === taskId ? { ...task, ...updates } : task,
        ),
      },
    })
  }

  const togglePlanTask = (taskId) => {
    const target = planForSelectedDate.find((task) => task.id === taskId)
    if (!target) return
    updatePlanTask(taskId, { completed: !target.completed })
  }

  const deletePlanTask = (taskId) => {
    updateData({
      ...data,
      dailyPlans: {
        ...data.dailyPlans,
        [selectedDate]: planForSelectedDate.filter((task) => task.id !== taskId),
      },
    })
  }

  const dailyPlanTotalXP = planForSelectedDate.reduce((sum, task) => sum + (Number(task.xp) >= 0 ? Number(task.xp) : 10), 0)
  const dailyPlanCompletedXP = planForSelectedDate.filter((task) => task.completed).reduce((sum, task) => sum + (Number(task.xp) >= 0 ? Number(task.xp) : 10), 0)

  const totalXP = useMemo(() => {
    return Object.values(data.entries).reduce((sum, entry) => sum + calculateEntryXP(entry), 0)
  }, [data.entries])

  const level = Math.floor(totalXP / 100) + 1
  const xpInCurrentLevel = totalXP % 100
  const xpToNextLevel = 100 - xpInCurrentLevel
  const streak = calculateCurrentStreak(data.entries)
  const weeklyXP = calculateWeeklyXP(data.entries)
  const goalsOverview = goalSummary(data.goals)
  const activeGoals = data.goals.filter((goal) => goal.status !== 'Completed')
  const completedGoals = data.goals.filter((goal) => goal.status === 'Completed')

  const updateData = (nextData) => {
    setData(nextData)
    saveData(nextData)
  }

  const updateTodayEntry = (updatedEntry) => {
    const normalized = normalizeEntry({ ...updatedEntry, date: selectedDate }, selectedDate)
    updateData({
      ...data,
      entries: {
        ...data.entries,
        [selectedDate]: normalized,
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

  const removeListItem = (field, indexToRemove) => {
    updateTodayEntry({
      ...todayEntry,
      [field]: todayEntry[field].filter((_, index) => index !== indexToRemove),
    })
  }

  const saveGoal = () => {
    if (!goalDraft.name.trim()) return
    if (goalDraft.targetProgress <= 0) return

    const normalizedDraft = { ...goalDraft, completedAt: goalDraft.status === 'Completed' ? (goalDraft.completedAt || selectedDate) : null }

    const nextGoals = isEditingGoal
      ? data.goals.map((goal) => (goal.id === normalizedDraft.id ? normalizedDraft : goal))
      : [...data.goals, normalizedDraft]

    updateData({ ...data, goals: nextGoals })
    setGoalDraft(createEmptyGoal())
    setIsEditingGoal(false)
  }

  const editGoal = (goal) => {
    setGoalDraft({ ...goal })
    setIsEditingGoal(true)
  }


  const completeGoal = (goalId) => {
    updateData({
      ...data,
      goals: data.goals.map((goal) => (
        goal.id === goalId
          ? { ...goal, status: 'Completed', currentProgress: goal.targetProgress, completedAt: selectedDate }
          : goal
      )),
    })
  }

  const restoreGoal = (goalId) => {
    updateData({
      ...data,
      goals: data.goals.map((goal) => (
        goal.id === goalId
          ? { ...goal, status: 'In progress', completedAt: null }
          : goal
      )),
    })
  }

  const deleteGoal = (goalId) => {
    updateData({
      ...data,
      goals: data.goals.filter((goal) => goal.id !== goalId),
    })

    if (goalDraft.id === goalId) {
      setGoalDraft(createEmptyGoal())
      setIsEditingGoal(false)
    }
  }


  const openHistoryModal = (date) => {
    const entry = data.entries[date]
    if (!entry) return
    const selected = { date, ...entry }
    setSelectedHistoryEntry(selected)
    setHistoryDraft({
      ...selected,
      achievementsText: Array.isArray(selected.achievements) ? selected.achievements.join('\n') : '',
      gratitudeText: Array.isArray(selected.gratitude) ? selected.gratitude.join('\n') : '',
      goalNotesText: Array.isArray(selected.goalNotes) ? selected.goalNotes.join('\n') : '',
    })
    setIsHistoryEditMode(false)
  }

  const closeHistoryModal = () => {
    setSelectedHistoryEntry(null)
    setHistoryDraft(null)
    setIsHistoryEditMode(false)
  }

  const toList = (text) => {
    const input = (text || '').trim()
    if (!input) return []
    const source = input.includes('\n') ? input.split('\n') : input.split(',')
    return source.map((item) => item.trim()).filter(Boolean)
  }

  const saveHistoryEdit = () => {
    if (!historyDraft) return
    const updatedEntry = normalizeEntry({
      ...historyDraft,
      achievements: toList(historyDraft.achievementsText),
      gratitude: toList(historyDraft.gratitudeText),
      goalNotes: toList(historyDraft.goalNotesText),
      mood: Number(historyDraft.mood) || 5,
      energy: Number(historyDraft.energy) || 5,
      lesson: historyDraft.lesson || '',
    }, historyDraft.date)

    const nextData = {
      ...data,
      entries: {
        ...data.entries,
        [historyDraft.date]: updatedEntry,
      },
    }
    updateData(nextData)
    setSelectedHistoryEntry({ date: historyDraft.date, ...updatedEntry })
    setHistoryDraft({
      ...historyDraft,
      ...updatedEntry,
      achievementsText: updatedEntry.achievements.join('\n'),
      gratitudeText: updatedEntry.gratitude.join('\n'),
      goalNotesText: updatedEntry.goalNotes.join('\n'),
    })
    setIsHistoryEditMode(false)
  }

  const achievementBullets = (entry) => {
    const text = Array.isArray(entry?.achievements) ? entry.achievements.join('\n') : (entry?.achievements || '')
    return toList(text)
  }

  const plannedTasksForDate = (date) => data.dailyPlans?.[date] || []

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") setSelectedHistoryEntry(null)
    }

    if (!selectedHistoryEntry) return undefined
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [selectedHistoryEntry])

  return (    <div className="min-h-screen bg-slate-50 p-6 text-slate-800">
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
              <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">1. Today Entry ({selectedDate})</h2><input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-sm" /></div>
              <div className="mt-4 space-y-4">
                <EntryInput label="Achievements" value={achievementInput} setValue={setAchievementInput} onAdd={() => addListItem('achievements', achievementInput, setAchievementInput)} onRemove={(index) => removeListItem('achievements', index)} items={todayEntry.achievements} xpText="+10 XP each" />
                <EntryInput label="Gratitude" value={gratitudeInput} setValue={setGratitudeInput} onAdd={() => addListItem('gratitude', gratitudeInput, setGratitudeInput)} onRemove={(index) => removeListItem('gratitude', index)} items={todayEntry.gratitude} xpText="+5 XP each" />
                <EntryInput label="Goal Progress Notes" value={goalNoteInput} setValue={setGoalNoteInput} onAdd={() => addListItem('goalNotes', goalNoteInput, setGoalNoteInput)} onRemove={(index) => removeListItem('goalNotes', index)} items={todayEntry.goalNotes} xpText="+15 XP each" />
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
              <h2 className="text-xl font-semibold">Daily Plan</h2>
              <p className="mt-1 text-sm text-slate-600">Plan tasks and intentions for {selectedDate}.</p>
              <div className="mt-3 space-y-2">
                <input
                  value={planTaskInput}
                  onChange={(e) => setPlanTaskInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2"
                  placeholder="Add a task or activity"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input value={planCategoryInput} onChange={(e) => setPlanCategoryInput(e.target.value)} className="rounded-lg border border-slate-300 p-2" placeholder="Category" />
                  <input type="number" min="0" value={planXpInput} onChange={(e) => setPlanXpInput(e.target.value)} className="rounded-lg border border-slate-300 p-2" placeholder="XP" />
                  <button onClick={addPlanTask} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Add task</button>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-600">Completed plan XP: {dailyPlanCompletedXP} / {dailyPlanTotalXP} XP</p>

              <div className="mt-4 space-y-2">
                {planForSelectedDate.map((task) => (
                  <div key={task.id} className={`flex items-center gap-2 rounded-lg border border-slate-200 p-2 ${task.completed ? 'opacity-60' : ''}`}>
                    <input type="checkbox" checked={task.completed} onChange={() => togglePlanTask(task.id)} className="h-4 w-4" />
                    <div className="w-full space-y-1">
                      <input
                        value={task.text}
                        onChange={(e) => updatePlanTask(task.id, { text: e.target.value })}
                        className={`w-full rounded border border-slate-300 p-1 ${task.completed ? 'line-through' : ''}`}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={task.category || 'General'} onChange={(e) => updatePlanTask(task.id, { category: e.target.value })} className="rounded border border-slate-300 p-1 text-sm" />
                        <input type="number" min="0" value={Number(task.xp) >= 0 ? task.xp : 10} onChange={(e) => updatePlanTask(task.id, { xp: Math.max(0, Number(e.target.value) || 0) })} className="rounded border border-slate-300 p-1 text-sm" />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-indigo-600">{Number(task.xp) >= 0 ? task.xp : 10} XP</span>
                    <button onClick={() => deletePlanTask(task.id)} className="rounded bg-rose-100 px-2 py-1 text-rose-700">Delete</button>
                  </div>
                ))}
                {planForSelectedDate.length === 0 && <p className="text-sm text-slate-500">No tasks planned yet.</p>}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">2. Goals</h2>
              <p className="mt-2 text-sm text-slate-600">Create, edit, and update goals directly from your dashboard.</p>

              <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
                <h3 className="font-semibold">{isEditingGoal ? 'Edit Goal' : 'Create Goal'}</h3>
                <input className="w-full rounded-lg border border-slate-300 p-2" placeholder="Name" value={goalDraft.name} onChange={(e) => setGoalDraft({ ...goalDraft, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" className="w-full rounded-lg border border-slate-300 p-2" placeholder="Current progress" value={goalDraft.currentProgress} onChange={(e) => setGoalDraft({ ...goalDraft, currentProgress: Number(e.target.value) })} />
                  <input type="number" className="w-full rounded-lg border border-slate-300 p-2" placeholder="Target" value={goalDraft.targetProgress} onChange={(e) => setGoalDraft({ ...goalDraft, targetProgress: Number(e.target.value) })} />
                </div>
                <select className="w-full rounded-lg border border-slate-300 p-2" value={goalDraft.status} onChange={(e) => setGoalDraft({ ...goalDraft, status: e.target.value, completedAt: e.target.value === 'Completed' ? selectedDate : null })}>
                  <option>Not started</option>
                  <option>In progress</option>
                  <option>Completed</option>
                  <option>Paused</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={saveGoal} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">{isEditingGoal ? 'Save Changes' : 'Add Goal'}</button>
                  {isEditingGoal && <button onClick={() => { setGoalDraft(createEmptyGoal()); setIsEditingGoal(false) }} className="rounded-lg bg-slate-200 px-4 py-2">Cancel</button>}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {activeGoals.map((goal) => {
                  const percent = goal.targetProgress > 0 ? Math.min(100, Math.round((goal.currentProgress / goal.targetProgress) * 100)) : 0
                  const isEditing = dashboardEditingGoalId === goal.id
                  return (
                    <div key={goal.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-full">
                          {isEditing ? (
                            <input className="w-full rounded border border-slate-300 p-1" value={goalDraft.name} onChange={(e) => setGoalDraft({ ...goalDraft, name: e.target.value })} />
                          ) : (
                            <p className="font-semibold">{goal.name}</p>
                          )}
                          <p className="text-slate-600">{goal.currentProgress}/{goal.targetProgress} • {goal.status}</p>
                        </div>
                        <div className="flex gap-2">
                          {isEditing ? (
                            <button onClick={() => { saveGoal(); setDashboardEditingGoalId(null) }} className="rounded bg-indigo-600 px-2 py-1 text-white">Save</button>
                          ) : (
                            <button onClick={() => { editGoal(goal); setDashboardEditingGoalId(goal.id) }} className="rounded bg-slate-100 px-2 py-1">Edit</button>
                          )}
                          {goal.status !== 'Completed' ? (
                            <button onClick={() => completeGoal(goal.id)} className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">Complete</button>
                          ) : (
                            <button disabled className="rounded bg-emerald-50 px-2 py-1 text-emerald-400">Completed</button>
                          )}
                          <button onClick={() => deleteGoal(goal.id)} className="rounded bg-rose-100 px-2 py-1 text-rose-700">Delete</button>
                        </div>
                      </div>
                      <ProgressBar percent={percent} />
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <input type="number" className="w-full rounded border border-slate-300 p-1" value={isEditing ? goalDraft.currentProgress : goal.currentProgress} onChange={(e) => isEditing ? setGoalDraft({ ...goalDraft, currentProgress: Number(e.target.value) }) : updateData({ ...data, goals: data.goals.map((g) => g.id === goal.id ? { ...g, currentProgress: Number(e.target.value) } : g) })} />
                        <input type="number" className="w-full rounded border border-slate-300 p-1" value={isEditing ? goalDraft.targetProgress : goal.targetProgress} onChange={(e) => isEditing ? setGoalDraft({ ...goalDraft, targetProgress: Number(e.target.value) }) : updateData({ ...data, goals: data.goals.map((g) => g.id === goal.id ? { ...g, targetProgress: Number(e.target.value) } : g) })} />
                        <select className="w-full rounded border border-slate-300 p-1" value={isEditing ? goalDraft.status : goal.status} onChange={(e) => isEditing ? setGoalDraft({ ...goalDraft, status: e.target.value, completedAt: e.target.value === 'Completed' ? selectedDate : null }) : updateData({ ...data, goals: data.goals.map((g) => g.id === goal.id ? { ...g, status: e.target.value, completedAt: e.target.value === 'Completed' ? selectedDate : null } : g) })}>
                          <option>Not started</option><option>In progress</option><option>Completed</option><option>Paused</option>
                        </select>
                      </div>
                    </div>
                  )
                })}
                {activeGoals.length === 0 && <p className="text-slate-500">No active goals. Complete archive below.</p>}              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Completed Goals Archive</h2>
              <div className="mt-4 space-y-3">
                {completedGoals.map((goal) => (
                  <div key={goal.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-semibold">{goal.name}</p>
                    <p className="text-slate-600">{goal.currentProgress}/{goal.targetProgress} • {goal.status}</p>
                    <p className="text-slate-500">Completed: {goal.completedAt || 'Unknown'}</p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => restoreGoal(goal.id)} className="rounded bg-slate-200 px-2 py-1">Restore</button>
                      <button onClick={() => deleteGoal(goal.id)} className="rounded bg-rose-100 px-2 py-1 text-rose-700">Delete</button>
                    </div>
                  </div>
                ))}
                {completedGoals.length === 0 && <p className="text-slate-500">No completed goals yet.</p>}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">3. Progress Dashboard</h2>
              <div className="mt-4 grid gap-3 text-sm">
                <DashboardCard title="Total XP" value={`${totalXP} XP`} />
                <DashboardCard title="Current Level" value={`Level ${level}`} />
                <DashboardCard title="XP Needed for Next Level" value={`${xpToNextLevel} XP`}>
                  <ProgressBar percent={xpInCurrentLevel} />
                </DashboardCard>
                <DashboardCard title="Current Daily Logging Streak" value={`${streak} day(s)`} />
                <DashboardCard title="Weekly XP Total" value={`${weeklyXP} XP`} />
                <DashboardCard title="Goal Progress Summary" value={`${goalsOverview.completed}/${goalsOverview.total} completed`}>
                  <ProgressBar percent={goalsOverview.avg} />
                </DashboardCard>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold">4. History</h2>
              <div className="mt-3 flex gap-2">
                <input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-sm" />
              </div>
              <div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm">
                {data.entries[historyDate] ? (
                  <button
                    type="button"
                    onClick={() => openHistoryModal(historyDate)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHistoryModal(historyDate) } }}
                    className="w-full rounded-lg border border-transparent p-2 text-left transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                  >
                    <p className="font-semibold">{historyDate} • XP: {data.entries[historyDate].xpEarned}</p>
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Achievements preview</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
                        {(data.entries[historyDate].achievements.length ? data.entries[historyDate].achievements.slice(0, 2) : ['Not provided']).map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="mt-2"><span className="font-medium">Lesson preview:</span> {data.entries[historyDate].lesson || 'Not provided'}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">View details →</p>
                  </button>
                ) : <p className="text-slate-500">No saved entry for this date.</p>}
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
                  <input type="number" className="w-full rounded-lg border border-slate-300 p-2" placeholder="Current progress" value={goalDraft.currentProgress} onChange={(e) => setGoalDraft({ ...goalDraft, currentProgress: Number(e.target.value) })} />
                  <input type="number" className="w-full rounded-lg border border-slate-300 p-2" placeholder="Target" value={goalDraft.targetProgress} onChange={(e) => setGoalDraft({ ...goalDraft, targetProgress: Number(e.target.value) })} />
                </div>
                <select className="w-full rounded-lg border border-slate-300 p-2" value={goalDraft.status} onChange={(e) => setGoalDraft({ ...goalDraft, status: e.target.value, completedAt: e.target.value === 'Completed' ? selectedDate : null })}>
                  <option>Not started</option>
                  <option>In progress</option>
                  <option>Completed</option>
                  <option>Paused</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={saveGoal} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">{isEditingGoal ? 'Save Changes' : 'Add Goal'}</button>
                  {isEditingGoal && <button onClick={() => { setGoalDraft(createEmptyGoal()); setIsEditingGoal(false) }} className="rounded-lg bg-slate-200 px-4 py-2">Cancel</button>}
                </div>
              </div>

              <div className="space-y-4">
                {activeGoals.map((goal) => {
                  const percent = goal.targetProgress > 0 ? Math.min(100, Math.round((goal.currentProgress / goal.targetProgress) * 100)) : 0
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
                      <p className="mt-1 text-sm">{goal.currentProgress} / {goal.targetProgress} ({percent}%)</p>
                    </div>
                  )
                })}
                {data.goals.length === 0 && <p className="text-slate-500">No goals yet. Create your first goal.</p>}
              </div>
            </div>
          </section>
        )}

        {selectedHistoryEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={closeHistoryModal}>
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h3 className="text-xl font-semibold">Daily History Details</h3>
                  <p className="mt-1 text-sm text-slate-600">{selectedHistoryEntry.date}</p>
                </div>
                <button type="button" onClick={closeHistoryModal} className="rounded-md bg-slate-100 px-3 py-1 text-sm">Close</button>
              </div>

              <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">XP Earned</p>
                    <p className="text-xl font-bold text-indigo-700">{selectedHistoryEntry.xpEarned ?? 0}</p>
                  </div>
                  {!isHistoryEditMode ? (
                    <button type="button" onClick={() => setIsHistoryEditMode(true)} className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-semibold text-white">Edit</button>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" onClick={saveHistoryEdit} className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-semibold text-white">Save</button>
                      <button type="button" onClick={() => { setIsHistoryEditMode(false); setHistoryDraft({ ...selectedHistoryEntry, achievementsText: selectedHistoryEntry.achievements.join('\n'), gratitudeText: selectedHistoryEntry.gratitude.join('\n'), goalNotesText: selectedHistoryEntry.goalNotes.join('\n') }) }} className="rounded-md bg-slate-100 px-3 py-1 text-sm">Cancel</button>
                    </div>
                  )}
                </div>

                {isHistoryEditMode ? (
                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="mb-1 block font-semibold">Achievements</label>
                      <textarea rows={4} value={historyDraft?.achievementsText || ''} onChange={(e) => setHistoryDraft({ ...historyDraft, achievementsText: e.target.value })} className="w-full rounded-lg border border-slate-300 p-2" />
                      <p className="mt-1 text-xs text-slate-500">Write each achievement on a new line.</p>
                    </div>
                    <FormTextArea label="Gratitude" value={historyDraft?.gratitudeText || ''} onChange={(value) => setHistoryDraft({ ...historyDraft, gratitudeText: value })} />
                    <FormTextArea label="Goal Notes" value={historyDraft?.goalNotesText || ''} onChange={(value) => setHistoryDraft({ ...historyDraft, goalNotesText: value })} />
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput label="Mood" type="number" value={historyDraft?.mood ?? ''} onChange={(value) => setHistoryDraft({ ...historyDraft, mood: value })} />
                      <FormInput label="Energy" type="number" value={historyDraft?.energy ?? ''} onChange={(value) => setHistoryDraft({ ...historyDraft, energy: value })} />
                    </div>
                    <FormTextArea label="Lesson" value={historyDraft?.lesson || ''} onChange={(value) => setHistoryDraft({ ...historyDraft, lesson: value })} />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <ScoreCard title="Mood" value={selectedHistoryEntry.mood} />
                      <ScoreCard title="Energy" value={selectedHistoryEntry.energy} />
                    </div>
                    <BulletSection title="Achievements" items={achievementBullets(selectedHistoryEntry)} />
                    <ModalSection title="Gratitude" value={selectedHistoryEntry.gratitude} />
                    <ModalSection title="Goal Notes" value={selectedHistoryEntry.goalNotes} />
                    <ModalSection title="Lesson" value={selectedHistoryEntry.lesson} />
                    <TaskPreviewSection title="Planned Tasks" tasks={plannedTasksForDate(selectedHistoryEntry.date)} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function EntryInput({ label, value, setValue, onAdd, onRemove, items, xpText }) { return <div><label className="mb-1 block font-medium">{label} ({xpText})</label><div className="flex gap-2"><input value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" placeholder={`Add ${label.toLowerCase()}`} /><button onClick={onAdd} className="rounded-lg bg-slate-800 px-3 py-2 text-white">Add</button></div><ul className="mt-2 space-y-1 pl-1 text-sm">{items.map((item, index) => <li key={index} className="flex items-center justify-between rounded bg-slate-100 px-2 py-1"><span>{item}</span><button onClick={() => onRemove(index)} className="rounded bg-rose-100 px-2 py-0.5 text-rose-700">X</button></li>)}</ul></div> }
function ScoreInput({ label, value, onChange }) { return <div><label className="mb-1 block font-medium">{label} (1-10)</label><input type="range" min="1" max="10" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" /><p className="text-center text-sm">{value}</p></div> }
function Stat({ label, value }) { return <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2"><span>{label}</span><span className="font-semibold">{value}</span></div> }
function DashboardCard({ title, value, children }) { return <div className="rounded-lg bg-slate-100 p-3"><p className="text-slate-600">{title}</p><p className="font-semibold">{value}</p>{children}</div> }
function ProgressBar({ percent }) { return <div className="mt-2 h-2 w-full rounded-full bg-slate-200"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div> }
function sumCount(entries, field) { return Object.values(entries).reduce((sum, entry) => sum + entry[field].length, 0) }
function averageScore(entries, field) { const values = Object.values(entries).map((entry) => entry[field]).filter(Boolean); if (!values.length) return '-'; return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) }

function ScoreCard({ title, value }) {
  const displayValue = value === 0 || value ? value : 'Not provided'
  return <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-1 text-lg font-semibold">{displayValue}</p></div>
}

function ModalSection({ title, value }) {
  const displayValue = Array.isArray(value) ? (value.length ? value.join(', ') : 'Not provided') : (value ? value : 'Not provided')
  return <div className="rounded-lg bg-slate-50 p-3"><p className="font-semibold">{title}</p><p className="text-slate-700">{displayValue}</p></div>
}


function FormTextArea({ label, value, onChange }) {
  return <div><label className="mb-1 block font-semibold">{label}</label><textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" /></div>
}

function FormInput({ label, value, onChange, type = 'text' }) {
  return <div><label className="mb-1 block font-semibold">{label}</label><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" /></div>
}

function BulletSection({ title, items }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="font-semibold">{title}</p>{items.length ? <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="text-slate-700">Not provided</p>}</div>
}


function TaskPreviewSection({ title, tasks }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="font-semibold">{title}</p>
      {tasks.length ? (
        <ul className="mt-2 space-y-1">
          {tasks.map((task) => (
            <li key={task.id} className={`flex items-center gap-2 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
              <input type="checkbox" checked={task.completed} readOnly className="h-4 w-4" />
              <span>{task.text} <span className="text-xs text-slate-500">({task.category || 'General'} • {Number(task.xp) >= 0 ? task.xp : 10} XP)</span></span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-700">No tasks planned.</p>
      )}
    </div>
  )
}

export default App
