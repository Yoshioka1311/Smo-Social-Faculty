import test from 'node:test';
import assert from 'node:assert/strict';

const coreModule = await import('../assets/app-core.js').catch(() => null);

test('core module is available to the browser and tests', () => {
  assert.ok(coreModule, 'expected assets/app-core.js to exist');
});

const {
  filterPrograms,
  filterInventory,
  validateLoanRequest,
  transitionRequest,
  validateEventApplication,
} = coreModule ?? {};

test('program search matches verified Thai and English program names', () => {
  const programs = [
    { title: 'หลักสูตรวิทยาศาสตรบัณฑิต สาขาวิชาเวชระเบียน', english: 'Medical Record', keywords: ['สุขภาพ'] },
    { title: 'หลักสูตรนิติศาสตรบัณฑิต', english: 'Bachelor of Laws', keywords: ['กฎหมาย'] },
    { title: 'หลักสูตรรัฐศาสตรบัณฑิต', english: 'Political Science', keywords: ['การเมือง'] },
  ];

  assert.deepEqual(filterPrograms(programs, 'medical').map((item) => item.english), ['Medical Record']);
  assert.deepEqual(filterPrograms(programs, 'การเมือง').map((item) => item.english), ['Political Science']);
});

test('inventory filter combines category and text query', () => {
  const items = [
    { name: 'ลำโพงพกพา', category: 'เครื่องเสียง & อิเล็กทรอนิกส์', code: 'AV-01' },
    { name: 'ลูกบาสเกตบอล', category: 'กีฬา & นันทนาการ', code: 'SP-02' },
    { name: 'เต็นท์กิจกรรม', category: 'กิจกรรม & สถานที่', code: 'EV-03' },
  ];

  assert.deepEqual(filterInventory(items, 'กีฬา & นันทนาการ', 'บาส').map((item) => item.code), ['SP-02']);
  assert.deepEqual(filterInventory(items, 'ทั้งหมด', 'AV-01').map((item) => item.name), ['ลำโพงพกพา']);
});

test('external borrowers must provide an affiliation name', () => {
  const errors = validateLoanRequest({
    itemId: 'AV-01',
    fullName: 'ทดสอบ ระบบ',
    studentId: '6612345',
    phone: '0812345678',
    startDate: '2026-11-06',
    endDate: '2026-11-07',
    purpose: 'ใช้จัดกิจกรรมตัวอย่างของนักศึกษา',
    borrowerType: 'external',
    affiliation: '',
  }, { name: 'request.pdf', type: 'application/pdf', size: 1000 }, '2026-11-05');

  assert.equal(errors.affiliation, 'กรุณาระบุชื่อคณะหรือหน่วยงาน');
});

test('loan request rejects unsupported attachment types and reversed dates', () => {
  const errors = validateLoanRequest({
    itemId: 'AV-01',
    fullName: 'ทดสอบ ระบบ',
    studentId: '6612345',
    phone: '0812345678',
    startDate: '2026-11-08',
    endDate: '2026-11-07',
    purpose: 'ใช้จัดกิจกรรมตัวอย่างของนักศึกษา',
    borrowerType: 'internal',
    affiliation: '',
  }, { name: 'request.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1000 }, '2026-11-05');

  assert.equal(errors.endDate, 'วันคืนต้องไม่ก่อนวันเริ่มยืม');
  assert.equal(errors.attachment, 'รองรับเฉพาะ PDF, PNG และ JPG');
});

test('complete internal loan request passes validation', () => {
  const errors = validateLoanRequest({
    itemId: 'SP-02',
    fullName: 'สมฤดี ใจดี',
    studentId: '6612345',
    phone: '0891234567',
    startDate: '2026-11-06',
    endDate: '2026-11-08',
    purpose: 'ใช้สำหรับกิจกรรมกีฬาสัมพันธ์ของคณะ',
    borrowerType: 'internal',
    affiliation: '',
  }, { name: 'letter.jpg', type: 'image/jpeg', size: 900000 }, '2026-11-05');

  assert.deepEqual(errors, {});
});

test('admin decisions update pending request status without changing its other data', () => {
  const request = { id: 'REQ-004', status: 'pending', itemName: 'ลำโพงพกพา' };

  assert.deepEqual(transitionRequest(request, 'approve'), {
    id: 'REQ-004', status: 'approved', itemName: 'ลำโพงพกพา', reviewedAt: 'now'
  });
  assert.deepEqual(transitionRequest(request, 'reject'), {
    id: 'REQ-004', status: 'rejected', itemName: 'ลำโพงพกพา', reviewedAt: 'now'
  });
  assert.equal(request.status, 'pending');
});

test('event application rejects a position that the selected event does not offer', () => {
  const event = {
    id: 'sports-day',
    positions: [
      { id: 'athlete-football', label: 'นักกีฬาฟุตบอล' },
      { id: 'athlete-basketball', label: 'นักกีฬาบาสเกตบอล' },
    ],
  };

  const errors = validateEventApplication({
    eventId: 'sports-day',
    positionId: 'photographer',
    fullName: 'สมฤดี ใจดี',
    studentId: '6612345',
    phone: '0891234567',
  }, event);

  assert.equal(errors.positionId, 'ตำแหน่งนี้ไม่ได้เปิดรับสมัครในกิจกรรมที่เลือก');
});

test('complete athlete application passes validation', () => {
  const event = {
    id: 'sports-day',
    positions: [
      { id: 'athlete-football', label: 'นักกีฬาฟุตบอล' },
      { id: 'athlete-basketball', label: 'นักกีฬาบาสเกตบอล' },
    ],
  };

  const errors = validateEventApplication({
    eventId: 'sports-day',
    positionId: 'athlete-basketball',
    fullName: 'สมฤดี ใจดี',
    studentId: '6612345',
    phone: '0891234567',
  }, event);

  assert.deepEqual(errors, {});
});
