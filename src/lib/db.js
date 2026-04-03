const DB_NAME = 'munda'
const DB_VERSION = 4

const STORES = {
  profile: 'profile',
  journal: 'journal',
  cache: 'cache',
}

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORES.profile)) {
        db.createObjectStore(STORES.profile, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.journal)) {
        const journal = db.createObjectStore(STORES.journal, { keyPath: 'id', autoIncrement: true })
        journal.createIndex('date', 'date')
        journal.createIndex('type', 'type')
        journal.createIndex('season', 'season')
      }
      if (!db.objectStoreNames.contains('plan')) {
        const plan = db.createObjectStore('plan', { keyPath: 'id', autoIncrement: true })
        plan.createIndex('month', 'month')
        plan.createIndex('done', 'done')
      }
      if (!db.objectStoreNames.contains(STORES.cache)) {
        const cache = db.createObjectStore(STORES.cache, { keyPath: 'key' })
        cache.createIndex('expires', 'expires')
      }
      if (!db.objectStoreNames.contains('chatMessages')) {
        db.createObjectStore('chatMessages', { keyPath: 'id' })
      }
    }
  })
}

function tx(storeName, mode = 'readonly') {
  return open().then((db) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    return { store, transaction, db }
  })
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Profile
export async function getProfile() {
  const { store } = await tx(STORES.profile)
  return reqToPromise(store.get('farmer'))
}

export async function saveProfile(data) {
  const { store } = await tx(STORES.profile, 'readwrite')
  return reqToPromise(store.put({ id: 'farmer', ...data, updatedAt: Date.now() }))
}

// Journal
export async function addJournalEntry(entry) {
  const { store } = await tx(STORES.journal, 'readwrite')
  return reqToPromise(store.add({ ...entry, createdAt: Date.now() }))
}

export async function getJournalEntries() {
  const { store } = await tx(STORES.journal)
  return reqToPromise(store.getAll())
}

export async function deleteJournalEntry(id) {
  const { store } = await tx(STORES.journal, 'readwrite')
  return reqToPromise(store.delete(id))
}

// Plan entries
export async function addPlanEntry(entry) {
  const { store } = await tx('plan', 'readwrite')
  return reqToPromise(store.add({ ...entry, done: false, createdAt: Date.now() }))
}

export async function getPlanEntries() {
  const { store } = await tx('plan')
  return reqToPromise(store.getAll())
}

export async function togglePlanEntry(id, done) {
  const { store } = await tx('plan', 'readwrite')
  const entry = await reqToPromise(store.get(id))
  if (entry) {
    entry.done = done
    return reqToPromise(store.put(entry))
  }
}

export async function deletePlanEntry(id) {
  const { store } = await tx('plan', 'readwrite')
  return reqToPromise(store.delete(id))
}

export async function clearPlan() {
  const { store } = await tx('plan', 'readwrite')
  return reqToPromise(store.clear())
}

// Chat messages
export async function saveChatMessages(messages) {
  const { store } = await tx('chatMessages', 'readwrite')
  return reqToPromise(store.put({ id: 'session', messages }))
}

export async function getChatMessages() {
  const { store } = await tx('chatMessages')
  const record = await reqToPromise(store.get('session'))
  return record ? record.messages : []
}

// Cache (for API responses)
export async function getCached(key) {
  const { store } = await tx(STORES.cache)
  const entry = await reqToPromise(store.get(key))
  if (!entry) return null
  if (entry.expires && entry.expires < Date.now()) {
    const { store: writeStore } = await tx(STORES.cache, 'readwrite')
    writeStore.delete(key)
    return null
  }
  return entry.data
}

export async function setCache(key, data, ttlMs = 7 * 24 * 60 * 60 * 1000) {
  const { store } = await tx(STORES.cache, 'readwrite')
  return reqToPromise(store.put({
    key,
    data,
    expires: Date.now() + ttlMs,
    cachedAt: Date.now(),
  }))
}
