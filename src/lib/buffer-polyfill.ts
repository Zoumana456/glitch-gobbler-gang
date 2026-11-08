// The PDF engine expects Node's Buffer global; browsers lack it, which breaks image processing.
import { Buffer } from "buffer";

const g = globalThis as any;
if (!g.Buffer) g.Buffer = Buffer;

export {};
