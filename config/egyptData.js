'use strict';

/**
 * Static Egypt governorate-to-area mapping.
 * Used for address dropdown validation (whitelist).
 *
 * Each governorate has:
 *   - name   (Arabic)
 *   - nameEn (English — for logging / admin display)
 *   - areas  (array of Arabic area names)
 */
const governorates = [
  {
    name: 'القاهرة',
    nameEn: 'Cairo',
    areas: [
      'مدينة نصر', 'المعادي', 'حلوان', 'مصر الجديدة', 'التجمع الخامس',
      'المقطم', 'شبرا', 'عين شمس', 'الزيتون', 'مصر القديمة',
      'الزمالك', 'وسط البلد', 'المنيل', 'حدائق القبة', 'الأميرية',
      'السيدة زينب', 'باب الشعرية', 'عابدين', 'الدرب الأحمر', 'الخليفة',
    ],
  },
  {
    name: 'الجيزة',
    nameEn: 'Giza',
    areas: [
      'الدقي', 'المهندسين', 'العجوزة', 'فيصل', 'الهرم',
      '6 أكتوبر', 'الشيخ زايد', 'حدائق الأهرام', 'أبو رواش', 'البدرشين',
      'العياط', 'أطفيح', 'الصف', 'الواحات البحرية', 'بولاق الدكرور',
    ],
  },
  {
    name: 'الإسكندرية',
    nameEn: 'Alexandria',
    areas: [
      'المنتزه', 'سيدي بشر', 'ستانلي', 'كليوباترا', 'سموحة',
      'العصافرة', 'أبو قير', 'المنشية', 'العطارين', 'محرم بك',
      'الحضرة', 'بحري', 'العجمي', 'برج العرب', 'كنج ماريوط',
    ],
  },
  {
    name: 'القليوبية',
    nameEn: 'Qalyubia',
    areas: [
      'بنها', 'شبرا الخيمة', 'قليوب', 'الخانكة', 'القناطر الخيرية',
      'طوخ', 'كفر شكر', 'شبين القناطر', 'العبور',
    ],
  },
  {
    name: 'الشرقية',
    nameEn: 'Sharqia',
    areas: [
      'الزقازيق', 'العاشر من رمضان', 'بلبيس', 'منيا القمح', 'أبو حماد',
      'أبو كبير', 'فاقوس', 'الحسينية', 'ديرب نجم',
    ],
  },
  {
    name: 'الدقهلية',
    nameEn: 'Dakahlia',
    areas: [
      'المنصورة', 'طلخا', 'ميت غمر', 'دكرنس', 'أجا',
      'السنبلاوين', 'شربين', 'المنزلة', 'بلقاس',
    ],
  },
  {
    name: 'الغربية',
    nameEn: 'Gharbia',
    areas: [
      'طنطا', 'المحلة الكبرى', 'كفر الزيات', 'زفتى', 'السنطة',
      'بسيون', 'قطور', 'سمنود',
    ],
  },
  {
    name: 'المنوفية',
    nameEn: 'Menoufia',
    areas: [
      'شبين الكوم', 'مدينة السادات', 'منوف', 'أشمون', 'الباجور',
      'قويسنا', 'بركة السبع', 'تلا',
    ],
  },
  {
    name: 'البحيرة',
    nameEn: 'Beheira',
    areas: [
      'دمنهور', 'كفر الدوار', 'رشيد', 'إدكو', 'أبو المطامير',
      'حوش عيسى', 'إيتاي البارود', 'الدلنجات',
    ],
  },
  {
    name: 'كفر الشيخ',
    nameEn: 'Kafr El Sheikh',
    areas: [
      'كفر الشيخ', 'دسوق', 'فوه', 'مطوبس', 'بيلا',
      'الحامول', 'سيدي سالم', 'الرياض',
    ],
  },
  {
    name: 'دمياط',
    nameEn: 'Damietta',
    areas: [
      'دمياط', 'دمياط الجديدة', 'رأس البر', 'فارسكور', 'كفر سعد',
    ],
  },
  {
    name: 'بورسعيد',
    nameEn: 'Port Said',
    areas: ['بورسعيد', 'بورفؤاد', 'الزهور', 'العرب', 'المناخ'],
  },
  {
    name: 'الإسماعيلية',
    nameEn: 'Ismailia',
    areas: [
      'الإسماعيلية', 'القنطرة شرق', 'القنطرة غرب', 'فايد', 'أبو صوير',
      'التل الكبير',
    ],
  },
  {
    name: 'السويس',
    nameEn: 'Suez',
    areas: ['السويس', 'عتاقة', 'الأربعين', 'الجناين', 'فيصل'],
  },
  {
    name: 'شمال سيناء',
    nameEn: 'North Sinai',
    areas: ['العريش', 'الشيخ زويد', 'رفح', 'بئر العبد', 'الحسنة'],
  },
  {
    name: 'جنوب سيناء',
    nameEn: 'South Sinai',
    areas: ['شرم الشيخ', 'دهب', 'نويبع', 'طابا', 'سانت كاترين', 'الطور'],
  },
  {
    name: 'البحر الأحمر',
    nameEn: 'Red Sea',
    areas: ['الغردقة', 'سفاجا', 'القصير', 'مرسى علم', 'رأس غارب'],
  },
  {
    name: 'الفيوم',
    nameEn: 'Fayoum',
    areas: ['الفيوم', 'سنورس', 'إبشواي', 'طامية', 'يوسف الصديق'],
  },
  {
    name: 'بني سويف',
    nameEn: 'Beni Suef',
    areas: ['بني سويف', 'الوسطى', 'ناصر', 'إهناسيا', 'ببا', 'الفشن'],
  },
  {
    name: 'المنيا',
    nameEn: 'Minya',
    areas: [
      'المنيا', 'المنيا الجديدة', 'ملوي', 'سمالوط', 'أبو قرقاص',
      'مغاغة', 'بني مزار', 'ديرمواس',
    ],
  },
  {
    name: 'أسيوط',
    nameEn: 'Assiut',
    areas: [
      'أسيوط', 'أسيوط الجديدة', 'ديروط', 'القوصية', 'منفلوط',
      'أبو تيج', 'الغنايم', 'ساحل سليم',
    ],
  },
  {
    name: 'سوهاج',
    nameEn: 'Sohag',
    areas: [
      'سوهاج', 'سوهاج الجديدة', 'أخميم', 'جرجا', 'طهطا',
      'المراغة', 'البلينا', 'المنشأة',
    ],
  },
  {
    name: 'قنا',
    nameEn: 'Qena',
    areas: ['قنا', 'قنا الجديدة', 'نجع حمادي', 'أبو تشت', 'دشنا', 'قوص', 'فرشوط'],
  },
  {
    name: 'الأقصر',
    nameEn: 'Luxor',
    areas: ['الأقصر', 'الأقصر الجديدة', 'الطود', 'إسنا', 'أرمنت', 'الزينية'],
  },
  {
    name: 'أسوان',
    nameEn: 'Aswan',
    areas: ['أسوان', 'أسوان الجديدة', 'إدفو', 'كوم أمبو', 'دراو', 'نصر النوبة'],
  },
  {
    name: 'الوادي الجديد',
    nameEn: 'New Valley',
    areas: ['الخارجة', 'الداخلة', 'الفرافرة', 'باريس', 'بلاط'],
  },
  {
    name: 'مطروح',
    nameEn: 'Matrouh',
    areas: ['مرسى مطروح', 'العلمين', 'الحمام', 'الضبعة', 'سيوة', 'النجيلة'],
  },
];

// Pre-built lookup maps for O(1) validation
const governorateNames = new Set(governorates.map((g) => g.name));
const areasByGovernorate = {};
for (const gov of governorates) {
  areasByGovernorate[gov.name] = new Set(gov.areas);
}

/**
 * Returns true if the governorate name exists.
 */
const isValidGovernorate = (name) => governorateNames.has(name);

/**
 * Returns true if the area belongs to the given governorate.
 */
const isValidArea = (governorate, area) => {
  const areas = areasByGovernorate[governorate];
  return areas ? areas.has(area) : false;
};

module.exports = {
  governorates,
  governorateNames,
  areasByGovernorate,
  isValidGovernorate,
  isValidArea,
};
