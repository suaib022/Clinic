// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import VoiceInput from '@/components/feedback/VoiceInput';

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  mimeType = 'audio/webm;codecs=opus';
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: unknown) {
    FakeRecorder.instances.push(this);
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

const track = { stop: vi.fn() };
const stream = { getTracks: () => [track] };

function setSupport(supported: boolean, permission: 'ok' | 'denied' = 'ok') {
  if (supported) {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          if (permission === 'denied') throw new DOMException('denied', 'NotAllowedError');
          return stream;
        }),
      },
    });
  } else {
    vi.stubGlobal('MediaRecorder', undefined);
    vi.stubGlobal('navigator', {});
  }
}

describe('VoiceInput', () => {
  beforeEach(() => {
    FakeRecorder.instances = [];
    track.stop.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders nothing when the browser cannot record', () => {
    setSupport(false);
    const { container } = render(<VoiceInput onText={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows an error when microphone permission is denied, and stays idle', async () => {
    setSupport(true, 'denied');
    render(<VoiceInput onText={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /speak/i }));
    expect(await screen.findByText(/microphone permission/i)).toBeTruthy();
    expect(FakeRecorder.instances).toHaveLength(0);
  });

  it('records, uploads, and hands the transcript to onText', async () => {
    setSupport(true);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: 'the doctor was kind' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const onText = vi.fn();
    render(<VoiceInput onText={onText} />);

    fireEvent.click(screen.getByRole('button', { name: /speak/i }));
    await waitFor(() => expect(FakeRecorder.instances).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));

    await waitFor(() => expect(onText).toHaveBeenCalledWith('the doctor was kind'));
    expect(fetchMock).toHaveBeenCalledWith('/api/feedback/transcribe', expect.objectContaining({ method: 'POST' }));
    expect(track.stop).toHaveBeenCalled();
  });

  it('shows an error and calls nothing when transcription fails', async () => {
    setSupport(true);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Could not transcribe right now. You can type your comment instead.' }), { status: 502 })));
    const onText = vi.fn();
    render(<VoiceInput onText={onText} />);
    fireEvent.click(screen.getByRole('button', { name: /speak/i }));
    await waitFor(() => expect(FakeRecorder.instances).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(await screen.findByText(/type your comment instead/i)).toBeTruthy();
    expect(onText).not.toHaveBeenCalled();
  });

  it('is disabled while the parent is submitting', () => {
    setSupport(true);
    render(<VoiceInput onText={() => {}} disabled />);
    expect((screen.getByRole('button', { name: /speak/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
