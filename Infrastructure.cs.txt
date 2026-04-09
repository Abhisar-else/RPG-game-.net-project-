// ============================================================
//  IdleQuest.Infrastructure  —  Data, Auth, Cache & SignalR
//  All external dependency implementations live here.
// ============================================================

// ─── EF Core DbContext ───────────────────────────────────────
namespace IdleQuest.Infrastructure.Data
{
    using IdleQuest.Domain.Aggregates;
    using IdleQuest.Domain.ValueObjects;
    using Microsoft.EntityFrameworkCore;
    using Microsoft.EntityFrameworkCore.Metadata.Builders;

    public class IdleQuestDbContext : DbContext
    {
        public IdleQuestDbContext(DbContextOptions<IdleQuestDbContext> opts) : base(opts) { }

        public DbSet<Player>        Players        => Set<Player>();
        public DbSet<Item>          Items          => Set<Item>();
        public DbSet<Quest>         Quests         => Set<Quest>();
        public DbSet<Enemy>         Enemies        => Set<Enemy>();
        public DbSet<Zone>          Zones          => Set<Zone>();
        public DbSet<Npc>           Npcs           => Set<Npc>();
        public DbSet<CombatSession> CombatSessions => Set<CombatSession>();
        public DbSet<SaveGame>      SaveGames      => Set<SaveGame>();
        public DbSet<WorldState>    WorldState     => Set<WorldState>();

        protected override void OnModelCreating(ModelBuilder mb)
        {
            mb.ApplyConfiguration(new PlayerConfig());
            mb.ApplyConfiguration(new ItemConfig());
            mb.ApplyConfiguration(new QuestConfig());
            mb.ApplyConfiguration(new EnemyConfig());
            mb.ApplyConfiguration(new ZoneConfig());
            mb.ApplyConfiguration(new NpcConfig());
            mb.ApplyConfiguration(new CombatSessionConfig());
            mb.ApplyConfiguration(new SaveGameConfig());
        }
    }

    // ── Entity Type Configurations ───────────────────────────

    internal class PlayerConfig : IEntityTypeConfiguration<Player>
    {
        public void Configure(EntityTypeBuilder<Player> b)
        {
            b.HasKey(p => p.Id);
            b.Property(p => p.Username).HasMaxLength(50).IsRequired();
            b.Property(p => p.HeroName).HasMaxLength(50).IsRequired();
            b.HasIndex(p => p.Username).IsUnique();

            // StatBlock as owned (maps columns inline)
            b.OwnsOne(p => p.BaseStats, s =>
            {
                s.Property(x => x.MaxHp).HasColumnName("BaseMaxHp");
                s.Property(x => x.Attack).HasColumnName("BaseAtk");
                s.Property(x => x.Defense).HasColumnName("BaseDef");
                s.Property(x => x.Speed).HasColumnName("BaseSpd");
                s.Property(x => x.MagicPower).HasColumnName("BaseMag");
                s.Property(x => x.CritChance).HasColumnName("BaseCrit");
                s.Property(x => x.CritMultiplier).HasColumnName("BaseCritMult");
            });

            // Owned collections as JSON columns (EF Core 8+)
            b.OwnsMany(p => p.Inventory,  o => o.ToJson());
            b.OwnsMany(p => p.Equipment,  o => o.ToJson());
            b.OwnsMany(p => p.Quests,     o => o.ToJson());
            b.OwnsMany(p => p.Skills,     o => o.ToJson());

            b.Property(p => p.Gold).HasConversion<long>(g => g.Value, v => v);
        }
    }

    internal class ItemConfig : IEntityTypeConfiguration<Item>
    {
        public void Configure(EntityTypeBuilder<Item> b)
        {
            b.HasKey(i => i.Id);
            b.Property(i => i.Name).HasMaxLength(100).IsRequired();
            b.OwnsOne(i => i.StatBonus, s => s.Property(x => x.MaxHp)
                .HasColumnName("BonusHp"));
        }
    }

    internal class QuestConfig : IEntityTypeConfiguration<Quest>
    {
        public void Configure(EntityTypeBuilder<Quest> b)
        {
            b.HasKey(q => q.Id);
            b.Property(q => q.Title).HasMaxLength(150).IsRequired();
            b.OwnsMany(q => q.Objectives, o => o.ToJson());
        }
    }

