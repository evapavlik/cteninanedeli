import { describe, it, expect } from "vitest";
import { checkAuth } from "./auth.ts";

const ENV = { adminSecret: "tajny-klic-123", serviceRoleKey: "service-role-abc" };

describe("checkAuth", () => {
  it("accepts a matching x-admin-secret header", () => {
    expect(checkAuth({ adminSecret: "tajny-klic-123" }, ENV)).toBe(true);
  });

  it("rejects a wrong x-admin-secret header", () => {
    expect(checkAuth({ adminSecret: "spatny" }, ENV)).toBe(false);
  });

  it("accepts the service role key as Bearer token", () => {
    expect(checkAuth({ authorization: "Bearer service-role-abc" }, ENV)).toBe(true);
  });

  it("accepts Bearer prefix case-insensitively", () => {
    expect(checkAuth({ authorization: "bearer service-role-abc" }, ENV)).toBe(true);
  });

  it("rejects the anon key / any other Bearer token", () => {
    expect(checkAuth({ authorization: "Bearer anon-key-xyz" }, ENV)).toBe(false);
  });

  it("rejects a request with no credentials", () => {
    expect(checkAuth({}, ENV)).toBe(false);
  });

  it("fails closed when ADMIN_SECRET is not configured", () => {
    expect(checkAuth({ adminSecret: "" }, { ...ENV, adminSecret: undefined })).toBe(false);
    expect(checkAuth({ adminSecret: "cokoliv" }, { ...ENV, adminSecret: undefined })).toBe(false);
  });

  it("fails closed when no secrets are configured at all", () => {
    expect(checkAuth({ adminSecret: "x", authorization: "Bearer y" }, {})).toBe(false);
  });

  it("rejects an empty Bearer token even if service key is empty", () => {
    expect(checkAuth({ authorization: "Bearer " }, { serviceRoleKey: "" })).toBe(false);
  });

  it("does not treat the admin secret as a valid Bearer token", () => {
    expect(checkAuth({ authorization: "Bearer tajny-klic-123" }, ENV)).toBe(false);
  });
});
