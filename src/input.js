// Tipkovnica i gamepad. Volan pozitivan = lijevo.

const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const DEADZONE = 0.08;

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.kbThrottle = 0;
    this.kbBrake = 0;
    this.kbSteer = 0;
    this.padPrev = [];
    addEventListener('keydown', (e) => {
      // Tipkanje u poljima (prijava, panel postavki) nije vožnja.
      if (e.target.closest && e.target.closest('#tuning, input, textarea, select')) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  consume(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  any(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  // Gumbi gamepada koji su upravo pritisnuti.
  padPressed(index) {
    const p = this.pad();
    if (!p) return false;
    const down = !!p.buttons[index]?.pressed;
    const was = !!this.padPrev[index];
    this.padPrev[index] = down;
    return down && !was;
  }

  read(dt) {
    const up = this.any('KeyW', 'ArrowUp');
    const down = this.any('KeyS', 'ArrowDown');
    // Tipke ne mogu dozirati gas, pa se gas i kočnica kratko pojačavaju umjesto da skoče na 100%.
    this.kbThrottle = up ? Math.min(1, this.kbThrottle + dt * 6) : Math.max(0, this.kbThrottle - dt * 12);
    this.kbBrake = down ? Math.min(1, this.kbBrake + dt * 6) : Math.max(0, this.kbBrake - dt * 12);
    // Volan s tipkovnice se okreće postupno: kratak dodir je mala korekcija, a pun zakret traži držanje.
    const steerKey = (this.any('KeyA', 'ArrowLeft') ? 1 : 0) - (this.any('KeyD', 'ArrowRight') ? 1 : 0);
    const back = steerKey === 0 || steerKey * this.kbSteer < 0;
    const steerRate = (back ? 7 : 3) * dt;
    this.kbSteer += Math.max(-steerRate, Math.min(steerRate, steerKey - this.kbSteer));
    let steer = this.kbSteer;
    let throttle = this.kbThrottle;
    let brake = this.kbBrake;
    let handbrake = this.any('Space') ? 1 : 0;
    let shiftUp = this.consume('KeyE');
    let shiftDown = this.consume('KeyQ');

    const p = this.pad();
    if (p) {
      const x = p.axes[0] || 0;
      if (Math.abs(x) > DEADZONE) steer = -Math.sign(x) * ((Math.abs(x) - DEADZONE) / (1 - DEADZONE));
      throttle = Math.max(throttle, p.buttons[7]?.value || 0);
      brake = Math.max(brake, p.buttons[6]?.value || 0);
      if (p.buttons[0]?.pressed || p.buttons[2]?.pressed) handbrake = 1;
      shiftUp = shiftUp || this.padPressed(5);
      shiftDown = shiftDown || this.padPressed(4);
    }
    return { throttle, brake, steer, handbrake, shiftUp, shiftDown };
  }
}
