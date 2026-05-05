const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export class EscPosBuilder {
  private readonly chunks: number[] = [];

  private appendBytes(...bytes: number[]): this {
    this.chunks.push(...bytes);
    return this;
  }

  private appendText(value: string): this {
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      this.chunks.push(code <= 255 ? code : 63);
    }
    return this;
  }

  // ESC @ => reset printer state before composing a new job.
  init(): this {
    return this.appendBytes(ESC, 0x40);
  }

  text(value: string): this {
    return this.appendText(value);
  }

  line(value: string): this {
    return this.text(value).feed(1);
  }

  feed(lines = 1): this {
    const safeLines = Math.max(1, Math.floor(lines));
    for (let index = 0; index < safeLines; index += 1) {
      this.appendBytes(LF);
    }
    return this;
  }

  // ESC a n => set alignment: 0 left, 1 center, 2 right.
  align(mode: 'left' | 'center' | 'right'): this {
    const alignValue = mode === 'center' ? 1 : mode === 'right' ? 2 : 0;
    return this.appendBytes(ESC, 0x61, alignValue);
  }

  // ESC E n => enable or disable bold mode.
  bold(enabled: boolean): this {
    return this.appendBytes(ESC, 0x45, enabled ? 1 : 0);
  }

  // GS ! n => scale width/height using 0-7 multipliers.
  size(widthMultiplier: number, heightMultiplier: number): this {
    const safeWidth = Math.max(0, Math.min(7, Math.floor(widthMultiplier) - 1));
    const safeHeight = Math.max(0, Math.min(7, Math.floor(heightMultiplier) - 1));
    const sizeValue = (safeWidth << 4) | safeHeight;
    return this.appendBytes(GS, 0x21, sizeValue);
  }

  // GS V m => cut paper when cutter is available.
  cut(): this {
    return this.appendBytes(GS, 0x56, 0x00);
  }

  // ESC p m t1 t2 => pulse cash drawer on pin 2.
  openCashDrawer(): this {
    return this.appendBytes(ESC, 0x70, 0x00, 0x19, 0xfa);
  }

  qr(value: string): this {
    const text = String(value || '').trim();
    if (!text) {
      return this;
    }

    const payloadLength = text.length + 3;
    const pL = payloadLength & 0xff;
    const pH = (payloadLength >> 8) & 0xff;

    this.appendBytes(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    this.appendBytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06);
    this.appendBytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30);
    this.appendBytes(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    this.appendText(text);
    this.appendBytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this.feed(1);
  }

  barcode(value: string): this {
    const text = String(value || '').trim();
    if (!text) {
      return this;
    }

    this.appendBytes(GS, 0x48, 0x02);
    this.appendBytes(GS, 0x68, 0x50);
    this.appendBytes(GS, 0x77, 0x02);
    this.appendBytes(GS, 0x6b, 0x49, text.length);
    this.appendText(text);
    return this.feed(1);
  }

  rasterImage(data: Uint8Array, widthBytes: number, height: number): this {
    const safeWidthBytes = Math.max(1, Math.floor(widthBytes));
    const safeHeight = Math.max(1, Math.floor(height));
    const xL = safeWidthBytes & 0xff;
    const xH = (safeWidthBytes >> 8) & 0xff;
    const yL = safeHeight & 0xff;
    const yH = (safeHeight >> 8) & 0xff;
    this.appendBytes(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);
    for (let index = 0; index < data.length; index += 1) {
      this.chunks.push(data[index]);
    }
    return this;
  }

  build(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}
