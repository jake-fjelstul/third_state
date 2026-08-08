import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { Share } from '@capacitor/share'

const clr = {
  bg: 'var(--bg)',
  white: 'var(--white)',
  indigo: 'var(--indigo)',
  indigoLt: 'var(--indigoLt)',
  textDark: 'var(--textDark)',
  textMid: 'var(--textMid)',
  textLight: 'var(--textLight)',
  border: 'var(--border)',
}

export default function QRCard({ url, code, title, subtitle, message }) {
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [qrError, setQrError] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let mounted = true
    if (!url) return
    setQrError(false)
    QRCode.toDataURL(url, {
      width: 512,
      margin: 1,
      color: { dark: '#0F172A', light: '#FFFFFF' }
    })
      .then((dataUrl) => {
        if (mounted) setQrDataUrl(dataUrl)
      })
      .catch((err) => {
        console.error('[QRCard] QRCode generation failed', err)
        if (mounted) setQrError(true)
      })
    return () => { mounted = false }
  }, [url])

  const handleShare = async () => {
    const textToShare = message || title || 'Join me on Third Space!'
    try {
      await Share.share({
        title: title || 'Third Space',
        text: textToShare,
        url: url,
      })
      return
    } catch {
      // Share API threw or was cancelled/unavailable; try navigator.share
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: title || 'Third Space',
          text: textToShare,
          url: url,
        })
        return
      } catch {
        // Fallback to copy link
      }
    }

    // Fallback to copy link
    handleCopyLink()
  }

  const handleTextIt = () => {
    const fullText = (message ? message + ' ' : '') + (url || '')
    window.location.href = `sms:&body=${encodeURIComponent(fullText)}`
  }

  const handleCopyLink = () => {
    if (!url) return
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      padding: '20px 16px', boxSizing: 'border-box', width: '100%',
    }}>
      {title && (
        <h3 style={{ fontSize: 20, fontWeight: 800, color: clr.textDark, margin: '0 0 4px 0' }}>
          {title}
        </h3>
      )}
      {subtitle && (
        <p style={{ fontSize: 13, color: clr.textMid, margin: '0 0 16px 0' }}>
          {subtitle}
        </p>
      )}

      {/* QR Code Container - Always white background regardless of app theme */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: `1px solid ${clr.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        {!qrError && qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR Code"
            style={{ width: 220, height: 220, display: 'block', borderRadius: 8 }}
          />
        ) : !qrError ? (
          <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: 13 }}>
            Generating QR code...
          </div>
        ) : (
          <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13, padding: 16 }}>
            Couldn't render the QR code
          </div>
        )}

        {/* 8-character code */}
        {code && (
          <div style={{
            marginTop: 12,
            padding: '6px 16px',
            backgroundColor: '#F8FAFC',
            borderRadius: 10,
            border: '1px solid #E2E8F0',
          }}>
            <span style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: '0.25em',
              color: '#0F172A',
            }}>
              {code}
            </span>
          </div>
        )}
      </div>

      {/* Button Row */}
      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 360 }}>
        <button
          type="button"
          onClick={handleShare}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 999, border: 'none',
            backgroundColor: clr.indigo, color: '#FFFFFF',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(91,95,239,0.3)',
            fontFamily: 'inherit',
          }}
        >
          Share
        </button>

        <button
          type="button"
          onClick={handleTextIt}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 999,
            border: `1.5px solid ${clr.border}`,
            backgroundColor: clr.white, color: clr.textDark,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Text it
        </button>

        <button
          type="button"
          onClick={handleCopyLink}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 999,
            border: `1.5px solid ${copied ? clr.indigo : clr.border}`,
            backgroundColor: copied ? clr.indigoLt : clr.white,
            color: copied ? clr.indigo : clr.textDark,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.2s ease',
          }}
        >
          {copied ? '✓ Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}
