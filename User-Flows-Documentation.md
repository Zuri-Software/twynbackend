# Soul App - Complete User Flow Documentation

## Table of Contents
1. [Authentication & Onboarding Flow](#authentication--onboarding-flow)
2. [Character Training Flow](#character-training-flow)
3. [Image Generation Flow](#image-generation-flow)
4. [Navigation Patterns](#navigation-patterns)
5. [Data Synchronization Flows](#data-synchronization-flows)
6. [Technical Architecture Overview](#technical-architecture-overview)

## Authentication & Onboarding Flow

### 1. App Launch & Authentication Check
**Frontend (Swift/SwiftUI):**
- `FluxAppApp.swift` → `RootView.swift` → `AuthService.shared`
- **Process:**
  1. App launches and initializes `RootView`
  2. `AuthService` checks for stored access token in Keychain
  3. If token exists, calls `fetchUserProfile()` API
  4. Sets `authState` to appropriate state based on result

**API Call:**
```
GET /api/users/profile
Authorization: Bearer {token}
```

**States:**
- `.loading` - While checking stored token
- `.authenticated(UserProfile)` - Valid token & profile loaded
- `.unauthenticated` - No token or expired/invalid token

### 2. Phone Number Entry
**Screen:** `PhoneNumberView`
- **User Actions:**
  - Selects country code (default: Canada +1)
  - Enters phone number (minimum 10 digits)
  - Taps "Send OTP" button
- **Validation:** Client-side validation for phone number format
- **API Call:**
```
POST /api/auth/send-otp
{
  "phone": "+15195463438"
}
```
- **Backend Process:**
  1. Validates phone number format
  2. Calls Supabase Auth `signInWithOtp()`
  3. Returns success message

### 3. OTP Verification
**Screen:** `OTPVerificationView`
- **User Actions:**
  - Enters 6-digit OTP code
  - Auto-submit when complete or manual verify
  - Option to resend after 60-second timer
- **API Call:**
```
POST /api/auth/verify-otp
{
  "phone": "+15195463438",
  "token": "123456"
}
```
- **Backend Process:**
  1. Validates OTP with Supabase Auth
  2. Creates/updates user record in PostgreSQL
  3. Returns user profile and session tokens
- **Frontend Actions:**
  1. Stores `access_token` and `refresh_token` in Keychain
  2. Updates `authState` to `.authenticated(UserProfile)`

### 4. Profile Completion (Onboarding)
**Screen:** `ProfileCompletionView`
- **Trigger:** `user.onboardingCompleted == false`
- **User Actions:**
  - Enters full name (required)
  - Selects date of birth
  - Selects gender (male/female/other)
  - Taps "Complete" button
- **API Call:**
```
PUT /api/users/profile
{
  "name": "John Smith",
  "dateOfBirth": "1990-01-01T00:00:00.000Z",
  "gender": "male"
}
```

### 5. Avatar Training Setup (Onboarding)
**Screen:** `AvatarTrainingView`
- **User Actions:**
  - Selects up to 25 photos using PhotosPicker
  - Photos automatically upload on selection
  - Option to "Skip for now"
- **Upload Process:**
  1. Client converts `PhotosPickerItem` to `Data`
  2. Creates multipart form data with all images
  3. Uploads to temporary folder via API
- **API Call:**
```
POST /api/onboarding/batch-upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

Form data: [images array]
```
- **Backend Process:**
  1. Saves images to S3 temp folder: `users/{userId}/temp_{timestamp}/`
  2. Returns `tempModelId` for later use

### 6. Image Confirmation
**Screen:** `ImageConfirmationView`
- **Display:** Success message with image count
- **User Action:** Taps "Continue" to proceed

### 7. Notification Permission
**Screen:** `NotificationPermissionView`
- **User Actions:**
  - "Enable Notifications" - requests iOS notification permission
  - "Not Now" - skips permission
- **Permission Process:**
  1. Calls `UNUserNotificationCenter.requestAuthorization()`
  2. Registers device token with backend (if permitted)
- **API Call:**
```
POST /api/users/register-device
{
  "userId": "user_id",
  "deviceToken": "apns_token",
  "platform": "ios"
}
```

### 8. Complete Onboarding
- **API Call:**
```
POST /api/users/complete-onboarding
Authorization: Bearer {token}
```
- **Backend:** Sets `onboarding_completed = true` in user record
- **Frontend:** Updates user profile and transitions to main app

### Error Handling
- **Network Errors:** Show retry options with clear error messages
- **Invalid OTP:** Clear input and show error message
- **Token Expiry:** Automatic token refresh attempt, logout if failed
- **Upload Failures:** Individual image retry with progress indication

---

## Character Training Flow

### 1. Training Initiation
**Entry Points:**
- **First Model (with onboarding images):** ModelTrainingView detects `hasOnboardingImages`
- **New Model:** User taps "Generate New" → Photo selection

### 2. Onboarding Images Flow
**Process:**
1. `checkForOnboardingImages()` API call on view load
2. If images exist, show popup: "Use Your Onboarding Photos"
3. User enters model name
4. Calls `trainModelFromOnboardingImages()`

**API Call:**
```
GET /api/onboarding/check-temp-folder
Authorization: Bearer {token}

Response:
{
  "hasOnboardingImages": true,
  "tempFolderName": "temp_1234567890",
  "imageCount": 23
}
```

**Training API:**
```
POST /api/onboarding/train-from-images
{
  "modelName": "My First Model",
  "tempFolderName": "temp_1234567890"
}
```

### 3. New Model Training Flow
**Process:**
1. User taps "Generate New" button
2. Name input alert appears
3. After name confirmation, PhotosPicker opens
4. User selects 20-50 images
5. Automatic training initiation on selection

**View Model:** `UploadViewModel`
- **State Management:**
  - `isTraining: Bool`
  - `progressText: String`
  - `selectedItems: [PhotosPickerItem]`
  - `existingModels: [TrainedModel]`

### 4. Image Upload & Processing
**Client Process:**
1. Convert `PhotosPickerItem` to `Data` arrays
2. Create multipart form request
3. Show progress indicator
4. Upload to training endpoint

**API Call:**
```
POST /api/train
Content-Type: multipart/form-data
Authorization: Bearer {token}

Form fields:
- modelName: "My Model"
- images: [binary data array]
```

### 5. Backend Training Process
**Immediate Response:**
```json
{
  "modelId": "uuid-model-id",
  "modelName": "My Model",
  "status": "pending",
  "message": "Training started, you will receive a push notification when complete"
}
```

**Background Process:**
1. **Create Model Record:** Inserts into PostgreSQL `models` table
2. **Upload to S3:** Temporary folder with UUID
3. **Submit to 302.AI:**
   ```
   POST https://api.302.ai/higgsfield/character
   {
     "name": "My Model",
     "input_images": ["s3_url_1", "s3_url_2", ...]
   }
   ```
4. **Poll for Completion:** Background polling every 10 seconds (max 30 minutes)
5. **File Reorganization:** Move from temp folder to `higgsfield_id` folder
6. **Update Database:** Set status to 'completed' with `higgsfield_id`
7. **Send Push Notification:**
   ```json
   {
     "title": "Training Complete!",
     "body": "Your model \"My Model\" is ready to use",
     "type": "training_complete",
     "data": {"higgsfield_id": "hf_12345", "modelName": "My Model"}
   }
   ```

### 6. Training Progress & Status
**Client Monitoring:**
- **Overlay UI:** Progress spinner with status text
- **Status Updates:** Polling or push notification driven
- **Error Handling:** Mark model as 'failed' and notify user

**Status Flow:**
- `pending` → `training` → `completed` or `failed`

### 7. Model Management
**Features:**
- **Selection:** Tap model card to select for generation
- **Renaming:** Tap model name to edit
- **Deletion:** Long press → shake animation → delete button
- **Visual Feedback:** Selected models show pink border and checkmark

**Model Card Data:**
- **Thumbnail:** From 302.AI response or first training image
- **Name:** User-defined, editable
- **Photo Count:** Number of training images
- **Status:** Visual indicators for training state

---

## Image Generation Flow

### 1. Generation Trigger Points
**Home View (Browse):**
- User taps preset card → `PresetDetailView`
- User taps "Generate" with selected character
- Automatic tab switch to Gallery after generation start

**Favorites View:**
- Same process as Home View
- Uses favorited presets only

### 2. Preset Selection & Configuration
**Screen:** `PresetDetailView`
- **Display:** Large preset image with details
- **Character Selection:** Must have trained model selected
- **Action:** "Generate" button triggers creation

**Preset Data Structure:**
```swift
struct Preset {
    let id: String
    let name: String
    let prompt: String
    let styleId: String  // 302.AI style identifier
    let imageUrl: URL
    let category: PresetCategory
}
```

### 3. Generation Request
**Client Process:**
1. Validate character selection exists
2. Create pending generation placeholder in UI
3. Submit async generation request
4. Switch to Gallery tab immediately

**API Call:**
```
POST /api/generate
{
  "prompt": "A portrait of a person in cinematic lighting",
  "style_id": "cinematic",
  "higgsfield_id": "hf_trained_model_id",
  "quality": "high",
  "aspect_ratio": "3:4"
}
```

**Immediate Response:**
```json
{
  "generationId": "gen_user123_1234567890",
  "status": "started",
  "message": "Generation started, you will receive a push notification when complete"
}
```

### 4. Background Generation Processing
**Backend Flow:**
1. **Immediate Return:** API responds instantly with generation ID
2. **302.AI Submission:**
   ```
   POST https://api.302.ai/higgsfield/text2image_soul
   {
     "prompt": "enhanced prompt",
     "style_id": "cinematic",
     "custom_reference_id": "hf_trained_model_id",
     "quality": "high",
     "aspect_ratio": "3:4"
   }
   ```
3. **Background Polling:** Poll 302.AI every 10 seconds (max 10 minutes)
4. **Image Download:** Fetch generated images from 302.AI URLs
5. **S3 Upload:** Store images in user's gallery folder
6. **Usage Tracking:** Increment generation count
7. **Push Notification:** Notify completion

### 5. Client-Side Generation Monitoring
**View Model:** `GenerateTabViewModel`
- **Pending State:** Show skeleton loader in gallery
- **Background Polling:** Refresh gallery at 30s, 2m, and 5m intervals
- **Push Notification Handler:** Immediate refresh on notification received

**Notification Handling:**
```swift
NotificationCenter.default.publisher(for: .generationCompleted)
    .sink { _ in
        Task { await self.loadImages() }
    }
```

### 6. Gallery Display & Management
**Screen:** `GalleryView`
**Layout:** Staggered grid of photo stacks (4 images per generation)

**Data Structure:**
```swift
struct GenerationBatch {
    let id: UUID
    let images: [URL]
    let timestamp: Date
}
```

**Image Loading:**
- **Caching:** `ImageCacheManager` with priority-based preloading
- **Progressive Loading:** Thumbnails first, full images on demand
- **Error Handling:** Fallback placeholders for failed loads

### 7. Image Interaction
**Photo Stack View:**
- **Tap:** Expand to 2x2 grid overlay
- **Grid Interaction:** Tap individual image for full screen
- **Full Screen:** Swipe gestures, zoom, share functionality

**Image States:**
- **Loading:** Skeleton animation
- **Loaded:** Cached display
- **Failed:** Error placeholder
- **Full Screen:** High resolution with controls

---

## Navigation Patterns

### 1. Tab-Based Architecture
**Main Structure:** `MainTabView` with 4 tabs
- **Tab 0:** Home (Browse) - `HomeView`
- **Tab 1:** Favorites - `FavoritesView`  
- **Tab 2:** Gallery - `GalleryView`
- **Tab 3:** Profile/Training - `ModelTrainingView`

**Custom Tab Bar:**
- **Implementation:** Custom `CustomTabBar` with image-based buttons
- **States:** Normal and selected image assets
- **Styling:** Black background with custom spacing

### 2. Navigation Stack Management
**Per-Tab Navigation:**
```swift
@State private var browsePath = NavigationPath()
@State private var notificationsPath = NavigationPath()
@State private var generatePath = NavigationPath()
@State private var profilePath = NavigationPath()
```

**Reset Patterns:**
- **Character Change:** Clear all navigation stacks
- **Model Selection:** Reset and switch to Browse tab
- **Navigation Trigger:** `AppStateManager.navigationResetTrigger`

### 3. Modal Presentations
**Sheet Presentations:**
- **Preset Detail:** Custom sheet with drag-to-dismiss
- **Country Picker:** Standard sheet
- **Photo Picker:** System PhotosPicker
- **Full Screen Covers:** Authentication flows, onboarding

**Custom Sheet Implementation:**
```swift
.fullScreenCover(isPresented: $showingSheet) {
    CustomPresetSheet(preset: selectedPreset)
}
```

### 4. Deep Linking & State Restoration
**App State Persistence:**
- **Selected Character:** `AppStateManager.selectedLoraId`
- **Authentication State:** Keychain-stored tokens
- **User Preferences:** UserDefaults for UI state

**State Restoration:**
- **Character Selection:** Auto-select if single model available
- **Tab State:** Restore to last selected tab
- **Navigation Depth:** Preserved per-tab navigation stacks

### 5. Cross-Tab Communication
**Generation Flow:**
- Home → Generate request → Switch to Gallery tab
- Automatic tab switching with data passing

**Model Management:**
- Profile tab model selection → Updates app state → Affects all tabs
- Real-time synchronization via `@ObservedObject`

---

## Data Synchronization Flows

### 1. Authentication State Management
**Service:** `AuthService` (Singleton, `@MainActor`)
**State:** `@Published var authState: AuthState`

**Token Management:**
- **Storage:** Keychain for secure token persistence
- **Refresh:** Automatic refresh on 401 responses
- **Expiry Handling:** Logout on failed refresh

**Sync Pattern:**
```swift
// Automatic token refresh on API calls
if response.statusCode == 401 {
    if await AuthService.shared.refreshToken() {
        return try await retryRequest()
    } else {
        throw AuthError.tokenExpired
    }
}
```

### 2. Character Model Synchronization
**Service:** `AppStateManager` (Singleton, `@MainActor`)
**Data:** User's trained models and selection state

**Sync Points:**
- **App Launch:** Load available models from API
- **Model Creation:** Refresh list after training completion
- **Model Updates:** Real-time updates via push notifications

**API Integration:**
```
GET /api/users/models
Response: {
  "models": [
    {
      "id": "uuid",
      "name": "My Model",
      "status": "completed",
      "higgsfield_id": "hf_12345",
      "thumbnail_url": "s3_url"
    }
  ]
}
```

### 3. Image Gallery Synchronization
**Service:** `GenerateTabViewModel`
**Pattern:** Pull-to-refresh + Push notification updates

**Sync Strategy:**
1. **Initial Load:** Fetch all images on view appearance
2. **Background Refresh:** Periodic checks during active generation
3. **Push Notification:** Immediate refresh on completion
4. **Pull-to-Refresh:** User-initiated full sync

**Caching Strategy:**
- **Memory Cache:** `ImageCacheManager` with LRU eviction
- **Disk Cache:** URLSession default cache
- **Preloading:** Priority-based background loading

### 4. Preset Data Synchronization
**Source:** Supabase direct connection (bypasses main backend)
**Service:** `PresetService` (Singleton)

**Sync Pattern:**
```
GET https://knpayppjljuoznrazink.supabase.co/rest/v1/presets
?select=*&is_active=eq.true&order=sort_order
```

**Caching:** In-memory cache with app session lifetime

### 5. Offline Behavior
**Authentication:** Graceful degradation with cached user profile
**Images:** Display cached images, disable generation
**Models:** Show cached model list, disable training
**Sync Recovery:** Full refresh on network restoration

### 6. Real-Time Updates
**Push Notifications:** APNs for iOS, FCM for Android (planned)
**Notification Types:**
- `training_complete` - Model ready
- `generation_complete` - Images ready
- `training_failed` / `generation_failed` - Error states

**Notification Handling:**
```swift
// AppDelegate registers for notifications
// Notifications trigger immediate data refresh
NotificationCenter.default.post(name: .generationCompleted, object: nil)
```

### 7. State Consistency Patterns
**Single Source of Truth:** Each data type has one authoritative source
**Cascading Updates:** Changes propagate through reactive bindings
**Error Recovery:** Retry mechanisms with exponential backoff
**Data Validation:** Client and server-side validation

---

## Technical Architecture Overview

### Frontend (Swift/SwiftUI)
```
FluxApp/
├── Models/                 # Data structures
│   ├── AuthModels.swift   # User, session, auth states
│   └── Preset.swift       # Presets, trained models
├── Services/              # Business logic layer
│   ├── AppStateManager.swift    # Global app state
│   ├── AuthService.swift        # Authentication
│   ├── PresetService.swift      # Preset management
│   └── ImageCacheManager.swift  # Image caching
├── ViewModels/           # MVVM presentation layer
│   ├── GenerateTabViewModel.swift
│   ├── GenerateViewModel.swift
│   └── UploadViewModel.swift
├── Views/                # SwiftUI interface
│   ├── AuthViews.swift   # Onboarding flow
│   ├── MainTabView.swift # Tab navigation
│   ├── HomeView.swift    # Preset browser
│   ├── GalleryView.swift # Generated images
│   └── ModelTrainingView.swift # Character training
└── Networking/           # API communication
    └── APIService.swift  # HTTP client
```

### Backend (Node.js/TypeScript)
```
src/
├── routes/               # API endpoints
│   ├── auth.ts          # Authentication
│   ├── train.ts         # Model training
│   ├── generate.ts      # Image generation
│   ├── images.ts        # Gallery management
│   └── onboarding.ts    # Onboarding flow
├── controllers/         # Request handlers
│   ├── authController.ts
│   ├── trainController.ts
│   ├── generateController.ts
│   └── onboardingController.ts
├── services/           # Business logic
│   ├── 302aiService.ts       # AI integration
│   ├── pushNotificationService.ts
│   ├── userService.ts
│   └── s3.ts
├── middleware/         # Request processing
│   ├── auth.ts         # JWT validation
│   └── usageLimits.ts  # Rate limiting
└── migrations/         # Database schema
    └── *.sql
```

### Key Integrations
- **Authentication:** Supabase Auth with phone OTP
- **AI Processing:** 302.AI for training and generation
- **Storage:** AWS S3 for images
- **Database:** PostgreSQL for user data
- **Push Notifications:** APNs (iOS) / FCM (Android)
- **Caching:** Redis for session management

### Data Flow Architecture
1. **Client Request** → SwiftUI View → ViewModel → APIService
2. **Network** → Express.js Router → Controller → Service Layer
3. **Processing** → 302.AI API / S3 / PostgreSQL
4. **Response** → JSON → Swift Models → UI Update
5. **Real-time** → Push Notifications → Background Processing → UI Refresh

This documentation covers the complete user experience flow from authentication through image generation, including all technical implementation details and data synchronization patterns.