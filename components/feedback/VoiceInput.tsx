'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};
const canRecord = () =>
  typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

const MAX_SECONDS = 60;

type Phase = 'idle' | 'recording' | 'transcribing';

/** Mic button: record a short comment, send it for speech-to-text, return the text. Never auto-submits. */
export default function VoiceInput({
  onText,
  disabled = false,
}: {
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  // Server render says "no", the browser says what it really supports. No setState-in-effect.
  const supported = useSyncExternalStore(noopSubscribe, canRecord, () => false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!supported) return null;

  const stopRecording = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    recorderRef.current?.stop();
  };

  const start = async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone permission was denied. You can type your comment instead.');
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const type = (recorder.mimeType || 'audio/webm').split(';')[0];
      const blob = new Blob(chunksRef.current, { type });
      setPhase('transcribing');
      try {
        const form = new FormData();
        form.append('audio', blob, 'comment');
        const res = await fetch('/api/feedback/transcribe', { method: 'POST', body: form });
        const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok || typeof body.text !== 'string') {
          setError(body.error || 'Could not transcribe right now. You can type your comment instead.');
          return;
        }
        if (body.text) onText(body.text);
        else setError('We could not hear anything. Please try again or type your comment.');
      } catch {
        setError('Could not transcribe right now. You can type your comment instead.');
      } finally {
        setPhase('idle');
      }
    };

    recorder.start();
    setPhase('recording');
    timerRef.current = setTimeout(stopRecording, MAX_SECONDS * 1000);
  };

  const label =
    phase === 'recording' ? 'Stop' : phase === 'transcribing' ? 'Transcribing…' : 'Speak your comment';

  return (
    <div className="d-flex flex-column gap-1">
      <button
        type="button"
        className={`btn btn-sm align-self-start ${phase === 'recording' ? 'btn-danger' : 'btn-outline-primary'}`}
        disabled={disabled || phase === 'transcribing'}
        onClick={() => (phase === 'recording' ? stopRecording() : start())}
        aria-label={label}
      >
        <i className={`bi ${phase === 'recording' ? 'bi-stop-circle' : 'bi-mic'} me-1`}></i>
        {label}
      </button>
      {phase === 'recording' && (
        <div className="small text-danger">Recording… tap Stop when done (max {MAX_SECONDS} seconds).</div>
      )}
      {error && <div className="small text-danger">{error}</div>}
    </div>
  );
}
