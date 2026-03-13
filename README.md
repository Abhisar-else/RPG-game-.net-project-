# ⚔️ IdleQuest — Web-Based Idle RPG Adventure

> A full-stack idle RPG built with **ASP.NET Core 8 MVC**, **Entity Framework Core**, **Bootstrap 5**, and **Razor Pages**.  
> Developed as a Practical Skill Journal project at **Symbiosis University of Applied Sciences, Indore**.

---

## 📖 Overview

**IdleQuest** is a browser-based idle RPG where players register an account, create a hero, and watch them automatically progress through the world — gaining XP, leveling up, looting items, and battling enemies. All game progression runs server-side, making it a true idle experience.

The project demonstrates a complete full-stack development cycle:
- User authentication with ASP.NET Core Identity  
- Game entity modeling with Entity Framework Core  
- Responsive UI with Bootstrap 5 and Razor Views  
- Session state management and CRUD operations  

---

## 🎮 Game Flow

```
Register / Login
       ↓
 Create Character
       ↓
  Explore Zones  ──→  Fight Enemies  ──→  Gain XP & Items
       ↓
   Level Up  ──→  Stronger Stats  ──→  New Zones
```

---

## ✨ Features

### 🧑 User Module
- Register and log in securely via **ASP.NET Core Identity**
- Persistent user session with profile page
- Password hashing and role-based access

### ⚔️ Character Module
- Create a character with a name and class (Warrior, Mage, Rogue)
- Stats: HP, Attack, Defense, Level, XP
- Idle XP gain calculated on each session tick

### 🐉 Combat System
- Idle combat resolution against randomly selected enemies
- `CombatLog` entity records each fight with outcome and timestamp
- Item drops on enemy defeat

### 🎒 Inventory & Items
- `Item` entity with name, type, rarity, and stat bonuses
- Equip/unequip items to modify character stats
- Shopping system *(planned)*

### 🖥️ UI / UX
- Razor Pages and MVC Views for all screens
- Bootstrap 5 — fully responsive across desktop and mobile
- Game dashboard with character status, active zone, and combat log

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Bootstrap 5, Razor Pages / MVC Views |
| **Backend** | ASP.NET Core 8 MVC |
| **ORM** | Entity Framework Core |
| **Authentication** | ASP.NET Core Identity |
| **Database (Dev)** | SQLite |
| **Database (Prod)** | SQL Server |
| **IDE** | Visual Studio 2022 |
| **Version Control** | Git / GitHub |

---

## 🗃️ Database Entities

### `Character`
```csharp
public class Character
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Class { get; set; }      // Warrior, Mage, Rogue
    public int Level { get; set; } = 1;
    public int XP { get; set; } = 0;
    public int HP { get; set; } = 100;
    public int Attack { get; set; } = 10;
    public int Defense { get; set; } = 5;
    public string UserId { get; set; }     // FK to ApplicationUser
    public ApplicationUser User { get; set; }
    public ICollection<Item> Inventory { get; set; }
    public ICollection<CombatLog> CombatLogs { get; set; }
}
```

### `Item`
```csharp
public class Item
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Type { get; set; }       // Weapon, Armor, Accessory
    public string Rarity { get; set; }     // Common, Rare, Epic, Legendary
    public int AttackBonus { get; set; }
    public int DefenseBonus { get; set; }
    public bool IsEquipped { get; set; }
    public int CharacterId { get; set; }
    public Character Character { get; set; }
}
```

### `CombatLog`
```csharp
public class CombatLog
{
    public int Id { get; set; }
    public string EnemyName { get; set; }
    public bool PlayerWon { get; set; }
    public int XPGained { get; set; }
    public string ItemDropped { get; set; }
    public DateTime Timestamp { get; set; }
    public int CharacterId { get; set; }
    public Character Character { get; set; }
}
```

---

## 🚀 Getting Started

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Visual Studio 2022](https://visualstudio.microsoft.com/)
- [Git](https://git-scm.com/)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/IdleQuest.git
cd IdleQuest

# 2. Restore NuGet packages
dotnet restore

# 3. Apply database migrations
dotnet ef database update

# 4. Run the application
dotnet run
```

Then open your browser at `https://localhost:7xxx`.

### Configuration

Edit `appsettings.json` to customize game settings:

```json
{
  "GameSettings": {
    "IdleXpPerMinute": 10,
    "BaseXpToLevelUp": 100,
    "XpScalingFactor": 1.5,
    "MaxLevel": 50
  }
}
```

---

## 📁 Project Structure

```
IdleQuest/
├── Controllers/
│   ├── HomeController.cs
│   ├── AccountController.cs
│   ├── CharacterController.cs
│   ├── CombatController.cs
│   └── InventoryController.cs
├── Models/
│   ├── ApplicationUser.cs
│   ├── Character.cs
│   ├── Item.cs
│   └── CombatLog.cs
├── Data/
│   └── ApplicationDbContext.cs
├── Views/
│   ├── Shared/
│   │   └── _Layout.cshtml
│   ├── Home/
│   ├── Character/
│   ├── Combat/
│   └── Inventory/
├── wwwroot/
│   ├── css/
│   └── js/
├── appsettings.json
└── Program.cs
```

---

## 🗺️ Development Roadmap

| Phase | Features | Status |
|---|---|---|
| **MVP** | Auth, character creation, idle XP, leveling | 🔄 In Progress |
| **Phase 2** | Combat system, enemy generation, combat log | 📋 Planned |
| **Phase 3** | Inventory, item drops, equipment system | 📋 Planned |
| **Phase 4** | Shop, leaderboard, multiple zones | 📋 Planned |
| **Phase 5** | SQL Server migration, deployment | 📋 Planned |

---

## 🎯 Learning Objectives

This project was built to demonstrate:

- ✅ **MVC Pattern** — Controllers, Views, Models in ASP.NET Core
- ✅ **Entity Framework Core** — DbContext, migrations, entity relationships
- ✅ **CRUD Operations** — Full create/read/update/delete for all game entities
- ✅ **ASP.NET Core Identity** — Secure user registration and login
- ✅ **Session Management** — Stateful game tracking in a stateless HTTP context
- ✅ **Database Design** — Normalized relational schema for game data
- ✅ **Responsive UI** — Bootstrap 5 grid, components, and theming

---

## 📚 Resources & Tools

- [ASP.NET Core Docs](https://docs.microsoft.com/en-us/aspnet/core/)
- [Entity Framework Core Docs](https://docs.microsoft.com/en-us/ef/core/)
- [Bootstrap 5 Docs](https://getbootstrap.com/docs/5.3/)
- [ASP.NET Core Identity](https://docs.microsoft.com/en-us/aspnet/core/security/authentication/identity)

---

## 🏫 Academic Context

**Institution:** Symbiosis University of Applied Sciences, Indore  
**Program:** Practical Skill Journal  
**Skill No.:** 1 & 2  
**Title:** Web-Based RPG Adventure using ASP.NET Core  
**Skills Acquired:** C#, ASP.NET Core MVC, Entity Framework Core, State Management, Bootstrap 5

---

## 📄 License

This project is developed for academic purposes as part of the Symbiosis University Skill Journal curriculum.

---

*Built with ⚔️ and C# — IdleQuest, Symbiosis University of Applied Sciences*
