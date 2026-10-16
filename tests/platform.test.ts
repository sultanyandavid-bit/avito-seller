import { test } from "node:test";
import assert from "node:assert/strict";
import { requireStoreAccess, type Principal } from "../lib/platform/access";
import {
  evaluateAutomation,
  replyIdentity,
  emptyPolicy,
  parsePolicy,
} from "../lib/platform/automation";
test("future access boundary rejects missing identity, other workspaces and viewer writes", () => {
  const store = { id: "s1", workspaceId: "w1" };
  assert.throws(
    () => requireStoreAccess(null, store, "read"),
    /UNAUTHENTICATED/,
  );
  const viewer: Principal = {
    userId: "u",
    memberships: [{ workspaceId: "w1", role: "viewer" }],
  };
  assert.equal(requireStoreAccess(viewer, store, "read").storeId, "s1");
  assert.throws(() => requireStoreAccess(viewer, store, "edit"), /FORBIDDEN/);
  assert.throws(
    () =>
      requireStoreAccess(viewer, { ...store, workspaceId: "other" }, "read"),
    /FORBIDDEN/,
  );
  assert.throws(
    () =>
      requireStoreAccess(
        { ...viewer, memberships: [{ workspaceId: "w1", role: "editor" }] },
        store,
        "manage",
      ),
    /FORBIDDEN/,
  );
});
test("automatic replies require every safety gate, distinct message identity and frequency check", () => {
  const request = {
    authorized: true,
    officialConnection: true,
    explicitPermission: true,
    enabled: true,
    scenario: "price",
    allowed: ["price"],
    human: false,
    alreadySent: false,
    lastSentAt: null,
    now: 100000,
    intervalSeconds: 30,
  };
  assert.equal(evaluateAutomation(request).allowed, true);
  for (const patch of [
    { authorized: false },
    { officialConnection: false },
    { explicitPermission: false },
    { enabled: false },
    { human: true },
    { alreadySent: true },
    { scenario: "discount" },
    { lastSentAt: 99000 },
  ])
    assert.equal(evaluateAutomation({ ...request, ...patch }).allowed, false);
  assert.notEqual(replyIdentity("a", "c", "m"), replyIdentity("b", "c", "m"));
  assert.equal(
    parsePolicy(
      JSON.stringify({ ...emptyPolicy("a"), autoEnabled: true }),
      "a",
    ),
    null,
  );
});
