import { App, TFile } from 'obsidian';
import type { ReducedImageOrientation, RotationDirection } from '../../settings/schema';

export type LogLevel = 'info' | 'error';
export interface Logger {
  info(msg: string): void;
  error(msg: string): void;
}

export interface PreparedImageOptions {
  subjectDir: string;
  photosSubdir?: string; // defaults to "photos"
  photosDir?: string;    // absolute photos directory (overrides subjectDir/photosSubdir when provided)
  maxW?: number; // default 750
  maxH?: number; // default 1000
  aiMax?: number; // default 512
  keepOriginal?: boolean; // default false
  orientation?: ReducedImageOrientation;
  rotationDirection?: RotationDirection;
  logger?: Logger;
}

/**
 * PreparedImage owns the lifecycle of turning a source image TFile into a note-ready
 * photo in subject/photos (JPEG as needed), while also providing a small AI-specific
 * base64 for model calls. It separates in-memory preparation from disk writes.
 */
export class PreparedImage {
  private readonly app: App;
  private sourceFile: TFile;
  private logger?: Logger;

  private subjectDir: string;
  private photosSubdir: string;
  private photosDir?: string;
  private maxW: number;
  private maxH: number;
  private aiMax: number;
  private keepOriginal: boolean;
  private orientation: ReducedImageOrientation;
  private rotationDirection: RotationDirection;

  // In-memory state after ensurePrepared()
  private originalBuf?: ArrayBuffer;
  private preparedBuf?: ArrayBuffer; // JPEG buffer if resized, else undefined
  private preparedWidth = 0;
  private preparedHeight = 0;
  private needsResize = false;

  // Cached encodings
  private noteBase64?: string;
  private aiBase64?: string;

  // On-disk state after writeFile()
  private persistedFile?: TFile;

  // Cached EXIF data after first parse
  private exifData?: ExifData | null;

  constructor(app: App, file: TFile, opts: PreparedImageOptions) {
    this.app = app;
    this.sourceFile = file;
    this.logger = opts.logger;
    this.subjectDir = opts.subjectDir;
    this.photosSubdir = opts.photosSubdir || 'photos';
  this.photosDir = opts.photosDir;
    this.maxW = opts.maxW ?? 750;
    this.maxH = opts.maxH ?? 1000;
    this.aiMax = opts.aiMax ?? 512;
    this.keepOriginal = !!opts.keepOriginal;
    this.orientation = opts.orientation || 'maintain';
    this.rotationDirection = opts.rotationDirection || 'clockwise';
  }

  // Public API

  /**
   * Load source bytes, measure, and (if needed) produce a resized JPEG buffer in memory.
   * Returns true when preparation is ready; false when an error occurred (already logged).
   */
  async ensurePrepared(): Promise<boolean> {
    try {
      this.logInfo('Reading image bytes...');
      this.originalBuf = await this.app.vault.readBinary(this.sourceFile);
    } catch {
      this.logError(`Failed to read the image file: ${this.sourceFile.name}.`);
      return false;
    }

    const { w, h } = await this.measure(this.originalBuf).catch(() => ({ w: 0, h: 0 }));
    if (!w || !h) {
      this.logError('Could not read image dimensions.');
      return false;
    }
    this.logInfo(`Image dimensions: ${w}×${h}`);

    // Check for explicit rotation requirement
    let effectiveW = w;
    let effectiveH = h;
    let rotate = false; 

    if (this.orientation === 'landscape' && h > w) {
        effectiveW = h;
        effectiveH = w;
        rotate = true;
    } else if (this.orientation === 'portrait' && w > h) {
        effectiveW = h;
        effectiveH = w;
        rotate = true;
    }

    const { targetW, targetH, needsResize } = this.computeScaledDims(effectiveW, effectiveH, this.maxW, this.maxH);
    this.needsResize = needsResize || rotate;
    if (!needsResize && !rotate) {
      // No resize needed; noteBase64 from original buf
      this.preparedWidth = w; this.preparedHeight = h;
      this.noteBase64 = this.toBase64(this.originalBuf);
      return true;
    }

    this.logInfo(`Resizing/Rotating image to fit within ${this.maxW}×${this.maxH}...`);
    try {
      this.preparedBuf = await this.resizeToJpeg(
        this.originalBuf, 
        targetW, 
        targetH, 
        0.9, 
        rotate ? (this.rotationDirection === 'counter-clockwise' ? 'ccw' : 'cw') : 'none'
      );
      this.preparedWidth = targetW; this.preparedHeight = targetH;
      this.noteBase64 = this.toBase64(this.preparedBuf);
      return true;
    } catch (e) {
      this.logError('Failed to resize image.');
      console.error(e);
      return false;
    }
  }

