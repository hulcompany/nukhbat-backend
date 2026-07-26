import { DataSource } from 'typeorm';

const WISDOMS = [
  'العلم في الصغر كالنقش على الحجر.',
  'من جدّ وجد ومن زرع حصد.',
  'اطلبوا العلم من المهد إلى اللحد.',
  'العلم نور والجهل ظلام.',
  'لا تؤجل عمل اليوم إلى الغد.',
  'الوقت كالسيف إن لم تقطعه قطعك.',
  'بالعلم ترتقي الأمم.',
  'خير جليس في الزمان كتاب.',
  'الصبر مفتاح الفرج.',
  'من سار على الدرب وصل.',
];

// A pool of daily wisdoms; the app rotates one per day.
export async function seedDailyWisements(ds: DataSource) {
  await ds
    .getRepository('DailyWisement')
    .insert(WISDOMS.map((text) => ({ text })));
}
