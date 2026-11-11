# LandRegistryChain — Frontend

React 19 + Vite single-page portal for the LandRegistryChain land-registry project.

## Status

The authentication flow and the main registry views are wired to the live Express API
in `../land-registry-backend`:

- Register, sign in, session refresh, logout and profile updates.
- Parcel search by parcel number (exact match).
- Parcel list, ownership history and document hashes.
- Evidence list for investigators/administrators.
- Title freeze/unfreeze for registrars/administrators.
- Optional wallet-address linking (`PATCH /users/me`).

The following areas are still UI/demo content and do not call domain endpoints:

- The Ardhisasa-style service catalog is static text.
- GIS is a parcel inspector using stored latitude/longitude, not a real map tile or
  spatial layer.
- The forensic "risk score" is derived client-side from parcel status, not from an
  investigation engine.
- Wallet connect uses `ethers`/MetaMask and links the address to the profile; it does
  not sign or submit contract transactions.

There is no blockchain read/verify UI yet; blockchain status/transactions are
administrator-only API endpoints.

## Setup

```bash
npm install
cp .env.example .env      # optional; defaults to http://localhost:5000/api
npm run dev
```

Start the backend first (`cd ../land-registry-backend && npm run dev`) and make sure
its `CORS_ORIGINS` includes this app's origin (`http://localhost:5173` by default).

For Vercel services, the frontend uses the same-origin `/api` path, which the root
`vercel.json` routes to the backend service. For the Docker stack, the frontend is built with `VITE_API_BASE_URL=/api` and nginx
proxies `/api/` to the backend container.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |

## Backend integration

- `src/api/client.js` — fetch wrapper, token storage, automatic refresh-token retry,
  and the registry/evidence/notification calls used by the UI.
- `src/context/` — `AuthProvider`, auth context and `useAuth()` hook.
- `src/components/AuthModal.jsx` — sign in / landowner registration modal.
- `src/App.jsx` — the portal screens and their API calls.

Access and refresh tokens live in `localStorage` (`lrc.accessToken`,
`lrc.refreshToken`). The access token is sent as `Authorization: Bearer <token>`.

Relevant API features:

| UI area | Endpoint(s) |
|---|---|
| Auth | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` |
| Profile / wallet | `PATCH /users/me` |
| Title search | `GET /parcels/search?q=` |
| GIS / forensic lists | `GET /parcels?limit=100` |
| Ownership / documents | `GET /parcels/:id/ownerships`, `GET /parcels/:id/documents` |
| Freeze/unfreeze | `POST /parcels/:id/freeze` |
| Evidence | `GET /evidence` |
| Notifications | `GET /notifications`, `POST /notifications/read-all` |

See `../land-registry-backend/docs/API.md` for the full API reference.

## Known limitations

- Service catalog, forensic risk scoring and the GIS view are demonstration UI; only
  the parcel/evidence data comes from the backend.
- The label "IPFS Title Document Hash" is actually the SHA-256 digest stored by the
  backend; no IPFS integration exists.
- Wallet connect links an address to the profile but does not sign contract calls.
- No automated frontend tests yet.
