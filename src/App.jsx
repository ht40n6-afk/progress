import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'life-gamification-tracker-v1'

const DEFAULT_TASK_CATEGORIES = ['Work', 'Health', 'Personal', 'Learning', 'Admin', 'Other']

const XP_RULES = {
  achievement: 10,
  gratitude: 5,
  goalNote: 15,
  lesson: 20,
}

const todayString = () => new Date().toISOString().split('T')[0]

const defaultState = {
  goals: [],
  entries: {},
  dailyPlans: {},
  rewards: [],
  taskCategories: DEFAULT_TASK_CATEGORIES,
}


function createEmptyEntry(date) {
  return {
    date,
    achievements: [],
    gratitude: [],
    goalNotes: [],
    badActions: [],
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
    badActions: Array.isArray(entry.badActions) ? entry.badActions : [],
    mood: Number(entry.mood) || 5,
    energy: Number(entry.energy) || 5,
    lesson: typeof entry.lesson === 'string' ? entry.lesson : '',
    xpEarned: Number(entry.xpEarned) || 0,
  }
  normalized.xpEarned = calculateEntryXP(normalized)
  return normalized
}


function ensureArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined).map((item) => String(item))
  if (typeof value === 'string') return value.trim() ? value.split(/\n|,/).map((item) => item.trim()).filter(Boolean) : []
  return []
}

function safeText(value, fallback = 'Not provided') {
  if (typeof value === 'string') return value.trim() || fallback
  if (value === null || value === undefined) return fallback
  return String(value)
}

function safeScore(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 'Not provided'
}

