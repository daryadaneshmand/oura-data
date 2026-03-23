/**
 * OAuth for Dale's Oura account (separate "Oura Data Export" app).
 * Run: npm run get-token:dale
 *
 * Requires DALE_CLIENT_ID and DALE_CLIENT_SECRET in .env.
 * Add http://localhost:3001/callback to that OAuth app's redirect URIs.
 * Saves DALE_OURA_TOKEN to .env (then run npm run fetch:dale).
 */

import "dotenv/config";
import express from "express";
import { appendFileSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import open from "open";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3001;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = "email personal daily heartrate workout tag session spo2 stress";

const app = express();
let server;

app.get("/callback", async (req, res) => {
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

  const clientId = process.env.DALE_CLIENT_ID;
  const clientSecret = process.env.DALE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.send("<h1>Missing DALE_CLIENT_ID or DALE_CLIENT_SECRET in .env</h1>");
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
        redirect_uri: REDIRECT_URI,
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

    const envPath = join(__dirname, "..", ".env");
    let envContent = readFileSync(envPath, "utf8");
    if (envContent.includes("DALE_OURA_TOKEN=")) {
      envContent = envContent.replace(/DALE_OURA_TOKEN=.*/m, `DALE_OURA_TOKEN=${accessToken}`);
      writeFileSync(envPath, envContent, "utf8");
    } else {
      appendFileSync(envPath, `\nDALE_OURA_TOKEN=${accessToken}\n`, "utf8");
    }

    res.send(`
      <h1>Success</h1>
      <p>Dale's access token saved to .env as DALE_OURA_TOKEN.</p>
      <p>Run <code>npm run fetch:dale</code> to write <code>data/dale.json</code>.</p>
    `);

    console.log("DALE_OURA_TOKEN saved to .env.");
    shutdown(0);
  } catch (err) {
    res.send(`<h1>Error</h1><pre>${err.message}</pre>`);
    console.error(err);
    shutdown(1);
  }
});

function shutdown(exitCode) {
  if (server) server.close(() => process.exit(exitCode));
  else process.exit(exitCode);
}

async function main() {
  const clientId = process.env.DALE_CLIENT_ID;
  const clientSecret = process.env.DALE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("DALE_CLIENT_ID and DALE_CLIENT_SECRET must be set in .env");
    process.exit(1);
  }

  const authUrl = new URL("https://cloud.ouraring.com/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);

  server = app.listen(PORT, () => {
    console.log(`Dale OAuth server: http://localhost:${PORT}`);
    console.log("Opening browser — Dale should sign in with his Oura account.");
    open(authUrl.toString());
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
