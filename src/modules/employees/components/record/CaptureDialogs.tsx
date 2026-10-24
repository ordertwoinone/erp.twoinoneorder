import { useEffect, useRef, useState } from 'react'
import { Camera, Eraser, Loader2, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

/** Live camera preview; Capture returns a JPEG file. */
export function CameraCaptureDialog({ open, onClose, onCapture }: { open: boolean; onClose: () => void; onCapture: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function start() {
      setError(null)
      setReady(false)
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser can’t use the camera. Use “Upload Photo” instead.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
          setReady(true)
        }
      } catch (err) {
        const name = (err as DOMException).name
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission was refused. Allow the camera for this site in the browser’s address bar, then try again.'
            : name === 'NotFoundError'
              ? 'No camera was found on this device. Use “Upload Photo” instead.'
              : `The camera couldn’t start (${(err as Error).message}).`,
        )
      }
    }
    void start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open, facing])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    // A passport-style 4:5 crop from the middle of the frame.
    const targetRatio = 4 / 5
    let w = video.videoWidth
    let h = video.videoHeight
    let sx = 0
    let sy = 0
    if (w / h > targetRatio) {
      const nw = h * targetRatio
      sx = (w - nw) / 2
      w = nw
    } else {
      const nh = w / targetRatio
      sy = (h - nh) / 2
      h = nh
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w)
    canvas.height = Math.round(h)
    canvas.getContext('2d')!.drawImage(video, sx, sy, w, h, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(new File([blob], `photo-${stamp()}.jpg`, { type: 'image/jpeg' }))
        onClose()
      },
      'image/jpeg',
      0.9,
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Capture employee photo</DialogTitle>
          <DialogDescription>Face the camera with a plain background, then press Capture.</DialogDescription>
        </DialogHeader>
        <div className="relative mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-xl border bg-muted">
          <video ref={videoRef} playsInline muted className="size-full object-cover" style={facing === 'user' ? { transform: 'scaleX(-1)' } : undefined} />
          {!ready && !error && (
            <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </span>
          )}
          {error && <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} disabled={!!error}>
            <RefreshCcw /> Switch camera
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={capture} disabled={!ready}>
              <Camera /> Capture
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Draw a signature with mouse, finger or pen; Save returns a transparent PNG. */
export function SignaturePadDialog({ open, title, onClose, onSave }: { open: boolean; title: string; onClose: () => void; onSave: (file: File) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  // Fresh, crisp canvas each time the dialog opens.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ratio = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * ratio
      canvas.height = rect.height * ratio
      const ctx = canvas.getContext('2d')!
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#0b2a6f'
      setHasInk(false)
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
  }

  function save() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return
      onSave(new File([blob], `signature-${stamp()}.png`, { type: 'image/png' }))
      onClose()
    }, 'image/png')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Sign inside the box with a mouse, finger or pen.</DialogDescription>
        </DialogHeader>
        <div className="relative rounded-xl border-2 border-dashed bg-white">
          <canvas
            ref={canvasRef}
            className="block h-52 w-full touch-none cursor-crosshair"
            aria-label="Signature area"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              drawing.current = true
              const ctx = e.currentTarget.getContext('2d')!
              const p = point(e)
              ctx.beginPath()
              ctx.moveTo(p.x, p.y)
              ctx.lineTo(p.x + 0.01, p.y + 0.01)
              ctx.stroke()
              setHasInk(true)
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return
              const ctx = e.currentTarget.getContext('2d')!
              const p = point(e)
              ctx.lineTo(p.x, p.y)
              ctx.stroke()
            }}
            onPointerUp={() => (drawing.current = false)}
            onPointerLeave={() => (drawing.current = false)}
          />
          <span className="pointer-events-none absolute right-4 bottom-8 left-4 border-b border-neutral-300" />
          {!hasInk && <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-neutral-400">Sign here</span>}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={clear} disabled={!hasInk}>
            <Eraser /> Clear
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={!hasInk}>
              Save signature
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
