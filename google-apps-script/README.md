# Google Apps Script Setup Guide for Dru Edu Sheet Management

## Step 1: Create the Google Apps Script Project

1. Go to [Google Apps Script](https://script.google.com/)
2. Click "New Project"
3. Replace the default `Code.gs` content with the code from `SheetManager.gs` (in this directory)
4. Rename the project to "Dru Edu Sheet Manager"

## Step 2: Deploy as Web App

1. In the Apps Script editor, click "Deploy" > "New deployment"
2. Choose type: "Web app"
3. Configure the deployment:
   - **Description**: "Dru Edu Sheet Manager v1"
   - **Execute as**: "Me (your email)"
   - **Who has access**: "Anyone" (this allows our Next.js app to call it)
4. Click "Deploy"
5. **IMPORTANT**: Copy the Web App URL (you'll need this for the Next.js configuration)

## Step 3: Authorize Permissions

1. After deployment, you'll be prompted to authorize permissions
2. Click "Authorize access"
3. Sign in with your Google account (the one that owns the "Dru Edu Sheets" folder)
4. Grant the following permissions:
   - View and manage your Google Drive files
   - View and manage Google Drive files and folders that you have opened or created with this app

## Step 4: Test the Deployment

The web app URL will look like:
```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

Test it by visiting the URL in your browser - you should see:
```json
{
  "message": "Dru Edu Sheet Manager is running",
  "timestamp": "2024-01-XX..."
}
```

## Step 5: Update Environment Variables

Add the following to your `.env` file:
```
# Google Apps Script Configuration
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

## Step 6: Security Considerations

- The script runs with YOUR Google Drive permissions
- It can only access files you have access to
- The web app is public but requires POST requests with specific data structure
- Consider adding additional authentication if needed

## Troubleshooting

### Common Issues:

1. **"Script function not found"**: Make sure you deployed the script after pasting the code
2. **Permission denied**: Ensure you authorized all permissions during deployment
3. **Folder not found**: Verify the `SHARED_FOLDER_ID` in the script matches your folder
4. **Template not accessible**: The template file must be accessible by your Google account

### Testing Functions:

You can test individual functions in the Apps Script editor:
- `testConnection()` - Verify folder access
- `testSheetCreation()` - Test creating sheets (update with real template ID)
- `cleanupTestSheets()` - Clean up test files

## Next Steps

Once deployed, the Next.js application will be updated to use this Google Apps Script instead of the direct Google Sheets API, which should resolve the permission issues we were experiencing.