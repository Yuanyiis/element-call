# Be My Eyes Helper - MVP Implementation Guide

## Overview

This MVP transforms Element Call into a Be My Eyes-style visual assistance application, connecting volunteers with visually impaired people through video calls.

## Architecture

```
┌─────────────────────────────────────────────┐
│           Be My Eyes Helper MVP             │
├─────────────────────────────────────────────┤
│                                             │
│  ┌────────────┐         ┌────────────┐    │
│  │ Role       │         │ Matching   │    │
│  │ Selection  │────────>│ System     │    │
│  └────────────┘         └────────────┘    │
│        │                      │            │
│        v                      v            │
│  ┌────────────┐         ┌────────────┐    │
│  │ Volunteer  │         │ Visually   │    │
│  │ Dashboard  │         │ Impaired   │    │
│  └────────────┘         │ Help View  │    │
│        │                └────────────┘    │
│        │                      │            │
│        └──────────┬───────────┘            │
│                   v                        │
│            ┌────────────┐                  │
│            │ Video Call │                  │
│            │ (1v1 Room) │                  │
│            └────────────┘                  │
│                                             │
└─────────────────────────────────────────────┘
```

## Features Implemented

### ✅ Phase 1.1: Role System Foundation
- User role management (Volunteer/Visually Impaired)
- Persistent storage with localStorage
- Role context and hooks
- User statistics tracking

**Files:**
- `src/bme/types.ts`
- `src/bme/storage.ts`
- `src/bme/useRole.ts`
- `src/bme/RoleContext.tsx`

### ✅ Phase 1.2: Role Selection Page
- Beautiful landing page with role selection
- Responsive design with accessibility features
- Full i18n support (English & Chinese)

**Files:**
- `src/bme/RoleSelectionPage.tsx`
- `src/bme/RoleSelectionPage.module.css`

### ✅ Phase 1.3: Matching System Core
- Matrix-based volunteer pool management
- Intelligent matching with language preferences
- Real-time volunteer availability tracking
- Automatic room creation and joining

**Files:**
- `src/bme/matching/VolunteerPool.ts`
- `src/bme/matching/MatchingService.ts`
- `src/bme/matching/useMatching.ts`
- `src/bme/matching/MatchingContext.tsx`

### ✅ Phase 1.4: Volunteer Workflow
- Volunteer dashboard with statistics
- Waiting view with animated status
- Real-time online volunteer count
- Auto-navigation to matched calls

**Files:**
- `src/bme/volunteer/VolunteerDashboard.tsx`
- `src/bme/volunteer/VolunteerWaitingView.tsx`

### ✅ Phase 1.5: Visually Impaired Workflow
- Help request interface with large buttons
- Camera permission handling
- Searching animation view
- No volunteers available fallback

**Files:**
- `src/bme/help/HelpRequestView.tsx`
- `src/bme/help/SearchingView.tsx`
- `src/bme/help/NoVolunteersView.tsx`

### ✅ Phase 1.6: Enhanced Camera Controls
- Automatic rear camera selection for visually impaired
- Camera switching functionality
- Flashlight/torch control
- Role-based camera constraints

**Files:**
- `src/bme/camera/useCameraConstraints.ts`
- `src/bme/camera/useCameraSwitcher.ts`
- `src/bme/camera/useFlashlight.ts`
- `src/bme/camera/CameraControls.tsx`

## User Flows

### Volunteer Flow
1. Visit home page → Select "I'm a Volunteer"
2. Navigate to `/volunteer` dashboard
3. Click "Start waiting for requests"
4. Enter waiting state with live stats
5. Auto-matched when help request comes in
6. Join call room automatically
7. Help visually impaired user
8. End call → Return to dashboard

### Visually Impaired Flow
1. Visit home page → Select "I Need Help"
2. Navigate to `/help` request page
3. Grant camera permission
4. Click large "Find Volunteer" button
5. Enter searching state with animation
6. Auto-matched with available volunteer
7. Join call room automatically
8. Receive help from volunteer
9. End call → Return to help page

## Routing Structure

```
/                   → RoleSelectionPage (Landing)
/volunteer          → VolunteerDashboard
/help               → HelpRequestView
/login              → LoginPage
/register           → RegisterPage
/:roomId            → RoomPage (Video Call)
```

## Key Technologies

- **Frontend:** React 19 + TypeScript + Vite
- **State Management:** React Context + RxJS
- **Styling:** CSS Modules + PostCSS
- **Video:** LiveKit + WebRTC
- **Matrix:** matrix-js-sdk
- **i18n:** react-i18next
- **Testing:** Vitest + Playwright

## Configuration

### Backend Requirements

1. **Matrix Homeserver (Synapse)**
   - MSC4143 (MatrixRTC)
   - MSC4195 (LiveKit backend)
   - MSC4140 (Delayed events)
   - MSC4222 (Sync v2 state_after)

