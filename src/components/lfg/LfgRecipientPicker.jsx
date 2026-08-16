import { useState, useEffect, useCallback } from 'react'
import { avatarFor } from '../../lib/avatar'
import { listFriendGroups, saveFriendGroup, deleteFriendGroup } from '../../lib/friendGroups'

export default function LfgRecipientPicker({ connections = [], selectedIds = [], onChange, clr }) {
  const [groups, setGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [groupNameDraft, setGroupNameDraft] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const theme = clr || {
    bg: 'var(--bg, #F9FAFB)',
    white: 'var(--white, #FFFFFF)',
    indigo: 'var(--indigo, #5B5FEF)',
    indigoLt: 'var(--indigoLt, #EEF0FF)',
    amber: '#F59E0B',
    textDark: 'var(--textDark, #111827)',
    textMid: 'var(--textMid, #4B5563)',
    textLight: 'var(--textLight, #9CA3AF)',
    border: 'var(--border, #E5E7EB)',
  }

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true)
    try {
      const list = await listFriendGroups()
      setGroups(list)
    } catch (err) {
      console.error('[LfgRecipientPicker] failed to fetch friend groups', err)
      setGroups([])
    } finally {
      setGroupsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const handleChipTap = (group) => {
    if (editingGroupId === group.id) {
      setEditingGroupId(null)
      onChange([])
    } else {
      setEditingGroupId(group.id)
      const memberIds = group.members.map(m => m.id)
      onChange(memberIds)
    }
  }

  const handleDeleteGroup = async (e, groupId) => {
    e.stopPropagation()
    if (confirmDeleteId !== groupId) {
      setConfirmDeleteId(groupId)
      return
    }
    try {
      await deleteFriendGroup(groupId)
      setConfirmDeleteId(null)
      if (editingGroupId === groupId) {
        setEditingGroupId(null)
      }
      await fetchGroups()
    } catch (err) {
      setError(err?.message || 'Could not delete group')
    }
  }

  const handleToggleUser = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const activeGroup = groups.find(g => g.id === editingGroupId)
  const activeMemberIds = activeGroup ? activeGroup.members.map(m => m.id) : []
  const selectionDiffers = editingGroupId && activeGroup
    ? (selectedIds.length !== activeMemberIds.length || selectedIds.some(id => !activeMemberIds.includes(id)))
    : false

  const handleSaveGroup = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (editingGroupId && selectionDiffers && activeGroup) {
        await saveFriendGroup({
          name: activeGroup.name,
          memberIds: selectedIds,
          groupId: editingGroupId,
        })
      } else {
        const name = groupNameDraft.trim()
        if (!name) {
          setError('Please enter a group name.')
          setSaving(false)
          return
        }
        const newId = await saveFriendGroup({
          name,
          memberIds: selectedIds,
        })
        if (newId) {
          setEditingGroupId(newId)
        }
        setShowNameInput(false)
        setGroupNameDraft('')
      }
      await fetchGroups()
    } catch (err) {
      if (err?.code === '23505' || err?.message?.toLowerCase().includes('unique') || err?.message?.toLowerCase().includes('already exists')) {
        setError('You already have a group with that name.')
      } else {
        setError(err?.message || 'Could not save group.')
      }
    } finally {
      setSaving(false)
    }
  }

  const filteredConnections = connections.filter(c =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase().trim())
  )

  return (
    <div style={{ marginTop: 8, marginBottom: 16 }}>
      {/* 3a. SAVED GROUP CHIPS */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: theme.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Saved Groups
        </label>
        {!groupsLoading && groups.length === 0 ? (
          <p style={{ fontSize: 12, color: theme.textLight, margin: '4px 0', fontStyle: 'italic' }}>
            Pick people below, then save them as a group to reuse later.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -4px', padding: '2px 4px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {groups.map(g => {
                const isActive = editingGroupId === g.id
                const isConfirming = confirmDeleteId === g.id
                return (
                  <div
                    key={g.id}
                    onClick={() => handleChipTap(g)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: isActive ? `1.5px solid ${theme.indigo}` : `1.5px solid ${theme.border}`,
                      backgroundColor: isActive ? theme.indigoLt : theme.bg,
                      color: isActive ? theme.indigo : theme.textDark,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{g.name} · {g.members.length}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteGroup(e, g.id)}
                      title={isConfirming ? "Click again to confirm delete" : "Delete group"}
                      style={{
                        background: isConfirming ? '#EF4444' : 'transparent',
                        color: isConfirming ? '#FFFFFF' : theme.textLight,
                        border: 'none',
                        borderRadius: 999,
                        padding: isConfirming ? '2px 6px' : '0 2px',
                        fontSize: isConfirming ? 10 : 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >
                      {isConfirming ? 'Delete?' : '✕'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3b. CONNECTION MULTI-SELECT */}
      {connections.length > 8 && (
        <div style={{ marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Search connections..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 12px',
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.bg,
              fontSize: 13,
              color: theme.textDark,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
      )}

      <div style={{
        maxHeight: 260,
        overflowY: 'auto',
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        backgroundColor: theme.white,
        padding: '4px 0',
      }}>
        {filteredConnections.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', fontSize: 13, color: theme.textLight }}>
            {connections.length === 0 ? 'No connections yet' : 'No matching connections'}
          </div>
        ) : (
          filteredConnections.map(person => {
            const isSelected = selectedIds.includes(person.id)
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => handleToggleUser(person.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  gap: 12,
                  padding: '10px 14px',
                  border: 'none',
                  background: isSelected ? theme.indigoLt : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <img
                  src={avatarFor(person)}
                  alt={person.name}
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: theme.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {person.name}
                </span>
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: isSelected ? `2px solid ${theme.indigo}` : `2px solid ${theme.border}`,
                  backgroundColor: isSelected ? theme.indigo : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}>
                  {isSelected && '✓'}
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* 3c. SELECTION SUMMARY + SAVE */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: theme.textMid }}>
            {selectedIds.length} selected
          </span>

          {editingGroupId && selectionDiffers ? (
            <button
              type="button"
              onClick={handleSaveGroup}
              disabled={saving}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: `1.5px solid ${theme.indigo}`,
                backgroundColor: theme.indigoLt,
                color: theme.indigo,
                fontSize: 13,
                fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              {saving ? 'Updating...' : 'Update group'}
            </button>
          ) : selectedIds.length > 0 && !showNameInput ? (
            <button
              type="button"
              onClick={() => { setShowNameInput(true); setError('') }}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: `1.5px solid ${theme.border}`,
                backgroundColor: theme.bg,
                color: theme.indigo,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Save as group
            </button>
          ) : null}
        </div>

        {showNameInput && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Group name (e.g. Gym crew)"
              value={groupNameDraft}
              onChange={e => setGroupNameDraft(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 12,
                border: `1px solid ${theme.border}`,
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={handleSaveGroup}
              disabled={saving}
              style={{
                padding: '8px 14px',
                borderRadius: 12,
                border: 'none',
                backgroundColor: theme.indigo,
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer',
                flexShrink: 0,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setShowNameInput(false); setGroupNameDraft(''); setError('') }}
              style={{
                padding: '8px 12px',
                borderRadius: 12,
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.bg,
                color: theme.textMid,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {error && (
          <div style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
