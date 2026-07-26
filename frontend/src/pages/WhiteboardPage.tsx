import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, MousePointer2, Pencil, Square, Circle,
  ArrowUpRight, Type, Eraser, Undo2, Redo2, ZoomIn,
  ZoomOut, Trash2, Eye, Users, ChevronDown, Save,
  Lock, Unlock, Copy, Clipboard
} from 'lucide-react'
import { api } from '../services/api'
import type { BoardObject, Whiteboard } from '../types/whiteboard'
import type { Workspace } from '../types/workspace'
import { CollaborationPanel } from '../components/CollaborationPanel'
import { useFeedback } from '../components/Feedback'
import { useAuth } from '../features/auth/AuthContext'

type Tool = 'select' | 'pencil' | 'rect' | 'circle' | 'arrow' | 'text' | 'eraser'

const TOOL_CONFIG: { key: Tool; icon: any; label: string; shortcut?: string }[] = [
  { key: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { key: 'pencil', icon: Pencil, label: 'Pencil', shortcut: 'P' },
  { key: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { key: 'circle', icon: Circle, label: 'Circle', shortcut: 'C' },
  { key: 'arrow', icon: ArrowUpRight, label: 'Arrow', shortcut: 'A' },
  { key: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { key: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E' },
]

/* Cursor color from user ID hash */
const CURSOR_COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
]
function cursorColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

type RemoteCursor = { x: number; y: number; name: string; color: string }
type OnlineUser = { user_id: string; user_name: string; role: string }
type RemoteSelection = { user_id: string; user_name: string; selected_ids: string[] }

export function WhiteboardPage() {
  const { whiteboardId } = useParams()
  const { user } = useAuth()
  const { input, confirm: askConfirm, toast } = useFeedback()

  const [board, setBoard] = useState<Whiteboard | null>(null)
  const [role, setRole] = useState<string>('viewer')
  const [objects, setObjects] = useState<BoardObject[]>([])
  const [history, setHistory] = useState<BoardObject[][]>([])
  const [future, setFuture] = useState<BoardObject[][]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState('#1e293b')
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState<BoardObject | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({})
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [showOnline, setShowOnline] = useState(false)
  const [showPanel, setShowPanel] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const [clipboard, setClipboard] = useState<BoardObject[]>([])
  const [isPanning, setIsPanning] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number; px: number; py: number } | null>(null)
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [dragStart, setDragStart] = useState<{ x: number; y: number; origPositions: Map<string, { x: number; y: number }> } | null>(null)
  const [remoteSelections, setRemoteSelections] = useState<RemoteSelection[]>([])
  const [resizeHandle, setResizeHandle] = useState<{ handle: string; startX: number; startY: number; origBounds: { minX: number; minY: number; maxX: number; maxY: number }; origObjects: Map<string, { x: number; y: number; w: number; h: number; points?: number[]; fontSize?: number }> } | null>(null)
  const [eraserHoverId, setEraserHoverId] = useState<string | null>(null)
  const [isEraserDragging, setIsEraserDragging] = useState(false)
  const [editingText, setEditingText] = useState<{ id: string; x: number; y: number; text: string; isNew: boolean; createdAt: number } | null>(null)

  const saveTimer = useRef<number | undefined>(undefined)
  const socket = useRef<WebSocket | null>(null)
  const cursorThrottle = useRef<number>(0)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)

  const isViewer = role === 'viewer'
  const canEdit = (role === 'owner' || role === 'editor') && !isLocked

  /* ── Screen to canvas coords ── */
  function screenToCanvas(clientX: number, clientY: number) {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left) / zoom - panX,
      y: (clientY - rect.top) / zoom - panY,
    }
  }

  /* ── Canvas to screen coords (for HTML overlays) ── */
  function canvasToScreen(cx: number, cy: number) {
    return {
      x: (cx + panX) * zoom,
      y: (cy + panY) * zoom,
    }
  }

  function getPoint(event: React.PointerEvent<SVGSVGElement>) {
    return screenToCanvas(event.clientX, event.clientY)
  }

  /* ── Load board ── */
  useEffect(() => {
    if (!whiteboardId) return
    setLoading(true)
    api.get<Whiteboard>(`/whiteboards/${whiteboardId}`)
      .then(({ data }) => {
        setBoard(data)
        setObjects(data.board_data.objects)
        setZoom(data.board_data.zoom ?? 1)
        setIsLocked(data.is_locked ?? false)
        return api.get<Workspace>(`/workspaces/${data.workspace_id}`)
      })
      .then(({ data }) => setRole(data.role ?? 'viewer'))
      .catch(err => setError(err.response?.data?.detail ?? 'Unable to load whiteboard'))
      .finally(() => setLoading(false))
  }, [whiteboardId])

  /* ── WebSocket ── */
  useEffect(() => {
    if (!whiteboardId) return
    const token = localStorage.getItem('access_token')
    if (!token) return

    const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1')
      .replace('/api/v1', '')
      .replace(/^http/, 'ws')
    const ws = new WebSocket(`${base}/ws/whiteboards/${whiteboardId}?token=${encodeURIComponent(token)}`)
    socket.current = ws

    ws.onmessage = event => {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'board:update':
          setObjects(msg.objects)
          break
        case 'board:lock':
          setIsLocked(true)
          break
        case 'board:unlock':
          setIsLocked(false)
          break
        case 'presence':
          if (msg.action === 'connected' || msg.action === 'joined' || msg.action === 'left') {
            if (msg.users) setOnlineUsers(msg.users)
          }
          if (msg.action === 'connected' && msg.is_locked !== undefined) {
            setIsLocked(msg.is_locked)
          }
          if (msg.action === 'left' && msg.user_id) {
            setCursors(prev => {
              const next = { ...prev }
              delete next[msg.user_id]
              return next
            })
            setRemoteSelections(prev => prev.filter(s => s.user_id !== msg.user_id))
          }
          break
        case 'cursor':
          if (msg.user_id) {
            setCursors(prev => ({
              ...prev,
              [msg.user_id]: {
                x: msg.x, y: msg.y,
                name: msg.user_name || msg.user_id.slice(0, 6),
                color: cursorColor(msg.user_id),
              }
            }))
          }
          break
        case 'selection:update':
          if (msg.user_id) {
            setRemoteSelections(prev => {
              const filtered = prev.filter(s => s.user_id !== msg.user_id)
              if (msg.selected_ids?.length) {
                filtered.push({ user_id: msg.user_id, user_name: msg.user_name, selected_ids: msg.selected_ids })
              }
              return filtered
            })
          }
          break
      }
    }

    return () => ws.close()
  }, [whiteboardId])

  /* ── Broadcast selection ── */
  useEffect(() => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({
        type: 'selection:update',
        selected_ids: Array.from(selectedIds),
      }))
    }
  }, [selectedIds])

  /* ── Commit & Save ── */
  const commit = useCallback((next: BoardObject[]) => {
    setHistory(items => [...items, objects])
    setObjects(next)
    setFuture([])
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ type: 'board:update', objects: next }))
    }
  }, [objects])

  const save = useCallback((next = objects) => {
    if (!whiteboardId || !board) return
    clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      api.patch(`/whiteboards/${whiteboardId}`, {
        board_data: { objects: next, background: board.board_data.background, zoom }
      }).catch(() => toast('Save failed. Please retry.', 'error'))
    }, 400)
  }, [whiteboardId, board, zoom, toast, objects])

  /* ── Undo / Redo ── */
  function undo() {
    if (!canEdit) return
    const prior = history.at(-1)
    if (!prior) return
    setFuture(items => [objects, ...items])
    setHistory(items => items.slice(0, -1))
    setObjects(prior)
    save(prior)
  }

  function redo() {
    if (!canEdit) return
    const next = future[0]
    if (!next) return
    setHistory(items => [...items, objects])
    setFuture(items => items.slice(1))
    setObjects(next)
    save(next)
  }

  /* ── Delete selected ── */
  function deleteSelected() {
    if (!canEdit || selectedIds.size === 0) return
    const next = objects.filter(item => !selectedIds.has(item.id))
    commit(next)
    save(next)
    setSelectedIds(new Set())
  }

  /* ── Copy / Paste / Duplicate ── */
  function copySelected() {
    if (selectedIds.size === 0) return
    setClipboard(objects.filter(o => selectedIds.has(o.id)))
  }

  function paste() {
    if (!canEdit || clipboard.length === 0) return
    const offset = 20
    const pasted = clipboard.map(o => ({
      ...o,
      id: crypto.randomUUID(),
      x: (o.x ?? 0) + offset,
      y: (o.y ?? 0) + offset,
      points: o.points?.map((p, i) => p + (i % 2 === 0 ? offset : offset)),
    }))
    const next = [...objects, ...pasted]
    commit(next)
    save(next)
    setSelectedIds(new Set(pasted.map(o => o.id)))
  }

  function duplicate() {
    if (!canEdit || selectedIds.size === 0) return
    const selected = objects.filter(o => selectedIds.has(o.id))
    const offset = 20
    const duped = selected.map(o => ({
      ...o,
      id: crypto.randomUUID(),
      x: (o.x ?? 0) + offset,
      y: (o.y ?? 0) + offset,
      points: o.points?.map((p, i) => p + (i % 2 === 0 ? offset : offset)),
    }))
    const next = [...objects, ...duped]
    commit(next)
    save(next)
    setSelectedIds(new Set(duped.map(o => o.id)))
  }

  function selectAll() {
    setSelectedIds(new Set(objects.map(o => o.id)))
  }

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return

      if (e.code === 'Space' && !spaceHeld) {
        e.preventDefault()
        setSpaceHeld(true)
      }

      if (isLocked && !['Space', 'Equal', 'Minus'].includes(e.code)) return

      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if (ctrl && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
      else if (ctrl && e.key === 'Z') { e.preventDefault(); redo() }
      else if (ctrl && e.key === 'c') { e.preventDefault(); copySelected() }
      else if (ctrl && e.key === 'v') { e.preventDefault(); paste() }
      else if (ctrl && e.key === 'd') { e.preventDefault(); duplicate() }
      else if (ctrl && e.key === 'a') { e.preventDefault(); selectAll() }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected() }
      else if (e.key === 'Escape') { setSelectedIds(new Set()) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelected(0, e.shiftKey ? -10 : -1) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveSelected(0, e.shiftKey ? 10 : 1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveSelected(e.shiftKey ? -10 : -1, 0) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); moveSelected(e.shiftKey ? 10 : 1, 0) }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  })

  function moveSelected(dx: number, dy: number) {
    if (!canEdit || selectedIds.size === 0) return
    const next = objects.map(o => {
      if (!selectedIds.has(o.id)) return o
      if (o.type === 'path' && o.points) {
        return { ...o, points: o.points.map((p, i) => p + (i % 2 === 0 ? dx : dy)) }
      }
      return { ...o, x: (o.x ?? 0) + dx, y: (o.y ?? 0) + dy }
    })
    commit(next)
    save(next)
  }

  /* ── Excalidraw-style scroll: wheel = pan, Ctrl+wheel = zoom ── */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        // Zoom centered on cursor
        const rect = el!.getBoundingClientRect()
        const cursorX = e.clientX - rect.left
        const cursorY = e.clientY - rect.top
        const delta = e.deltaY > 0 ? -0.08 : 0.08
        setZoom(prevZoom => {
          const newZoom = Math.max(0.1, Math.min(5, +(prevZoom + delta).toFixed(2)))
          // Adjust pan so zoom centers on cursor position
          const zoomRatio = newZoom / prevZoom
          const worldX = cursorX / prevZoom
          const worldY = cursorY / prevZoom
          const newWorldX = cursorX / newZoom
          const newWorldY = cursorY / newZoom
          setPanX(prev => prev + (newWorldX - worldX))
          setPanY(prev => prev + (newWorldY - worldY))
          return newZoom
        })
      } else {
        // Regular scroll = pan (like Excalidraw)
        const speed = 1
        setPanX(prev => prev - (e.deltaX * speed) / zoom)
        setPanY(prev => prev - (e.deltaY * speed) / zoom)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  /* ── Auto-focus inline text editor ── */
  useEffect(() => {
    if (editingText && textInputRef.current) {
      // Delay to let the browser settle after the pointer event
      const timer = setTimeout(() => {
        textInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [editingText?.id])

  /* ── Commit inline text ── */
  function commitInlineText() {
    if (!editingText) return
    const text = editingText.text.trim()
    if (!text) {
      setEditingText(null)
      return
    }
    if (editingText.isNew) {
      // Creating new text object
      const next = [...objects, { id: editingText.id, type: 'text' as const, x: editingText.x, y: editingText.y, text, color, fontSize: 18 }]
      commit(next)
      save(next)
    } else {
      // Editing existing text object
      const next = objects.map(o => o.id === editingText.id ? { ...o, text } : o)
      commit(next)
      save(next)
    }
    setEditingText(null)
  }

  /* ── Lock / Unlock ── */
  async function toggleLock() {
    if (!whiteboardId || !board) return
    try {
      if (isLocked) {
        await api.post(`/whiteboards/${whiteboardId}/unlock`)
        setIsLocked(false)
        toast('Board unlocked')
      } else {
        await api.post(`/whiteboards/${whiteboardId}/lock`)
        setIsLocked(true)
        toast('Board locked')
      }
    } catch (err: any) {
      toast(err.response?.data?.detail ?? 'Lock operation failed', 'error')
    }
  }

  /* ── Pointer handlers ── */
  async function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!board) return
    const { x, y } = getPoint(event)

    // Space+drag for panning
    if (spaceHeld) {
      setIsPanning(true)
      setPanStart({ x: event.clientX, y: event.clientY, px: panX, py: panY })
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (!canEdit) return

    if (tool === 'select') {
      // Check if clicked on a resize handle
      const handleEl = (event.target as Element).closest('[data-handle]')?.getAttribute('data-handle')
      if (handleEl && selectedIds.size > 0) {
        const sel = objects.filter(o => selectedIds.has(o.id))
        const bounds = getSelectionBounds(sel)
        if (bounds) {
          const origObjects = new Map<string, { x: number; y: number; w: number; h: number; points?: number[]; fontSize?: number }>()
          sel.forEach(o => {
            const b = getObjectBounds(o)
            origObjects.set(o.id, { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY, points: o.points ? [...o.points] : undefined, fontSize: o.fontSize })
          })
          setResizeHandle({ handle: handleEl, startX: x, startY: y, origBounds: bounds, origObjects })
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        return
      }

      // Check if clicked on the selection bounding box edge (for moving)
      const boxEl = (event.target as Element).closest('[data-selection-box]')
      if (boxEl && selectedIds.size > 0) {
        const origPositions = new Map<string, { x: number; y: number; points?: number[] }>()
        objects.forEach(o => {
          if (selectedIds.has(o.id)) {
            origPositions.set(o.id, { x: o.x ?? 0, y: o.y ?? 0, points: o.points ? [...o.points] : undefined })
          }
        })
        setDragStart({ x, y, origPositions: origPositions as any })
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }

      // Check if clicked on an object — only select it, don't drag
      const target = (event.target as Element).closest('[data-object]')?.getAttribute('data-object')

      if (target) {
        if (event.shiftKey) {
          setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(target)) next.delete(target)
            else next.add(target)
            return next
          })
        } else {
          setSelectedIds(new Set([target]))
        }
        return
      }

      // Start selection box on empty space
      if (!event.shiftKey) setSelectedIds(new Set())
      setSelectionStart({ x, y })
      setSelectionBox({ x, y, w: 0, h: 0 })
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (tool === 'eraser') {
      // Excalidraw-style: click to delete, drag to delete multiple
      const target = (event.target as Element).closest('[data-object]')?.getAttribute('data-object')
      if (target) {
        const next = objects.filter(item => item.id !== target)
        setEraserHoverId(null)
        commit(next)
        save(next)
      }
      setIsEraserDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (tool === 'text') {
      // Excalidraw-style: inline text editing at click position
      event.preventDefault()
      setEditingText({ id: crypto.randomUUID(), x, y, text: '', isNew: true, createdAt: Date.now() })
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    const id = crypto.randomUUID()
    if (tool === 'pencil') {
      setDraft({ id, type: 'path', points: [x, y], color })
    } else {
      setDraft({ id, type: tool, x, y, width: 0, height: 0, color })
    }
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const { x, y } = getPoint(event)

    // Throttle cursor broadcasts to ~30fps
    const now = Date.now()
    if (now - cursorThrottle.current > 33 && socket.current?.readyState === WebSocket.OPEN) {
      cursorThrottle.current = now
      socket.current.send(JSON.stringify({ type: 'cursor', x, y }))
    }

    // Eraser hover detection
    if (tool === 'eraser' && !isEraserDragging) {
      const target = (event.target as Element).closest('[data-object]')?.getAttribute('data-object')
      setEraserHoverId(target ?? null)
    }

    // Eraser drag-through: delete objects as cursor passes over them
    if (tool === 'eraser' && isEraserDragging) {
      const target = (event.target as Element).closest('[data-object]')?.getAttribute('data-object')
      if (target) {
        const next = objects.filter(item => item.id !== target)
        setEraserHoverId(null)
        commit(next)
        save(next)
      }
      return
    }

    // Panning
    if (isPanning && panStart) {
      const dx = (event.clientX - panStart.x) / zoom
      const dy = (event.clientY - panStart.y) / zoom
      setPanX(panStart.px + dx)
      setPanY(panStart.py + dy)
      return
    }

    // Resizing via handles
    if (resizeHandle && canEdit) {
      const dx = x - resizeHandle.startX
      const dy = y - resizeHandle.startY
      const { handle, origBounds, origObjects } = resizeHandle
      const ob = origBounds
      const obW = ob.maxX - ob.minX
      const obH = ob.maxY - ob.minY
      if (obW === 0 && obH === 0) return

      // Compute new bounds based on which handle is dragged
      let newMinX = ob.minX, newMinY = ob.minY, newMaxX = ob.maxX, newMaxY = ob.maxY
      if (handle.includes('w')) newMinX = Math.min(ob.minX + dx, ob.maxX - 4)
      if (handle.includes('e')) newMaxX = Math.max(ob.maxX + dx, ob.minX + 4)
      if (handle.includes('n')) newMinY = Math.min(ob.minY + dy, ob.maxY - 4)
      if (handle.includes('s')) newMaxY = Math.max(ob.maxY + dy, ob.minY + 4)

      const scaleX = obW > 0 ? (newMaxX - newMinX) / obW : 1
      const scaleY = obH > 0 ? (newMaxY - newMinY) / obH : 1

      setObjects(prev => prev.map(o => {
        if (!selectedIds.has(o.id)) return o
        const orig = origObjects.get(o.id)
        if (!orig) return o

        // Path objects: scale all points
        if (o.type === 'path' && orig.points) {
          const newPoints = orig.points.map((p, i) => {
            if (i % 2 === 0) return newMinX + (p - ob.minX) * scaleX
            return newMinY + (p - ob.minY) * scaleY
          })
          return { ...o, points: newPoints }
        }

        // Text objects: scale fontSize
        if (o.type === 'text') {
          const baseFontSize = orig.fontSize ?? 18
          const avgScale = (scaleX + scaleY) / 2
          return { ...o, x: newMinX + (orig.x - ob.minX) * scaleX, y: newMinY + (orig.y - ob.minY) * scaleY, fontSize: Math.max(8, baseFontSize * avgScale) }
        }

        // Regular shapes
        const nx = newMinX + (orig.x - ob.minX) * scaleX
        const ny = newMinY + (orig.y - ob.minY) * scaleY
        const nw = orig.w * scaleX
        const nh = orig.h * scaleY
        return { ...o, x: nx, y: ny, width: nw, height: nh }
      }))
      return
    }

    // Dragging selected objects
    if (dragStart && canEdit) {
      const dx = x - dragStart.x
      const dy = y - dragStart.y
      setObjects(prev => prev.map(o => {
        if (!selectedIds.has(o.id)) return o
        const orig = dragStart.origPositions.get(o.id) as any
        if (!orig) return o
        if (o.type === 'path' && orig.points) {
          return { ...o, points: orig.points.map((p: number, i: number) => p + (i % 2 === 0 ? dx : dy)) }
        }
        return { ...o, x: orig.x + dx, y: orig.y + dy }
      }))
      return
    }

    // Selection box
    if (selectionStart && tool === 'select') {
      const w = x - selectionStart.x
      const h = y - selectionStart.y
      setSelectionBox({
        x: w >= 0 ? selectionStart.x : x,
        y: h >= 0 ? selectionStart.y : y,
        w: Math.abs(w),
        h: Math.abs(h),
      })
      return
    }

    if (!draft || !canEdit) return
    if (draft.type === 'path') {
      setDraft({ ...draft, points: [...(draft.points ?? []), x, y] })
    } else {
      setDraft({ ...draft, width: x - (draft.x ?? x), height: y - (draft.y ?? y) })
    }
  }

  function handlePointerUp() {
    // End eraser drag
    if (isEraserDragging) {
      setIsEraserDragging(false)
      return
    }

    // End panning
    if (isPanning) {
      setIsPanning(false)
      setPanStart(null)
      return
    }

    // End resize
    if (resizeHandle) {
      const next = [...objects]
      commit(next)
      save(next)
      setResizeHandle(null)
      return
    }

    // End dragging
    if (dragStart) {
      const next = [...objects]
      commit(next)
      save(next)
      setDragStart(null)
      return
    }

    // End selection box
    if (selectionStart && selectionBox) {
      const box = selectionBox
      const inBox = objects.filter(o => {
        const ox = o.x ?? 0
        const oy = o.y ?? 0
        const ow = o.width ?? 0
        const oh = o.height ?? 0
        if (o.type === 'path' && o.points) {
          return o.points.some((_, i) => {
            if (i % 2 !== 0) return false
            const px = o.points![i]
            const py = o.points![i + 1]
            return px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h
          })
        }
        return ox + ow >= box.x && ox <= box.x + box.w && oy + oh >= box.y && oy <= box.y + box.h
      })
      setSelectedIds(new Set(inBox.map(o => o.id)))
      setSelectionBox(null)
      setSelectionStart(null)
      return
    }

    if (!draft || !canEdit) return
    const next = [...objects, draft]
    commit(next)
    save(next)
    setDraft(null)
  }

  /* ── Compute viewBox for infinite canvas ── */
  const vbW = (wrapRef.current?.clientWidth ?? 1200) / zoom
  const vbH = (wrapRef.current?.clientHeight ?? 720) / zoom
  const viewBox = `${-panX} ${-panY} ${vbW} ${vbH}`

  /* ── Get remote selection color for an object ── */
  function remoteSelectionColor(objId: string): string | null {
    for (const rs of remoteSelections) {
      if (rs.selected_ids.includes(objId)) return cursorColor(rs.user_id)
    }
    return null
  }

  /* ── Get bounds for a single object ── */
  function getObjectBounds(o: BoardObject): { minX: number; minY: number; maxX: number; maxY: number } {
    if (o.type === 'path' && o.points && o.points.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (let i = 0; i < o.points.length; i += 2) {
        minX = Math.min(minX, o.points[i]); maxX = Math.max(maxX, o.points[i])
        minY = Math.min(minY, o.points[i + 1]); maxY = Math.max(maxY, o.points[i + 1])
      }
      return { minX, minY, maxX, maxY }
    }
    if (o.type === 'text') {
      const x = o.x ?? 0, y = o.y ?? 0
      const fs = o.fontSize ?? 18
      const textLen = (o.text?.length ?? 1) * fs * 0.6
      return { minX: x, minY: y - fs, maxX: x + textLen, maxY: y + 4 }
    }
    const x = o.x ?? 0, y = o.y ?? 0, w = o.width ?? 0, h = o.height ?? 0
    return { minX: Math.min(x, x + w), minY: Math.min(y, y + h), maxX: Math.max(x, x + w), maxY: Math.max(y, y + h) }
  }

  /* ── Compute selection bounds helper ── */
  function getSelectionBounds(sel: BoardObject[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (sel.length === 0) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    sel.forEach(o => {
      const b = getObjectBounds(o)
      minX = Math.min(minX, b.minX); maxX = Math.max(maxX, b.maxX)
      minY = Math.min(minY, b.minY); maxY = Math.max(maxY, b.maxY)
    })
    if (minX === Infinity) return null
    return { minX, minY, maxX, maxY }
  }

  /* ── Render objects ── */
  const renderObject = (item: BoardObject) => {
    const isSelected = selectedIds.has(item.id)
    const remoteColor = remoteSelectionColor(item.id)
    const isEraserHover = tool === 'eraser' && eraserHoverId === item.id
    const common = {
      'data-object': item.id,
      stroke: item.type === 'text' ? 'none' : (isEraserHover ? '#ef4444' : item.color),
      fill: item.type === 'text' ? (isEraserHover ? '#ef4444' : item.color) : 'transparent',
      strokeWidth: item.type === 'text' ? 0 : (isEraserHover ? 3 : 2),
      style: {
        ...(isSelected ? {
          filter: 'drop-shadow(0 0 4px rgba(99, 102, 241, 0.7))',
        } : {}),
        ...(remoteColor ? {
          filter: `drop-shadow(0 0 3px ${remoteColor}88)`,
        } : {}),
        ...(isEraserHover ? {
          filter: 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))',
          opacity: 0.7,
        } : {}),
        cursor: tool === 'eraser' ? 'pointer' : 'default',
        transition: 'stroke 0.1s, opacity 0.1s, stroke-width 0.1s',
      } as React.CSSProperties,
    }

    switch (item.type) {
      case 'path':
        return <polyline key={item.id} {...common} points={(item.points ?? []).join(',')} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      case 'rect':
        return <rect key={item.id} {...common} x={item.x} y={item.y} width={item.width} height={item.height} rx={3} />
      case 'circle':
        return <ellipse key={item.id} {...common} cx={(item.x ?? 0) + (item.width ?? 0) / 2} cy={(item.y ?? 0) + (item.height ?? 0) / 2} rx={Math.abs(item.width ?? 0) / 2} ry={Math.abs(item.height ?? 0) / 2} />
      case 'arrow':
        return <line key={item.id} {...common} x1={item.x} y1={item.y} x2={(item.x ?? 0) + (item.width ?? 0)} y2={(item.y ?? 0) + (item.height ?? 0)} markerEnd="url(#arrow)" />
      case 'text': {
        const fs = item.fontSize ?? 18
        return <text key={item.id} {...common} x={item.x} y={item.y} fontSize={fs} fontFamily="'Caveat', cursive" fontWeight="400" onDoubleClick={(e) => {
          if (canEdit) {
            e.stopPropagation()
            setEditingText({ id: item.id, x: item.x ?? 0, y: item.y ?? 0, text: item.text ?? '', isNew: false, createdAt: Date.now() })
          }
        }}>{item.text}</text>
      }
      default:
        return null
    }
  }

  /* ── PowerPoint-style Selection Handles (8 handles) ── */
  function renderSelectionHandles() {
    if (selectedIds.size === 0 || !canEdit) return null
    const sel = objects.filter(o => selectedIds.has(o.id))
    const bounds = getSelectionBounds(sel)
    if (!bounds) return null

    const { minX, minY, maxX, maxY } = bounds
    const pad = 6
    const bx = minX - pad, by = minY - pad
    const bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2
    const hs = 8 / zoom // handle size scales with zoom
    const hh = hs / 2
    const cx = bx + bw / 2, cy = by + bh / 2

    const handles = [
      { id: 'nw', x: bx - hh, y: by - hh, cursor: 'nwse-resize' },
      { id: 'n',  x: cx - hh, y: by - hh, cursor: 'ns-resize' },
      { id: 'ne', x: bx + bw - hh, y: by - hh, cursor: 'nesw-resize' },
      { id: 'w',  x: bx - hh, y: cy - hh, cursor: 'ew-resize' },
      { id: 'e',  x: bx + bw - hh, y: cy - hh, cursor: 'ew-resize' },
      { id: 'sw', x: bx - hh, y: by + bh - hh, cursor: 'nesw-resize' },
      { id: 's',  x: cx - hh, y: by + bh - hh, cursor: 'ns-resize' },
      { id: 'se', x: bx + bw - hh, y: by + bh - hh, cursor: 'nwse-resize' },
    ]

    return (
      <g className="selection-handles">
        {/* Bounding box — draggable for moving */}
        <rect
          data-selection-box="true"
          x={bx} y={by} width={bw} height={bh}
          fill="transparent" stroke="#6366f1" strokeWidth={1.5 / zoom} strokeDasharray={`${4 / zoom} ${3 / zoom}`}
          rx={2}
          style={{ cursor: 'move' }}
        />
        {/* 8 resize handles */}
        {handles.map(h => (
          <rect
            key={h.id}
            data-handle={h.id}
            x={h.x} y={h.y}
            width={hs} height={hs}
            rx={1.5 / zoom}
            fill="#fff" stroke="#6366f1" strokeWidth={1.5 / zoom}
            style={{ cursor: h.cursor }}
          />
        ))}
      </g>
    )
  }

  /* ── Minimap ── */
  function Minimap() {
    const mW = 180, mH = 120
    let minX = 0, minY = 0, maxX = 1200, maxY = 720
    objects.forEach(o => {
      if (o.type === 'path' && o.points) {
        for (let i = 0; i < o.points.length; i += 2) {
          minX = Math.min(minX, o.points[i]); maxX = Math.max(maxX, o.points[i])
          minY = Math.min(minY, o.points[i + 1]); maxY = Math.max(maxY, o.points[i + 1])
        }
      } else {
        const x = o.x ?? 0, y = o.y ?? 0, w = o.width ?? 0, h = o.height ?? 0
        minX = Math.min(minX, x); maxX = Math.max(maxX, x + w)
        minY = Math.min(minY, y); maxY = Math.max(maxY, y + h)
      }
    })
    const pad = 100
    minX -= pad; minY -= pad; maxX += pad; maxY += pad
    const worldW = maxX - minX, worldH = maxY - minY
    const scale = Math.min(mW / worldW, mH / worldH)

    // Viewport rect
    const vpX = (-panX - minX) * scale
    const vpY = (-panY - minY) * scale
    const vpW = vbW * scale
    const vpH = vbH * scale

    function handleMinimapClick(e: React.MouseEvent<SVGSVGElement>) {
      const rect = e.currentTarget.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const worldX = mx / scale + minX
      const worldY = my / scale + minY
      setPanX(-(worldX - vbW / 2))
      setPanY(-(worldY - vbH / 2))
    }

    return (
      <div className="minimap">
        <svg width={mW} height={mH} onClick={handleMinimapClick} style={{ cursor: 'pointer' }}>
          <rect width={mW} height={mH} fill="#1e293b" rx={4} />
          {objects.map(o => {
            if (o.type === 'path' && o.points && o.points.length >= 4) {
              const pts = o.points.map((p, i) => ((p - (i % 2 === 0 ? minX : minY)) * scale)).join(',')
              return <polyline key={o.id} points={pts} stroke={o.color} fill="none" strokeWidth={0.5} opacity={0.6} />
            }
            const x = ((o.x ?? 0) - minX) * scale
            const y = ((o.y ?? 0) - minY) * scale
            const w = Math.max((o.width ?? 4) * scale, 2)
            const h = Math.max((o.height ?? 4) * scale, 2)
            return <rect key={o.id} x={x} y={y} width={w} height={h} fill={o.color} opacity={0.5} rx={1} />
          })}
          <rect x={vpX} y={vpY} width={vpW} height={vpH} fill="none" stroke="#6366f1" strokeWidth={1.5} rx={2} opacity={0.8} />
        </svg>
      </div>
    )
  }

  /* ── Error / Loading ── */
  if (error) {
    return (
      <main className="board-page" style={{ display: 'block' }}>
        <header>
          <div className="board-info">
            <Link to="/dashboard"><ArrowLeft size={16} /> Dashboard</Link>
          </div>
        </header>
        <div className="centered"><p className="error">{error}</p></div>
      </main>
    )
  }

  if (loading || !board) {
    return (
      <div className="centered">
        <div className="spinner" /> Loading whiteboard…
      </div>
    )
  }

  return (
    <main className="board-page">
      {/* Board Lock Banner */}
      {isLocked && (
        <div className="board-lock-banner">
          <Lock size={16} />
          <span>Board is Locked — Viewing only</span>
          {role === 'owner' && (
            <button className="btn-xs" onClick={toggleLock} style={{ marginLeft: 'auto' }}>
              <Unlock size={14} /> Unlock
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <header>
        <div className="board-info">
          <Link to={`/workspaces/${board.workspace_id}`}>
            <ArrowLeft size={15} />
          </Link>
          <span className="board-title">{board.title}</span>
        </div>
        <div className="board-meta">
          {isViewer && (
            <span className="viewer-badge">
              <Eye size={14} /> Viewer Mode
            </span>
          )}
          {role === 'owner' && !isLocked && (
            <button className="btn-xs btn-outline" onClick={toggleLock} title="Lock Board">
              <Lock size={14} /> Lock
            </button>
          )}
          <span><Save size={14} /> {objects.length} objects</span>

          {/* Online Users Toggle */}
          <div className="online-panel">
            <button className="online-toggle" onClick={() => setShowOnline(v => !v)}>
              <span className="live-dot" />
              <Users size={14} />
              {onlineUsers.length} online
              <ChevronDown size={12} />
            </button>
            {showOnline && (
              <div className="online-popover">
                <h4>Online Now</h4>
                {onlineUsers.length > 0 ? onlineUsers.map(u => (
                  <div className="member-item" key={u.user_id} style={{ padding: '0.5rem' }}>
                    <div
                      className="member-avatar"
                      style={{ width: 28, height: 28, fontSize: '0.7rem', background: cursorColor(u.user_id) + '22', color: cursorColor(u.user_id) }}
                    >
                      {u.user_name?.charAt(0).toUpperCase() || '?'}
                      <span className="online-dot" />
                    </div>
                    <div className="member-info">
                      <div className="member-name" style={{ fontSize: '0.82rem' }}>
                        {u.user_name}
                        {u.user_id === user?.id && <span className="you-tag">(You)</span>}
                      </div>
                    </div>
                    <span className={`badge ${u.role === 'owner' ? 'badge-accent' : u.role === 'editor' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.65rem' }}>
                      {u.role}
                    </span>
                  </div>
                )) : (
                  <p style={{ padding: '0.5rem', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>Just you!</p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="tool-group">
          {TOOL_CONFIG.map(t => (
            <button
              key={t.key}
              className={tool === t.key ? 'active' : ''}
              onClick={() => canEdit ? setTool(t.key) : (t.key === 'select' ? setTool(t.key) : null)}
              disabled={!canEdit && t.key !== 'select'}
              title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}`}
            >
              <t.icon size={18} />
            </button>
          ))}
        </div>

        <div className="tool-group">
          <input
            className="color-picker"
            aria-label="Stroke color"
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            disabled={!canEdit}
          />
        </div>

        <div className="tool-group">
          <button onClick={undo} disabled={!canEdit || !history.length} title="Undo (Ctrl+Z)">
            <Undo2 size={18} />
          </button>
          <button onClick={redo} disabled={!canEdit || !future.length} title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={18} />
          </button>
        </div>

        <div className="tool-group">
          <button onClick={copySelected} disabled={selectedIds.size === 0} title="Copy (Ctrl+C)">
            <Copy size={18} />
          </button>
          <button onClick={paste} disabled={!canEdit || clipboard.length === 0} title="Paste (Ctrl+V)">
            <Clipboard size={18} />
          </button>
        </div>

        <div className="tool-group zoom-controls">
          <button onClick={() => setZoom(v => Math.max(0.1, +(v - 0.1).toFixed(1)))} title="Zoom Out">
            <ZoomOut size={18} />
          </button>
          <span style={{ minWidth: '3rem', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(v => Math.min(5, +(v + 0.1).toFixed(1)))} title="Zoom In">
            <ZoomIn size={18} />
          </button>
        </div>

        {selectedIds.size > 0 && canEdit && (
          <div className="tool-group">
            <button className="active" style={{ background: 'var(--danger)' }} onClick={deleteSelected} title="Delete Selected (Del)">
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="canvas-wrap" ref={wrapRef}>
        <svg
          ref={svgRef}
          className={`board-canvas tool-${tool}${spaceHeld ? ' tool-pan' : ''}${isPanning ? ' panning' : ''}`}
          style={{ background: board.board_data.background, width: '100%', height: '100%' }}
          viewBox={viewBox}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L0,6 L9,3 z" fill={color} />
            </marker>
          </defs>

          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.5" fill="#cbd5e140" />
            </pattern>
          </defs>
          <rect x={-panX - 5000} y={-panY - 5000} width={vbW + 10000} height={vbH + 10000} fill="url(#grid)" />

          {/* Board objects */}
          {objects.map(renderObject)}
          {draft && renderObject(draft)}


          {/* Selection handles */}
          {renderSelectionHandles()}

          {/* Selection box */}
          {selectionBox && selectionBox.w > 0 && selectionBox.h > 0 && (
            <rect
              x={selectionBox.x} y={selectionBox.y}
              width={selectionBox.w} height={selectionBox.h}
              fill="rgba(99, 102, 241, 0.08)" stroke="#6366f1"
              strokeWidth={1} strokeDasharray="4 2" rx={2}
              pointerEvents="none"
            />
          )}

          {/* Remote cursors */}
          {Object.entries(cursors).map(([userId, cursor]) => (
            <g key={userId} className="remote-cursor" style={{ color: cursor.color }}>
              <g transform={`translate(${cursor.x}, ${cursor.y})`}>
                <path d="M0,0 L0,14 L4,11 L7,17 L9,16 L6,10 L11,10 Z" fill={cursor.color} stroke="#fff" strokeWidth="1" />
                <rect x="12" y="8" rx="3" ry="3" width={Math.max(cursor.name.length * 6.5 + 12, 36)} height="18" fill={cursor.color} opacity="0.9" />
                <text x="18" y="20" fontSize="10" fill="#fff" fontWeight="600">{cursor.name}</text>
              </g>
            </g>
          ))}
        </svg>

        {/* Inline text editor — HTML overlay outside SVG */}
        {editingText && (() => {
          const pos = canvasToScreen(editingText.x, editingText.y)
          return (
            <textarea
              ref={textInputRef}
              value={editingText.text}
              onChange={e => setEditingText(prev => prev ? { ...prev, text: e.target.value } : null)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  commitInlineText()
                }
                if (e.key === 'Escape') {
                  setEditingText(null)
                }
                e.stopPropagation()
              }}
              onBlur={() => {
                // Guard: don't dismiss if textarea was just created (prevents race condition)
                if (Date.now() - editingText.createdAt < 300) return
                commitInlineText()
              }}
              onPointerDown={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: pos.y - 4,
                left: pos.x,
                zIndex: 50,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                borderRadius: '0',
                color: color,
                fontSize: `${18 * zoom}px`,
                fontFamily: "'Caveat', cursive",
                fontWeight: 400,
                padding: '4px 6px',
                resize: 'none',
                overflow: 'hidden',
                whiteSpace: 'pre',
                minWidth: `${Math.max(120, (editingText.text.length + 2) * 10 * zoom)}px`,
                minHeight: `${28 * zoom}px`,
                lineHeight: '1.4',
                boxShadow: 'none',
              }}
            />
          )
        })()}

        {/* Minimap */}
        <Minimap />
      </div>

      {/* Collaboration Panel */}
      {showPanel && (
        <CollaborationPanel boardId={board.id} role={role} />
      )}
    </main>
  )
}
