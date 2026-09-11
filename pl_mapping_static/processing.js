function normalizeSeries(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return values.map(() => null);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = Math.max(1e-12, max - min);
  return values.map((value) => Number.isFinite(value) ? (value - min) / range : null);
}

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const a = matrix.map((row, rowIndex) => [...row, vector[rowIndex]]);
  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(a[row][pivot]) > Math.abs(a[maxRow][pivot])) maxRow = row;
    }
    if (Math.abs(a[maxRow][pivot]) < 1e-12) return null;
    if (maxRow !== pivot) [a[pivot], a[maxRow]] = [a[maxRow], a[pivot]];
    const pivotValue = a[pivot][pivot];
    for (let col = pivot; col <= size; col += 1) a[pivot][col] /= pivotValue;
    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = a[row][pivot];
      for (let col = pivot; col <= size; col += 1) a[row][col] -= factor * a[pivot][col];
    }
  }
  return a.map((row) => row[size]);
}

function smoothSeries(values, rawWindow, rawPoly) {
  const length = values.length;
  let windowSize = Number(rawWindow);
  let polyOrder = Number(rawPoly);
  if (!Number.isInteger(windowSize)) windowSize = 7;
  if (!Number.isInteger(polyOrder)) polyOrder = 2;
  if (windowSize < 3) windowSize = 3;
  if (windowSize > length) windowSize = length;
  polyOrder = Math.max(1, Math.min(polyOrder, windowSize - 1));
  if (windowSize < 3 || windowSize <= polyOrder || windowSize > length) return values.slice();

  const half = Math.floor(windowSize / 2);
  const degreeCount = polyOrder + 1;
  const output = new Array(length);

  for (let center = 0; center < length; center += 1) {
    if (!Number.isFinite(values[center])) { output[center] = null; continue; }
    const start = Math.max(0, Math.min(length - windowSize, center - half));
    const xtx = Array.from({ length: degreeCount }, () => Array(degreeCount).fill(0));
    const xty = Array(degreeCount).fill(0);

    for (let localIndex = 0; localIndex < windowSize; localIndex += 1) {
      const sourceIndex = start + localIndex;
      if (!Number.isFinite(values[sourceIndex])) continue;
      const x = sourceIndex - center;
      const powers = Array(degreeCount).fill(1);
      for (let power = 1; power < degreeCount; power += 1) powers[power] = powers[power - 1] * x;
      for (let row = 0; row < degreeCount; row += 1) {
        xty[row] += powers[row] * values[sourceIndex];
        for (let col = 0; col < degreeCount; col += 1) xtx[row][col] += powers[row] * powers[col];
      }
    }

    const coefficients = solveLinearSystem(xtx, xty);
    output[center] = coefficients ? coefficients[0] : values[center];
  }

  return output;
}

function safeReferenceDenominator(value) {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-12) return null;
  return value;
}

function applyReferenceDivision(yValues, referenceValues, referenceOffset) {
  const length = Math.min(yValues.length, referenceValues.length);
  const offset = Number(referenceOffset) || 0;
  const output = new Array(length);
  for (let index = 0; index < length; index += 1) {
    const reference = referenceValues[index];
    const denominator = Number.isFinite(reference) ? safeReferenceDenominator(reference + offset) : null;
    const value = Number.isFinite(yValues[index]) && denominator !== null ? yValues[index] / denominator : null;
    output[index] = Number.isFinite(value) ? value : null;
  }
  return output;
}


if (typeof module !== "undefined") module.exports = {normalizeSeries, smoothSeries, applyReferenceDivision};

// Exact SI h*c/e expressed in eV nm. Intensity remains counts per measured channel.
const SPECTRAL_HC = 1239.8419843320026;
function spectralConvert(value, from, to, laserNm) {
  if (!Number.isFinite(value)) throw new Error('Spectral coordinates must be finite.');
  if (from === to) return value;
  if ((from === 'raman' || to === 'raman') && !(Number.isFinite(laserNm) && laserNm > 0))
    throw new Error('Enter the excitation laser wavelength in nm for Raman shift.');
  let nm;
  if (from === 'nm') nm = value;
  else if (from === 'eV') nm = SPECTRAL_HC / value;
  else if (from === 'wavenumber') nm = 1e7 / value;
  else if (from === 'raman') nm = 1e7 / (1e7 / laserNm - value);
  else throw new Error('Uncalibrated channel indices cannot be converted to physical units.');
  if (!(Number.isFinite(nm) && nm > 0)) throw new Error('The coordinate does not represent a positive wavelength.');
  if (to === 'nm') return nm;
  if (to === 'eV') return SPECTRAL_HC / nm;
  if (to === 'wavenumber') return 1e7 / nm;
  if (to === 'raman') return 1e7 / laserNm - 1e7 / nm;
  throw new Error('Unknown spectral unit.');
}
function spectralLabel(unit) {
  return {nm:['Wavelength','nm'],eV:['Energy','eV'],raman:['Raman shift','cm⁻¹'],wavenumber:['Wavenumber','cm⁻¹']}[unit];
}
function convertSpectralPayload(payload, from, to, laserNm) {
  if (!payload || (payload.wavelength_unit || payload.x_unit) === 'index') return payload;
  const out = {...payload};
  const convert = value => spectralConvert(value, from, to, laserNm);
  for (const key of ['x','wavelengths']) if (Array.isArray(out[key])) out[key] = out[key].map(convert);
  for (const key of ['min_wavelength','max_wavelength','target_wavelength','range_start_wavelength','range_end_wavelength'])
    if (Number.isFinite(out[key])) out[key] = convert(out[key]);
  for (const [a,b] of [['min_wavelength','max_wavelength'],['range_start_wavelength','range_end_wavelength']])
    if (Number.isFinite(out[a]) && Number.isFinite(out[b]) && out[a] > out[b]) [out[a],out[b]]=[out[b],out[a]];
  const [label,unit] = spectralLabel(to);
  if ('wavelength_unit' in out) {out.wavelength_unit=unit;out.wavelength_axis_label=label;}
  if ('x_unit' in out) {out.x_unit=unit;out.x_label=label;}
  return out;
}
if (typeof module !== 'undefined') Object.assign(module.exports,{spectralConvert,convertSpectralPayload});
