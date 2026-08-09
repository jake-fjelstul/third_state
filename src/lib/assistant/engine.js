/**
 * Feed Assistant Orchestrator Engine.
 * Pure, deterministic workflow: parseSlots -> classify -> resolve -> propose -> execute.
 * Enforces byte-identical determinism given identical input and app context.
 */

import { parseSlots } from './slots.js'
import { buildIndex, resolve } from './entities.js'
import { classify, INTENT_TYPES } from './classify.js'
import { ACTION_REGISTRY, getMissingSlots } from './actions.js'
import { handleFindPeople, handleFindCircles, handleFindEvents, handleNavigate, handleHelp } from './handlers.js'
import {
  assistantText, assistantPeople, assistantCircles, assistantEvents, assistantNavigate, assistantHelp
} from './conversation.js'

export async function runAssistant(text, ctx = {}, pendingState = null) {
  const now = ctx.now instanceof Date ? ctx.now : (ctx.now ? new Date(ctx.now) : new Date())
  const searchRadius = ctx.searchRadius || 10

  // Handle Multi-Turn Pending State
  if (pendingState) {
    const turns = (pendingState.turns || 0) + 1
    if (turns > 3) {
      // Exceeded max turns, reset pending state
      pendingState = null
    } else {
      // Slot-filling multi-turn continuation
      const combinedText = `${pendingState.slots?.topic?.value || pendingState.originalText || ''} ${text}`
      return await runAssistant(combinedText, { ...ctx, now }, null)
    }
  }

  // 1. Parse Structured Slots
  const slots = parseSlots(text, now, { userRadius: searchRadius, categories: ctx.categories })

  // 2. Build Universal Index
  const index = buildIndex(ctx)

  // 3. Preliminary Entity Resolution for Classifier Signals
  const prelimEntities = resolve(text, index, { limit: 5 })

  // 4. Scored Intent Classification
  const classification = classify(text, slots, prelimEntities)

  // 5. Target Entity Resolution for the classified intent
  const targetKinds = getTargetKindsForIntent(classification.intent)
  const searchQuery = slots.person?.name || slots.circle?.name || slots.topic?.value || text
  const resolvedEntities = resolve(searchQuery, index, { kinds: targetKinds, limit: 10 })

  // 6. Ambiguity Check: top two entity candidates within 15 points
  const topEntity = resolvedEntities[0] || null
  const secondEntity = resolvedEntities[1] || null
  const isEntityAmbiguous = topEntity && secondEntity && (topEntity.score - secondEntity.score <= 15)

  // 7. Low Confidence (< 0.4) or Entity Ambiguity -> Ask or Disambiguate
  if (classification.confidence < 0.4 && !isEntityAmbiguous) {
    return {
      messages: [
        assistantText("I'm not completely sure what you'd like to do. Could you clarify if you're looking for people, circles, or events?")
      ],
      pendingState: { originalText: text, awaiting: 'clarification', turns: 1 }
    }
  }

  if (isEntityAmbiguous && resolvedEntities.length >= 2) {
    return {
      messages: [
        assistantText(`I found multiple matches for "${searchQuery}". Which one did you mean?`),
        {
          id: `disambiguate_${searchQuery.replace(/\s+/g, '_')}`,
          kind: 'disambiguation',
          query: searchQuery,
          candidates: resolvedEntities.slice(0, 4).map(e => ({
            id: e.id,
            title: e.title,
            subtitle: e.subtitle,
            kind: e.kind,
            reason: e.reason,
            data: e.data
          }))
        }
      ],
      pendingState: { originalText: text, awaiting: 'disambiguation_choice', candidates: resolvedEntities, turns: 1 }
    }
  }

  // 8. Select Action
  const actionId = mapIntentToActionId(classification.intent, slots, topEntity)
  const action = ACTION_REGISTRY[actionId] || ACTION_REGISTRY.help

  // 9. Check Required Slots
  const missingSlots = getMissingSlots(action, slots, topEntity)
  if (missingSlots.length > 0) {
    const missingName = missingSlots[0]
    return {
      messages: [
        assistantText(`Which ${missingName} would you like to ${action.label.toLowerCase()}?`)
      ],
      pendingState: { actionId: action.id, slots, entity: topEntity, awaiting: missingName, turns: 1 }
    }
  }

  // 10. Confirmation Card for Write Actions
  if (action.confirm) {
    const description = action.describe(slots, topEntity)
    return {
      messages: [
        assistantText(`Shall I go ahead and ${description.toLowerCase()}?`),
        {
          id: `confirm_${action.id}_${topEntity?.id || 'new'}`,
          kind: 'action_confirmation',
          actionId: action.id,
          actionLabel: action.label,
          description,
          slots,
          entity: topEntity,
          reason: topEntity?.reason || 'Matched intent'
        }
      ],
      pendingState: { actionId: action.id, slots, entity: topEntity, awaiting: 'user_confirmation', turns: 1 }
    }
  }

  // 11. Read Actions / Directly Executable Flows
  const alternativeMsg = classification.alternativeIntent
    ? `(Did you mean ${formatIntentLabel(classification.alternativeIntent)}?)`
    : null

  let responseMessages = []

  switch (classification.intent) {
    case INTENT_TYPES.FIND_PEOPLE: {
      const res = await handleFindPeople({ topic: slots.topic?.value, ctx })
      responseMessages = attachReasonAndAlternative(res, topEntity, alternativeMsg)
      break
    }
    case INTENT_TYPES.FIND_CIRCLES: {
      const res = await handleFindCircles({ topic: slots.topic?.value, ctx })
      responseMessages = attachReasonAndAlternative(res, topEntity, alternativeMsg)
      break
    }
    case INTENT_TYPES.FIND_EVENTS: {
      const res = await handleFindEvents({ topic: slots.topic?.value, ctx })
      responseMessages = attachReasonAndAlternative(res, topEntity, alternativeMsg)
      break
    }
    case INTENT_TYPES.NAVIGATE: {
      const pagePath = topEntity?.path || slots.topic?.value || '/feed'
      const res = handleNavigate({ topic: pagePath })
      responseMessages = attachReasonAndAlternative(res, topEntity, alternativeMsg)
      break
    }
    case INTENT_TYPES.HELP:
    default: {
      responseMessages = handleHelp()
      break
    }
  }

  return {
    messages: responseMessages,
    pendingState: null
  }
}

