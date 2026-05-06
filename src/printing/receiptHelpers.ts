const normalizeText = (value: string): string => String(value || '').replace(/\s+/g, ' ').trim();

export const padLeft = (value: string, width: number): string => {
  const text = String(value || '');
  if (text.length >= width) {
    return text;
  }
  return `${' '.repeat(width - text.length)}${text}`;
};

export const padRight = (value: string, width: number): string => {
  const text = String(value || '');
  if (text.length >= width) {
    return text;
  }
  return `${text}${' '.repeat(width - text.length)}`;
};

export const separator = (width: number, char = '-'): string => {
  return String(char || '-').charAt(0).repeat(Math.max(0, width));
};

export const centerText = (value: string, width: number): string => {
  const text = normalizeText(value);
  if (!text) {
    return '';
  }
  if (text.length >= width) {
    return text;
  }
  const totalPadding = width - text.length;
  const left = Math.floor(totalPadding / 2);
  const right = totalPadding - left;
  return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
};

export const leftRight = (left: string, right: string, width: number): string => {
  const leftText = normalizeText(left);
  const rightText = normalizeText(right);
  if (!rightText) {
    return padRight(leftText, width).slice(0, width);
  }
  if (rightText.length >= width) {
    return rightText.slice(-width);
  }
  if (leftText.length + rightText.length >= width) {
    const allowedLeft = Math.max(0, width - rightText.length - 1);
    const safeLeft = leftText.slice(0, allowedLeft);
    return `${safeLeft}${' '.repeat(width - safeLeft.length - rightText.length)}${rightText}`;
  }
  const spaces = width - leftText.length - rightText.length;
  return `${leftText}${' '.repeat(spaces)}${rightText}`;
};

export const wrapText = (value: string, width: number): string[] => {
  const text = normalizeText(value);
  if (!text) {
    return [''];
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    if (word.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }
      let start = 0;
      while (start < word.length) {
        lines.push(word.slice(start, start + width));
        start += width;
      }
      return;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
      return;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  });

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [''];
};

export const formatCurrency = (value: number): string => {
  const amount = Number(value || 0);
  const sign = amount < 0 ? '-' : '';
  const whole = Math.abs(Math.round(amount)).toString();
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}Rp${grouped}`;
};

export const formatReceiptAmount = (value: number): string => {
  const amount = Number(value || 0);
  const sign = amount < 0 ? '-' : '';
  const whole = Math.abs(Math.round(amount)).toString();
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped}`;
};

export const formatQty = (value: number): string => {
  const amount = Number(value || 0);
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
};
