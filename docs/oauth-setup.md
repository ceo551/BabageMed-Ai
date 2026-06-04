# Connector OAuth setup

Each connector's **Connect → sign in at the provider → connected** flow activates
only when its OAuth client id + secret are set in the backend environment
(`values-prod.yaml` → `secrets.*`, mapped to env by `secret.yaml`). Until then the
connector falls back to the paste-a-token dialog. The OAuth client secrets live on
the **backend** secret only — the MCP pods only ever receive the resulting per-user
access token via the `X-MCP-Credential` header.

## Redirect URI (identical for every provider)

```
https://pervagans.com/api/backend/api/oauth/callback
```

## Per-provider registration

| Provider | Where to register | values key | Notes |
|---|---|---|---|
| **Notion** | https://www.notion.so/profile/integrations → New integration → **Public** | `notionOauthClientId` / `notionOauthClientSecret` | Add the redirect URI under *OAuth Domain & URIs*. Tokens don't expire. |
| **Google** (Gmail + Calendar + Drive, one app) | https://console.cloud.google.com → APIs & Services → Credentials → **OAuth client ID → Web application** | `googleOauthClientId` / `googleOauthClientSecret` | Enable Gmail/Calendar/Drive APIs + configure the OAuth consent screen. `access_type=offline` is requested, so Google returns a refresh token (auto-refreshed). |
| **Slack** | https://api.slack.com/apps → Create New App → OAuth & Permissions | `slackOauthClientId` / `slackOauthClientSecret` | Add the redirect URL + **User Token Scopes** `search:read, channels:read, chat:write` (we request a user token so `search.messages` works). |
| **LinkedIn** | https://www.linkedin.com/developers/apps → Auth | `linkedinOauthClientId` / `linkedinOauthClientSecret` | Scopes `openid profile w_member_social`. |
| **Microsoft 365** | https://entra.microsoft.com → App registrations → New registration | `ms365OauthClientId` / `ms365OauthClientSecret` | Platform = **Web**, add the redirect URI. API permissions: `User.Read, Mail.Read, Calendars.Read, Files.Read, offline_access`. |

## Activating a provider

1. Register the app (above) and copy its client id + secret.
2. Add to `C:/Users/EL3ATTY/pervagans-deploy/values-prod.yaml` under `secrets:`, e.g.

   ```yaml
   secrets:
     notionOauthClientId: "…"
     notionOauthClientSecret: "…"
   ```
3. `helm upgrade pervagans infra/helm/pervagans -n pervagans -f .../values-prod.yaml`
   — the `checksum/secret` annotation auto-rolls the backend so the new env is picked up.
4. The connector's **Connect** button (on `/mcps` and the connector detail page) now
   opens the real provider sign-in popup.

## How it works

- `GET /api/connectors/{id}/oauth/start` (auth) → mints an `oauth_states` row → 302 to the
  provider's authorize URL.
- Provider redirects back to `GET /api/oauth/callback` (public; authenticated by the
  one-time `state`) → exchanges the code → stores the encrypted token on the user's
  connector row → returns a tiny HTML page that signals the opener window and closes.
- The stored token feeds `Credential()`, which the chat/agent/`/api/mcp/call` paths
  attach as `X-MCP-Credential`; expiring tokens are refreshed + persisted transparently.
