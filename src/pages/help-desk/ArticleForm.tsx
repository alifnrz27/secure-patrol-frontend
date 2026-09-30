import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Group, Select, Stack, Switch, TextInput } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { helpDeskApi, type HelpDeskArticleBody } from '@/api/helpDesk';
import { ArticleEditor } from '@/components/editor/ArticleEditor';
import type { HelpDeskArticle, HelpDeskCategory } from '@/lib/api/types';
import { applyServerErrors } from '@/lib/formErrors';
import { notifyError, notifySuccess } from '@/lib/notify';

import { CATEGORIES, CATEGORY_LABEL } from './categories';

const schema = z.object({
  category: z.enum(['rule', 'guide', 'faq']),
  title: z.string().trim().min(1, 'Judul wajib diisi.').max(200, 'Maksimal 200 karakter.'),
  content: z.string().trim().min(1, 'Isi wajib diisi.').max(20000, 'Maksimal 20.000 karakter.'),
  is_published: z.boolean(),
});
type FormValues = z.infer<typeof schema>;
const FIELDS = ['category', 'title', 'content', 'is_published'] as const;

export default function ArticleForm({ article, defaultCategory, onDone }: { article: HelpDeskArticle | null; defaultCategory: HelpDeskCategory; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: article?.category ?? defaultCategory,
      title: article?.title ?? '',
      content: article?.content ?? '',
      is_published: article?.is_published ?? true,
    },
  });

  const mutation = useMutation({
    // No sort_order: new articles go last, edits keep their place. Order is
    // changed only by drag & drop on the list.
    mutationFn: (body: HelpDeskArticleBody) => (article ? helpDeskApi.update(article.id, body) : helpDeskApi.create(body)),
    onSuccess: () => {
      notifySuccess(article ? 'Artikel diperbarui.' : 'Artikel ditambahkan.');
      void queryClient.invalidateQueries({ queryKey: ['help-desk'] });
      onDone();
    },
    onError: (error) => {
      const rest = applyServerErrors(error, setError, FIELDS);
      if (rest.length) notifyError(error, rest);
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      <Stack>
        <Group grow align="flex-start">
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                label="Kategori"
                withAsterisk
                data={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
                allowDeselect={false}
              />
            )}
          />
          <TextInput label="Judul" withAsterisk {...register('title')} error={formState.errors.title?.message} />
        </Group>
        <Controller
          control={control}
          name="content"
          render={({ field, fieldState }) => (
            <ArticleEditor
              label="Isi artikel"
              initialValue={article?.content ?? ''}
              onChange={field.onChange}
              length={field.value.length}
              maxLength={20000}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="is_published"
          render={({ field }) => (
            <Switch
              label="Terbitkan"
              description="Jika tidak diterbitkan, artikel disimpan sebagai draft dan tidak terlihat oleh Tim Keamanan."
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Batal
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Simpan
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