function taskXpValue(task) {
  return Number(task?.xp) >= 0 ? Number(task.xp) : 10
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


function normalizeReward(rawReward) {
  if (!rawReward || typeof rawReward !== 'object') return null
  return {
    id: rawReward.id || safeId(),
    title: typeof rawReward.title === 'string' ? rawReward.title : 'Untitled reward',
    description: typeof rawReward.description === 'string' ? rawReward.description : '',
    requiredLevel: Number(rawReward.requiredLevel) >= 1 ? Number(rawReward.requiredLevel) : 1,
    claimed: Boolean(rawReward.claimed),
    createdAt: rawReward.createdAt || new Date().toISOString(),
    claimedAt: rawReward.claimedAt || null,
    imageData: typeof rawReward.imageData === 'string' ? rawReward.imageData : null,
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
              category: task?.category && typeof task.category === 'string' ? task.category : 'Other',
              xp: Number(task?.xp) >= 0 ? Number(task.xp) : 10,
              createdAt: task?.createdAt || new Date().toISOString(),
            })).filter((task) => task.text.trim())
          : [],
      ]),
    )

    const normalizedTaskCategories = Array.isArray(parsed.taskCategories)
      ? Array.from(new Set(parsed.taskCategories.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim())))
      : DEFAULT_TASK_CATEGORIES
    const finalTaskCategories = normalizedTaskCategories.length ? (normalizedTaskCategories.includes('Other') ? normalizedTaskCategories : [...normalizedTaskCategories, 'Other']) : DEFAULT_TASK_CATEGORIES

    const normalizedRewards = Array.isArray(parsed.rewards)
      ? parsed.rewards.map(normalizeReward).filter(Boolean)
      : []

    return {
      goals: normalizedGoals,
      entries: normalizedEntries,
      dailyPlans: normalizedPlans,
      rewards: normalizedRewards,
      taskCategories: finalTaskCategories,
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
  const badActionXP = (entry.badActions || []).length * 10
  const lessonXP = entry.lesson.trim() ? XP_RULES.lesson : 0

  return achievementXP + gratitudeXP + goalNoteXP + lessonXP - badActionXP
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
  const [badActionInput, setBadActionInput] = useState('')
  const [planTaskInput, setPlanTaskInput] = useState('')
  const [planCategoryInput, setPlanCategoryInput] = useState('Other')
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [planXpInput, setPlanXpInput] = useState(10)

  const [dashboardEditingGoalId, setDashboardEditingGoalId] = useState(null)

  const today = todayString()
  const [selectedDate, setSelectedDate] = useState(today)
  const [historyDate, setHistoryDate] = useState(today)
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState(null)
  const [isHistoryEditMode, setIsHistoryEditMode] = useState(false)
  const [historyDraft, setHistoryDraft] = useState(null)
  const [rewardTitleInput, setRewardTitleInput] = useState('')
  const [rewardDescriptionInput, setRewardDescriptionInput] = useState('')
  const [rewardRequiredLevelInput, setRewardRequiredLevelInput] = useState(1)
  const [editingRewardId, setEditingRewardId] = useState(null)
  const [rewardImageData, setRewardImageData] = useState(null)
  const [removeRewardImage, setRemoveRewardImage] = useState(false)

  const todayEntry = data.entries[selectedDate] || createEmptyEntry(selectedDate)


  const planForSelectedDate = data.dailyPlans?.[selectedDate] || []
  const categoryOptions = (Array.isArray(data.taskCategories) && data.taskCategories.length ? data.taskCategories : DEFAULT_TASK_CATEGORIES)

  const addPlanTask = () => {
    if (!planTaskInput.trim()) return
    const nextTask = {
      id: safeId(),
      text: planTaskInput.trim(),
      completed: false,
      category: categoryOptions.includes(planCategoryInput) ? planCategoryInput : 'Other',
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
          task.id === taskId ? { ...task, ...updates, category: categoryOptions.includes(updates.category ?? task.category) ? (updates.category ?? task.category) : 'Other' } : task,
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

  const addTaskCategory = () => {
    const next = (newCategoryInput || '').trim()
    if (!next) return
    if (categoryOptions.includes(next)) return
    updateData({ ...data, taskCategories: [...categoryOptions, next] })
    setNewCategoryInput('')
  }

  const renameTaskCategory = (oldName, newName) => {
    const next = (newName || '').trim()
    if (!next || oldName === 'Other') return
    const updatedCats = categoryOptions.map((c) => (c === oldName ? next : c))
    updateData({
      ...data,
      taskCategories: Array.from(new Set(updatedCats)),
      dailyPlans: Object.fromEntries(Object.entries(data.dailyPlans || {}).map(([date, tasks]) => [date, (tasks || []).map((t) => ({ ...t, category: t.category === oldName ? next : t.category }))])),
    })
  }

  const deleteTaskCategory = (name) => {
    if (categoryOptions.length <= 1 || name === 'Other') return
    const updatedCats = categoryOptions.filter((c) => c !== name)
    updateData({
      ...data,
      taskCategories: updatedCats.includes('Other') ? updatedCats : [...updatedCats, 'Other'],
      dailyPlans: Object.fromEntries(Object.entries(data.dailyPlans || {}).map(([date, tasks]) => [date, (tasks || []).map((t) => ({ ...t, category: t.category === name ? 'Other' : t.category }))])),
    })
  }

  const dailyPlanTotalXP = planForSelectedDate.reduce((sum, task) => sum + taskXpValue(task), 0)
  const dailyPlanCompletedXP = planForSelectedDate.filter((task) => task.completed).reduce((sum, task) => sum + taskXpValue(task), 0)

  const totalXP = useMemo(() => {
    const entryXP = Object.values(data.entries).reduce((sum, entry) => sum + calculateEntryXP(entry), 0)
    const planXP = Object.values(data.dailyPlans || {}).flat().filter((task) => task.completed).reduce((sum, task) => sum + taskXpValue(task), 0)
    return entryXP + planXP
  }, [data.entries, data.dailyPlans])

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
      achievementsText: ensureArray(selected.achievements).join('\n'),
      gratitudeText: ensureArray(selected.gratitude).join('\n'),
      goalNotesText: ensureArray(selected.goalNotes).join('\n'),
      badActionsText: ensureArray(selected.badActions).join('\n'),
    })
    setIsHistoryEditMode(false)
  }

  const closeHistoryModal = () => {
    setSelectedHistoryEntry(null)
    setHistoryDraft(null)
    setIsHistoryEditMode(false)
  }

  const toList = (text) => {
    const input = typeof text === 'string' ? text.trim() : ''
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
      badActions: toList(historyDraft.badActionsText),
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
      badActionsText: ensureArray(updatedEntry.badActions).join('\n'),
    })
    setIsHistoryEditMode(false)
  }

  const achievementBullets = (entry) => ensureArray(entry?.achievements)

  const plannedTasksForDate = (date) => {
    const tasks = data?.dailyPlans?.[date]
    return Array.isArray(tasks) ? tasks : []
  }


  const sortedRewards = [...(data.rewards || [])].sort((a, b) => {
    const aUnlocked = level >= a.requiredLevel && !a.claimed
    const bUnlocked = level >= b.requiredLevel && !b.claimed
    if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1
    return a.requiredLevel - b.requiredLevel
  })
  const unlockedRewardsCount = (data.rewards || []).filter((reward) => level >= reward.requiredLevel).length
  const availableRewards = sortedRewards.filter((reward) => !reward.claimed && level >= reward.requiredLevel)
  const lockedRewards = sortedRewards.filter((reward) => !reward.claimed && level < reward.requiredLevel)
  const claimedRewards = sortedRewards.filter((reward) => reward.claimed)


  const handleRewardImageChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      setRewardImageData(typeof reader.result === 'string' ? reader.result : null)
      setRemoveRewardImage(false)
    }
    reader.readAsDataURL(file)
  }

  const addOrUpdateReward = () => {
    if (!rewardTitleInput.trim()) return
    const payload = {
      id: editingRewardId || safeId(),
      title: rewardTitleInput.trim(),
      description: rewardDescriptionInput.trim(),
      requiredLevel: Math.max(1, Number(rewardRequiredLevelInput) || 1),
      claimed: false,
      createdAt: new Date().toISOString(),
      claimedAt: null,
      imageData: rewardImageData,
    }

    const existing = (data.rewards || []).find((r) => r.id === editingRewardId)
    const mergedImageData = removeRewardImage ? null : (rewardImageData ?? existing?.imageData ?? null)
    const merged = existing ? { ...existing, ...payload, imageData: mergedImageData, claimed: existing.claimed, claimedAt: existing.claimedAt, createdAt: existing.createdAt } : { ...payload, imageData: rewardImageData }
    const nextRewards = editingRewardId
      ? (data.rewards || []).map((reward) => (reward.id === editingRewardId ? merged : reward))
      : [...(data.rewards || []), merged]

    updateData({ ...data, rewards: nextRewards })
    setRewardTitleInput('')
    setRewardDescriptionInput('')
    setRewardRequiredLevelInput(1)
    setEditingRewardId(null)
    setRewardImageData(null)
    setRemoveRewardImage(false)
  }

  const startEditReward = (reward) => {
    setEditingRewardId(reward.id)
    setRewardTitleInput(reward.title)
    setRewardDescriptionInput(reward.description || '')
    setRewardRequiredLevelInput(reward.requiredLevel)
    setRewardImageData(reward.imageData || null)
    setRemoveRewardImage(false)
  }

  const claimReward = (rewardId) => {
    updateData({
      ...data,
      rewards: (data.rewards || []).map((reward) => reward.id === rewardId ? { ...reward, claimed: true, claimedAt: reward.claimedAt || new Date().toISOString() } : reward),
    })
  }

  const deleteReward = (rewardId) => {
    updateData({ ...data, rewards: (data.rewards || []).filter((reward) => reward.id !== rewardId) })
    if (editingRewardId === rewardId) {
      setEditingRewardId(null)
    setRewardImageData(null)
    setRemoveRewardImage(false)
      setRewardTitleInput('')
      setRewardDescriptionInput('')
      setRewardRequiredLevelInput(1)
      setRewardImageData(null)
      setRemoveRewardImage(false)
    }
  }

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
                <EntryInput label="Things I should not have done" value={badActionInput} setValue={setBadActionInput} onAdd={() => addListItem('badActions', badActionInput, setBadActionInput)} onRemove={(index) => removeListItem('badActions', index)} items={todayEntry.badActions || []} xpText="-10 XP each" />
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
                  <select value={planCategoryInput} onChange={(e) => setPlanCategoryInput(e.target.value)} className="rounded-lg border border-slate-300 p-2">{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select>
                  <input type="number" min="0" value={planXpInput} onChange={(e) => setPlanXpInput(e.target.value)} className="rounded-lg border border-slate-300 p-2" placeholder="XP" />
                  <button onClick={addPlanTask} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Add task</button>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold">Manage categories</p>
                <div className="mt-2 flex gap-2">
                  <input value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} className="w-full rounded border border-slate-300 p-1 text-sm" placeholder="New category" />
                  <button onClick={addTaskCategory} className="rounded bg-slate-800 px-2 py-1 text-sm text-white">Add</button>
                </div>
                <div className="mt-2 space-y-1">
                  {categoryOptions.map((category) => (
                    <CategoryRow key={category} category={category} canDelete={categoryOptions.length > 1 && category !== 'Other'} onRename={renameTaskCategory} onDelete={deleteTaskCategory} />
                  ))}
                </div>
              </div>

              <p className="mt-3 text-sm font-semibold text-slate-600">Completed plan XP: {dailyPlanCompletedXP} / {dailyPlanTotalXP} XP (included in Total XP)</p>

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
                        <select value={categoryOptions.includes(task.category) ? task.category : 'Other'} onChange={(e) => updatePlanTask(task.id, { category: e.target.value })} className="rounded border border-slate-300 p-1 text-sm">{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select>
                        <input type="number" min="0" value={Number(task.xp) >= 0 ? task.xp : 10} onChange={(e) => updatePlanTask(task.id, { xp: Math.max(0, Number(e.target.value) || 0) })} className="rounded border border-slate-300 p-1 text-sm" />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-indigo-600">{taskXpValue(task)} XP</span>
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
              <h2 className="text-xl font-semibold">Rewards</h2>
              <p className="mt-1 text-sm text-slate-600">Current Level: {level} · Rewards unlocked: {unlockedRewardsCount} / {(data.rewards || []).length}</p>
              <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-4">
                <input value={rewardTitleInput} onChange={(e) => setRewardTitleInput(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" placeholder="Reward title" />
                <textarea value={rewardDescriptionInput} onChange={(e) => setRewardDescriptionInput(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" rows={2} placeholder="Reward description" />
                <div className="grid gap-2 sm:grid-cols-3">
                  <input type="number" min="1" value={rewardRequiredLevelInput} onChange={(e) => setRewardRequiredLevelInput(e.target.value)} className="rounded-lg border border-slate-300 p-2" placeholder="Required level" />
                  <input type="file" accept="image/*" onChange={handleRewardImageChange} className="rounded-lg border border-slate-300 p-2 text-sm" />
                  <button onClick={addOrUpdateReward} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">{editingRewardId ? 'Save reward' : 'Add reward'}</button>
                </div>
                {rewardImageData && (
                  <div className="flex items-center gap-3">
                    <img src={rewardImageData} alt="Reward preview" className="h-16 w-24 rounded object-cover" />
                    <button onClick={() => { setRewardImageData(null); setRemoveRewardImage(true) }} className="rounded bg-rose-100 px-2 py-1 text-sm text-rose-700">Remove image</button>
                  </div>
                )}
                {editingRewardId && <button onClick={() => { setEditingRewardId(null); setRewardTitleInput(''); setRewardDescriptionInput(''); setRewardRequiredLevelInput(1); setRewardImageData(null); setRemoveRewardImage(false) }} className="rounded-lg bg-slate-200 px-4 py-2">Cancel</button>}
              </div>

              <RewardGroup title="Available to claim" rewards={availableRewards} level={level} onEdit={startEditReward} onClaim={claimReward} onDelete={deleteReward} />
              <RewardGroup title="Locked" rewards={lockedRewards} level={level} onEdit={startEditReward} onClaim={claimReward} onDelete={deleteReward} />
              <RewardGroup title="Claimed" rewards={claimedRewards} level={level} onEdit={startEditReward} onClaim={claimReward} onDelete={deleteReward} claimed />
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
                        {(ensureArray(data.entries[historyDate].achievements).length ? ensureArray(data.entries[historyDate].achievements).slice(0, 2) : ['Not provided']).map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="mt-2"><span className="font-medium">Lesson preview:</span> {safeText(data.entries[historyDate].lesson)}</p>
                    <p className="mt-1 text-xs text-rose-600">Bad actions: {(ensureArray(data.entries[historyDate].badActions).length ? ensureArray(data.entries[historyDate].badActions).slice(0, 2).join(', ') : 'Not provided')}</p>
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
                      <button type="button" onClick={() => { setIsHistoryEditMode(false); setHistoryDraft({ ...selectedHistoryEntry, achievementsText: ensureArray(selectedHistoryEntry.achievements).join('\n'), gratitudeText: ensureArray(selectedHistoryEntry.gratitude).join('\n'), goalNotesText: ensureArray(selectedHistoryEntry.goalNotes).join('\n'), badActionsText: ensureArray(selectedHistoryEntry.badActions).join('\n') }) }} className="rounded-md bg-slate-100 px-3 py-1 text-sm">Cancel</button>
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
                    <FormTextArea label="Things I should not have done" value={historyDraft?.badActionsText || ''} onChange={(value) => setHistoryDraft({ ...historyDraft, badActionsText: value })} />
                    <FormTextArea label="Lesson" value={historyDraft?.lesson || ''} onChange={(value) => setHistoryDraft({ ...historyDraft, lesson: value })} />
                  </div>
                ) : (
                  <>
                    <BulletSection title="Achievements" items={achievementBullets(selectedHistoryEntry)} />
                    <BulletSection title="Things I should not have done" items={ensureArray(selectedHistoryEntry.badActions)} />
                    <ModalSection title="Gratitude" value={ensureArray(selectedHistoryEntry.gratitude)} />
                    <ModalSection title="Goal Notes" value={ensureArray(selectedHistoryEntry.goalNotes)} />
                    <ModalSection title="Lesson" value={safeText(selectedHistoryEntry.lesson)} />
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
  const displayValue = Array.isArray(value) ? (value.length ? value.join(', ') : 'Not provided') : safeText(value)
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
  const safeTasks = Array.isArray(tasks) ? tasks : []
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="font-semibold">{title}</p>
      {safeTasks.length ? (
        <ul className="mt-2 space-y-1">
          {safeTasks.map((task) => (
            <li key={task.id} className={`flex items-center gap-2 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
              <input type="checkbox" checked={task.completed} readOnly className="h-4 w-4" />
              <span>{safeText(task?.text)} <span className="text-xs text-slate-500">({task.category || 'General'} • {taskXpValue(task)} XP)</span></span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-700">No tasks planned.</p>
      )}
    </div>
  )
}


function RewardGroup({ title, rewards, level, onEdit, onClaim, onDelete, claimed = false }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2 space-y-3">
        {rewards.map((reward) => {
          const unlocked = level >= reward.requiredLevel
          return (
            <div key={reward.id} className={`rounded-lg border border-slate-200 p-3 text-sm ${claimed ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {reward.imageData ? (
                    <img src={reward.imageData} alt={reward.title} className="mb-2 h-24 w-full max-w-xs rounded object-cover" />
                  ) : null}
                  <p className="font-semibold">{reward.title}</p>
                  <p className="text-slate-600">{safeText(reward.description)}</p>
                  <p className="mt-1 text-xs text-slate-500">Required level: {reward.requiredLevel}</p>
                  {!reward.claimed && !unlocked && <p className="text-xs text-slate-500">{reward.requiredLevel - level} level(s) needed</p>}
                  {reward.claimed && <p className="mt-1 inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Claimed{reward.claimedAt ? ` · ${new Date(reward.claimedAt).toLocaleDateString()}` : ''}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onEdit(reward)} className="rounded bg-slate-100 px-2 py-1">Edit</button>
                  {!reward.claimed && unlocked && <button onClick={() => onClaim(reward.id)} className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">Claim reward</button>}
                  <button onClick={() => onDelete(reward.id)} className="rounded bg-rose-100 px-2 py-1 text-rose-700">Delete</button>
                </div>
              </div>
            </div>
          )
        })}
        {rewards.length === 0 && <p className="text-slate-500">No rewards in this group.</p>}
      </div>
    </div>
  )
}


function CategoryRow({ category, canDelete, onRename, onDelete }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <input
        value={category}
        onChange={(e) => onRename(category, e.target.value)}
        disabled={category === 'Other'}
        className="w-full rounded border border-slate-300 p-1 disabled:bg-slate-100"
      />
      <button
        onClick={() => onDelete(category)}
        disabled={!canDelete}
        className="rounded bg-rose-100 px-2 py-1 text-rose-700 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  )
}

export default App