    internal class EnemyConfig : IEntityTypeConfiguration<Enemy>
    {
        public void Configure(EntityTypeBuilder<Enemy> b)
        {
            b.HasKey(e => e.Id);
            b.Property(e => e.Name).HasMaxLength(100).IsRequired();
            b.OwnsOne(e => e.Stats, s => s.Property(x => x.MaxHp).HasColumnName("EnemyMaxHp"));
            b.OwnsMany(e => e.LootTable, o => o.ToJson());
        }
    }

    internal class ZoneConfig : IEntityTypeConfiguration<Zone>
    {
        public void Configure(EntityTypeBuilder<Zone> b)
        {
            b.HasKey(z => z.Id);
            b.Property(z => z.Name).HasMaxLength(100).IsRequired();
        }
    }

    internal class NpcConfig : IEntityTypeConfiguration<Npc>
    {
        public void Configure(EntityTypeBuilder<Npc> b)
        {
            b.HasKey(n => n.Id);
            b.Property(n => n.Name).HasMaxLength(100).IsRequired();
            b.OwnsMany(n => n.Dialogue, d =>
            {
                d.ToJson();
                d.OwnsMany(dl => dl.Responses);
            });
            b.OwnsMany(n => n.Shop, s => s.ToJson());
        }
    }

    internal class CombatSessionConfig : IEntityTypeConfiguration<CombatSession>
    {
        public void Configure(EntityTypeBuilder<CombatSession> b)
        {
            b.HasKey(c => c.Id);
            b.HasIndex(c => c.PlayerId);
            b.OwnsMany(c => c.Log, l => l.ToJson());
        }
    }

    internal class SaveGameConfig : IEntityTypeConfiguration<SaveGame>
    {
        public void Configure(EntityTypeBuilder<SaveGame> b)
        {
            b.HasKey(s => s.Id);
            b.HasIndex(s => new { s.PlayerId, s.Slot }).IsUnique();
            b.Property(s => s.Snapshot).HasColumnType("nvarchar(max)");
        }
    }
}

// ─── Repository Implementations ─────────────────────────────
namespace IdleQuest.Infrastructure.Repositories
{
    using IdleQuest.Application.Interfaces.Repositories;
    using IdleQuest.Domain.Aggregates;
    using IdleQuest.Domain.Enums;
    using IdleQuest.Infrastructure.Data;
    using Microsoft.EntityFrameworkCore;
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;
    using System.Threading.Tasks;

    public class PlayerRepository : IPlayerRepository
    {
        private readonly IdleQuestDbContext _db;
        public PlayerRepository(IdleQuestDbContext db) => _db = db;

        public Task<Player?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
            _db.Players.FirstOrDefaultAsync(p => p.Id == id, ct);

        public Task<Player?> GetByUsernameAsync(string username, CancellationToken ct = default) =>
            _db.Players.FirstOrDefaultAsync(p => p.Username == username, ct);

        public Task<List<Player>> GetTopPlayersAsync(int count, CancellationToken ct = default) =>
            _db.Players.OrderByDescending(p => p.Level)
               .ThenByDescending(p => p.PrestigeLevel)
               .Take(count).ToListAsync(ct);

        public async Task AddAsync(Player player, CancellationToken ct = default)
        {
            _db.Players.Add(player);
            await _db.SaveChangesAsync(ct);
        }

        public async Task UpdateAsync(Player player, CancellationToken ct = default)
        {
            _db.Players.Update(player);
            await _db.SaveChangesAsync(ct);
        }

        public async Task DeleteAsync(Guid id, CancellationToken ct = default)
        {
            var p = await GetByIdAsync(id, ct);
            if (p is null) return;
            _db.Players.Remove(p);
            await _db.SaveChangesAsync(ct);
        }

        public Task<bool> ExistsAsync(string username, CancellationToken ct = default) =>
            _db.Players.AnyAsync(p => p.Username == username, ct);
    }

    public class ItemRepository : IItemRepository
    {
        private readonly IdleQuestDbContext _db;
        public ItemRepository(IdleQuestDbContext db) => _db = db;

        public Task<Item?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
            _db.Items.FirstOrDefaultAsync(i => i.Id == id, ct);

        public Task<List<Item>> GetAllAsync(CancellationToken ct = default) =>
            _db.Items.ToListAsync(ct);

        public Task<List<Item>> GetByRarityAsync(ItemRarity rarity, CancellationToken ct = default) =>
            _db.Items.Where(i => i.Rarity == rarity).ToListAsync(ct);