  /**
   * Persist the prepared photo into subject/photos.
   * - If resized: write a new JPEG (collision-safe name derived from source name).
   * - If not resized: move the existing file into photos/ if not already there.
   * Optionally deletes the original depending on keepOriginal setting.
   */
  async writeFile(): Promise<TFile> {
    const photosDir = this.photosDir || `${this.subjectDir}/${this.photosSubdir}`;
    await this.ensureFolder(photosDir);

    if (!this.needsResize) {
      // move if needed, else leave in place
      const isInPhotos = this.sourceFile.path.startsWith(`${photosDir}/`);
      if (!isInPhotos) {
        const newPath = `${photosDir}/${this.sourceFile.name}`;
        this.logInfo('Moving image into photos directory.');
        await this.app.fileManager.renameFile(this.sourceFile, newPath);
        const moved = this.app.vault.getAbstractFileByPath(newPath) as TFile | null;
        if (!moved) throw new Error('move-failed');
        this.persistedFile = moved;
      } else {
        this.logInfo('Image already within size limits and in photos directory.');
        this.persistedFile = this.sourceFile;
      }
      return this.persistedFile!;
    }

    // needsResize: write JPEG to photos/
    if (!this.preparedBuf) throw new Error('prepared-buffer-missing');
    const baseName = this.sourceFile.name.replace(/\.[^.]+$/, '');
    let candidate = `${baseName}.jpg`;
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(`${photosDir}/${candidate}`)) {
      candidate = `${baseName}-resized${counter === 1 ? '' : '-' + counter}.jpg`;
      counter++;
    }
    const finalPath = `${photosDir}/${candidate}`;
    this.logInfo(`Writing JPEG: ${candidate} (${this.preparedWidth}×${this.preparedHeight}).`);
    // @ts-ignore createBinary exists at runtime
    const created = await (this.app.vault as any).createBinary(finalPath, this.preparedBuf);
    this.persistedFile = created as TFile;

