import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import { findAvailablePort } from "./localhost-port.mjs";

function listen(port = 0) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port }, () => resolve(server));
  });
}

test("skips a localhost port that is already in use", async () => {
  const server = await listen();
  const address = server.address();
  assert.equal(typeof address, "object");
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");

  try {
    const selected = await findAvailablePort(address.port, 2);
    assert.notEqual(selected, address.port);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
