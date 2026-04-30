import { supabase } from './supabase'

// ---------- shape mappers ----------

function mapCircleRow(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    city: row.city,
    type: row.type,
    category: row.category,
    interestTag: row.interest_tag,
    memberCount: row.member_count,
    coverGradient: row.cover_gradient,
    coverImageUrl: row.cover_image_url || '',
    description: row.description,
    vibe: row.vibe,
    rules: row.rules || [],
    organizerId: row.organizer_id,
    createdAt: row.created_at,
    // populated by getCircle when joined queries succeed
    members: [],
    hoops: [],
    events: [],
  }
}

function mapHoopRow(row) {
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    options: row.options,
    order: row.order_index,
  }
}

function mapMemberRow(row) {
  // row shape: { user_id, role, profiles: { id, name, avatar_url } }
  const p = row.profiles || {}
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar_url || '',
    role: row.role,
  }
}

// ---------- reads ----------

export async function listCircles() {
  const { data, error } = await supabase
    .from('circles')
    .select('*')
    .order('member_count', { ascending: false })
  if (error) throw error
  return (data || []).map(mapCircleRow)
}

export async function listMyCircleIds(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('circle_members')
    .select('circle_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data || []).map(r => r.circle_id)
}

export async function listCirclesForUser(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('circle_members')
    .select('circles ( * )')
    .eq('user_id', userId)
  if (error) throw error
  return (data || []).map(r => r.circles).filter(Boolean).map(mapCircleRow)
}

export async function listJoinedCircleMembers(userId) {
  if (!userId) return {}
  const { data: mine, error: mineErr } = await supabase
    .from('circle_members')
    .select('circle_id')
    .eq('user_id', userId)
  if (mineErr) throw mineErr
  const circleIds = (mine || []).map((r) => r.circle_id).filter(Boolean)
  if (circleIds.length === 0) return {}

  const { data, error } = await supabase
    .from('circle_members')
    .select('circle_id, user_id, profiles(id, name, avatar_url)')
    .in('circle_id', circleIds)
  if (error) throw error

  const byCircle = {}
  for (const row of data || []) {
    const p = row.profiles || {}
    if (!p.id) continue
    if (!byCircle[row.circle_id]) byCircle[row.circle_id] = []
    byCircle[row.circle_id].push({
      id: p.id,
      name: p.name,
      avatar: p.avatar_url || '',
    })
  }
  return byCircle
}

export async function getCircle(circleId) {
  if (!circleId) return null
  const [circleRes, hoopsRes, membersRes] = await Promise.all([
    supabase.from('circles').select('*').eq('id', circleId).maybeSingle(),
    supabase.from('hoops').select('*').eq('circle_id', circleId).order('order_index'),
    supabase.from('circle_members').select('user_id, role, profiles(id, name, avatar_url)').eq('circle_id', circleId),
  ])
  if (circleRes.error) throw circleRes.error
  if (hoopsRes.error) throw hoopsRes.error
  if (membersRes.error) throw membersRes.error
  if (!circleRes.data) return null

  const circle = mapCircleRow(circleRes.data)
  circle.hoops = (hoopsRes.data || []).map(mapHoopRow)
  circle.members = (membersRes.data || []).map(mapMemberRow)

  // resolve organizer from members if present
  if (circle.organizerId) {
    const org = circle.members.find(m => m.id === circle.organizerId)
    if (org) circle.organizer = { name: org.name, avatar: org.avatar, role: 'Organizer' }
  }
  return circle
}

// ---------- writes ----------

export async function createCircle({ userId, name, emoji, city, type, category, interestTag, coverGradient, coverImageUrl, description, vibe, rules }) {
  const { data, error } = await supabase
    .from('circles')
    .insert({
      name, emoji, city, type, category,
      interest_tag: interestTag,
      cover_gradient: coverGradient,
      cover_image_url: coverImageUrl || null,
      description, vibe, rules: rules || [],
      organizer_id: userId,
      member_count: 0,
    })
    .select()
    .single()
  if (error) throw error
  return mapCircleRow(data)
}

export async function createHoopsForCircle(circleId, hoops) {
  const validHoops = (hoops || []).filter(h => h && (h.type === 'written' || h.type === 'multiplechoice'))
  if (!circleId || validHoops.length === 0) return []
  const rows = validHoops.map((h, index) => ({
    circle_id: circleId,
    type: h.type,
    prompt: h.prompt || '',
    options: h.type === 'multiplechoice' ? (h.options || []).filter(Boolean) : null,
    order_index: Number.isFinite(h.order) ? h.order : index,
  }))
  const { data, error } = await supabase.from('hoops').insert(rows).select('*').order('order_index')
  if (error) throw error
  return (data || []).map(mapHoopRow)
}

export async function updateCircle(circleId, patch) {
  const dbPatch = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.emoji !== undefined) dbPatch.emoji = patch.emoji
  if (patch.city !== undefined) dbPatch.city = patch.city
  if (patch.type !== undefined) dbPatch.type = patch.type
  if (patch.category !== undefined) dbPatch.category = patch.category
  if (patch.interestTag !== undefined) dbPatch.interest_tag = patch.interestTag
  if (patch.coverGradient !== undefined) dbPatch.cover_gradient = patch.coverGradient
  if (patch.coverImageUrl !== undefined) dbPatch.cover_image_url = patch.coverImageUrl
  if (patch.description !== undefined) dbPatch.description = patch.description
  if (patch.vibe !== undefined) dbPatch.vibe = patch.vibe
  if (patch.rules !== undefined) dbPatch.rules = patch.rules
  const { data, error } = await supabase.from('circles').update(dbPatch).eq('id', circleId).select().single()
  if (error) throw error
  return mapCircleRow(data)
}

