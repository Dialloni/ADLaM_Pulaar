import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, X, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

// Reusable mic recorder. Captures audio via MediaRecorder, hands the parent a
// Blob (or null when cleared) plus a preview <audio>. Used both in the public
// collector (contributor audio) and the admin queue (verified Pulaar audio).
export function AudioRecorder({
  value,
  onChange,
  label,
  hint,
  accent = '#3b82f6',
  disabled = false,
}: {
  value: Blob | null;
  onChange: (blob: Blob | null) => void;
  label: string;
  hint?: string;
  accent?: string;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Build/tear down an object URL whenever the blob changes.
  useEffect(() => {
    if (!value) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  // Stop the mic + timer on unmount so we don't leak the stream.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // Pick a mimeType the browser actually supports (Safari ≠ Chrome).
  function pickMime(): string {
    const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg'];
    for (const m of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        onChange(blob);
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : 'Could not access microphone',
      );
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function clear() {
    onChange(null);
    setElapsed(0);
    setPlaying(false);
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); } else { el.play(); }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="rounded-2xl border border-white/8 p-5 space-y-3" style={{ background: '#131313' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{label}</p>
        {hint && <span className="text-xs text-zinc-600">{hint}</span>}
      </div>

      {/* recorded preview */}
      {value && previewUrl ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:opacity-80"
            style={{ background: `${accent}25`, color: accent, border: `1px solid ${accent}50` }}>
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <audio
            ref={audioRef}
            src={previewUrl}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            className="flex-1"
            controls
          />
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
            style={{ background: '#f87171', color: '#fff' }}
            title="Remove recording">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : recording ? (
        <button
          type="button"
          onClick={stop}
          className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-xl font-bold text-sm transition-all"
          style={{ background: '#f8717120', color: '#f87171', border: '1px solid #f8717140' }}>
          <Square className="w-4 h-4 animate-pulse" fill="#f87171" />
          Stop · {fmt(elapsed)}
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          className={cn(
            'w-full flex items-center justify-center gap-3 px-5 py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-40',
          )}
          style={{ background: `${accent}18`, color: accent, border: `1px dashed ${accent}50` }}>
          {disabled ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          Record audio
        </button>
      )}

      {error && (
        <p className="text-xs font-bold" style={{ color: '#f87171' }}>{error}</p>
      )}
    </div>
  );
}
