const emailsTest = [
  { studentEmail: 'test@gmail.com', confirmStudentEmail: 'test@gmaill.com', parentEmail: 'parent@gmail.com', confirmParentEmail: 'parent@gmail.com' },
  { studentEmail: 'test@gmaill.com', confirmStudentEmail: 'test@gmaill.com', parentEmail: 'parent@gmail.com', confirmParentEmail: 'parent@gmaiil.com' },
  { studentEmail: 'test@gmaill.com', confirmStudentEmail: 'test@gmaill.com', parentEmail: 'parent@gmail.com', confirmParentEmail: 'parent@gmail.com' },
];

function validateForm(formData) {
  const errors = [];

  if (formData.studentEmail !== formData.confirmStudentEmail) {
    errors.push('Student emails do not match');
  }

  if (formData.parentEmail !== formData.confirmParentEmail) {
    errors.push('Parent/Guardian emails do not match');
  }

  return errors;
}

emailsTest.forEach((data, index) => {
  const errors = validateForm(data);
  console.log(`Test case ${index + 1}:`, data);
  if (errors.length > 0) {
    console.log('❌ Validation failed (Expected behavior):', errors);
  } else {
    console.log('✅ Validation passed:', errors);
  }
});