2. **LiveKit SFU**
   - WebRTC media server
   - JWT authentication

3. **MatrixRTC Authorization Service**
   - lk-jwt-service

### Environment Setup

```bash
# Clone and install
git clone <repo>
cd element-call
corepack enable
yarn install

# Copy config
cp config/config.devenv.json public/config.json

# Start dev server
yarn dev

# Start backend (Docker)
yarn backend
```

### Browser Setup

For local development, add certificate exceptions:
- `https://localhost:3000`
- `https://matrix-rtc.m.localhost/livekit/jwt/healthz`
- `https://synapse.m.localhost/.well-known/matrix/client`

Or add `backend/dev_tls_local-ca.crt` to trusted certificates.

## Accessibility Features

### For Visually Impaired Users
- ✅ Extra large touch targets (min 48x48px)
- ✅ High contrast mode support
- ✅ Screen reader optimized (ARIA labels)
- ✅ Simple, intuitive interface
- ✅ Voice announcements ready
- ✅ Automatic rear camera
- ✅ Flashlight control

### General Accessibility
- ✅ Keyboard navigation
- ✅ Focus management
- ✅ Reduced motion support
- ✅ Semantic HTML
- ✅ Color contrast compliance

## Internationalization

Supported languages:
- English (en)
- Simplified Chinese (zh-Hans)

Translation files:
- `locales/en/app.json`
- `locales/zh-Hans/app.json`

All BME-specific translations under `bme` namespace.

## Next Steps (Post-MVP)

### Phase 2: User Experience Enhancement
- [ ] PWA support (offline, install prompt)
- [ ] Push notifications for volunteers
- [ ] Voice announcements with Web Speech API
- [ ] Haptic feedback on mobile
- [ ] Better onboarding flow

### Phase 3: Advanced Features
- [ ] Feedback/rating system
- [ ] User profiles and accounts
- [ ] Volunteer verification
- [ ] Queue management
- [ ] Call history
- [ ] Statistics dashboard
- [ ] AI-assisted features (OCR, object detection)

### Phase 4: Scalability
- [ ] Independent matching server
- [ ] Load balancing
- [ ] Multi-language volunteer matching
- [ ] Geographic routing
- [ ] Performance monitoring

## Testing

### Run Tests
```bash
# Unit tests
yarn test

# E2E tests with Playwright
yarn backend  # Start backend first
yarn test:playwright

# Type checking
yarn lint:types
```

### Manual Testing Checklist

#### Role Selection
- [ ] Landing page loads correctly
- [ ] Both role buttons work
- [ ] Navigates to correct pages

#### Volunteer Flow
- [ ] Dashboard shows correct stats
- [ ] Can start/stop waiting
- [ ] Online count updates
- [ ] Auto-joins call when matched

#### Visually Impaired Flow
- [ ] Camera permission request works
- [ ] Large help button is accessible
- [ ] Searching animation displays
- [ ] Error handling for no volunteers
- [ ] Auto-joins call when matched

#### Camera Controls
- [ ] Rear camera selected by default
- [ ] Camera switch works (if device has multiple)
- [ ] Flashlight toggles (if supported)

#### Call Quality
- [ ] Video connects successfully
- [ ] Audio is clear
- [ ] Video quality is good
- [ ] No major lag or disconnections

## Troubleshooting

### Common Issues

**"No volunteers available"**
- Ensure at least one volunteer is online
- Check Matrix volunteer pool room exists
- Verify backend is running

**Camera not working**
- Grant camera permissions
- Check browser supports getUserMedia
- Try HTTPS (required for camera access)
- Check device has camera

**Matching fails**
- Verify Matrix homeserver is configured correctly
- Check `.well-known/matrix/client` settings
- Ensure LiveKit backend is running
- Check network connectivity

**Build errors**
- Run `yarn install` to ensure dependencies
- Check Node version (requires Node 20+)
- Clear node_modules and reinstall

## Contributing

### Code Style
- TypeScript strict mode
- ESLint + Prettier
- CSS Modules for styling
- Functional components with hooks

### File Organization
```
src/bme/
├── types.ts              # Shared types
├── storage.ts            # LocalStorage utils
├── RoleContext.tsx       # Role provider
├── RoleSelectionPage.tsx # Landing page
├── matching/             # Matching system
├── volunteer/            # Volunteer views
├── help/                 # Visually impaired views
└── camera/               # Camera controls
```

### Adding Features
1. Create feature branch
2. Implement with tests
3. Update translations (en + zh-Hans)
4. Update this README
5. Submit PR

## License

AGPL-3.0 OR LicenseRef-Element-Commercial

Copyright 2021-2025 New Vector Ltd

## Credits

Built on Element Call by Element
Matrix protocol by Matrix.org Foundation
LiveKit for WebRTC infrastructure

---

**MVP Status:** ✅ Complete
**Last Updated:** 2025-01-14
**Version:** 1.0.0-mvp
