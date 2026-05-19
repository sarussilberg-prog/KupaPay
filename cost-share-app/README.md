# Cost Share App - Production-Grade Monorepo

A complete mobile + backend cost-sharing application (like Splitwise) built with modern technologies and scalable architecture patterns.

## 🏗️ Architecture

This is a **production-grade monorepo** using Turborepo with strict architectural patterns:

```
cost-share-app/
├── apps/
│   ├── mobile/     # React Native (Expo) frontend
│   ├── web/        # Next.js web app (Supabase auth)
│   ├── server/     # NestJS backend with mock data
├── packages/
│   ├── shared/     # Shared TypeScript types
├── .cursor/
│   └── rules/      # AI-friendly architecture documentation
```

## 🚀 Tech Stack

### Frontend (Mobile + Web)
- **React Native** with Expo SDK 54
- **Next.js 15** web client with Supabase SSR auth
- **React Navigation** (bottom tabs, WhatsApp-style)
- **NativeWind** (Tailwind CSS for React Native)
- **Zustand** (state management)
- **i18next** (internationalization: EN/HE with RTL support)

### Backend (Server)
- **NestJS** (enterprise-grade Node.js framework)
- **TypeScript** (strict mode)
- **Supabase Postgres** via NestJS API (service role + JWT auth on requests)

### Shared
- **TypeScript** types shared between frontend and backend
- **Zod** schemas (placeholder for validation)

## 📱 Features

### Screens
1. **Groups** - List of cost-sharing groups with create button
2. **History** - List of expenses grouped by group
3. **Profile** - User profile with language toggle (EN/HE) and logout

### Core Functionality
- View groups and expenses
- Mock API integration
- English/Hebrew support with RTL
- Clean services layer architecture

## 🧱 Critical Architecture Rule

**ALL DATA MUTATIONS MUST GO THROUGH SERVICES LAYER**

```
UI → services/ → API → backend
```

### ✅ Correct Pattern
```typescript
import { createGroup } from '../../services/groups.service';

const handleCreate = async () => {
  await createGroup(data);
};
```

### ❌ Wrong Pattern
```typescript
const handleCreate = async () => {
  await fetch('/api/groups', { method: 'POST', body: data });
};
```

## 🚦 Getting Started

### Prerequisites
- Node.js >= 18
- npm >= 9

### Installation

1. **Install dependencies:**
```bash
cd cost-share-app
npm install
```

2. **Configure Supabase env (see `.env.example` in each app):**
```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/web/.env.example apps/web/.env.local
# Fill keys from Supabase → Project Settings → API
# Enable Google provider + redirect URLs (documented in .env.example files)
```

3. **Apply database schema and seed (one-time):**
   - Paste `apps/server/db/schema.sql` into Supabase SQL Editor → Run
   - `cd apps/server && npm run seed` (optional dev data)
   - Verify: `bash scripts/verify-supabase-schema.sh`

4. **Mobile API URL (physical device / Expo Go):**
   - Set `EXPO_PUBLIC_API_URL=http://<YOUR_MAC_LAN_IP>:3000/api` in `apps/mobile/.env`
   - `dev-start.sh` prints the suggested value on boot

### Running the Project

#### Start Backend Server
```bash
npm run server
# or
cd apps/server && npm run dev
```

Server runs on: `http://localhost:3000/api`

#### Start Mobile App
```bash
npm run mobile
# or
cd apps/mobile && npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app

#### Start Web App
```bash
npm run web
# or
cd apps/web && npm run dev
```

Web runs on: `http://localhost:3000`

### Development

```bash
# Run all apps in dev mode
npm run dev

# Build all apps
npm run build

# Clean all build artifacts
npm run clean
```

## 📂 Project Structure

### Frontend Structure
```
apps/mobile/
├── screens/          # UI screens (thin composition layer)
│   ├── groups/
│   ├── history/
│   └── profile/
├── services/         # ALL API calls and data mutations
│   ├── api.ts
│   ├── groups.service.ts
│   ├── expenses.service.ts
│   └── users.service.ts
├── store/            # Zustand global state
├── navigation/       # React Navigation setup
├── i18n/             # Internationalization
│   └── locales/
│       ├── en.json
│       └── he.json
├── components/       # Reusable UI components
└── theme/            # Theme configuration
```

### Backend Structure
```
apps/server/src/
├── controllers/      # Thin HTTP layer
├── services/         # Business logic
├── data/             # Mock in-memory data
├── app.module.ts
└── main.ts
```

### Shared Package
```
packages/shared/src/
├── types/            # TypeScript interfaces
├── schemas/          # Zod validation schemas
├── utils/            # Shared utilities
└── index.ts
```

## 🌍 Internationalization

Supports English and Hebrew with full RTL support:

```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
<Text>{t('groups.title')}</Text>
```

Language change in Profile screen may require app restart for full RTL effect.

## 🔌 API Endpoints

Base URL: `http://localhost:3000/api`

### Users
- `GET /users` - Get all users
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user

### Groups
- `GET /groups` - Get all groups
- `GET /groups/:id` - Get group by ID
- `POST /groups` - Create group

### Expenses
- `GET /expenses` - Get all expenses
- `GET /expenses?groupId=:id` - Get expenses by group
- `GET /expenses/:id` - Get expense by ID
- `POST /expenses` - Create expense

## 📋 Architecture Documentation

Comprehensive AI-friendly rules in `.cursor/rules/`:

- `architecture.mdc` - Core architectural patterns
- `frontend.mdc` - Frontend rules and patterns
- `backend.mdc` - Backend rules and patterns
- `shared.mdc` - Shared package rules
- `coding-style.mdc` - Code style guidelines
- `api-contract.mdc` - API contract documentation
- `i18n.mdc` - Internationalization rules
- `rtl.mdc` - RTL support rules

## 🎯 Why This Architecture?

This project follows production-grade patterns even though it uses mock data:

✅ **Scalable** - Easy to migrate to real database (Supabase)  
✅ **Maintainable** - Clean separation of concerns  
✅ **AI-Friendly** - Consistent patterns for AI code generation  
✅ **Testable** - Services layer enables easy testing  
✅ **Future-Proof** - Ready for offline support without UI refactoring  

## 🔄 Future Enhancements

- [x] Migrate to Supabase database
- [x] Add authentication (Google via Supabase — mobile + web)
- [ ] Implement offline support
- [ ] Add expense splitting logic
- [ ] Add push notifications
- [ ] Add expense categories
- [ ] Add group member management
- [ ] Add expense editing/deletion
- [ ] Add settlement calculations

## 📝 Development Guidelines

### Adding a New Feature

1. **Define types** in `packages/shared/src/types/`
2. **Create backend service** in `apps/server/src/services/`
3. **Create backend controller** in `apps/server/src/controllers/`
4. **Create frontend service** in `apps/mobile/services/`
5. **Create UI screen** in `apps/mobile/screens/`
6. **Add translations** in `apps/mobile/i18n/locales/`

### Rules to Follow

- ❌ NO direct API calls from screens
- ❌ NO business logic in UI components
- ❌ NO "any" types in TypeScript
- ❌ NO hardcoded strings (use i18n)
- ✅ ALL mutations through services layer
- ✅ Use NativeWind for styling
- ✅ Keep controllers thin
- ✅ Document with comments

## 🤝 Contributing

This is a starter template. Feel free to:
- Add new features
- Improve architecture
- Add tests
- Enhance UI/UX
- Add more languages

## 📄 License

MIT

## 🙏 Acknowledgments

Built with modern best practices for scalable mobile + backend applications.

---

**Ready to build amazing cost-sharing features! 🚀**
