# 🎨 Theme-Aware Images Setup

## Current Setup
The student dashboard currently uses these images:
- `/welcome.png` - Welcome/intro image in the header
- `/loading.gif` - Loading animation

## Required Changes

### Ben 10 Theme Images
- **Welcome Image:** `/ben10-welcome.png` - Hero character image
- **Loading Animation:** `/ben10-loading.gif` - Ben 10 themed loading

### Tinkerbell Theme Images  
- **Welcome Image:** `/tinkerbell-welcome.png` - Tinkerbell/fairy character
- **Loading Animation:** `/tinkerbell-loading.gif` - Tinkerbell themed loading

## How to Add Images

### Step 1: Add Images to Public Folder
1. Create or download your theme images:
   - Ben 10 hero character image (rectangular or square, ~300x300px recommended)
   - Tinkerbell/fairy character image (~300x300px)
   - Ben 10 loading animation (GIF)
   - Tinkerbell loading animation (GIF)

2. Save them to `/public/` directory:
   - `ben10-welcome.png`
   - `tinkerbell-welcome.png`
   - `ben10-loading.gif`
   - `tinkerbell-loading.gif`

### Step 2: Implementation in Code
The code will automatically switch images based on theme:

```tsx
// Loading screen uses theme-aware images
<img 
  src={theme === 'ben10' ? '/ben10-loading.gif' : '/tinkerbell-loading.gif'} 
  alt="Loading..." 
/>

// Welcome header uses theme-aware images
<img 
  src={theme === 'ben10' ? '/ben10-welcome.png' : '/tinkerbell-welcome.png'} 
  alt="Welcome"
/>
```

## Image Specifications

### Welcome Image
- **Format:** PNG with transparency (or JPG)
- **Recommended Size:** 300x300px to 400x400px
- **Usage:** Rounded circle (border-radius applied in CSS)
- **Display:** Top-right of welcome header section
- **Theme Ben 10:** Green hero character (e.g., actual Ben 10 artwork)
- **Theme Tinkerbell:** Pink/purple fairy character (e.g., Tinkerbell artwork)

### Loading Animation
- **Format:** GIF or MP4
- **Recommended Size:** 300x300px
- **Duration:** 1-2 seconds loop
- **Theme Ben 10:** Green/black animation
- **Theme Tinkerbell:** Pink/purple animation

## File Paths After Implementation

```
/public/
  ├── ben10-welcome.png         (New - Ben 10 character)
  ├── tinkerbell-welcome.png    (New - Tinkerbell character)
  ├── ben10-loading.gif         (New - Ben 10 loading animation)
  ├── tinkerbell-loading.gif    (New - Tinkerbell loading animation)
  ├── welcome.png               (Keep as fallback)
  └── loading.gif               (Keep as fallback)
```

## Code Changes Made

### Updated Loading Screen
The loading screen now checks the theme and uses appropriate image:
```tsx
if (loading) {
  return (
    <div style={{
      background: theme === 'ben10'
        ? 'linear-gradient(to br, rgb(74, 222, 128), rgb(0, 0, 0))'
        : 'linear-gradient(to br, rgb(244, 114, 182), rgb(109, 40, 217))'
    }}>
      <img 
        src={theme === 'ben10' ? '/ben10-loading.gif' : '/tinkerbell-loading.gif'} 
        alt="Loading..."
      />
    </div>
  );
}
```

### Updated Welcome Image
The welcome header now uses theme-aware image:
```tsx
<img 
  src={theme === 'ben10' ? '/ben10-welcome.png' : '/tinkerbell-welcome.png'} 
  alt="Welcome" 
  className={`w-40 h-40 rounded-full border-4 border-black ring-4 ${
    theme === 'ben10' ? 'ring-green-400' : 'ring-pink-400'
  }`}
/>
```

## Next Steps
1. ✅ Code updated to support theme-aware images
2. ⏳ Add actual images to `/public/` directory:
   - `ben10-welcome.png`
   - `tinkerbell-welcome.png`
   - `ben10-loading.gif`
   - `tinkerbell-loading.gif`
3. Test theme switching - images should change instantly

## Placeholder Behavior
Until you add the themed images, the system will use:
- `/loading.gif` when `ben10-loading.gif` is not found
- `/welcome.png` when `ben10-welcome.png` is not found

Once you add the themed images, they will be used automatically!
