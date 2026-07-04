// Batch DISC / Part 1 — seed the 5 example "حملات وثبة" collections as INACTIVE
// placeholders for an admin to activate. Idempotent.
import { PrismaClient } from '@prisma/client';

export const COLLECTIONS = [
  { slug: 'made-in-saudi', nameAr: 'اصنع في السعودية', descriptionAr: 'مشاريع تصنع منتجاتها محلياً داخل المملكة دعماً للصناعة الوطنية.' },
  { slug: 'ramadan-khair', nameAr: 'رمضان الخير', descriptionAr: 'مبادرات ومشاريع خيرية وموسمية في شهر رمضان المبارك.' },
  { slug: 'riyadh-season', nameAr: 'موسم الرياض', descriptionAr: 'مشاريع وتجارب مستوحاة من موسم الرياض والفعاليات الترفيهية.' },
  { slug: 'graduation-projects', nameAr: 'مشاريع التخرج', descriptionAr: 'أفكار طلاب الجامعات ومشاريع التخرج الباحثة عن التمويل الأول.' },
  { slug: 'women-creators', nameAr: 'مبدعات سعوديات', descriptionAr: 'مشاريع تقودها رائدات أعمال ومبدعات سعوديات — تمكيناً يتماشى مع رؤية ٢٠٣٠.' },
];

export async function seedCollections(prisma) {
  for (const [i, c] of COLLECTIONS.entries()) {
    const existing = await prisma.collection.findUnique({ where: { slug: c.slug } });
    const data = { ...c, sortOrder: i + 1 };
    if (existing) {
      // Preserve admin-set isActive/showInMenu on re-seed; only refresh copy.
      await prisma.collection.update({
        where: { id: existing.id },
        data: { nameAr: c.nameAr, descriptionAr: c.descriptionAr, sortOrder: i + 1 },
      });
    } else {
      await prisma.collection.create({ data: { ...data, isActive: false, showInMenu: false } });
    }
  }
  console.log(`[seed-collections] ${COLLECTIONS.length} collections ready (inactive placeholders)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const prisma = new PrismaClient();
  seedCollections(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
