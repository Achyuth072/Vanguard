#!/usr/bin/env node
import http from "node:http";
import net from "node:net";

const TARGET_HOST = process.env.CDP_TARGET_HOST ?? "127.0.0.1";
const TARGET_PORT = Number(process.env.CDP_TARGET_PORT ?? 9222);
const BRIDGE_PORT = Number(process.env.CDP_BRIDGE_PORT ?? 9333);
const PUBLIC_HOST = process.env.CDP_PUBLIC_HOST ?? "host.docker.internal";

let publicPort = BRIDGE_PORT;
const STRIPPED_UPSTREAM_HEADERS = new Set(["host", "origin"]);

const server = http.createServer((req, res) => {
  const upstream = http.request(
    {
      host: TARGET_HOST,
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` },
    },
    (upstreamRes) => {
      const chunks = [];
      upstreamRes.on("data", (chunk) => chunks.push(chunk));
      upstreamRes.on("end", () => {
        let body = Buffer.concat(chunks);
        const contentType = upstreamRes.headers["content-type"] ?? "";
        if (contentType.includes("json")) {
          body = Buffer.from(
            body
              .toString("utf8")
              .replace(
                new RegExp(`ws://${TARGET_HOST}(?::\\d+)?`, "g"),
                () => `ws://${PUBLIC_HOST}:${publicPort}`,
              ),
            "utf8",
          );
        }
        const headers = { ...upstreamRes.headers };
        delete headers["content-length"];
        delete headers["transfer-encoding"];
        headers["content-length"] = String(body.length);
        res.writeHead(upstreamRes.statusCode ?? 502, headers);
        res.end(body);
      });
    },
  );

  upstream.on("error", (error) => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(`cdp-bridge: cannot reach ${TARGET_HOST}:${TARGET_PORT} (${error.message})`);
  });

  req.pipe(upstream);
});

server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(TARGET_PORT, TARGET_HOST, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`, `Host: ${TARGET_HOST}:${TARGET_PORT}`];
    for (const [name, value] of Object.entries(req.headers)) {
      if (STRIPPED_UPSTREAM_HEADERS.has(name.toLowerCase())) continue;
      lines.push(`${name}: ${value}`);
    }
    lines.push("", "");
    upstream.write(lines.join("\r\n"));
    if (head?.length) upstream.write(head);

    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  const teardown = () => {
    socket.destroy();
    upstream.destroy();
  };
  upstream.on("error", teardown);
  socket.on("error", teardown);
});

server.listen(BRIDGE_PORT, "0.0.0.0", () => {
  const address = server.address();
  publicPort = typeof address === "object" && address ? address.port : BRIDGE_PORT;
  console.log(
    `cdp-bridge listening on 0.0.0.0:${publicPort} -> ${TARGET_HOST}:${TARGET_PORT} ` +
      `(containers reach it as http://${PUBLIC_HOST}:${publicPort})`,
  );
});

