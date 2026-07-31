import { supabase } from './supabase'

export async function createPoll({ chatId, channelId = null, question, options, allowMultiple = false }) {
  const { data, error } = await supabase.rpc('create_chat_poll', {
    p_chat_id: chatId,
    p_question: question,
    p_options: options,
    p_allow_multiple: allowMultiple,
    p_channel_id: channelId,
  })
  if (error) throw error
  return data
}

export async function fetchPoll(pollId) {
  const [pollRes, votesRes] = await Promise.all([
    supabase.from('polls').select('*').eq('id', pollId).maybeSingle(),
    supabase
      .from('poll_votes')
      .select('user_id, option_index, profiles:user_id(id, name, avatar_url)')
      .eq('poll_id', pollId),
  ])
  if (pollRes.error) throw pollRes.error
  if (votesRes.error) throw votesRes.error
  const poll = pollRes.data
  if (!poll) return null

  const options = Array.isArray(poll.options) ? poll.options : []
  const votes = votesRes.data || []

  return {
    id: poll.id,
    chatId: poll.chat_id,
    createdBy: poll.created_by,
    question: poll.question,
    allowMultiple: poll.allow_multiple,
    closedAt: poll.closed_at,
    totalVoters: new Set(votes.map(v => v.user_id)).size,
    options: options.map((label, i) => {
      const forOption = votes.filter(v => v.option_index === i)
      return {
        label,
        index: i,
        count: forOption.length,
        voters: forOption.map(v => ({
          id: v.user_id,
          name: v.profiles?.name || '',
          avatar: v.profiles?.avatar_url || '',
        })),
      }
    }),
  }
}

export async function votePoll(pollId, optionIndex) {
  const { error } = await supabase.rpc('vote_poll', {
    p_poll_id: pollId,
    p_option_index: optionIndex,
  })
  if (error) throw error
}

export async function closePoll(pollId) {
  const { error } = await supabase.rpc('close_poll', { p_poll_id: pollId })
  if (error) throw error
}