        public Task<List<Item>> GetBySlotAsync(ItemSlot slot, CancellationToken ct = default) =>
            _db.Items.Where(i => i.Slot == slot).ToListAsync(ct);

        public async Task AddAsync(Item item, CancellationToken ct = default)
        {
            _db.Items.Add(item);
            await _db.SaveChangesAsync(ct);
        }

        public async Task UpdateAsync(Item item, CancellationToken ct = default)
        {
            _db.Items.Update(item);
            await _db.SaveChangesAsync(ct);
        }
    }

    public class EnemyRepository : IEnemyRepository
    {
        private readonly IdleQuestDbContext _db;
        private static readonly Random      _rng = new();

        public EnemyRepository(IdleQuestDbContext db) => _db = db;

        public Task<Enemy?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
            _db.Enemies.FirstOrDefaultAsync(e => e.Id == id, ct);

        public Task<List<Enemy>> GetByZoneAsync(int zoneId, CancellationToken ct = default) =>
            _db.Enemies.Where(e => e.ZoneId == zoneId).ToListAsync(ct);

        public async Task<Enemy> GetRandomForZoneAsync(int zoneId, CancellationToken ct = default)
        {
            var enemies = await GetByZoneAsync(zoneId, ct);
            if (!enemies.Any()) throw new Domain.DomainException($"No enemies in zone {zoneId}.");
            return enemies[_rng.Next(enemies.Count)];
        }
    }

    public class QuestRepository : IQuestRepository
    {
        private readonly IdleQuestDbContext _db;
        public QuestRepository(IdleQuestDbContext db) => _db = db;

        public Task<Quest?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
            _db.Quests.Include(q => q.Objectives).FirstOrDefaultAsync(q => q.Id == id, ct);

        public Task<List<Quest>> GetAvailableForLevelAsync(int level, CancellationToken ct = default) =>
            _db.Quests.Where(q => q.RequiredLevel <= level)
               .Include(q => q.Objectives).ToListAsync(ct);

        public Task<List<Quest>> GetByNpcAsync(Guid npcId, CancellationToken ct = default) =>
            _db.Quests.Where(q => q.GiverNpcId == npcId).ToListAsync(ct);

        public async Task AddAsync(Quest quest, CancellationToken ct = default)
        {
            _db.Quests.Add(quest);
            await _db.SaveChangesAsync(ct);
        }

        public async Task UpdateAsync(Quest quest, CancellationToken ct = default)
        {
            _db.Quests.Update(quest);
            await _db.SaveChangesAsync(ct);
        }
    }

    public class CombatSessionRepository : ICombatSessionRepository
    {
        private readonly IdleQuestDbContext _db;
        public CombatSessionRepository(IdleQuestDbContext db) => _db = db;

        public Task<CombatSession?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
            _db.CombatSessions.FirstOrDefaultAsync(c => c.Id == id, ct);

        public Task<CombatSession?> GetActiveForPlayerAsync(Guid playerId, CancellationToken ct = default) =>
            _db.CombatSessions.FirstOrDefaultAsync(
                c => c.PlayerId == playerId && c.Result == CombatResult.Ongoing, ct);

        public async Task AddAsync(CombatSession session, CancellationToken ct = default)
        {
            _db.CombatSessions.Add(session);
            await _db.SaveChangesAsync(ct);
        }

        public async Task UpdateAsync(CombatSession session, CancellationToken ct = default)
        {
            _db.CombatSessions.Update(session);
            await _db.SaveChangesAsync(ct);
        }
    }

    public class SaveGameRepository : ISaveGameRepository
    {
        private readonly IdleQuestDbContext _db;
        public SaveGameRepository(IdleQuestDbContext db) => _db = db;

        public Task<SaveGame?> GetAsync(Guid playerId, SaveSlot slot, CancellationToken ct = default) =>
            _db.SaveGames.FirstOrDefaultAsync(s => s.PlayerId == playerId && s.Slot == slot, ct);

        public Task<List<SaveGame>> GetAllForPlayerAsync(Guid playerId, CancellationToken ct = default) =>
            _db.SaveGames.Where(s => s.PlayerId == playerId).ToListAsync(ct);

