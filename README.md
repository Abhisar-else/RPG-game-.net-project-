# IdleQuest — C# .NET Backend Architecture

> **Multiplayer-ready, event-driven, clean DDD backend for the IdleQuest Idle RPG.**

---

## Project Structure

```
IdleQuest.Backend/
└── src/
    ├── IdleQuest.Domain/          # Core business logic — zero framework deps
    │   └── Models.cs              # Aggregates, value objects, events, helpers
    │
    ├── IdleQuest.Application/     # Use cases, interfaces, DTOs
    │   └── Application.cs         # Service contracts + full service implementations
    │
    ├── IdleQuest.Infrastructure/  # EF Core, Redis, SignalR, JWT
    │   └── Infrastructure.cs      # DbContext, repositories, auth, caching, hub
    │
    └── IdleQuest.API/             # ASP.NET Core Web API
        ├── API.cs                 # Controllers, middleware, background services
        └── Program.cs             # DI composition root + middleware pipeline
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      IdleQuest Frontend                      │
│              (index.html — vanilla JS / Tailwind)            │
└────────────────────┬────────────────────┬────────────────────┘
                     │ REST (JWT)          │ WebSocket (SignalR)
                     ▼                    ▼
┌────────────────────────────────────────────────────────────────┐
│                       API Layer                                │
│  AuthController  PlayerController  CombatController  ...      │
│  GlobalExceptionMiddleware  RateLimitAttribute                 │
│  Background: AutoCombatTick | WorldEventScheduler | AutoSave  │
└─────────────────────────┬──────────────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────────┐
│                   Application Layer                            │
│  PlayerService  CombatService  QuestService  SaveLoadService  │
│  IDomainEventDispatcher  IGameHubNotifier  ICacheService       │
└──────────────┬────────────────────────────┬────────────────────┘
               │                            │
┌──────────────▼──────────┐  ┌─────────────▼───────────────────┐
│      Domain Layer       │  │     Infrastructure Layer        │
│  Player (Aggregate)     │  │  EF Core (SQL Server)           │
│  Item / Quest / Enemy   │  │  Redis (cache + SignalR hub)    │
│  Zone / NPC / Combat    │  │  JWT Auth  (BCrypt passwords)   │
│  StatBlock (VO)         │  │  DomainEventDispatcher          │
│  DomainEvents           │  │  GameHub (SignalR)              │
│  DomainException        │  │  Repositories (1 per aggregate) │
└─────────────────────────┘  └─────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Domain-Driven Design (DDD)
- **Aggregates** (`Player`, `CombatSession`, etc.) are the only mutation entry points.
- All state changes raise **domain events** — no direct cross-aggregate calls.
- `DomainException` flows up to `GlobalExceptionMiddleware` → clean HTTP 400.

### 2. Event-Driven Logic
```
Player.GainXP()  →  PlayerLeveledUp event
  └─► PlayerLeveledUpHandler.HandleAsync()
        └─► IGameHubNotifier.NotifyPlayerAsync("LevelUp", {...})
              └─► Frontend receives real-time SignalR push
```
Adding new behaviors (achievements, analytics) = add a handler, zero existing code changes.

### 3. Value Objects
`StatBlock` is an **immutable record** — equipment bonuses compose with `Add()` cleanly:
```csharp
var effective = baseStats.Add(weapon.Bonus).Add(armor.Bonus);
```

### 4. Multiplayer-Ready SignalR
- Per-player groups: `player:{id}` — push level-ups, loot, quest completions.
- Per-zone groups: `zone:{id}` — broadcast player arrivals/departures.
- Redis backplane (`AddStackExchangeRedis`) enables horizontal scaling across pods.

### 5. Idle Reward System
`CombatService.ClaimIdleRewardsAsync()` computes offline XP/gold from `LastLoginAt`:
- Capped at 8 hours of offline gains.
- Auto-save service persists online players every 2 minutes to `SaveSlot.Auto`.

### 6. Save / Load
Full player snapshots stored as compressed JSON in `SaveGame.Snapshot`.
- 4 slots: `Auto`, `Manual1`, `Manual2`, `Manual3`.
- Version field enables forward-compatible migration on load.

### 7. Clean Cache Strategy
| Cache Key         | TTL    | Invalidated on         |
|-------------------|--------|------------------------|
| `player:{id}`     | 5 min  | Any player mutation    |
| `leaderboard:top` | 2 min  | Rolling expiry         |
| `zone:{id}`       | 10 min | Admin update           |

---

## API Endpoints Summary

| Method | Path                          | Description                      |
|--------|-------------------------------|----------------------------------|
| POST   | `/api/auth/register`          | Register new account             |
| POST   | `/api/auth/login`             | Login → JWT + refresh token      |
| POST   | `/api/auth/refresh`           | Refresh expired JWT              |
| GET    | `/api/player/me`              | Current player state             |
| PATCH  | `/api/player/me/rename`       | Rename hero                      |
| PATCH  | `/api/player/me/class`        | Change class (Warrior→Mage etc.) |
| POST   | `/api/player/me/prestige`     | Prestige reset (requires lv 50)  |
| GET    | `/api/player/leaderboard`     | Top players                      |
| GET    | `/api/inventory`              | Full inventory                   |
| POST   | `/api/inventory/equip/{id}`   | Equip item                       |
| DELETE | `/api/inventory/equip/{slot}` | Unequip slot                     |
| POST   | `/api/inventory/{id}/sell`    | Sell item for gold               |
| GET    | `/api/quests/available`       | Quests player can accept         |
| POST   | `/api/quests/{id}/accept`     | Accept a quest                   |
| POST   | `/api/quests/{id}/complete`   | Complete & claim rewards         |
| POST   | `/api/combat/start/{zoneId}`  | Enter combat in zone             |
| POST   | `/api/combat/{session}/attack`| Manual attack                    |
| POST   | `/api/combat/{session}/flee`  | Attempt to flee                  |
| POST   | `/api/combat/idle-rewards`    | Claim offline idle gains         |
| GET    | `/api/npcs/zone/{zoneId}`     | NPCs in current zone             |
| POST   | `/api/npcs/{id}/dialogue`     | Start NPC dialogue               |
| GET    | `/api/npcs/{id}/shop`         | NPC shop inventory               |
| POST   | `/api/npcs/{id}/shop/{item}`  | Purchase item from NPC           |
| GET    | `/api/world/zones`            | All zones + unlock status        |
| POST   | `/api/world/zones/{id}/travel`| Travel to zone                   |
| GET    | `/api/saves`                  | List save slots                  |
| POST   | `/api/saves/{slot}`           | Save game                        |
| POST   | `/api/saves/{slot}/load`      | Load game from slot              |

**SignalR Hub:** `wss://{host}/hubs/game?access_token={jwt}`

