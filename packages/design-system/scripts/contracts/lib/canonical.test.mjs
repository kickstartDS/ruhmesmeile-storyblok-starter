import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  contentAddress,
  contentAddressOfJson,
  verifyAddress,
} from "./canonical.mjs";

/* Knapsack glossary worked example: the indented file canonicalizes to 60 bytes. */
describe("RFC 8785 canonical form", () => {
  it("matches the specification's worked example", () => {
    const value = JSON.parse(
      '{ "contractId": "button-primary", "component": "Button Primary" }',
    );
    const canonical = canonicalJson(value);
    expect(canonical).toBe(
      '{"component":"Button Primary","contractId":"button-primary"}',
    );
    expect(Buffer.byteLength(canonical, "utf8")).toBe(60);
  });

  it("sorts members by UTF-16 code units and emits no whitespace", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson([3, { z: 1, a: 2 }])).toBe('[3,{"a":2,"z":1}]');
  });

  it("keeps numbers in ECMAScript shortest round-trip form", () => {
    expect(canonicalJson(0.1)).toBe("0.1");
    expect(canonicalJson(1e21)).toBe("1e+21");
    expect(canonicalJson(-0)).toBe("0");
    expect(canonicalJson(1440)).toBe("1440");
  });

  it("serializes booleans and null as literals", () => {
    expect(canonicalJson({ a: true, b: false, c: null })).toBe(
      '{"a":true,"b":false,"c":null}',
    );
  });

  it("does not escape non-ASCII", () => {
    expect(canonicalJson("Café")).toBe('"Café"');
  });
});

describe("content addresses", () => {
  it("is stable across whitespace and key order", () => {
    const pretty = '{\n  "b": 1,\n  "a": 2\n}\n';
    const reordered = '{"a":2,"b":1}';
    expect(contentAddressOfJson(pretty)).toBe(contentAddressOfJson(reordered));
    expect(contentAddress(JSON.parse(pretty))).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("detects a mismatch — a mismatch is a hard failure, not a warning", () => {
    const value = { a: 1 };
    expect(verifyAddress(value, contentAddress(value))).toEqual({
      ok: true,
      expected: contentAddress(value),
      actual: contentAddress(value),
    });
    expect(verifyAddress(value, "sha256:" + "0".repeat(64)).ok).toBe(false);
  });

  it("normalizes undefined exactly as JSON.stringify would", () => {
    // The address must match the bytes a JSON file of the value would hold.
    expect(contentAddress({ a: 1, b: undefined })).toBe(contentAddress({ a: 1 }));
    expect(contentAddress({ a: [1, undefined] })).toBe(
      contentAddress({ a: [1, null] }),
    );
  });
});
