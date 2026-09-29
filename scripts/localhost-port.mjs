import { createServer } from "node:net";

export const DEFAULT_LOCALHOST_PORT = 9293;

function canListen(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port }, () => {
      server.close((error) => (error ? reject(error) : resolve(true)));
    });
  });
}

export async function findAvailablePort(preferred = DEFAULT_LOCALHOST_PORT, attempts = 100) {
  if (!Number.isInteger(preferred) || preferred < 1 || preferred > 65535) {
    throw new RangeError(`Invalid localhost port: ${preferred}`);
  }

  for (let offset = 0; offset < attempts && preferred + offset <= 65535; offset += 1) {
    const port = preferred + offset;
    try {
      await canListen(port);
      return port;
    } catch (error) {
      if (error?.code !== "EADDRINUSE" && error?.code !== "EACCES") throw error;
    }
  }

  throw new Error(`No available localhost port found from ${preferred}.`);
}