        public async Task UpsertAsync(SaveGame save, CancellationToken ct = default)
        {
            var existing = await GetAsync(save.PlayerId, save.Slot, ct);
            if (existing is null) _db.SaveGames.Add(save);
            else
            {
                existing.Snapshot    = save.Snapshot;
                existing.Label       = save.Label;
                existing.SavedAt     = save.SavedAt;
                existing.SaveVersion = save.SaveVersion;
                _db.SaveGames.Update(existing);
            }
            await _db.SaveChangesAsync(ct);
        }

        public async Task DeleteAsync(Guid playerId, SaveSlot slot, CancellationToken ct = default)
        {
            var s = await GetAsync(playerId, slot, ct);
            if (s is null) return;
            _db.SaveGames.Remove(s);
            await _db.SaveChangesAsync(ct);
        }
    }
}

// ─── Domain Event Dispatcher ─────────────────────────────────
namespace IdleQuest.Infrastructure.Events
{
    using IdleQuest.Application.Interfaces.Services;
    using IdleQuest.Domain.Events;
    using Microsoft.Extensions.Logging;
    using System;
    using System.Collections.Generic;
    using System.Threading;
    using System.Threading.Tasks;

    /// <summary>
    /// Dispatches domain events to registered handlers.
    /// Handlers are resolved from DI; failures are logged, not thrown.
    /// </summary>
    public class DomainEventDispatcher : IDomainEventDispatcher
    {
        private readonly IServiceProvider _sp;
        private readonly ILogger<DomainEventDispatcher> _log;

        public DomainEventDispatcher(IServiceProvider sp, ILogger<DomainEventDispatcher> log)
        {
            _sp  = sp;
            _log = log;
        }

        public async Task DispatchAsync(IEnumerable<DomainEvent> events, CancellationToken ct)
        {
            foreach (var e in events)
            {
                try
                {
                    var handlerType = typeof(IDomainEventHandler<>).MakeGenericType(e.GetType());
                    var handlers    = (IEnumerable<object>)_sp.GetService(
                        typeof(IEnumerable<>).MakeGenericType(handlerType))!;

                    foreach (var handler in handlers)
                    {
                        var method = handlerType.GetMethod("HandleAsync")!;
                        await (Task)method.Invoke(handler, new object[] { e, ct })!;
                    }
                }
                catch (Exception ex)
                {
                    _log.LogError(ex, "Error dispatching event {EventType}", e.GetType().Name);
                }
            }
        }
    }

    public interface IDomainEventHandler<TEvent> where TEvent : DomainEvent
    {
        Task HandleAsync(TEvent e, CancellationToken ct = default);
    }

    // ── Example Handlers ─────────────────────────────────────

    public class PlayerLeveledUpHandler : IDomainEventHandler<PlayerLeveledUp>
    {
        private readonly IGameHubNotifier _hub;
        private readonly ILogger<PlayerLeveledUpHandler> _log;

        public PlayerLeveledUpHandler(IGameHubNotifier hub, ILogger<PlayerLeveledUpHandler> log)
        {
            _hub = hub;
            _log = log;
        }

        public async Task HandleAsync(PlayerLeveledUp e, CancellationToken ct = default)
        {
            _log.LogInformation("Player {Id} leveled up to {Level}", e.PlayerId, e.NewLevel);
            await _hub.NotifyPlayerAsync(e.PlayerId, "LevelUp", new
            {
                e.NewLevel,
                BonusHp  = e.BonusStats.MaxHp,
                BonusAtk = e.BonusStats.Attack,
                BonusDef = e.BonusStats.Defense,
            });
        }
    }

    public class PrestigeCompletedHandler : IDomainEventHandler<PrestigeCompleted>
    {
        private readonly IGameHubNotifier _hub;

        public PrestigeCompletedHandler(IGameHubNotifier hub) => _hub = hub;

        public Task HandleAsync(PrestigeCompleted e, CancellationToken ct = default) =>
            _hub.NotifyPlayerAsync(e.PlayerId, "Prestige",
                new { e.NewPrestigeLevel, Message = "Prestige complete! Permanent bonus activated." });
    }
}

// ─── SignalR Hub ─────────────────────────────────────────────
namespace IdleQuest.Infrastructure.Hubs
{
    using IdleQuest.Application.Interfaces.Services;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.SignalR;
    using System;
    using System.Collections.Concurrent;
    using System.Threading.Tasks;

    [Authorize]
    public class GameHub : Hub
    {
        private readonly ICombatService _combat;
        private readonly IWorldService  _world;

