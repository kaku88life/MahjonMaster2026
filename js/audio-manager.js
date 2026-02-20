const AudioManager = {
    ctx: null,
    enabled: true,
    buffers: {},

    init() {
        if (this.ctx) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.createClackBuffer();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    },

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    },

    createClackBuffer() {
        if (!this.ctx) return;
        // Create a short crisp noise (Click/Clack)
        const duration = 0.04;
        const sampleRate = this.ctx.sampleRate;
        const frameCount = sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, frameCount, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < frameCount; i++) {
            // White noise with decay
            // Envelope: Attack fast, decay exp
            const t = i / frameCount;
            const envelope = 1 - t;
            data[i] = (Math.random() * 2 - 1) * envelope;
        }
        this.buffers.clack = buffer;
    },

    playClack() {
        if (!this.ctx || !this.enabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        // Noise click
        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers.clack;

        // Filter to make it sound like plastic (Bandpass/Lowpass)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 3000;

        // Gain
        const gain = this.ctx.createGain();
        gain.gain.value = 0.8;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        source.start();

        // Optional: Add a high-pitch tone for "Ring"
        const osc = this.ctx.createOscillator();
        osc.frequency.setValueAtTime(2500, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.01);
        const ossGain = this.ctx.createGain();
        ossGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        ossGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.01);
        osc.connect(ossGain);
        ossGain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.02);
    }
};

window.AudioManager = AudioManager;