### Server → Client Events
| Event           | Payload                               | Trigger                    |
|-----------------|---------------------------------------|----------------------------|
| `LevelUp`       | `{ newLevel, bonusHp, bonusAtk }`     | Player levels up           |
| `CombatStarted` | `{ sessionId, enemyName, enemyHp }`   | Combat begins              |
| `CombatUpdate`  | `CombatStateDto`                      | Each attack/flee           |
| `CombatVictory` | `{ xpGained, goldGained, lootCount }` | Enemy defeated             |
| `QuestCompleted`| `{ title, xpReward, goldReward }`     | Quest finished             |
| `Prestige`      | `{ newPrestigeLevel, message }`       | Prestige completed         |
| `WorldEvents`   | `WorldEventDto[]`                     | Active event broadcast     |

---

## Quick Start

### Prerequisites
- .NET 8 SDK
- SQL Server (or LocalDB for dev)
- Redis (or `docker run -p 6379:6379 redis`)

### 1. Configure `appsettings.Development.json`
```json
{
  "ConnectionStrings": {
    "IdleQuest": "Server=(localdb)\\mssqllocaldb;Database=IdleQuestDev;Trusted_Connection=True;",
    "Redis": "localhost:6379"
  },
  "Jwt": {
    "SecretKey": "CHANGE-THIS-TO-A-256-BIT-SECRET-IN-PRODUCTION",
    "Issuer": "idlequest-api",
    "Audience": "idlequest-client"
  },
  "AllowedOrigins": ["http://localhost:5173", "http://127.0.0.1:5500"]
}
```

### 2. Apply Migrations
```bash
cd src/IdleQuest.Infrastructure
dotnet ef migrations add InitialCreate --startup-project ../IdleQuest.API
dotnet ef database update --startup-project ../IdleQuest.API
```

### 3. Run
```bash
cd src/IdleQuest.API
dotnet run
# Swagger: https://localhost:7xxx/swagger
```

### 4. Connect Frontend
In `index.html`, replace the in-memory `gameState` with API calls:
```js
// Example: login
const res = await fetch('https://localhost:7xxx/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'hero42', password: 'secret' })
});
const { token, player } = await res.json();

// Example: SignalR connection
const connection = new signalR.HubConnectionBuilder()
  .withUrl('/hubs/game', { accessTokenFactory: () => token })
  .withAutomaticReconnect()
  .build();

connection.on('LevelUp', ({ newLevel }) => showToast(`Level up! → ${newLevel}`, 'amber'));
await connection.start();
```

---

## NuGet Packages Required

```xml
<!-- IdleQuest.Infrastructure.csproj -->
<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.*" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="8.*" />
<PackageReference Include="StackExchange.Redis" Version="2.*" />
<PackageReference Include="Microsoft.Extensions.Caching.StackExchangeRedis" Version="8.*" />
<PackageReference Include="Microsoft.AspNetCore.SignalR.StackExchangeRedis" Version="8.*" />
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="8.*" />
<PackageReference Include="Microsoft.IdentityModel.Tokens" Version="7.*" />
<PackageReference Include="BCrypt.Net-Next" Version="4.*" />

<!-- IdleQuest.API.csproj -->
<PackageReference Include="Swashbuckle.AspNetCore" Version="6.*" />
<PackageReference Include="AspNetCore.HealthChecks.Redis" Version="8.*" />
```

---

## Scaling Path

| Scale Step | What to Add |
|------------|-------------|
| Multi-instance | Redis SignalR backplane (already wired) |
| High read load | Read replicas + CQRS read models |
| Combat throughput | Queue-based tick processing (Azure Service Bus / RabbitMQ) |
| Analytics | Domain events → Kafka → ClickHouse |
| Anti-cheat | Server-side validation of all stat calculations (already done) |
| Mobile | Same REST + SignalR API — no changes needed |
