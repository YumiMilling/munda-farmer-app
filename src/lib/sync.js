import { supabase } from './supabase'

// Device ID — persistent per browser
function getDeviceId() {
  let id = localStorage.getItem('munda-device-id')
  if (!id) {
    id = 'dev-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    localStorage.setItem('munda-device-id', id)
  }
  return id
}

const SYNC_QUEUE_KEY = 'munda-sync-queue'

function getQueue() {
  try { return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]') }
  catch { return [] }
}

function setQueue(q) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(q))
}

// Queue an operation for sync when online
export function queueSync(table, operation, data) {
  const q = getQueue()
  q.push({ table, operation, data, queuedAt: new Date().toISOString() })
  setQueue(q)
  // Try to sync immediately if online
  if (navigator.onLine) processQueue()
}

// Process all queued operations
export async function processQueue() {
  const q = getQueue()
  if (q.length === 0) return

  const failed = []
  for (const item of q) {
    try {
      if (item.operation === 'upsert') {
        const { error } = await supabase.from(item.table).upsert(item.data)
        if (error) throw error
      } else if (item.operation === 'insert') {
        const { error } = await supabase.from(item.table).insert(item.data)
        if (error) throw error
      } else if (item.operation === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.data.id)
        if (error) throw error
      }
    } catch (e) {
      console.warn('Sync failed for', item.table, e.message)
      failed.push(item)
    }
  }
  setQueue(failed)
  return failed.length === 0
}

// Pull all data from Supabase (for initial load / refresh)
export async function pullAll() {
  const deviceId = getDeviceId()
  const results = { groups: null, hosts: null, observations: null }

  try {
    const { data: groups } = await supabase.from('ffs_groups').select('*').order('name')
    if (groups) results.groups = groups

    const { data: hosts } = await supabase.from('ffs_hosts').select('*').order('name')
    if (hosts) results.hosts = hosts

    const { data: obs } = await supabase.from('ffs_observations').select('*').order('date', { ascending: false })
    if (obs) results.observations = obs
  } catch (e) {
    console.warn('Pull failed:', e.message)
  }

  return results
}

// Push a new observation
export async function pushObservation(obs) {
  const deviceId = getDeviceId()
  const { data: { user } } = await supabase.auth.getUser()
  const row = {
    id: obs.id,
    device_id: deviceId,
    user_id: user?.id || null,
    facilitator_name: obs.facilitatorName || null,
    date: obs.date,
    group_id: obs.groupId || null,
    host_id: obs.hostId || null,
    meeting_type: obs.meetingType,
    practice: obs.practice,
    practice_other: obs.practiceOther || null,
    attendance: obs.attendance ? parseInt(obs.attendance) : null,
    location: obs.location || null,
    lat: obs.lat ? parseFloat(obs.lat) : null,
    lng: obs.lng ? parseFloat(obs.lng) : null,
    gps_acc: obs.gpsAcc ? parseInt(obs.gpsAcc) : null,
    variety: obs.variety || null,
    legume: obs.legume || null,
    planting_date: obs.plantingDate || null,
    plot_a_desc: obs.plotADesc || null,
    plot_b_desc: obs.plotBDesc || null,
    research_question: obs.researchQuestion || null,
    fieldwork: obs.fieldwork || null,
    crop_condition: obs.cropCondition || null,
    same_size: obs.sameSize || null,
    one_var: obs.oneVar || null,
    vis_diff: obs.visDiff || null,
    group_saw: obs.groupSaw || null,
    fac_saw: obs.facSaw || null,
    problems: obs.problems || null,
    yield_a: obs.yieldA ? parseFloat(obs.yieldA) : null,
    yield_b: obs.yieldB ? parseFloat(obs.yieldB) : null,
    leg_yield_a: obs.legYieldA ? parseFloat(obs.legYieldA) : null,
    leg_yield_b: obs.legYieldB ? parseFloat(obs.legYieldB) : null,
    price: obs.price ? parseFloat(obs.price) : null,
    leg_price: obs.legPrice ? parseFloat(obs.legPrice) : null,
    cost_a: obs.costA ? parseFloat(obs.costA) : null,
    cost_b: obs.costB ? parseFloat(obs.costB) : null,
    has_pests: obs.hasPests || false,
    pests: obs.pests || [],
    pest_other: obs.pestOther || null,
    has_diseases: obs.hasDiseases || false,
    diseases: obs.diseases || [],
    disease_other: obs.diseaseOther || null,
    has_sprayed: obs.hasSprayed || false,
    spray_product: obs.sprayProduct || null,
    spray_plot: obs.sprayPlot || null,
    has_fertiliser: obs.hasFertiliser || false,
    fert_type: obs.fertType || null,
    fert_plot: obs.fertPlot || null,
    weeding_done: obs.weedingDone || null,
    weeding_count: obs.weedingCount ? parseInt(obs.weedingCount) : null,
    weed_pressure: obs.weedPressure || null,
    drought_stress: obs.droughtStress || false,
    drought_plot: obs.droughtPlot || null,
    crop_vigour: obs.cropVigour || null,
    soil_moisture: obs.soilMoisture || null,
    germination: obs.germination || null,
    stover_burned: obs.stoverBurned || null,
    pigeon_pea_standing: obs.pigeonPeaStanding || null,
    next_season_discussed: obs.nextSeasonDiscussed || false,
  }

  if (navigator.onLine) {
    // Try direct push, fall back to queue
    supabase.from('ffs_observations').upsert(row).then(({ error }) => {
      if (error) {
        console.warn('Direct push failed, queuing:', error.message)
        queueSync('ffs_observations', 'upsert', row)
      }
    })
  } else {
    queueSync('ffs_observations', 'upsert', row)
  }
}

// Push a host farmer
export function pushHost(host, groupId) {
  const row = {
    id: host.id,
    group_id: groupId,
    name: host.name,
    practice: host.practice || '',
    year: host.year || '2026',
  }

  if (navigator.onLine) {
    supabase.from('ffs_hosts').upsert(row).then(({ error }) => {
      if (error) queueSync('ffs_hosts', 'upsert', row)
    })
  } else {
    queueSync('ffs_hosts', 'upsert', row)
  }
}

// Push group update
export function pushGroup(group) {
  const row = { id: group.id, name: group.name, area: group.area || '' }

  if (navigator.onLine) {
    supabase.from('ffs_groups').upsert(row).then(({ error }) => {
      if (error) queueSync('ffs_groups', 'upsert', row)
    })
  } else {
    queueSync('ffs_groups', 'upsert', row)
  }
}

// Delete a host
export function deleteHost(hostId) {
  if (navigator.onLine) {
    supabase.from('ffs_hosts').delete().eq('id', hostId).then(({ error }) => {
      if (error) queueSync('ffs_hosts', 'delete', { id: hostId })
    })
  } else {
    queueSync('ffs_hosts', 'delete', { id: hostId })
  }
}

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Back online — syncing queue...')
    processQueue()
  })
}
