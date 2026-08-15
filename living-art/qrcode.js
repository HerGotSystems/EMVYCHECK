/* EMVY CHECK Living Art V2 — dependency-free QR code encoder.

   A small, self-contained implementation of ISO/IEC 18004 (byte mode
   only - everything we encode here is a URL). No external library, no
   network fetch, no tracking. Supports versions 1-40 at error-correction
   levels L/M/Q/H and picks the smallest version that fits the given text
   at the requested level.

   Renders to a boolean module matrix (`encode()`), plus a small helper
   to draw that matrix onto a <canvas> (`renderToCanvas()`). */
(function (global) {
  'use strict';

  // ---- GF(256) arithmetic (primitive polynomial 0x11D) ---------------------
  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();
  function gfMul(a, b) { if (a === 0 || b === 0) return 0; return GF_EXP[GF_LOG[a] + GF_LOG[b]]; }

  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= gfMul(poly[j], 1);
        next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
      }
      poly = next;
    }
    return poly; // coefficients, highest degree first
  }

  function rsEncode(dataCodewords, ecCount) {
    const generator = rsGeneratorPoly(ecCount);
    const result = dataCodewords.slice();
    for (let i = 0; i < ecCount; i++) result.push(0);
    for (let i = 0; i < dataCodewords.length; i++) {
      const coef = result[i];
      if (coef === 0) continue;
      for (let j = 0; j < generator.length; j++) {
        result[i + j] ^= gfMul(generator[j], coef);
      }
    }
    return result.slice(dataCodewords.length);
  }

  // ---- capacity / block tables (byte mode, per version 1-40) ---------------
  // [totalCodewords, [ecPerBlockL,groupsL...], ...] - we only need, per EC
  // level: ecCodewordsPerBlock, and the block layout (count1,size1,count2,size2).
  const EC_LEVELS = { L: 0, M: 1, Q: 2, H: 3 };

  // Total data capacity in codewords (bytes) at each EC level, per version 1-40.
  const DATA_CODEWORDS = [
    [19, 16, 13, 9], [34, 28, 22, 16], [55, 44, 34, 26], [80, 64, 48, 36], [108, 86, 62, 46],
    [136, 108, 76, 60], [156, 124, 88, 66], [194, 154, 110, 86], [232, 182, 132, 100], [274, 216, 154, 122],
    [324, 254, 180, 140], [370, 290, 206, 158], [428, 334, 244, 180], [461, 365, 261, 197], [523, 415, 295, 223],
    [589, 453, 325, 253], [647, 507, 367, 283], [721, 563, 397, 313], [795, 627, 445, 341], [861, 669, 485, 385],
    [932, 714, 512, 406], [1006, 782, 568, 442], [1094, 860, 614, 464], [1174, 914, 664, 514], [1258, 1000, 718, 538],
    [1338, 1062, 754, 596], [1433, 1128, 808, 628], [1531, 1193, 871, 661], [1631, 1267, 911, 701], [1735, 1373, 985, 745],
    [1843, 1455, 1033, 793], [1955, 1541, 1115, 845], [2071, 1631, 1171, 901], [2191, 1725, 1231, 961], [2306, 1812, 1286, 986],
    [2434, 1914, 1354, 1054], [2566, 1992, 1426, 1096], [2702, 2102, 1502, 1142], [2812, 2216, 1582, 1222], [2956, 2334, 1666, 1276]
  ];

  // Error-correction codewords per block, and block group layout, per version
  // 1-40 x EC level. Each entry: [ecPerBlock, blocksGroup1, sizeGroup1, blocksGroup2, sizeGroup2]
  const BLOCK_TABLE = {
    L: [
      [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0], [26, 1, 108, 0, 0],
      [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0], [30, 2, 116, 0, 0], [18, 2, 68, 2, 69],
      [20, 4, 81, 0, 0], [24, 2, 92, 2, 93], [26, 4, 107, 0, 0], [30, 3, 115, 1, 116], [22, 5, 87, 1, 88],
      [24, 5, 98, 1, 99], [28, 1, 107, 5, 108], [30, 5, 120, 1, 121], [28, 3, 113, 4, 114], [28, 3, 107, 5, 108],
      [28, 4, 116, 4, 117], [28, 2, 111, 7, 112], [30, 4, 121, 5, 122], [30, 6, 117, 4, 118], [26, 8, 106, 4, 107],
      [28, 10, 114, 2, 115], [30, 8, 122, 4, 123], [30, 3, 117, 10, 118], [30, 7, 116, 7, 117], [30, 5, 115, 10, 116],
      [30, 13, 115, 3, 116], [30, 17, 115, 0, 0], [30, 17, 115, 1, 116], [30, 13, 115, 6, 116], [30, 12, 121, 7, 122],
      [30, 6, 121, 14, 122], [30, 17, 122, 4, 123], [30, 4, 122, 18, 123], [30, 20, 117, 4, 118], [30, 19, 118, 6, 119]
    ],
    M: [
      [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
      [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
      [30, 1, 50, 4, 51], [22, 6, 36, 2, 37], [22, 8, 37, 1, 38], [24, 4, 40, 5, 41], [24, 5, 41, 5, 42],
      [28, 7, 45, 3, 46], [28, 10, 46, 1, 47], [26, 9, 43, 4, 44], [26, 3, 44, 11, 45], [26, 3, 41, 13, 42],
      [26, 17, 42, 0, 0], [28, 17, 46, 0, 0], [28, 4, 47, 14, 48], [28, 6, 45, 14, 46], [28, 8, 47, 13, 48],
      [28, 19, 46, 4, 47], [28, 22, 45, 3, 46], [28, 3, 45, 23, 46], [28, 21, 45, 7, 46], [28, 19, 47, 10, 48],
      [28, 2, 46, 29, 47], [28, 10, 46, 23, 47], [28, 14, 46, 21, 47], [28, 14, 46, 23, 47], [28, 12, 47, 26, 48],
      [28, 6, 47, 34, 48], [28, 29, 46, 14, 47], [28, 13, 46, 32, 47], [28, 40, 47, 7, 48], [28, 18, 47, 31, 48]
    ],
    Q: [
      [13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0], [26, 2, 24, 0, 0], [18, 2, 15, 2, 16],
      [24, 4, 19, 0, 0], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19], [20, 4, 16, 4, 17], [24, 6, 19, 2, 20],
      [28, 4, 22, 4, 23], [26, 4, 20, 6, 21], [24, 8, 20, 4, 21], [20, 11, 16, 5, 17], [30, 5, 24, 7, 25],
      [24, 15, 19, 2, 20], [28, 1, 22, 15, 23], [28, 17, 22, 1, 23], [26, 17, 21, 4, 22], [30, 15, 24, 5, 25],
      [28, 17, 22, 6, 23], [30, 7, 24, 16, 25], [30, 11, 24, 14, 25], [30, 11, 24, 16, 25], [30, 7, 24, 22, 25],
      [28, 28, 22, 6, 23], [30, 8, 23, 26, 24], [30, 4, 24, 31, 25], [30, 1, 23, 37, 24], [30, 15, 24, 25, 25],
      [30, 42, 24, 1, 25], [30, 10, 24, 35, 25], [30, 29, 24, 19, 25], [30, 44, 24, 7, 25], [30, 39, 24, 14, 25],
      [30, 46, 24, 10, 25], [30, 49, 24, 10, 25], [30, 48, 24, 14, 25], [30, 43, 24, 22, 25], [30, 34, 24, 34, 25]
    ],
    H: [
      [17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0], [22, 2, 11, 2, 12],
      [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15], [24, 4, 12, 4, 13], [28, 6, 15, 2, 16],
      [24, 3, 12, 8, 13], [28, 7, 14, 4, 15], [22, 12, 11, 4, 12], [24, 11, 12, 5, 13], [24, 11, 12, 7, 13],
      [30, 3, 15, 13, 16], [28, 2, 14, 17, 15], [28, 2, 14, 19, 15], [26, 9, 13, 16, 14], [28, 15, 15, 10, 16],
      [30, 19, 16, 6, 17], [24, 34, 13, 0, 0], [30, 16, 15, 14, 16], [30, 30, 16, 2, 17], [30, 22, 15, 13, 16],
      [30, 33, 16, 4, 17], [30, 12, 15, 28, 16], [30, 11, 15, 31, 16], [30, 19, 15, 26, 16], [30, 23, 15, 25, 16],
      [30, 23, 15, 28, 16], [30, 19, 15, 35, 16], [30, 11, 15, 46, 16], [30, 59, 16, 1, 17], [30, 22, 15, 41, 16],
      [30, 2, 15, 64, 16], [30, 24, 15, 46, 16], [30, 42, 15, 32, 16], [30, 10, 15, 67, 16], [30, 20, 15, 61, 16]
    ]
  };

  const ALIGNMENT_POSITIONS = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
    [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
    [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]
  ];

  const FORMAT_GENERATOR = 0x537;
  const FORMAT_MASK = 0x5412;
  const VERSION_GENERATOR = 0x1F25;

  function bchFormat(data) {
    let d = data << 10;
    for (let i = 14; i >= 10; i--) if (d & (1 << i)) d ^= FORMAT_GENERATOR << (i - 10);
    return ((data << 10) | d) ^ FORMAT_MASK;
  }
  function bchVersion(data) {
    let d = data << 12;
    for (let i = 17; i >= 12; i--) if (d & (1 << i)) d ^= VERSION_GENERATOR << (i - 12);
    return (data << 12) | d;
  }

  function textToBytes(str) {
    return Array.from(new TextEncoder().encode(str));
  }

  function chooseVersion(byteLength, ecLevel) {
    for (let v = 1; v <= 40; v++) {
      const countBits = v <= 9 ? 8 : 16;
      const headerBits = 4 + countBits;
      const capacityBits = DATA_CODEWORDS[v - 1][EC_LEVELS[ecLevel]] * 8;
      const neededBits = headerBits + byteLength * 8;
      if (neededBits <= capacityBits) return v;
    }
    return null; // text too long even at version 40
  }

  function buildBitStream(bytes, version, ecLevel) {
    const bits = [];
    function push(value, len) { for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1); }
    push(0b0100, 4); // byte mode
    push(bytes.length, version <= 9 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });

    const capacityBits = DATA_CODEWORDS[version - 1][EC_LEVELS[ecLevel]] * 8;
    for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    const padBytes = [0xEC, 0x11];
    let pi = 0;
    while (bits.length < capacityBits) { push(padBytes[pi % 2], 8); pi++; }
    return bits;
  }

  function bitsToBytes(bits) {
    const out = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
      out.push(b);
    }
    return out;
  }

  function buildCodewords(bytes, version, ecLevel) {
    const bits = buildBitStream(bytes, version, ecLevel);
    const dataCodewords = bitsToBytes(bits);
    const [ecPerBlock, count1, size1, count2, size2] = BLOCK_TABLE[ecLevel][version - 1];

    const blocks = [];
    let offset = 0;
    for (let i = 0; i < count1; i++) { blocks.push(dataCodewords.slice(offset, offset + size1)); offset += size1; }
    for (let i = 0; i < count2; i++) { blocks.push(dataCodewords.slice(offset, offset + size2)); offset += size2; }

    const ecBlocks = blocks.map(function (block) { return rsEncode(block, ecPerBlock); });

    const maxDataLen = Math.max(size1, size2 || 0);
    const interleavedData = [];
    for (let i = 0; i < maxDataLen; i++) {
      blocks.forEach(function (block) { if (i < block.length) interleavedData.push(block[i]); });
    }
    const interleavedEc = [];
    for (let i = 0; i < ecPerBlock; i++) {
      ecBlocks.forEach(function (block) { interleavedEc.push(block[i]); });
    }
    return interleavedData.concat(interleavedEc);
  }

  const REMAINDER_BITS = [
    0, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0
  ];

  function buildMatrix(version) {
    const size = version * 4 + 17;
    const modules = [];
    const reserved = [];
    for (let i = 0; i < size; i++) { modules.push(new Array(size).fill(false)); reserved.push(new Array(size).fill(false)); }

    function setFn(row, col, val) { modules[row][col] = val; reserved[row][col] = true; }

    function placeFinder(row, col) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = row + r, cc = col + c;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          const isWhiteRing = r === -1 || r === 7 || c === -1 || c === 7;
          setFn(rr, cc, !isWhiteRing && (isBorder || isCore));
        }
      }
    }
    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    for (let i = 8; i < size - 8; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    setFn(size - 8, 8, true); // dark module

    const positions = ALIGNMENT_POSITIONS[version - 1];
    positions.forEach(function (row) {
      positions.forEach(function (col) {
        // skip alignment patterns overlapping the finder patterns
        if ((row <= 8 && col <= 8) || (row <= 8 && col >= size - 9) || (row >= size - 9 && col <= 8)) return;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const isBorder = r === -2 || r === 2 || c === -2 || c === 2;
            const isCenter = r === 0 && c === 0;
            setFn(row + r, col + c, isBorder || isCenter);
          }
        }
      });
    });

    // reserve format info areas
    for (let i = 0; i < 9; i++) { reserved[8][i] = true; reserved[i][8] = true; }
    for (let i = 0; i < 8; i++) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true; }

    if (version >= 7) {
      for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) { reserved[r][size - 11 + c] = true; reserved[size - 11 + c][r] = true; }
    }

    return { size, modules, reserved };
  }

  function placeData(matrix, codewords) {
    const { size, modules, reserved } = matrix;
    const bits = [];
    codewords.forEach(function (byte) { for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1); });
    let bitIndex = 0;
    let upward = true;
    for (let colPair = size - 1; colPair > 0; colPair -= 2) {
      if (colPair === 6) colPair = 5; // skip the vertical timing column
      for (let i = 0; i < size; i++) {
        const row = upward ? size - 1 - i : i;
        for (let c = 0; c < 2; c++) {
          const col = colPair - c;
          if (reserved[row][col]) continue;
          const bit = bitIndex < bits.length ? bits[bitIndex] : 0;
          modules[row][col] = !!bit;
          bitIndex++;
        }
      }
      upward = !upward;
    }
    return modules;
  }

  const MASK_FUNCS = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r, c) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return ((r * c) % 2) + ((r * c) % 3) === 0; },
    function (r, c) { return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; },
    function (r, c) { return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; }
  ];

  function applyMask(matrix, dataModules, maskIndex) {
    const { size, reserved } = matrix;
    const out = [];
    for (let r = 0; r < size; r++) {
      out.push(new Array(size));
      for (let c = 0; c < size; c++) {
        let v = dataModules[r][c];
        if (!reserved[r][c] && MASK_FUNCS[maskIndex](r, c)) v = !v;
        out[r][c] = v;
      }
    }
    return out;
  }

  function penalty(grid, size) {
    let score = 0;
    // rule 1: runs of 5+ same-colour modules in a row/column
    function runPenalty(getCell) {
      let p = 0;
      for (let i = 0; i < size; i++) {
        let run = 1;
        for (let j = 1; j < size; j++) {
          if (getCell(i, j) === getCell(i, j - 1)) { run++; } else { if (run >= 5) p += 3 + (run - 5); run = 1; }
        }
        if (run >= 5) p += 3 + (run - 5);
      }
      return p;
    }
    score += runPenalty(function (i, j) { return grid[i][j]; });
    score += runPenalty(function (i, j) { return grid[j][i]; });
    // rule 2: 2x2 blocks of same colour
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = grid[r][c];
        if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) score += 3;
      }
    }
    // rule 3: finder-like patterns
    const pattern = [true, false, true, true, true, false, true];
    function hasPattern(cells) {
      for (let i = 0; i + 6 < cells.length; i++) {
        let match = true;
        for (let k = 0; k < 7; k++) if (cells[i + k] !== pattern[k]) { match = false; break; }
        if (match) {
          const before = cells.slice(Math.max(0, i - 4), i).every(function (v) { return v === false; });
          const after = cells.slice(i + 7, i + 11).every(function (v) { return v === false; });
          if (before || after) return true;
        }
      }
      return false;
    }
    for (let r = 0; r < size; r++) if (hasPattern(grid[r])) score += 40;
    for (let c = 0; c < size; c++) { const col = []; for (let r = 0; r < size; r++) col.push(grid[r][c]); if (hasPattern(col)) score += 40; }
    // rule 4: overall dark proportion
    let dark = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (grid[r][c]) dark++;
    const percent = (dark / (size * size)) * 100;
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;
    return score;
  }

  function encode(text, ecLevel) {
    ecLevel = EC_LEVELS.hasOwnProperty(ecLevel) ? ecLevel : 'M';
    const bytes = textToBytes(text);
    const version = chooseVersion(bytes.length, ecLevel);
    if (!version) throw new Error('Text too long for a QR code');

    const codewords = buildCodewords(bytes, version, ecLevel);
    const matrix = buildMatrix(version);
    const dataModules = placeData(matrix, codewords);

    let best = null, bestScore = Infinity, bestMask = 0;
    for (let m = 0; m < 8; m++) {
      const masked = applyMask(matrix, dataModules, m);
      const score = penalty(masked, matrix.size);
      if (score < bestScore) { bestScore = score; best = masked; bestMask = m; }
    }

    const formatBits = bchFormat((EC_LEVELS[ecLevel] === 0 ? 1 : EC_LEVELS[ecLevel] === 1 ? 0 : EC_LEVELS[ecLevel] === 2 ? 3 : 2) << 3 | bestMask);
    // ISO format-level bits: L=01, M=00, Q=11, H=10
    placeFormatInfo(best, matrix.size, formatBits);
    if (version >= 7) placeVersionInfo(best, matrix.size, bchVersion(version));

    return { size: matrix.size, modules: best, version: version, ecLevel: ecLevel };
  }

  function placeFormatInfo(modules, size, bits) {
    function bit(i) { return ((bits >> i) & 1) === 1; }
    for (let i = 0; i < 15; i++) {
      const v = bit(i);
      // vertical copy, column 8
      if (i < 6) modules[i][8] = v;
      else if (i < 8) modules[i + 1][8] = v;
      else modules[size - 15 + i][8] = v;
      // horizontal copy, row 8
      if (i < 8) modules[8][size - i - 1] = v;
      else if (i < 9) modules[8][15 - i - 1 + 1] = v;
      else modules[8][15 - i - 1] = v;
    }
    modules[size - 8][8] = true;
  }

  function placeVersionInfo(modules, size, bits) {
    for (let i = 0; i < 18; i++) {
      const bitVal = ((bits >> i) & 1) === 1;
      const row = Math.floor(i / 3), col = i % 3;
      modules[row][size - 11 + col] = bitVal;
      modules[size - 11 + col][row] = bitVal;
    }
  }

  function renderToCanvas(canvas, matrixResult, opts) {
    opts = opts || {};
    const quiet = opts.quietZone == null ? 4 : opts.quietZone;
    const scale = opts.scale || 6;
    const dark = opts.dark || '#0b0b0c';
    const light = opts.light || '#ffffff';
    const size = matrixResult.size + quiet * 2;
    canvas.width = size * scale;
    canvas.height = size * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = dark;
    for (let r = 0; r < matrixResult.size; r++) {
      for (let c = 0; c < matrixResult.size; c++) {
        if (matrixResult.modules[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
    return canvas;
  }

  global.LivingArtQR = { encode: encode, renderToCanvas: renderToCanvas };
})(window);