    this.persistedFile = created as TFile;
    return this.persistedFile;
  }

  /**
   * Delete the original source file if configured to do so (and if it wasn't just moved).
   * Should be called only after the entire workflow succeeds.
   */
  async deleteOriginal(): Promise<void> {
    if (!this.keepOriginal && this.needsResize) {
      try {
        await this.app.vault.delete(this.sourceFile);
        this.logInfo('Deleted original image.');
      } catch (e) {
        this.logError('Failed to delete original image.');
        console.error(e);
      }
    } else if (!this.keepOriginal && !this.needsResize) {
       // If we didn't resize, we likely moved the file, so we don't delete it (it's the same file).
       // Logic in writeFile handles the move.
    }
  }

  /**
   * Return a small base64 (<= aiMax on the longest edge) suitable for LLM ingestion.
   * Computed lazily and cached. Uses the best available buffer (resized note JPEG if present
   * else original buffer).
   */
  async getAiImageBase64(): Promise<string> {
    if (this.aiBase64) return this.aiBase64;
    if (!this.originalBuf && !this.preparedBuf) throw new Error('ensurePrepared must be called first');

    const buf = this.preparedBuf || this.originalBuf!;
    const { w, h } = await this.measure(buf);
    const maxDim = Math.max(w, h);
    if (maxDim <= this.aiMax) {
      this.aiBase64 = this.toBase64(buf);
      return this.aiBase64;
    }
    const scale = this.aiMax / maxDim;
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);
    const smallBuf = await this.resizeToJpeg(buf, targetW, targetH, 0.8);
    this.aiBase64 = this.toBase64(smallBuf);
    return this.aiBase64;
  }

  /**
   * Collision-safe rename of the persisted file to the provided base (no extension).
   * Only valid after writeFile(). Returns the renamed TFile.
   */
  async renameTo(baseNoExt: string): Promise<TFile> {
    if (!this.persistedFile) throw new Error('rename requires writeFile() first');
    const photosDir = `${this.subjectDir}/${this.photosSubdir}`;
    const safeBase = baseNoExt.replace(/[^a-z0-9_\-]/gi, '_').replace(/_+/g, '_').toLowerCase();
    let candidate = `${safeBase}.jpg`;
    let n = 2;
    while (this.app.vault.getAbstractFileByPath(`${photosDir}/${candidate}`)) {
      candidate = `${safeBase}_${n}.jpg`;
      n++;
    }
    const desiredPath = `${photosDir}/${candidate}`;
    if (this.persistedFile.path === desiredPath) return this.persistedFile;
    this.logInfo(`Renaming photo to ${candidate}...`);
    await this.app.fileManager.renameFile(this.persistedFile, desiredPath);
    const renamed = this.app.vault.getAbstractFileByPath(desiredPath) as TFile | null;
    if (renamed) this.persistedFile = renamed;
    return this.persistedFile!;
  }

  getNoteBase64(): string {
    if (!this.noteBase64) throw new Error('ensurePrepared must be called first');
    return this.noteBase64;
  }

  getPreparedFile(): TFile | undefined { return this.persistedFile; }

  /**
   * Parse and return EXIF metadata from the original image buffer, if present.
   * Especially useful fields: latitude/longitude/altitude and dateTimeOriginal.
   * Returns null when EXIF is missing or parsing fails.
   */
  async getExifData(): Promise<ExifData | null> {
    if (this.exifData !== undefined) return this.exifData;
    if (!this.originalBuf) throw new Error('ensurePrepared must be called first');
    try {
      // Dynamically import to keep startup light; bundled by esbuild for production
      const exifr: any = await import('exifr');
      // Include XMP to catch GPS written in XMP blocks by some tools
      const raw = await exifr.parse(this.originalBuf, { tiff: true, ifd0: true, exif: true, gps: true, xmp: true });
      if (!raw || typeof raw !== 'object') {
        this.exifData = null; return null;
      }
      const dto = raw.DateTimeOriginal || raw.dateTimeOriginal || raw.CreateDate || raw.CreateDateTime;
      const dateTimeOriginal = dto instanceof Date ? dto.toISOString() : (dto ? String(dto) : null);
      let latitude: number | null | undefined = typeof raw.latitude === 'number' ? raw.latitude : (raw.GPSLatitude ?? null);
      let longitude: number | null | undefined = typeof raw.longitude === 'number' ? raw.longitude : (raw.GPSLongitude ?? null);
      // Fallback: try exifr.gps() convenience parser if missing
      if ((latitude === null || latitude === undefined) || (longitude === null || longitude === undefined)) {
        try {
          const gps = await exifr.gps(this.originalBuf);
          if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
            latitude = gps.latitude;
            longitude = gps.longitude;
          }
        } catch {/* ignore fallback errors */}
      }

      const exif: ExifData = {
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        altitude: raw.altitude ?? raw.GPSAltitude ?? null,
        orientation: raw.Orientation ?? raw.orientation ?? null,
        make: raw.Make || raw.make || '',
        model: raw.Model || raw.model || '',
        lensModel: raw.LensModel || raw.lensModel || '',
        focalLength: raw.FocalLength || raw.focalLength || null,
        exposureTime: raw.ExposureTime || raw.exposureTime || null,
        fNumber: raw.FNumber || raw.fNumber || null,
        iso: raw.ISO || raw.iso || null,
        dateTimeOriginal
      };
      this.exifData = exif;
      return exif;
    } catch (e) {
      this.logError('Failed to parse EXIF metadata.');
      console.error(e);
      this.exifData = null;
      return null;
    }
  }

  // Internal helpers (ported from the previous ImageProcessor)

  private logInfo(msg: string) { this.logger?.info(msg); }
  private logError(msg: string) { this.logger?.error(msg); }

  private async measure(buffer: ArrayBuffer): Promise<{ w: number; h: number }> {
    return await this.withObjectUrl(buffer, (url) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject; img.src = url;
    }));
  }

  private computeScaledDims(w: number, h: number, maxW: number, maxH: number) {
    const needsResize = w > maxW || h > maxH;
    if (!needsResize) return { targetW: w, targetH: h, needsResize: false };
    const scale = Math.min(maxW / w, maxH / h);
    return { targetW: Math.round(w * scale), targetH: Math.round(h * scale), needsResize: true };
  }

  private async resizeToJpeg(sourceBuffer: ArrayBuffer, targetW: number, targetH: number, quality = 0.9, rotate: 'none' | 'cw' | 'ccw' | boolean = 'none'): Promise<ArrayBuffer> {
    const { canvas, ctx } = this.makeCanvas(targetW, targetH);
    await this.withObjectUrl(sourceBuffer, (url) => new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => { 
        if (rotate === 'cw' || rotate === true) {
          ctx.translate(targetW, 0);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(img, 0, 0, targetH, targetW);
        } else if (rotate === 'ccw') {
          ctx.translate(0, targetH);
          ctx.rotate(-Math.PI / 2);
          ctx.drawImage(img, 0, 0, targetH, targetW);
        } else {
          ctx.drawImage(img, 0, 0, targetW, targetH); 
        }
        resolve(); 
      };
      img.onerror = reject; img.src = url;
    }));
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('toBlob-null');
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // SOI check
    if (!(bytes[0] === 0xFF && bytes[1] === 0xD8)) throw new Error('jpeg-soi-missing');
    // EOI fallback
    if (!(bytes[bytes.length - 2] === 0xFF && bytes[bytes.length - 1] === 0xD9)) {
      const fallback = canvas.toDataURL('image/jpeg', quality);
      const part = fallback.split(',')[1];
      const fb = Uint8Array.from(atob(part), c => c.charCodeAt(0));
      return fb.buffer as ArrayBuffer;
    }
    return buf;
  }

  private toBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    if (bytes.byteLength === 0) return '';
    if (typeof Buffer !== 'undefined' && typeof (Buffer as any).from === 'function') {
      return (Buffer as any).from(bytes).toString('base64');
    }
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(sub));
    }
    return btoa(binary);
  }

  private async ensureFolder(path: string) {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing) return;
    try { await this.app.vault.createFolder(path); } catch { /* ignore */ }
  }

  private async withObjectUrl<T>(buffer: ArrayBuffer, fn: (url: string) => Promise<T>): Promise<T> {
    const url = URL.createObjectURL(new Blob([buffer]));
    try { return await fn(url); } finally { URL.revokeObjectURL(url); }
  }

  private makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    return { canvas, ctx };
  }
}

// Public shape for EXIF results we care about
export interface ExifData {
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  orientation?: number | null;
  make?: string;
  model?: string;
  lensModel?: string;
  focalLength?: number | string | null;
  exposureTime?: number | string | null;
  fNumber?: number | string | null;
  iso?: number | null;
  dateTimeOriginal?: string | null; // ISO string when available
}
