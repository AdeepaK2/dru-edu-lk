/**
 * Google Apps Script for Dru Edu Sheet Management
 * This script handles creating individual student sheets from templates
 * and managing them in the shared "Dru Edu Sheets" folder
 */

// Configuration
const SHARED_FOLDER_NAME = 'Dru Edu Sheets';
const SHARED_FOLDER_ID = '1veqaKhxsRu7HamlOS8_XVJs7Hb_2elXg'; // Your existing folder ID

/**
 * Main function to handle HTTP requests from Next.js
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    console.log('Received request:', action);
    
    switch (action) {
      case 'createStudentSheets':
        return createStudentSheets(data);
      case 'testConnection':
        return testConnection();
      default:
        return createResponse({ error: 'Unknown action: ' + action }, 400);
    }
  } catch (error) {
    console.error('Error in doPost:', error);
    return createResponse({ error: error.toString() }, 500);
  }
}

/**
 * Handle GET requests for testing
 */
function doGet(e) {
  return createResponse({ 
    message: 'Dru Edu Sheet Manager is running',
    timestamp: new Date().toISOString()
  });
}

/**
 * Test connection function
 */
function testConnection() {
  try {
    const folder = DriveApp.getFolderById(SHARED_FOLDER_ID);
    return createResponse({
      success: true,
      message: 'Connection successful',
      folderName: folder.getName(),
      folderId: SHARED_FOLDER_ID
    });
  } catch (error) {
    return createResponse({ error: 'Connection failed: ' + error.toString() }, 500);
  }
}

/**
 * Create individual sheets for students from a template
 */
function createStudentSheets(data) {
  try {
    const { templateFileUrl, students, className, templateName } = data;
    
    if (!templateFileUrl || !students || !Array.isArray(students)) {
      return createResponse({ error: 'Missing required parameters' }, 400);
    }
    
    console.log(`Creating sheets for ${students.length} students`);
    console.log(`Template URL: ${templateFileUrl}`);
    
    // Download the template file from Firebase Storage URL
    let templateFile;
    try {
      console.log('Downloading template from Firebase Storage...');
      const response = UrlFetchApp.fetch(templateFileUrl);
      const blob = response.getBlob();
      
      // Determine the correct MIME type based on the file extension
      let mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; // Default to .xlsx
      if (templateFileUrl.includes('.csv')) {
        mimeType = 'text/csv';
      } else if (templateFileUrl.includes('.xls') && !templateFileUrl.includes('.xlsx')) {
        mimeType = 'application/vnd.ms-excel';
      }
      
      blob.setContentType(mimeType);
      
      // Create a temporary file in Google Drive
      const tempFileName = `temp_template_${Date.now()}`;
      templateFile = DriveApp.createFile(blob.setName(tempFileName));
      
      console.log(`✅ Template downloaded and uploaded to Drive: ${templateFile.getId()}`);
      
    } catch (downloadError) {
      console.error('❌ Error downloading template:', downloadError);
      return createResponse({ error: 'Failed to download template: ' + downloadError.toString() }, 500);
    }
    
    const sharedFolder = DriveApp.getFolderById(SHARED_FOLDER_ID);
    
    const results = [];
    const errors = [];
    
    for (const student of students) {
      try {
        console.log(`Creating sheet for student: ${student.name} (${student.id})`);
        
        // Create a copy of the template
        const sheetName = `${templateName} - ${student.name} (${className})`;
        const newSheet = templateFile.makeCopy(sheetName);
        
        // Move to shared folder
        sharedFolder.addFile(newSheet);
        
        // Remove from original location (if it's not already in the shared folder)
        const parents = newSheet.getParents();
        while (parents.hasNext()) {
          const parent = parents.next();
          if (parent.getId() !== SHARED_FOLDER_ID) {
            parent.removeFile(newSheet);
          }
        }
        
        // Set permissions - make it editable by anyone with the link
        newSheet.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
        
        // Get the sheet URL
        const sheetUrl = newSheet.getUrl();
        
        results.push({
          studentId: student.id,
          studentName: student.name,
          sheetId: newSheet.getId(),
          sheetUrl: sheetUrl,
          sheetName: sheetName
        });
        
        console.log(`✅ Created sheet for ${student.name}: ${sheetUrl}`);
        
      } catch (error) {
        console.error(`❌ Error creating sheet for ${student.name}:`, error);
        errors.push({
          studentId: student.id,
          studentName: student.name,
          error: error.toString()
        });
      }
    }
    
    // Clean up the temporary template file
    try {
      if (templateFile) {
        DriveApp.getFileById(templateFile.getId()).setTrashed(true);
        console.log('🗑️ Cleaned up temporary template file');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Could not clean up temporary file:', cleanupError);
    }
    
    return createResponse({
      success: true,
      message: `Created ${results.length} sheets successfully`,
      results: results,
      errors: errors,
      summary: {
        total: students.length,
        successful: results.length,
        failed: errors.length
      }
    });
    
  } catch (error) {
    console.error('Error in createStudentSheets:', error);
    
    // Clean up the temporary template file if it exists
    try {
      if (templateFile) {
        DriveApp.getFileById(templateFile.getId()).setTrashed(true);
        console.log('🗑️ Cleaned up temporary template file after error');
      }
    } catch (cleanupError) {
      console.warn('⚠️ Could not clean up temporary file after error:', cleanupError);
    }
    
    return createResponse({ error: error.toString() }, 500);
  }
}

/**
 * Helper function to create consistent HTTP responses
 */
function createResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Utility function to test sheet creation manually
 */
function testSheetCreation() {
  const testData = {
    action: 'createStudentSheets',
    templateFileId: 'YOUR_TEMPLATE_FILE_ID', // Replace with actual template file ID
    students: [
      { id: 'test1', name: 'Test Student 1' },
      { id: 'test2', name: 'Test Student 2' }
    ],
    className: 'Test Class',
    templateName: 'Test Template'
  };
  
  const result = createStudentSheets(testData);
  console.log('Test result:', result.getContent());
}

/**
 * Function to clean up test sheets (optional)
 */
function cleanupTestSheets() {
  try {
    const folder = DriveApp.getFolderById(SHARED_FOLDER_ID);
    const files = folder.getFiles();
    
    let deletedCount = 0;
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().includes('Test Template - Test Student')) {
        console.log('Deleting test file:', file.getName());
        file.setTrashed(true);
        deletedCount++;
      }
    }
    
    console.log(`Deleted ${deletedCount} test files`);
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up test sheets:', error);
    return 0;
  }
}