function getTargetKindsForIntent(intent) {
  switch (intent) {
    case INTENT_TYPES.FIND_PEOPLE:
    case INTENT_TYPES.START_DM:
    case INTENT_TYPES.CONNECT_PERSON:
      return ['person']
    case INTENT_TYPES.FIND_CIRCLES:
    case INTENT_TYPES.JOIN_CIRCLE:
    case INTENT_TYPES.CREATE_CIRCLE:
      return ['circle']
    case INTENT_TYPES.FIND_EVENTS:
    case INTENT_TYPES.RSVP_EVENT:
    case INTENT_TYPES.CREATE_EVENT:
      return ['event']
    case INTENT_TYPES.NAVIGATE:
      return ['page', 'setting', 'game']
    default:
      return null
  }
}

function mapIntentToActionId(intent, slots, entity) {
  switch (intent) {
    case INTENT_TYPES.START_DM: return 'start_dm'
    case INTENT_TYPES.CONNECT_PERSON: return 'connect_person'
    case INTENT_TYPES.JOIN_CIRCLE: return 'join_circle'
    case INTENT_TYPES.RSVP_EVENT: return 'rsvp_event'
    case INTENT_TYPES.CREATE_EVENT: return 'create_event'
    case INTENT_TYPES.CREATE_CIRCLE: return 'create_circle'
    case INTENT_TYPES.FIND_PEOPLE: return 'find_people'
    case INTENT_TYPES.FIND_CIRCLES: return 'find_circles'
    case INTENT_TYPES.FIND_EVENTS: return 'find_events'
    case INTENT_TYPES.NAVIGATE: return 'open_page'
    case INTENT_TYPES.HELP: default: return 'help'
  }
}

function formatIntentLabel(intent) {
  switch (intent) {
    case 'find_people': return 'Find People'
    case 'find_circles': return 'Find Circles'
    case 'find_events': return 'Find Events'
    case 'create_event': return 'Create Event'
    case 'create_circle': return 'Create Circle'
    case 'navigate': return 'Navigate'
    default: return intent
  }
}

function attachReasonAndAlternative(messages, topEntity, alternativeMsg) {
  return messages.map(msg => {
    const updated = { ...msg }
    if (topEntity && topEntity.reason && (updated.kind === 'people' || updated.kind === 'circles' || updated.kind === 'events')) {
      updated.reason = topEntity.reason
    }
    if (alternativeMsg && updated.kind === 'text') {
      updated.alternative = alternativeMsg
    }
    return updated
  })
}
