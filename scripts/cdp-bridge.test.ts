import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import type { Duplex } from "node:stream";

const projectRoot = process.cwd();
const bridgeScript = path.join(projectRoot, "scripts", "cdp-bridge.mjs");
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/** A stand-in for Chrome's DevTools HTTP server. */
interface FakeChrome {
  port: number;
  close: () => Promise<void>;
  requests: Array<{ url: string; headers: http.IncomingHttpHeaders }>;
  upgrades: number;
}

async function startFakeChrome(): Promise<FakeChrome> {
  const requests: FakeChrome["requests"] = [];
  const state = { upgrades: 0 };

  const server = http.createServer((req, res) => {
    requests.push({ url: req.url ?? "", headers: req.headers });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        Browser: "Chrome/fake",
        webSocketDebuggerUrl: `ws://127.0.0.1:${(server.address() as { port: number }).port}/devtools/browser/fake-id`,
      }),
    );
  });

  // Upgraded sockets detach from the HTTP server, so they must be tracked
  // explicitly or close() never resolves.
  const upgradedSockets = new Set<Duplex>();

  server.on("upgrade", (req, socket) => {
    state.upgrades += 1;
    upgradedSockets.add(socket);
    socket.on("close", () => upgradedSockets.delete(socket));
    const key = req.headers["sec-websocket-key"] ?? "";
    const accept = crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;

  return {
    port,
    requests,
    get upgrades() {
      return state.upgrades;
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of upgradedSockets) socket.destroy();
        upgradedSockets.clear();
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}

async function startBridge(
  targetPort: number,
): Promise<{ process: ChildProcessByStdio<null, Readable, Readable>; port: number }> {
  const bridge = spawn(process.execPath, [bridgeScript], {
    env: {
      ...process.env,
      CDP_TARGET_PORT: String(targetPort),
      CDP_BRIDGE_PORT: "0",
      // The bridge rewrites the advertised WebSocket URL to this host, so the
      // test can dial the bridge itself instead of host.docker.internal.
      CDP_PUBLIC_HOST: "127.0.0.1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("bridge did not start in time")), 10_000);
    bridge.stdout.on("data", (chunk: Buffer) => {
      const match = /listening on 0\.0\.0\.0:(\d+)/.exec(chunk.toString());
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    bridge.on("error", reject);
  });

  return { process: bridge, port };
}

describe("cdp bridge", () => {
  let chrome: FakeChrome;
  let bridge: ChildProcessByStdio<null, Readable, Readable>;
  let bridgePort: number;

  before(async () => {
    chrome = await startFakeChrome();
    const started = await startBridge(chrome.port);
    bridge = started.process;
    bridgePort = started.port;
  });

  after(async () => {
    bridge.kill();
    await chrome.close();
  });

  it("rewrites the Host header so Chrome accepts the request", async () => {
    const response = await fetch(`http://127.0.0.1:${bridgePort}/json/version`);
    assert.equal(response.status, 200);
    assert.equal(chrome.requests.at(-1)?.headers.host, `127.0.0.1:${chrome.port}`);
  });

  it("rewrites the advertised WebSocket URL back to the bridge", async () => {
    const response = await fetch(`http://127.0.0.1:${bridgePort}/json/version`);
    const body = (await response.json()) as { webSocketDebuggerUrl: string };
    assert.equal(body.webSocketDebuggerUrl, `ws://127.0.0.1:${bridgePort}/devtools/browser/fake-id`);
  });

  it("proxies the WebSocket upgrade to Chrome", async () => {
    const key = crypto.randomBytes(16).toString("base64");
    const expectedAccept = crypto
      .createHash("sha1")
      .update(key + WS_GUID)
      .digest("base64");

    const status = await new Promise<number>((resolve, reject) => {
      const request = http.request({
        host: "127.0.0.1",
        port: bridgePort,
        path: "/devtools/browser/fake-id",
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          "Sec-WebSocket-Key": key,
          "Sec-WebSocket-Version": "13",
        },
      });
      request.on("upgrade", (res, socket) => {
        assert.equal(res.headers["sec-websocket-accept"], expectedAccept);
        socket.destroy();
        resolve(res.statusCode ?? 0);
      });
      request.on("error", reject);
      request.end();
    });

    assert.equal(status, 101);
    assert.equal(chrome.upgrades, 1);
  });
});
