async function submitApplication() {
  const pdfContent = `%PDF-1.4
%âãÏÓ
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length 210 >>
stream
BT
/F1 12 Tf
72 712 Td
(Alex Mercer - Full Stack Software Engineer) Tj
0 -20 Td
(Email: alex.mercer.dev@example.com | Phone: +1 555 349 2810) Tj
0 -20 Td
(Skills: TypeScript, React, Node.js, Next.js, PostgreSQL) Tj
0 -20 Td
(Experience: 4 years building scalable web applications) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000015 00000 n 
0000000068 00000 n 
0000000125 00000 n 
0000000216 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
478
%%EOF`;

  const pdfBuffer = Buffer.from(pdfContent, 'utf-8');
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });

  const formData = new FormData();
  formData.append('name', 'Alex Mercer');
  formData.append('email', 'alex.mercer.dev@example.com');
  formData.append('phone', '+1 (555) 349-2810');
  formData.append('resume', blob, 'Alex_Mercer_Resume.pdf');

  console.log('Submitting mock application for Alex Mercer to JOB-1030...');

  const response = await fetch('http://localhost:4000/api/career/hvhgv-1/jobs/JOB-1030/apply', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  console.log('Response status:', response.status);
  console.log('Response body:', JSON.stringify(data, null, 2));
}

submitApplication().catch(console.error);

