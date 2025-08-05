# Firebase Database Environment Setup Guide

This guide explains how to set up different Firestore databases for different environments (development, production) while sharing the same Firebase Auth and Storage.

## Environment Configuration

### Local Development (.env)
- Uses the **default** Firestore database
- Environment variables set to `(default)`

### Production (.env.production)
- Uses the **production** Firestore database
- Environment variables set to `production`

## Key Environment Variables

### Client-side Configuration
```bash
# For development (uses default database)
NEXT_PUBLIC_FIRESTORE_DATABASE_ID=(default)

# For production (uses production database)
NEXT_PUBLIC_FIRESTORE_DATABASE_ID=production
```

### Server-side Configuration
```bash
# For development (uses default database)
FIRESTORE_DATABASE_ID=(default)

# For production (uses production database)
FIRESTORE_DATABASE_ID=production
```

## Deployment Setup

### For Vercel Deployment

1. **Set Environment Variables in Vercel Dashboard:**
   - Go to your Vercel project settings
   - Navigate to Environment Variables
   - Add all variables from `.env.production`
   - Make sure `NEXT_PUBLIC_FIRESTORE_DATABASE_ID=production`
   - Make sure `FIRESTORE_DATABASE_ID=production`

2. **Alternative: Use Vercel CLI**
   ```bash
   # Pull environment variables from Vercel
   vercel env pull .env.local
   
   # Or add them manually
   vercel env add NEXT_PUBLIC_FIRESTORE_DATABASE_ID production
   vercel env add FIRESTORE_DATABASE_ID production
   ```

### For Other Hosting Platforms

1. **Netlify:**
   - Go to Site Settings > Environment Variables
   - Add all variables from `.env.production`

2. **Railway:**
   - Go to your project settings
   - Add environment variables from `.env.production`

3. **DigitalOcean App Platform:**
   - Add environment variables in the app spec or dashboard

## Firebase Console Setup

### Creating the Production Database

1. **Go to Firebase Console:**
   - Navigate to your project: https://console.firebase.google.com/project/dru-edu

2. **Create Production Database:**
   - Go to Firestore Database
   - Click "Create database" (if you see a second option)
   - Choose "production" as the database ID
   - Select location (same as your default database)
   - Choose security rules (start in test mode, then update)

3. **Set Security Rules:**
   - Copy rules from your default database to production database
   - Or create new rules specific to production

## Testing the Setup

### Verify Database Connection

1. **Check Environment Variables:**
   ```bash
   # In your application, log the database ID being used
   console.log('Database ID:', process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID);
   ```

2. **Test Data Isolation:**
   - Create test data in development (should go to default database)
   - Deploy to production (should use production database)
   - Verify data doesn't mix between environments

## File Structure

```
├── .env                    # Local development (default database)
├── .env.production         # Production environment (production database)
├── src/utils/
│   ├── firebase-client.ts  # Updated to use database ID
│   ├── firebase-admin.ts   # Updated to use database ID
│   └── firebase-server.ts  # Updated to use database ID
```

## Benefits of This Setup

1. **Data Isolation:** Development and production data are completely separate
2. **Shared Resources:** Firebase Auth and Storage are shared between environments
3. **Cost Effective:** Only pay for additional Firestore database, not separate projects
4. **Easy Switching:** Change environment by updating one variable
5. **Safe Testing:** Can test in development without affecting production data

## Troubleshooting

### Common Issues

1. **Database Not Found Error:**
   - Ensure the database ID exists in Firebase Console
   - Check environment variable spelling
   - Verify the database was created in the correct project

2. **Permission Denied:**
   - Check Firestore security rules for the production database
   - Ensure rules are copied from default database

3. **Data Not Appearing:**
   - Verify you're connecting to the correct database
   - Check if data exists in the expected database in Firebase Console

### Debugging

```javascript
// Add this to your application to debug database connection
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();
console.log('Connected to database:', db._delegate._databaseId);
```
