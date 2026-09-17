import { dayCycleAt } from "./atmosphere.ts";

// Original instrumental score in eighth notes at 80 BPM. Both arrangements
// share a clock so sunset can blend them without restarting either phrase.
const STEP = 60 / 80 / 2;
const DAY_CHORDS = [
  [48, 55, 59, 64], [45, 52, 55, 60],
  [41, 48, 52, 57], [43, 50, 55, 59],
];
const NIGHT_CHORDS = [
  [36, 43, 50, 51], [32, 39, 46, 48],
  [29, 36, 43, 44], [31, 38, 44, 47],
];
const MELODY = [
  [76, 79, 74, 72, 71, 74, 79, 76],
  [72, 76, 79, 76, 74, 72, 71, 69],
  [69, 72, 76, 79, 76, 72, 74, 76],
  [74, 71, 67, 71, 74, 79, 74, 71],
];
const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Local music and cues. The context is created only inside a user gesture. */
export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private day: GainNode | null = null;
  private night: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private voices = new Set<OscillatorNode>();
  private nextStep = 0;
  private step = 0;
  private worldTime = 0;
  private hidden = false;
  private disposed = false;
  enabled = false;
  private lastHit = 0;

  private initialize() {
    const context = this.context ??= new AudioContext();
    if (this.master) return;
    const master = this.master = context.createGain();
    master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 4;
    master.connect(limiter).connect(context.destination);
    const music = context.createGain();
    music.gain.value = 0.65;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    music.connect(filter).connect(master);
    const echo = context.createDelay(1);
    echo.delayTime.value = STEP * 1.5;
    const feedback = context.createGain();
    feedback.gain.value = 0.22;
    filter.connect(echo).connect(feedback).connect(echo);
    feedback.connect(master);
    this.day = context.createGain();
    this.night = context.createGain();
    this.day.gain.value = 0;
    this.night.gain.value = 0;
    this.day.connect(music);
    this.night.connect(music);
    this.nodes = [master, limiter, music, filter, echo, feedback, this.day, this.night];
  }

  async start() {
    if (this.disposed) return false;
    this.enabled = true;
    try {
      this.initialize();
      await this.context!.resume();
      if (this.disposed) return false;
      this.update(this.worldTime, this.hidden);
      return this.enabled;
    } catch (error) {
      this.enabled = false;
      this.master?.gain.setTargetAtTime(0, this.context!.currentTime, 0.04);
      throw error;
    }
  }

  async toggle() {
    if (!this.enabled) return this.start();
    this.enabled = false;
    this.update(this.worldTime, this.hidden);
    return false;
  }

  update(worldTime: number, hidden = false) {
    this.worldTime = worldTime;
    this.hidden = hidden;
    const context = this.context;
    if (!context || !this.master || this.disposed) return;
    const now = context.currentTime;
    const audible = this.enabled && !hidden;
    this.master.gain.setTargetAtTime(audible ? 0.8 : 0, now, 0.08);
    if (!audible || context.state !== "running") return;
    const darkness = dayCycleAt(worldTime).darkness;
    this.day!.gain.setTargetAtTime(Math.cos(darkness * Math.PI / 2), now, 0.8);
    this.night!.gain.setTargetAtTime(Math.sin(darkness * Math.PI / 2), now, 0.8);
    // Never play a backlog after a muted/background tab. Schedule only a short
    // look-ahead on the audio clock, independent of the rendering frame rate.
    if (this.nextStep < now) this.nextStep = now + 0.025;
    while (this.nextStep < now + 0.18) {
      this.score(this.step++, this.nextStep);
      this.nextStep += STEP;
    }
  }

  private score(step: number, time: number) {
    const bar = Math.floor(step / 32) % 4;
    const beat = step % 32;
    const day = DAY_CHORDS[bar], night = NIGHT_CHORDS[bar];
    if (beat === 0) {
      for (const note of day)
        this.note(frequency(note), 12.4, time, "sine", 0.026, this.day!, 1.2);
      for (const note of night)
        this.note(frequency(note), 12.4, time, "triangle", 0.018, this.night!, 1.4);
    }
    if (beat % 2 === 0) {
      const index = [0, 2, 1, 3, 2, 1, 3, 1][(beat / 2) % 8];
      this.note(frequency(day[index] + 12), 1.6, time, "sine", 0.035, this.day!, 0.025);
      const pitch = night[beat % 8 === 6 ? 2 : 0] + 12;
      this.note(frequency(pitch), 0.42, time, "triangle", 0.047, this.night!, 0.018);
    }
    if (beat % 4 === 0) {
      const melody = MELODY[bar][beat / 4];
      this.note(frequency(melody), 2.1, time, "sine", 0.043, this.day!, 0.14);
      this.note(frequency(melody + 12), 1.1, time, "sine", 0.008, this.day!, 0.04);
      this.note(48, 0.26, time, "sine", 0.095, this.night!, 0.008, 31);
      this.note(55, 0.18, time + STEP * 0.7, "sine", 0.046, this.night!, 0.008, 35);
    }
    if (beat === 12 || beat === 28)
      this.note(frequency(night[3] + 24), 2.7, time, "sine", 0.03, this.night!, 0.5);
  }

  private note(
    pitch: number, duration: number, start: number, type: OscillatorType,
    volume: number, output: AudioNode, attack = 0.005, endPitch?: number,
  ) {
    const context = this.context!;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(pitch, start);
    if (endPitch)
      oscillator.frequency.exponentialRampToValueAtTime(endPitch, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(output);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private tone(
    pitch: number, duration: number, delay = 0,
    type: OscillatorType = "sine", volume = 0.04,
  ) {
    if (!this.enabled || !this.context || !this.master || this.disposed) return;
    this.note(pitch, duration, this.context.currentTime + delay, type, volume, this.master);
  }

  hit(tree: boolean) {
    const now = performance.now();
    if (now - this.lastHit < 90) return;
    this.lastHit = now;
    this.tone(tree ? 180 : 290, 0.07, 0, "triangle", 0.06);
    this.tone(tree ? 95 : 160, 0.1, 0.025, "sine", 0.035);
  }
  purchase() {
    [523, 659, 784].forEach((note, i) => this.tone(note, 0.22, i * 0.07));
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.enabled = false;
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
    for (const node of this.nodes) node.disconnect();
    this.nodes = [];
    void this.context?.close();
  }
}
