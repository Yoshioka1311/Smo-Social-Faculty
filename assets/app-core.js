const clean = (value) => String(value ?? '').trim().toLocaleLowerCase('th');

export function filterPrograms(programs, query) {
  const needle = clean(query);
  if (!needle) return programs;

  return programs.filter((program) => {
    const haystack = [program.title, program.english, ...(program.keywords ?? [])]
      .map(clean)
      .join(' ');
    return haystack.includes(needle);
  });
}

export function filterInventory(items, category, query) {
  const needle = clean(query);
  return items.filter((item) => {
    const categoryMatches = category === 'ทั้งหมด' || item.category === category;
    const textMatches = !needle || clean(`${item.name} ${item.code} ${item.category}`).includes(needle);
    return categoryMatches && textMatches;
  });
}

export function validateLoanRequest(data, file, today = new Date().toISOString().slice(0, 10)) {
  const errors = {};
  const digits = (value) => String(value ?? '').replace(/\D/g, '');

  if (!clean(data.itemId)) errors.itemId = 'กรุณาเลือกรายการพัสดุ';
  if (clean(data.fullName).length < 4) errors.fullName = 'กรุณากรอกชื่อและนามสกุล';
  if (!/^\d{7,10}$/.test(digits(data.studentId))) errors.studentId = 'รหัสนักศึกษาต้องเป็นตัวเลข 7-10 หลัก';
  if (!/^\d{9,10}$/.test(digits(data.phone))) errors.phone = 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก';
  if (!data.startDate) errors.startDate = 'กรุณาเลือกวันเริ่มยืม';
  if (!data.endDate) errors.endDate = 'กรุณาเลือกวันคืน';
  if (data.startDate && data.startDate < today) errors.startDate = 'วันเริ่มยืมต้องไม่ก่อนวันนี้';
  if (data.startDate && data.endDate && data.endDate < data.startDate) errors.endDate = 'วันคืนต้องไม่ก่อนวันเริ่มยืม';
  if (clean(data.purpose).length < 10) errors.purpose = 'กรุณาระบุวัตถุประสงค์อย่างน้อย 10 ตัวอักษร';
  if (!['internal', 'external'].includes(data.borrowerType)) errors.borrowerType = 'กรุณาเลือกสังกัดผู้ยืม';
  if (data.borrowerType === 'external' && !clean(data.affiliation)) {
    errors.affiliation = 'กรุณาระบุชื่อคณะหรือหน่วยงาน';
  }

  if (!file) {
    errors.attachment = 'กรุณาแนบเอกสารประกอบ';
  } else {
    const allowedTypes = new Set(['application/pdf', 'image/png', 'image/jpeg']);
    if (!allowedTypes.has(file.type)) errors.attachment = 'รองรับเฉพาะ PDF, PNG และ JPG';
    if (file.size > 5 * 1024 * 1024) errors.attachment = 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB';
  }

  return errors;
}

export function transitionRequest(request, decision) {
  const nextStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : null;
  if (!nextStatus) return request;
  return { ...request, status: nextStatus, reviewedAt: 'now' };
}

export function validateEventApplication(data, event) {
  const errors = {};
  const digits = (value) => String(value ?? '').replace(/\D/g, '');
  const allowedPositions = new Set((event?.positions ?? []).map((position) => position.id));

  if (!event || data.eventId !== event.id) errors.eventId = 'ไม่พบกิจกรรมที่เปิดรับสมัคร';
  if (!clean(data.positionId)) {
    errors.positionId = 'กรุณาเลือกตำแหน่งที่ต้องการสมัคร';
  } else if (!allowedPositions.has(data.positionId)) {
    errors.positionId = 'ตำแหน่งนี้ไม่ได้เปิดรับสมัครในกิจกรรมที่เลือก';
  }
  if (clean(data.fullName).length < 4) errors.fullName = 'กรุณากรอกชื่อและนามสกุล';
  if (!/^\d{7,10}$/.test(digits(data.studentId))) errors.studentId = 'รหัสนักศึกษาต้องเป็นตัวเลข 7-10 หลัก';
  if (!/^\d{9,10}$/.test(digits(data.phone))) errors.phone = 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก';

  return errors;
}
