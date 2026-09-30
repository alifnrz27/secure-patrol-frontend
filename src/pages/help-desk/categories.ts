import type { HelpDeskCategory } from '@/lib/api/types';

export const CATEGORY_LABEL: Record<HelpDeskCategory, string> = { rule: 'Aturan', guide: 'Tata Cara', faq: 'FAQ' };
export const CATEGORIES: HelpDeskCategory[] = ['rule', 'guide', 'faq'];