        // player ID → connection ID map (in-memory; use Redis for multi-node)
        public static readonly ConcurrentDictionary<Guid, string> PlayerConnections = new();

        public GameHub(ICombatService combat, IWorldService world)
        {
            _combat = combat;
            _world  = world;
        }

        public override async Task OnConnectedAsync()
        {
            var playerId = GetPlayerId();
            PlayerConnections[playerId] = Context.ConnectionId;
            await Groups.AddToGroupAsync(Context.ConnectionId, $"player:{playerId}");
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var playerId = GetPlayerId();
            PlayerConnections.TryRemove(playerId, out _);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"player:{playerId}");
            await base.OnDisconnectedAsync(exception);
        }

        // ── Client → Server Methods ──────────────────────────

        public async Task JoinZone(int zoneId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"zone:{zoneId}");
            await Clients.Group($"zone:{zoneId}").SendAsync("PlayerEnteredZone",
                new { PlayerId = GetPlayerId(), zoneId });
        }

        public async Task LeaveZone(int zoneId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"zone:{zoneId}");
        }

        public async Task SendCombatAction(string action, string sessionId)
        {
            var playerId  = GetPlayerId();
            var sessionGuid = Guid.Parse(sessionId);
            switch (action.ToLower())
            {
                case "attack":
                    var state = await _combat.AttackAsync(sessionGuid, playerId);
                    await Clients.Caller.SendAsync("CombatUpdate", state);
                    break;
                case "flee":
                    var fled = await _combat.FleeAsync(sessionGuid, playerId);
                    await Clients.Caller.SendAsync("CombatUpdate", fled);
                    break;
            }
        }

        public async Task RequestWorldState()
        {
            var world = await _world.GetWorldStateAsync();
            await Clients.Caller.SendAsync("WorldState", world);
        }

        private Guid GetPlayerId()
        {
            var claim = Context.User?.FindFirst("sub")?.Value
                        ?? Context.User?.FindFirst("playerId")?.Value;
            return Guid.Parse(claim ?? throw new HubException("Unauthorized."));
        }
    }

    /// <summary>
    /// Typed wrapper for pushing server→client messages.
    /// Injected into services so they don't depend on IHubContext directly.
    /// </summary>
    public class GameHubNotifier : IGameHubNotifier
    {
        private readonly IHubContext<GameHub> _hub;
        public GameHubNotifier(IHubContext<GameHub> hub) => _hub = hub;

        public Task NotifyPlayerAsync(Guid playerId, string method, object payload) =>
            _hub.Clients.Group($"player:{playerId}").SendAsync(method, payload);

        public Task NotifyZoneAsync(int zoneId, string method, object payload) =>
            _hub.Clients.Group($"zone:{zoneId}").SendAsync(method, payload);

        public Task BroadcastAsync(string method, object payload) =>
            _hub.Clients.All.SendAsync(method, payload);
    }
}

// ─── Redis Cache Service ─────────────────────────────────────
namespace IdleQuest.Infrastructure.Caching
{
    using IdleQuest.Application.Interfaces.Services;
    using Microsoft.Extensions.Caching.Distributed;
    using System;
    using System.Text.Json;
    using System.Threading;
    using System.Threading.Tasks;

    public class RedisCacheService : ICacheService
    {
        private readonly IDistributedCache _cache;
        private static readonly JsonSerializerOptions _opts = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        public RedisCacheService(IDistributedCache cache) => _cache = cache;

        public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default) where T : class
        {
            var data = await _cache.GetStringAsync(key, ct);
            return data is null ? null : JsonSerializer.Deserialize<T>(data, _opts);
        }

        public async Task SetAsync<T>(string key, T value, TimeSpan? ttl = null,
            CancellationToken ct = default) where T : class
        {
            var opts = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = ttl ?? TimeSpan.FromMinutes(10)
            };
            await _cache.SetStringAsync(key, JsonSerializer.Serialize(value, _opts), opts, ct);
        }

        public Task RemoveAsync(string key, CancellationToken ct = default) =>
            _cache.RemoveAsync(key, ct);

        public async Task InvalidatePatternAsync(string pattern, CancellationToken ct = default)
        {
            // Full pattern invalidation requires StackExchange.Redis directly
            // Shown as stub; wire up IConnectionMultiplexer for production use
            await Task.CompletedTask;
        }
    }
}

