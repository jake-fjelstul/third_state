import { useEffect, useMemo, useRef, useState } from 'react'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export default function ImageUploader({
  currentUrl,
  fallback,
  shape = 'circle',
  onUpload,
  onChange,
  onRemove,
  disabled = false,
  label,
}) {
  const inputRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [hovered, setHovered] = useState(false)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const displayUrl = previewUrl || currentUrl || ''
  const isCircle = shape === 'circle'
  const overlayLabel = label || (isCircle ? 'Change photo' : 'Change cover photo')

  const boxStyle = useMemo(() => ({
    position: 'relative',
    width: isCircle ? 120 : '100%',
    height: isCircle ? 120 : 180,
    borderRadius: isCircle ? '50%' : 16,
    overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    border: '1px solid rgba(148,163,184,0.3)',
    cursor: disabled ? 'default' : 'pointer',
    outline: hovered ? '2px solid var(--indigo)' : 'none',
    outlineOffset: 2,
    backgroundColor: 'var(--bg)',
  }), [disabled, hovered, isCircle])

  const validateFile = (file) => {
    if (!ACCEPTED.has(file.type)) throw new Error('Unsupported image format')
    if (file.size > MAX_BYTES) throw new Error('Image is too large (max 5 MB)')
  }

  const openPicker = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      validateFile(file)
      const localUrl = URL.createObjectURL(file)
      setPreviewUrl(localUrl)
      setUploading(true)
      const uploadedUrl = await onUpload(file)
      onChange(uploadedUrl)
      setPreviewUrl('')
      URL.revokeObjectURL(localUrl)
    } catch (err) {
      console.error('[ImageUploader] upload failed', err)
      setError(err?.message || 'Upload failed')
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl('')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={openPicker}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) openPicker() }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={boxStyle}
      >
        {displayUrl ? (
          <img src={displayUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : fallback}

        {!disabled && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: hovered ? 'rgba(0,0,0,0.5)' : 'transparent',
            display: 'flex',
            alignItems: isCircle ? 'center' : 'flex-end',
            justifyContent: 'center',
            padding: isCircle ? 0 : 12,
            transition: 'background 0.15s ease',
          }}>
            {hovered && (
              isCircle ? (
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>📷</div>
                  {overlayLabel}
                </div>
              ) : (
                <div style={{ width: '100%', textAlign: 'center', padding: '8px 12px', borderRadius: 999, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                  {overlayLabel}
                </div>
              )
            )}
          </div>
        )}

        {uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 20, height: 20, border: '3px solid rgba(255,255,255,0.5)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleSelect}
        style={{ display: 'none' }}
      />

      {onRemove && !!currentUrl && !uploading && !disabled && (
        <button type="button" onClick={async () => { setError(''); try { await onRemove(); onChange('') } catch (err) { setError(err?.message || 'Could not remove image') } }} style={{ marginTop: 8, border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          Remove
        </button>
      )}

      {error && <p style={{ margin: '8px 0 0', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>{error}</p>}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
