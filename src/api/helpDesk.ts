import { apiFetch } from '@/lib/api/client';
import type { HelpDeskArticle, HelpDeskCategory, ListParams, Paginated } from '@/lib/api/types';

export interface HelpDeskListParams extends ListParams {
  category?: HelpDeskCategory;
  is_published?: boolean;
}

export interface HelpDeskArticleBody {
  category: HelpDeskCategory;
  title: string;
  content: string;
  is_published: boolean;
}

export const helpDeskApi = {
  list: (params: HelpDeskListParams) =>
    apiFetch<Paginated<HelpDeskArticle>>('/help-desk-articles', { query: { ...params } }),
  get: (id: number) => apiFetch<HelpDeskArticle>(`/help-desk-articles/${id}`),
  create: (body: HelpDeskArticleBody) =>
    apiFetch<HelpDeskArticle>('/help-desk-articles', { method: 'POST', json: body }),
  update: (id: number, body: HelpDeskArticleBody) =>
    apiFetch<HelpDeskArticle>(`/help-desk-articles/${id}`, { method: 'PUT', json: body }),
  remove: (id: number) => apiFetch<null>(`/help-desk-articles/${id}`, { method: 'DELETE' }),
  reorder: (category: HelpDeskCategory, articleIds: number[]) =>
    apiFetch<HelpDeskArticle[]>('/help-desk-articles/reorder', {
      method: 'PUT',
      json: { category, article_ids: articleIds },
    }),
};