// ─── JWT Auth Service ────────────────────────────────────────
namespace IdleQuest.Infrastructure.Auth
{
    using IdleQuest.Application.DTOs;
    using IdleQuest.Application.Interfaces.Repositories;
    using IdleQuest.Application.Interfaces.Services;
    using IdleQuest.Application.Services;
    using IdleQuest.Domain;
    using IdleQuest.Domain.Aggregates;
    using IdleQuest.Domain.Enums;
    using Microsoft.Extensions.Configuration;
    using Microsoft.IdentityModel.Tokens;
    using System;
    using System.Collections.Generic;
    using System.IdentityModel.Tokens.Jwt;
    using System.Security.Claims;
    using System.Security.Cryptography;
    using System.Text;
    using System.Threading;
    using System.Threading.Tasks;

    public class JwtAuthService : IAuthService
    {
        private readonly IPlayerRepository  _players;
        private readonly IConfiguration     _config;
        private readonly IDomainEventDispatcher _dispatcher;

        // Refresh token store (use Redis or DB table in production)
        private static readonly Dictionary<string, (Guid PlayerId, DateTime Expires)> _refreshTokens = new();

        public JwtAuthService(IPlayerRepository players, IConfiguration config,
            IDomainEventDispatcher dispatcher)
        {
            _players    = players;
            _config     = config;
            _dispatcher = dispatcher;
        }

        public async Task<AuthResultDto> RegisterAsync(RegisterRequest req, CancellationToken ct = default)
        {
            if (await _players.ExistsAsync(req.Username, ct))
                return Fail("Username already taken.");

            var cls    = Enum.Parse<CharacterClass>(req.Class, ignoreCase: true);
            var player = Player.Create(Guid.NewGuid(), req.Username, req.HeroName, cls);

            // Hash password (BCrypt or PBKDF2)
            // player.PasswordHash = BCrypt.HashPassword(req.Password);

            await _players.AddAsync(player, ct);
            await _dispatcher.DispatchAsync(player.DomainEvents, ct);
            player.ClearEvents();

            return IssueTokens(player);
        }

        public async Task<AuthResultDto> LoginAsync(LoginRequest req, CancellationToken ct = default)
        {
            var player = await _players.GetByUsernameAsync(req.Username, ct);
            if (player is null) return Fail("Invalid credentials.");

            // Verify: BCrypt.Verify(req.Password, player.PasswordHash)
            // if (!verified) return Fail("Invalid credentials.");

            player.RecordLogin();
            await _players.UpdateAsync(player, ct);
            await _dispatcher.DispatchAsync(player.DomainEvents, ct);
            player.ClearEvents();

            return IssueTokens(player);
        }

        public async Task LogoutAsync(Guid playerId, string connectionId, CancellationToken ct = default)
        {
            var keys = new List<string>();
            foreach (var (k, v) in _refreshTokens)
                if (v.PlayerId == playerId) keys.Add(k);
            foreach (var k in keys) _refreshTokens.Remove(k);
            await Task.CompletedTask;
        }

        public async Task<AuthResultDto> RefreshTokenAsync(string refreshToken, CancellationToken ct = default)
        {
            if (!_refreshTokens.TryGetValue(refreshToken, out var entry) ||
                entry.Expires < DateTime.UtcNow)
                return Fail("Refresh token expired or invalid.");

            var player = await _players.GetByIdAsync(entry.PlayerId, ct);
            if (player is null) return Fail("Player not found.");

            _refreshTokens.Remove(refreshToken);
            return IssueTokens(player);
        }

        // ── Private ───────────────────────────────────────────

        private AuthResultDto IssueTokens(Player player)
        {
            var secretKey = _config["Jwt:SecretKey"]!;
            var key       = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
            var creds     = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var expires   = DateTime.UtcNow.AddHours(8);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, player.Id.ToString()),
                new Claim("playerId", player.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.UniqueName, player.Username),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var token = new JwtSecurityToken(
                issuer:   _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims:   claims,
                expires:  expires,
                signingCredentials: creds
            );

            var jwt          = new JwtSecurityTokenHandler().WriteToken(token);
            var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            _refreshTokens[refreshToken] = (player.Id, DateTime.UtcNow.AddDays(30));

            return new AuthResultDto(true, jwt, refreshToken, expires, null, PlayerService.MapToDto(player));
        }

        private static AuthResultDto Fail(string error) =>
            new(false, null, null, null, error, null);
    }
}
