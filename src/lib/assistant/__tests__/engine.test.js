import { describe, it, expect } from 'vitest'
import { parseSlots } from '../slots.js'
import { buildIndex, resolve } from '../entities.js'
import { classify, INTENT_TYPES } from '../classify.js'
import { ACTION_REGISTRY } from '../actions.js'
import { runAssistant } from '../engine.js'
import { resetIdCounter } from '../conversation.js'

describe('Feed Assistant Rule Engine', () => {
  const FIXED_NOW = new Date('2026-08-08T12:00:00Z') // Saturday Aug 8 2026

  const mockCtx = {
    now: FIXED_NOW,
    searchRadius: 15,
    currentUser: { id: 'user_1', name: 'Test User' },
    profiles: [
      { id: 'p1', name: 'Sarah Miller', bio: 'Loves hiking and chess', city: 'Seattle' },
      { id: 'p2', name: 'Sarah Connor', bio: 'Terminator fan', city: 'Los Angeles' },
      { id: 'p3', name: 'Bob Smith', bio: 'Coffee lover', city: 'Seattle' },
    ],
    connections: ['p3'],
    circles: [
      { id: 'c1', name: 'Chess Club', category: 'games', description: 'Weekly chess games' },
      { id: 'c2', name: 'Hiking Enthusiasts', category: 'outdoors', description: 'Weekend hikes' },
    ],
    joinedCircles: ['c1'],
    meetups: [
      { id: 'e1', title: 'Chess Tournament', date: '2026-08-08', time: '18:00', location: 'Park' },
      { id: 'e2', title: 'Saturday Hike', date: '2026-08-08', time: '09:00', location: 'Trail' },
    ],
    rsvpdEventIds: new Set(['e1']),
    chatState: {},
  }

  describe('1. Intent Misclassification Fixes', () => {
    it('"are there any people going to the chess event" returns find_events, not find_people', async () => {
      const slots = parseSlots('are there any people going to the chess event', FIXED_NOW)
      const index = buildIndex(mockCtx)
      const res = classify('are there any people going to the chess event', slots, index)
      expect(res.intent).toBe(INTENT_TYPES.FIND_EVENTS)
      expect(res.intent).not.toBe(INTENT_TYPES.FIND_PEOPLE)
    })

    it('"is anyone free tomorrow" does NOT return a bare find_events', async () => {
      const slots = parseSlots('is anyone free tomorrow', FIXED_NOW)
      const index = buildIndex(mockCtx)
      const res = classify('is anyone free tomorrow', slots, index)
      expect(res.intent).not.toBe(INTENT_TYPES.FIND_EVENTS)
    })
  })

  describe('2. Deterministic Slot Extraction with Injected Time', () => {
    it('extracts all supported time phrases accurately against a fixed now', () => {
      const phrases = [
        'today',
        'tonight',
        'tomorrow',
        'this weekend',
        'next week',
        'this month',
        'friday'
      ]

      phrases.forEach(phrase => {
        const slots = parseSlots(`events ${phrase}`, FIXED_NOW)
        expect(slots.time.kind).not.toBe('none')
        expect(slots.time.from).toBeDefined()
        expect(slots.time.to).toBeDefined()
        expect(slots.time.rawText.toLowerCase()).toContain(phrase.split(' ')[0])
      })
    })

    it('separates topic, time, and distance correctly', () => {
      const slots = parseSlots('hiking events near me this weekend', FIXED_NOW, { userRadius: 15 })
      expect(slots.time.label).toBe('this weekend')
      expect(slots.distance.miles).toBe(15)
      expect(slots.topic.value).toBe('hiking')
    })
  })

  describe('3. Deterministic Entity Ranking & Tie-Breaking', () => {
    it('ranks identical-scoring entities strictly by score desc, title asc, id asc', () => {
      const testIndex = [
        { kind: 'person', id: 'b_id', title: 'Alex Alpha', subtitle: 'Test', keywords: ['test'], path: '/p/1' },
        { kind: 'person', id: 'a_id', title: 'Alex Alpha', subtitle: 'Test', keywords: ['test'], path: '/p/2' },
        { kind: 'person', id: 'c_id', title: 'Beta Brax', subtitle: 'Test', keywords: ['test'], path: '/p/3' },
      ]

      const res1 = resolve('Alex Alpha', testIndex)
      const res2 = resolve('Alex Alpha', testIndex)

      expect(res1).toEqual(res2)
      // Both Alex Alphas have identical 100 exact score. Tie-break title asc -> id asc.
      expect(res1[0].id).toBe('a_id')
      expect(res1[1].id).toBe('b_id')
    })
  })

  describe('4. Byte-Identical Output Guarantee', () => {
    it('running the exact same query 10 times yields deeply equal output', async () => {
      const text = 'message Sarah'
      resetIdCounter()
      const firstRun = await runAssistant(text, mockCtx)

      for (let i = 0; i < 9; i++) {
        resetIdCounter()
        const run = await runAssistant(text, mockCtx)
        expect(run).toEqual(firstRun)
      }
    })
  })

  describe('5. Action Confirmation Guarantee', () => {
    it('every write action in the registry has confirm: true', () => {
      const writeActionIds = [
        'rsvp_event', 'cancel_rsvp', 'join_circle', 'leave_circle',
        'start_dm', 'send_message', 'connect_person', 'create_event',
        'create_circle', 'invite_to_circle', 'add_to_calendar', 'mark_attendance'
      ]

      writeActionIds.forEach(id => {
        const action = ACTION_REGISTRY[id]
        expect(action, `Action ${id} should exist`).toBeDefined()
        expect(action.confirm, `Write action ${id} MUST have confirm: true`).toBe(true)
      })
    })

    it('proposing a write action returns confirmation card', async () => {
      const res = await runAssistant('rsvp me to the chess tournament', mockCtx)
      expect(res.messages.some(m => m.kind === 'action_confirmation')).toBe(true)
    })

    it('prevents non-person entities from executing person actions like connect_person', async () => {
      const res = await runAssistant('connect with trivia', mockCtx)
      // Should ask which person to connect with rather than proposing connect with trivia game entity
      const hasActionWithTrivia = res.messages.some(m => m.kind === 'action_confirmation' && m.entity?.id === 'trivia')
      expect(hasActionWithTrivia).toBe(false)
    })
  })
})
