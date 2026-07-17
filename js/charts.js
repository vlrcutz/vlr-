// charts.js — minimal canvas bar/line charts, no external dependency
const Charts = {
  bar(canvas, labels, values, { color = "#C89B3C", valueFmt = (v) => v } = {}) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 160;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const max = Math.max(1, ...values);
    const padBottom = 22;
    const padTop = 16;
    const n = Math.max(1, values.length);
    const gap = 8;
    const barW = Math.max(2, (w - gap * (n + 1)) / n);

    ctx.font = "11px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#8C8474";
    ctx.textAlign = "center";

    values.forEach((v, i) => {
      const x = gap + i * (barW + gap);
      const barH = ((h - padBottom - padTop) * v) / max;
      const y = h - padBottom - barH;
      const grad = ctx.createLinearGradient(0, y, 0, h - padBottom);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "rgba(200,155,60,0.35)");
      ctx.fillStyle = grad;
      const r = Math.max(0, Math.min(6, barW / 2));
      roundRect(ctx, x, y, barW, Math.max(barH, 2), r);
      ctx.fill();
      ctx.fillStyle = "#8C8474";
      ctx.fillText(labels[i], x + barW / 2, h - 6);
    });
  },

  line(canvas, labels, values, { color = "#6B9B6E" } = {}) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 160;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const max = Math.max(1, ...values);
    const min = Math.min(0, ...values);
    const padBottom = 22;
    const padTop = 12;
    const n = values.length;
    const stepX = n > 1 ? (w - 16) / (n - 1) : 0;

    const yFor = (v) => padTop + (h - padBottom - padTop) * (1 - (v - min) / (max - min || 1));

    ctx.beginPath();
    values.forEach((v, i) => {
      const x = 8 + i * stepX;
      const y = yFor(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // fill under curve
    ctx.lineTo(8 + (n - 1) * stepX, h - padBottom);
    ctx.lineTo(8, h - padBottom);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padTop, 0, h - padBottom);
    grad.addColorStop(0, "rgba(107,155,110,0.35)");
    grad.addColorStop(1, "rgba(107,155,110,0)");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.font = "10px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#8C8474";
    ctx.textAlign = "center";
    const labelEvery = Math.ceil(n / 6) || 1;
    labels.forEach((lab, i) => {
      if (i % labelEvery === 0) ctx.fillText(lab, 8 + i * stepX, h - 6);
    });
  },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
