import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import nextConfig from "../next.config";
import { db } from "../lib/db";
import {
  DEFAULT_EDGE_EMBEDDING_MODEL,
  resolveTransformersCacheDir,
} from "../lib/scoring/edge-embeddings";

const projectRoot = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

describe("self-hosted deployment contract", () => {
  describe("Next.js standalone configuration", () => {
    it("emits a self-contained standalone server bundle", () => {
      assert.equal(nextConfig.output, "standalone");
    });

    it("keeps native runtime bindings outside the bundler", () => {
      const external = nextConfig.serverExternalPackages ?? [];
      for (const pkg of [
        "@huggingface/transformers",
        "onnxruntime-node",
        "@prisma/adapter-libsql",
        "@libsql/client",
        "playwright",
      ]) {
        assert.ok(external.includes(pkg), `${pkg} must be a server external package`);
      }
    });
  });

  describe("offline embedding cache resolution", () => {
    it("uses TRANSFORMERS_CACHE when the container provides it", () => {
      assert.equal(
        resolveTransformersCacheDir({ TRANSFORMERS_CACHE: "/app/.cache/transformers" }),
        "/app/.cache/transformers"
      );
    });

    it("falls back to the repository-local cache when unset or blank", () => {
      assert.equal(resolveTransformersCacheDir({}), "./.cache/transformers");
      assert.equal(resolveTransformersCacheDir({ TRANSFORMERS_CACHE: "   " }), "./.cache/transformers");
    });
  });

  describe("Dockerfile", () => {
    const dockerfile = read("Dockerfile");

    it("is a node:22-slim (Debian glibc) multi-stage build", () => {
      assert.match(dockerfile, /FROM node:22-slim AS deps/);
      assert.match(dockerfile, /FROM node:22-slim AS builder/);
      assert.match(dockerfile, /FROM node:22-slim AS prisma-cli/);
      assert.match(dockerfile, /FROM node:22-slim AS runner/);
      assert.doesNotMatch(dockerfile, /alpine/i);
    });

    it("installs locked dependencies and generates the Prisma client", () => {
      assert.match(dockerfile, /npm ci/);
      assert.match(dockerfile, /prisma generate/);
    });

    it("provides DATABASE_URL before Prisma config is evaluated", () => {
      const databaseUrl = dockerfile.indexOf("ENV DATABASE_URL=file:/tmp/vanguard-build.db");
      const generate = dockerfile.indexOf("RUN npx prisma generate");
      assert.ok(databaseUrl > -1, "builder must define a throwaway DATABASE_URL");
      assert.ok(generate > -1, "builder must generate the Prisma client");
      assert.ok(databaseUrl < generate, "DATABASE_URL must be set before prisma generate");
    });

    it("pre-warms the configured BGE ONNX weights during the image build", () => {
      assert.ok(
        dockerfile.includes(DEFAULT_EDGE_EMBEDDING_MODEL),
        `Dockerfile must pre-warm ${DEFAULT_EDGE_EMBEDDING_MODEL}`
      );
      assert.match(dockerfile, /\.cache\/transformers/);
      assert.match(dockerfile, /COPY --from=builder[^\n]*\.cache\/transformers/);
    });

    it("ships the standalone server, static assets, and public files", () => {
      assert.match(dockerfile, /COPY --from=builder[^\n]*\.next\/standalone/);
      assert.match(dockerfile, /COPY --from=builder[^\n]*\.next\/static[^\n]*\.next\/static/);
      assert.match(dockerfile, /COPY --from=builder[^\n]*\/app\/public[^\n]*\/public/);
    });

    it("ships Playwright's browser registry, which the bundler cannot trace", () => {
      assert.match(
        dockerfile,
        /COPY --from=builder[^\n]*playwright-core\/browsers\.json/,
        "playwright-core/browsers.json must be copied explicitly or importing playwright throws at runtime"
      );
    });

    it("ships the Prisma CLI and schema so the entrypoint can sync the database", () => {
      assert.match(dockerfile, /COPY --from=builder[^\n]*\/app\/prisma[^\n]*\.\/prisma/);
      assert.match(dockerfile, /COPY --from=builder[^\n]*prisma\.config\.ts/);
      assert.match(dockerfile, /COPY --from=prisma-cli[^\n]*\/cli\/node_modules[^\n]*\.\/node_modules/);
    });

    it("ships the dynamically loaded ONNX native runtime", () => {
      assert.match(dockerfile, /COPY --from=builder[^\n]*node_modules\/onnxruntime-node/);
      assert.match(dockerfile, /COPY --from=builder[^\n]*node_modules\/onnxruntime-common/);
    });

    it("runs unprivileged as nextjs (UID 1001) with a writable /data volume", () => {
      assert.match(dockerfile, /groupadd --system --gid 1001 nodejs/);
      assert.match(dockerfile, /useradd --system --uid 1001[^\n]*nextjs/);
      assert.match(dockerfile, /mkdir -p \/data/);
      assert.match(dockerfile, /chown[^\n]*\/data/);
      assert.match(dockerfile, /^USER nextjs$/m);
      assert.match(dockerfile, /^ENTRYPOINT \["\.\/docker-entrypoint\.sh"\]$/m);
      assert.match(dockerfile, /^CMD \["node", "server\.js"\]$/m);
    });

    it("points transformers at the baked cache directory", () => {
      assert.match(dockerfile, /TRANSFORMERS_CACHE="?\/app\/\.cache\/transformers/);
    });
  });

  describe("docker-entrypoint.sh", () => {
    const entrypoint = read("docker-entrypoint.sh");

    it("is executable and fails fast", () => {
      assert.ok(exists("docker-entrypoint.sh"));
      assert.doesNotThrow(() =>
        fs.accessSync(path.join(projectRoot, "docker-entrypoint.sh"), fs.constants.X_OK)
      );
      assert.match(entrypoint, /^#!/);
      assert.match(entrypoint, /set -e/);
    });

    it("pushes the Prisma schema before booting the server", () => {
      assert.match(entrypoint, /prisma db push/);
      assert.match(entrypoint, /exec "\$@"/);
    });

    it("enables WAL journaling and a busy timeout on the target database", () => {
      assert.match(entrypoint, /PRAGMA journal_mode = WAL;/);
      assert.match(entrypoint, /PRAGMA busy_timeout = 5000;/);
    });

    it("fails fast when the database directory is not writable", () => {
      assert.match(entrypoint, /not writable by UID/);
      assert.match(entrypoint, /chown -R 1001:1001/);
    });
  });

  describe("application database connection", () => {
    it("sets a per-connection busy timeout", async () => {
      const rows = await db.$queryRawUnsafe<Array<{ timeout: number | bigint }>>(
        "PRAGMA busy_timeout;"
      );
      assert.equal(Number(rows[0].timeout), 5000);
    });
  });

  describe("docker-compose.yml", () => {
    const compose = read("docker-compose.yml");

    it("persists SQLite at /data with the container database URL", () => {
      assert.match(compose, /DATABASE_URL:\s*file:\/data\/pulse\.db/);
      assert.match(compose, /vanguard-data:\/data/);
      assert.match(compose, /^volumes:/m);
      assert.match(compose, /^ {2}vanguard-data:/m);
    });

    it("declares a container healthcheck", () => {
      assert.match(compose, /healthcheck:/);
      assert.match(compose, /http:\/\/127\.0\.0\.1:3000/);
    });

    it("maps the host Chrome CDP endpoint and persists the fallback browser profile", () => {
      assert.match(compose, /PLAYWRIGHT_CDP_ENDPOINT:\s*\$\{PLAYWRIGHT_CDP_ENDPOINT:-?\}/);
      assert.match(compose, /host\.docker\.internal:host-gateway/);
      assert.match(compose, /BROWSER_PROFILE_DIR:\s*\/data\/browser-profile/);
    });

    it("declares the optional Tailscale sidecar with serve config and state", () => {
      assert.match(compose, /^ {2}tailscale:/m);
      assert.match(compose, /profiles:\s*\[?"?tailscale"?\]?/);
      assert.match(compose, /TS_SERVE_CONFIG[:=]\s*\/config\/serve\.json/);
      assert.match(compose, /\.\/tailscale-serve\.json:\/config\/serve\.json:ro/);
      assert.match(compose, /tailscale-state:\/var\/lib\/tailscale/);
      assert.match(compose, /TS_AUTH_ONCE:\s*"?true"?/);
    });

    it("has a Tailscale override that shares the sidecar network namespace", () => {
      assert.ok(exists("docker-compose.tailscale.yml"));
      const override = read("docker-compose.tailscale.yml");
      assert.match(override, /network_mode:\s*service:tailscale/);
      assert.match(override, /ports:\s*!reset \[\]/);
      // Docker refuses extra_hosts on a service that joins another
      // container's network namespace, so the mapping lives on the owner.
      assert.match(override, /extra_hosts:\s*!reset \[\]/);
      assert.match(override, /host\.docker\.internal:host-gateway/);
    });
  });

  describe("tailscale-serve.json", () => {
    const serve = JSON.parse(read("tailscale-serve.json")) as {
      TCP: Record<string, { HTTPS: boolean }>;
      Web: Record<string, { Handlers: Record<string, { Proxy: string }> }>;
    };

    it("terminates HTTPS on 443", () => {
      assert.equal(serve.TCP["443"].HTTPS, true);
    });

    it("proxies the MagicDNS cert domain to the local Next.js server", () => {
      const domain = serve.Web["${TS_CERT_DOMAIN}:443"];
      assert.equal(domain.Handlers["/"].Proxy, "http://127.0.0.1:3000");
    });
  });

  describe(".env.example", () => {
    const example = read(".env.example");

    it("documents the self-hosting knobs compose interpolates", () => {
      for (const key of [
        "PLAYWRIGHT_CDP_ENDPOINT",
        "BROWSER_PROFILE_DIR",
        "VANGUARD_BIND_ADDRESS",
        "TS_AUTHKEY",
      ]) {
        assert.match(
          example,
          new RegExp(`^${key}=`, "m"),
          `.env.example must document ${key}`,
        );
      }
    });
  });

  describe(".dockerignore", () => {
    it("keeps host artifacts and secrets out of the build context", () => {
      const ignore = read(".dockerignore");
      for (const pattern of [
        "node_modules",
        ".next",
        ".env",
        "*.db",
        ".cache",
      ]) {
        assert.ok(ignore.includes(pattern), `.dockerignore must exclude ${pattern}`);
      }
    });
  });
});
