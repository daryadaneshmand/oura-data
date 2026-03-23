/**
 * OAuth2 flow for Oura access token (primary account or Dale).
 *
 * Each run always starts a new browser authorization request. This script never
 * reads, validates, or reuses OURA_TOKEN / DALE_TOKEN — it only overwrites the
 * matching key in .env after a successful code exchange.
 *
 * Run: npm run get-token
 * Run: npm run get-token -- --user dale
 *
 * Callback ports (different so both can be configured in Oura without clashing):
 * - Default user: OURA_OAUTH_PORT (default 3000) → http://localhost:3000/callback
 * - Dale: DALE_OAUTH_PORT (default 3001) → http://localhost:3001/callback
 *
 * Env:
 * - Default: OURA_CLIENT_ID, OURA_CLIENT_SECRET → saves OURA_TOKEN
 * - Dale: DALE_CLIENT_ID, DALE_CLIENT_SECRET → saves DALE_TOKEN
 */

import "dotenv/config";
import express from "express";
import { appendFileSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import open from "open";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCOPES = "email personal daily heartrate workout tag session spo2 stress";

function parseUserArg(argv) {
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--user" && argv[i + 1]) return argv[i + 1].toLowerCase();
  }
  return null;
}

const app = express();
let server;

function createCallbackHandler(config) {
  return async (req, res) => {
    const { code, error } = req.query;

    if (error) {
      res.send(`<h1>Authorization failed</h1><p>${error}</p>`);
      shutdown(1);
      return;
    }

    if (!code) {
      res.send("<h1>No authorization code received</h1>");
      shutdown(1);
      return;
    }

    const { clientId, clientSecret, redirectUri, tokenEnvKey, successHtml } = config;

    if (!clientId || !clientSecret) {
      res.send(`<h1>Missing OAuth client credentials in .env</h1>`);
      shutdown(1);
      return;
    }

    try {
      const tokenRes = await fetch("https://api.ouraring.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      });

      const data = await tokenRes.json();

      if (!tokenRes.ok) {
        res.send(`<h1>Token exchange failed</h1><pre>${JSON.stringify(data, null, 2)}</pre>`);
        shutdown(1);
        return;
      }

      const accessToken = data.access_token;
      console.log("Token response scope (granted):", data.scope ?? "(not in response)");
      if (data.scope) {
        console.log("Granted scopes:", data.scope.split(" ").join(", "));
      }

      const envPath = join(__dirname, "..", ".env");
      let envContent = readFileSync(envPath, "utf8");
      const line = new RegExp(`^${tokenEnvKey}=.*`, "m");
      if (line.test(envContent)) {
        envContent = envContent.replace(line, `${tokenEnvKey}=${accessToken}`);
        writeFileSync(envPath, envContent, "utf8");
      } else {
        appendFileSync(envPath, `\n${tokenEnvKey}=${accessToken}\n`, "utf8");
      }

      res.send(successHtml);
      console.log(`${tokenEnvKey} saved to .env.`);
      shutdown(0);
    } catch (err) {
      res.send(`<h1>Error</h1><pre>${err.message}</pre>`);
      console.error(err);
      shutdown(1);
    }
  };
}

function shutdown(exitCode) {
  if (server) server.close(() => process.exit(exitCode));
  else process.exit(exitCode);
}

async function main() {
  const user = parseUserArg(process.argv);
  const isDale = user === "dale";

  const PORT = isDale
    ? Number(process.env.DALE_OAUTH_PORT) || 3001
    : Number(process.env.OURA_OAUTH_PORT) || 3000;

  const REDIRECT_URI = `http://localhost:${PORT}/callback`;

  const clientId = isDale ? process.env.DALE_CLIENT_ID : process.env.OURA_CLIENT_ID;
  const clientSecret = isDale ? process.env.DALE_CLIENT_SECRET : process.env.OURA_CLIENT_SECRET;
  const tokenEnvKey = isDale ? "DALE_TOKEN" : "OURA_TOKEN";

  if (!clientId || !clientSecret) {
    console.error(
      isDale
        ? "DALE_CLIENT_ID and DALE_CLIENT_SECRET must be set in .env"
        : "OURA_CLIENT_ID and OURA_CLIENT_SECRET must be set in .env"
    );
    process.exit(1);
  }

  if (user && user !== "dale") {
    console.error('Unknown --user (only "dale" is supported; omit for primary account).');
    process.exit(1);
  }

  app.get(
    "/callback",
    createCallbackHandler({
      clientId,
      clientSecret,
      redirectUri: REDIRECT_URI,
      tokenEnvKey,
      successHtml: isDale
        ? `<h1>Success</h1><p>Dale's access token saved as DALE_TOKEN.</p><p>Run <code>npm run fetch -- --user dale</code> for <code>data/dale.json</code>.</p>`
        : `<h1>Success!</h1><p>Access token saved to .env as OURA_TOKEN.</p><p>You can close this tab.</p>`,
    })
  );

  const authUrl = new URL("https://cloud.ouraring.com/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  /* Ask IdP to show consent again instead of silently re-approving a cached session. */
  authUrl.searchParams.set("prompt", "consent");

  server = app.listen(PORT, () => {
    console.log(`OAuth callback: ${REDIRECT_URI}`);
    console.log("Opening browser (new authorization — existing token in .env is not used)...");
    open(authUrl.toString());
    if (isDale) {
      console.log("\nDale: sign in with his Oura account. Token → DALE_TOKEN\n");
    } else {
      console.log("\nAuthorize the app. Token → OURA_TOKEN\n");
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
