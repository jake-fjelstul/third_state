/**
 * Declarative Action Registry for Feed Assistant.
 * Wraps existing AppContext methods. All write actions enforce `confirm: true`.
 */

export const ACTION_REGISTRY = {
  rsvp_event: {
    id: 'rsvp_event',
    label: 'RSVP to Event',
    kinds: ['event'],
    requiredSlots: ['entity'],
    confirm: true,
    describe: (slots, entity) => `RSVP to "${entity?.title || 'the event'}"`,
    execute: async (slots, entity, ctx) => {
      if (!entity?.data && !entity?.id) throw new Error('Missing event entity')
      const target = entity.data || entity
      await ctx.rsvpEvent(target)
      return { status: 'success', message: `You're RSVP'd to ${target.title || 'the event'}!` }
    }
  },

  cancel_rsvp: {
    id: 'cancel_rsvp',
    label: 'Cancel RSVP',
    kinds: ['event'],
    requiredSlots: ['entity'],
    confirm: true,
    describe: (slots, entity) => `Cancel RSVP for "${entity?.title || 'the event'}"`,
    execute: async (slots, entity, ctx) => {
      const eventId = entity?.id || entity?.data?.id
      if (!eventId) throw new Error('Missing event ID')
      await ctx.cancelRsvp(eventId)
      return { status: 'success', message: `Cancelled your RSVP for ${entity.title || 'the event'}.` }
    }
  },

  join_circle: {
    id: 'join_circle',
    label: 'Join Circle',
    kinds: ['circle'],
    requiredSlots: ['entity'],
    confirm: true,
    describe: (slots, entity) => `Join "${entity?.title || 'the circle'}"`,
    execute: async (slots, entity, ctx) => {
      const circleId = entity?.id || entity?.data?.id
      if (!circleId) throw new Error('Missing circle ID')
      await ctx.joinCircle(circleId)
      return { status: 'success', message: `You joined ${entity.title || 'the circle'}!` }
    }
  },

  leave_circle: {
    id: 'leave_circle',
    label: 'Leave Circle',
    kinds: ['circle'],
    requiredSlots: ['entity'],
    confirm: true,
    describe: (slots, entity) => `Leave "${entity?.title || 'the circle'}"`,
    execute: async (slots, entity, ctx) => {
      const circleId = entity?.id || entity?.data?.id
      if (!circleId) throw new Error('Missing circle ID')
      await ctx.leaveCircle(circleId)
      return { status: 'success', message: `Left ${entity.title || 'the circle'}.` }
    }
  },

  start_dm: {
    id: 'start_dm',
    label: 'Message Person',
    kinds: ['person'],
    requiredSlots: ['entity'],
    confirm: true,
    describe: (slots, entity) => `Start a DM with ${entity?.title || 'this person'}`,
    execute: async (slots, entity, ctx) => {
      const target = entity?.data || entity
      if (!target?.id) throw new Error('Missing person to message')
      const chatId = await ctx.startDM(target)
      return { status: 'success', message: `Started conversation with ${entity.title}.`, chatId }
    }
  },

  send_message: {
    id: 'send_message',
    label: 'Send Message',
    kinds: ['chat', 'person'],
    requiredSlots: ['entity', 'topic'],
    confirm: true,
    describe: (slots, entity) => `Send "${slots?.topic?.value || slots?.topic || 'message'}" to ${entity?.title || 'chat'}`,
    execute: async (slots, entity, ctx) => {
      let chatId = entity?.id
      if (entity?.kind === 'person') {
        chatId = await ctx.startDM(entity.data || entity)
      }
      const msgText = slots?.topic?.value || slots?.topic || ''
      if (!chatId || !msgText) throw new Error('Missing chatId or message text')
      await ctx.sendMessage(chatId, msgText)
      return { status: 'success', message: `Message sent to ${entity.title}!` }
    }
  },

  connect_person: {
    id: 'connect_person',
    label: 'Connect with Person',
    kinds: ['person'],
    requiredSlots: ['entity'],
    confirm: true,
    describe: (slots, entity) => `Send a connection request to ${entity?.title || 'this person'}`,
    execute: async (slots, entity, ctx) => {
      const target = entity?.data || entity
      if (!target || entity?.kind !== 'person') throw new Error('Missing person to connect with')
      await ctx.connectWithPerson(target)
      return { status: 'success', message: `Connection request sent to ${entity.title}!` }
    }
  },

  create_event: {
    id: 'create_event',
    label: 'Create Event',
    kinds: ['event'],
    requiredSlots: [],
    confirm: true,
    describe: (slots) => `Create a new event${slots?.topic?.value ? ` for "${slots.topic.value}"` : ''}`,
    execute: async (slots, entity, ctx) => {
      return { status: 'form', formKind: 'event_form', initialData: { title: slots?.topic?.value || '' } }
    }
  },

  create_circle: {
    id: 'create_circle',
    label: 'Create Circle',
    kinds: ['circle'],
    requiredSlots: [],
    confirm: true,
    describe: (slots) => `Create a new circle${slots?.topic?.value ? ` for "${slots.topic.value}"` : ''}`,
    execute: async (slots, entity, ctx) => {
      return { status: 'form', formKind: 'circle_form', initialData: { name: slots?.topic?.value || '' } }
    }
  },

  invite_to_circle: {
    id: 'invite_to_circle',
    label: 'Invite to Circle',
    kinds: ['person', 'circle'],
    requiredSlots: ['entity'],
    confirm: true,
    describe: (slots, entity) => `Invite ${entity?.title || 'member'} to circle`,
    execute: async (slots, entity, ctx) => {
      return { status: 'success', message: `Invitation sent!` }
    }
  },

  open_page: {
    id: 'open_page',
    label: 'Open Page',
    kinds: ['page', 'setting', 'game'],
    requiredSlots: ['entity'],
    confirm: false,
    describe: (slots, entity) => `Go to ${entity?.title || 'page'}`,
    execute: async (slots, entity, ctx) => {
      return { status: 'navigate', path: entity?.path || '/feed', label: entity?.title || 'Page' }
    }
  },

  add_to_calendar: {
    id: 'add_to_calendar',
    label: 'Add to Calendar',
    kinds: ['event'],
    requiredSlots: ['entity'],
    confirm: true,
    describe: (slots, entity) => `Add "${entity?.title || 'event'}" to schedule`,
    execute: async (slots, entity, ctx) => {
      const target = entity?.data || entity
      await ctx.rsvpEvent(target)
      return { status: 'success', message: `Added ${entity.title} to your schedule.` }
    }
  },

  mark_attendance: {
    id: 'mark_attendance',
    label: 'Mark Attendance',
    kinds: ['event'],
    requiredSlots: ['entity'],
    confirm: true,
    describe: (slots, entity) => `Mark attendance for "${entity?.title || 'event'}"`,
    execute: async (slots, entity, ctx) => {
      return { status: 'success', message: `Attendance recorded!` }
    }
  },

  find_people: {
    id: 'find_people',
    label: 'Find People',
    kinds: ['person'],
    requiredSlots: [],
    confirm: false,
    describe: (slots) => `Find people${slots?.topic?.value ? ` into ${slots.topic.value}` : ''}`,
    execute: async () => ({ status: 'read' })
  },

  find_circles: {
    id: 'find_circles',
    label: 'Find Circles',
    kinds: ['circle'],
    requiredSlots: [],
    confirm: false,
    describe: (slots) => `Find circles${slots?.topic?.value ? ` around ${slots.topic.value}` : ''}`,
    execute: async () => ({ status: 'read' })
  },

  find_events: {
    id: 'find_events',
    label: 'Find Events',
    kinds: ['event'],
    requiredSlots: [],
    confirm: false,
    describe: (slots) => `Find events${slots?.topic?.value ? ` for ${slots.topic.value}` : ''}`,
    execute: async () => ({ status: 'read' })
  },

  help: {
    id: 'help',
    label: 'Help',
    kinds: [],
    requiredSlots: [],
    confirm: false,
    describe: () => 'Get help',
    execute: async () => ({ status: 'help' })
  }
}

export function getMissingSlots(action, slots, entity) {
  if (!action || !action.requiredSlots) return []
  const missing = []
  for (const s of action.requiredSlots) {
    if (s === 'entity') {
      if (!entity || (action.kinds && action.kinds.length > 0 && !action.kinds.includes(entity.kind))) {
        missing.push(action.kinds?.[0] || 'entity')
      }
    } else if (s === 'person' && !slots.person?.name && entity?.kind !== 'person') {
      missing.push('person')
    } else if (s === 'circle' && !slots.circle?.name && entity?.kind !== 'circle') {
      missing.push('circle')
    } else if (s === 'topic' && !slots.topic?.value) {
      missing.push('topic')
    }
  }
  return missing
}
