import { DataSource } from 'typeorm';

// Single info/contact row shown on the public "about" pages.
export async function seedInfo(ds: DataSource) {
  await ds.getRepository('Info').insert({
    googlePlay: 'https://play.google.com/store/apps/details?id=com.nukhba',
    appStore: 'https://apps.apple.com/app/nukhba',
    phone: '+963935000000',
    location: 'سوريا - إدلب - سرمدة',
    position: { lat: 36.18, lng: 36.72 },
    about: 'تطبيق النخبة تطبيق تعليمي سوري يساعد الطلاب على الدراسة وحل الأسئلة.',
    privacyPolicy: 'سياسة الخصوصية.',
    termsAndConditions: 'الشروط والأحكام.',
  });
}
