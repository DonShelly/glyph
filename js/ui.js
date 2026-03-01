// UI controls — builds algorithm-specific parameter sliders

class UI {
  constructor() {
    this.paramContainer = document.getElementById('algoParams');
    this.paramValues = {};
    this.listeners = {};
  }

  buildParams(algoClass) {
    this.paramContainer.innerHTML = '';
    this.paramValues = {};
    const params = algoClass.params || [];

    if (params.length === 0) return;

    const title = document.createElement('label');
    title.textContent = algoClass.label + ' Settings';
    title.style.color = '#666';
    this.paramContainer.appendChild(title);

    for (const p of params) {
      const group = document.createElement('div');
      group.className = 'param-group';

      if (p.type === 'select') {
        const label = document.createElement('label');
        label.textContent = p.label;
        group.appendChild(label);

        const sel = document.createElement('select');
        for (const opt of p.options) {
          const o = document.createElement('option');
          o.value = opt; o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
          if (opt === p.def) o.selected = true;
          sel.appendChild(o);
        }
        this.paramValues[p.key] = p.def;
        sel.addEventListener('change', () => {
          this.paramValues[p.key] = sel.value;
          this._emit('change');
        });
        group.appendChild(sel);
      } else {
        const valSpan = document.createElement('span');
        valSpan.textContent = p.def;

        const label = document.createElement('label');
        label.textContent = p.label + ' ';
        label.appendChild(valSpan);
        group.appendChild(label);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = p.min; slider.max = p.max; slider.step = p.step; slider.value = p.def;
        this.paramValues[p.key] = p.def;
        slider.addEventListener('input', () => {
          const v = parseFloat(slider.value);
          this.paramValues[p.key] = v;
          valSpan.textContent = v;
          this._emit('change');
        });
        group.appendChild(slider);
      }

      this.paramContainer.appendChild(group);
    }
  }

  getParams() { return { ...this.paramValues }; }

  on(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  _emit(event) {
    for (const fn of (this.listeners[event] || [])) fn();
  }
}

window.UI = UI;
