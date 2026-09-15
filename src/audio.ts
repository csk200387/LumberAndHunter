/** Small, local synthesized cues. Audio starts only after an explicit user gesture. */
export class GameAudio {
  private context: AudioContext | null = null;
  enabled = false;
  private lastHit = 0;

  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ??= new AudioContext();
      await this.context.resume();
      this.purchase();
    }
    return this.enabled;
  }

  private tone(
    frequency: number,
    duration: number,
    delay = 0,
    type: OscillatorType = "sine",
    volume = 0.04,
  ) {
    const context = this.context;
    if (!this.enabled || !context) return;
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      start = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
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
    void this.context?.close();
  }
}
