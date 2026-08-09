import { supabase } from './supabase'

export async function getDailyQuestion() {
  const { data, error } = await supabase.rpc('get_daily_question')
  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return {
    questionId: row.question_id,
    questionText: row.question_text,
    alreadyAnswered: row.already_answered,
    dismissedToday: row.dismissed_today,
    enabled: row.enabled,
  }
}

export async function answerDailyQuestion(text) {
  const { error } = await supabase.rpc('answer_daily_question', { p_text: text })
  if (error) throw error
}

export async function dismissDailyQuestion(permanent = false) {
  const { error } = await supabase.rpc('dismiss_daily_question', { p_permanent: permanent })
  if (error) throw error
}

export async function syncQuestionReveals() {
  const { error } = await supabase.rpc('sync_question_reveals')
  if (error) throw error
}

export async function getPendingQuestion(chatId) {
  if (!chatId) return null
  const cleanId = String(chatId).split('---')[0]
  const { data, error } = await supabase.rpc('get_pending_question_for_chat', { p_chat_id: cleanId })
  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return {
    id: row.id,
    chatId: row.chat_id,
    askerId: row.asker_id,
    askerName: row.asker_name,
    askerAvatar: row.asker_avatar || '',
    recipientId: row.recipient_id,
    recipientName: row.recipient_name,
    recipientAvatar: row.recipient_avatar || '',
    questionText: row.question_text,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

export async function askSpontaneousQuestion({ chatId, question, myAnswer }) {
  const cleanId = String(chatId).split('---')[0]
  const { data, error } = await supabase.rpc('ask_spontaneous_question', {
    p_chat_id: cleanId,
    p_question: question,
    p_my_answer: myAnswer,
  })
  if (error) throw error
  return data
}

export async function answerSpontaneousQuestion({ id, text }) {
  const { error } = await supabase.rpc('answer_spontaneous_question', {
    p_id: id,
    p_text: text,
  })
  if (error) throw error
}

export async function cancelSpontaneousQuestion(id) {
  const { error } = await supabase.rpc('cancel_spontaneous_question', { p_id: id })
  if (error) throw error
}