export async function joinCircle({ userId, circleId }) {
  const { error } = await supabase
    .from('circle_members')
    .insert({ circle_id: circleId, user_id: userId, role: 'member' })
  if (error && error.code !== '23505') throw error // ignore unique-violation if already a member
}

export async function leaveCircle({ userId, circleId }) {
  const { error } = await supabase
    .from('circle_members')
    .delete()
    .eq('circle_id', circleId)
    .eq('user_id', userId)
  if (error) throw error
}

// ---------- applications / hoops ----------

export async function applyToCircle({ userId, circleId, answers }) {
  // answers: [{ hoopId, answer }]
  const { data: app, error: appErr } = await supabase
    .from('applications')
    .insert({ circle_id: circleId, applicant_id: userId, status: 'pending' })
    .select()
    .single()
  if (appErr) throw appErr

  if (answers && answers.length) {
    const rows = answers.map(a => ({
      application_id: app.id,
      hoop_id: a.hoopId,
      answer: a.answer == null ? null : String(a.answer),
    }))
    const { error: ansErr } = await supabase.from('application_answers').insert(rows)
    if (ansErr) throw ansErr
  }
  return app
}

export async function listApplicationsForCircle(circleId) {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id, circle_id, applicant_id, status, submitted_at, reviewed_at,
      profiles:applicant_id ( id, name, avatar_url ),
      application_answers (
        id, hoop_id, answer,
        hoops ( id, type, prompt )
      )
    `)
    .eq('circle_id', circleId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data || []).map(row => ({
    id: row.id,
    circleId: row.circle_id,
    applicantId: row.applicant_id,
    applicantName: row.profiles?.name || 'Unknown',
    applicantAvatar: row.profiles?.avatar_url || '',
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    responses: (row.application_answers || []).map(a => ({
      hoopId: a.hoop_id,
      type: a.hoops?.type,
      prompt: a.hoops?.prompt,
      response: a.answer,
    })),
  }))
}

export async function listMyApplications(userId) {
  const { data, error } = await supabase
    .from('applications')
    .select('id, circle_id, status, submitted_at')
    .eq('applicant_id', userId)
  if (error) throw error
  return data || []
}

export async function approveApplication(applicationId) {
  const { error } = await supabase.rpc('approve_application', { p_application_id: applicationId })
  if (error) throw error
}

export async function declineApplication(applicationId) {
  const { error } = await supabase.rpc('decline_application', { p_application_id: applicationId })
  if (error) throw error
}
