/**
 * Node 18 may lack global File/Blob used by alipay-sdk / urllib form helpers.
 * Import this module BEFORE importing alipay-sdk.
 */
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";

/* eslint-disable @typescript-eslint/no-explicit-any */
const g = globalThis as any;

if (typeof g.File === "undefined" && typeof NodeFile !== "undefined") {
  g.File = NodeFile;
}

if (typeof g.Blob === "undefined" && typeof NodeBlob !== "undefined") {
  g.Blob = NodeBlob;
}
