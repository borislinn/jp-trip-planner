const NS = "http://www.w3.org/2000/svg";

function svgEl(viewBox, label) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  return svg;
}

// Full pie chart. data: [{label, value, color}]. Returns an <svg>.
export function svgPie(data) {
  const slices = data.filter(d => d.value > 0);
  const total = slices.reduce((s, d) => s + d.value, 0);
  const svg = svgEl("0 0 120 120", "Spending by category");
  if (total <= 0) return svg;

  const cx = 60, cy = 60, r = 56;

  if (slices.length === 1) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", r);
    c.setAttribute("fill", slices[0].color);
    svg.appendChild(c);
    return svg;
  }

  let a0 = -Math.PI / 2;
  for (const d of slices) {
    const frac = d.value / total;
    const a1 = a0 + frac * 2 * Math.PI;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = frac > 0.5 ? 1 : 0;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d",
      `M ${cx} ${cy} L ${x0.toFixed(3)} ${y0.toFixed(3)} ` +
      `A ${r} ${r} 0 ${large} 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`);
    path.setAttribute("fill", d.color);
    svg.appendChild(path);
    a0 = a1;
  }
  return svg;
}

// Stacked daily bars with the day total printed on top of each bar.
// data: [{day, segments:[{category,amount}], total}]
// colorFor: (categoryId) => "#rrggbb"
// fmtTotal: (number) => string
export function svgStackedBars(data, colorFor, fmtTotal) {
  const W = 320, H = 190, padX = 22, padTop = 26, padBottom = 24;
  const svg = svgEl(`0 0 ${W} ${H}`, "Daily spending by category");
  if (!data.length) return svg;

  const max = Math.max(...data.map(d => d.total), 1);
  const plotH = H - padTop - padBottom;
  const slot = (W - padX * 2) / data.length;
  const bw = Math.min(46, slot * 0.6);

  data.forEach((d, i) => {
    const cx = padX + slot * i + slot / 2;
    let yTop = H - padBottom;
    for (const seg of d.segments) {
      const h = (seg.amount / max) * plotH;
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", cx - bw / 2);
      rect.setAttribute("y", yTop - h);
      rect.setAttribute("width", bw);
      rect.setAttribute("height", Math.max(1, h));
      rect.setAttribute("fill", colorFor(seg.category));
      svg.appendChild(rect);
      yTop -= h;
    }
    const total = document.createElementNS(NS, "text");
    total.setAttribute("x", cx);
    total.setAttribute("y", yTop - 6);
    total.setAttribute("font-size", "9");
    total.setAttribute("font-weight", "600");
    total.setAttribute("text-anchor", "middle");
    total.setAttribute("fill", "currentColor");
    total.textContent = fmtTotal(d.total);
    svg.appendChild(total);

    const dayLbl = document.createElementNS(NS, "text");
    dayLbl.setAttribute("x", cx);
    dayLbl.setAttribute("y", H - 8);
    dayLbl.setAttribute("font-size", "8");
    dayLbl.setAttribute("text-anchor", "middle");
    dayLbl.setAttribute("fill", "currentColor");
    dayLbl.textContent = d.day.slice(5);
    svg.appendChild(dayLbl);
  });
  return svg;
}
