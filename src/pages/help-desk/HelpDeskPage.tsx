import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type Announcements, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Accordion, ActionIcon, Badge, Button, Card, Group, Modal, SegmentedControl, Skeleton, Stack, Tabs, Text, Tooltip } from '@mantine/core';
import { IconGripVertical, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { helpDeskApi } from '@/api/helpDesk';
import { confirmDelete } from '@/components/confirm';
import { Markdown } from '@/components/Markdown';
import { PageHeader } from '@/components/PageHeader';
import { SearchInput } from '@/components/SearchInput';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { usePermission } from '@/hooks/useSession';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { isApiError } from '@/lib/api/errors';
import type { HelpDeskArticle, HelpDeskCategory } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { notifyError, notifySuccess } from '@/lib/notify';
import { fetchAllPages, MAX_PAGE_SIZE } from '@/lib/pagination';
import { CATEGORIES, CATEGORY_LABEL } from './categories';

// The WYSIWYG editor is large; load it only when the form opens.
const ArticleForm = lazy(() => import('./ArticleForm'));

const KEYS = ['category', 'search', 'is_published'] as const;

interface ArticleItemProps {
  article: HelpDeskArticle;
  sortable: boolean;
  dragDisabled: boolean;
  canManage: boolean;
  onEdit: (article: HelpDeskArticle) => void;
  onDelete: (article: HelpDeskArticle) => void;
}

function ArticleItem({ article, sortable, dragDisabled, canManage, onEdit, onDelete }: ArticleItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: article.id, disabled: !sortable || dragDisabled });
  return (
    <Accordion.Item
      ref={setNodeRef}
      value={String(article.id)}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, position: 'relative', zIndex: isDragging ? 2 : undefined }}
    >
      <Group gap={0} wrap="nowrap" align="center">
        {sortable && (
          <span
            className="sortable-handle"
            {...attributes}
            {...listeners}
            aria-label={`Pindahkan ${article.title}`}
            style={{ padding: '0 4px 0 12px', display: 'flex', opacity: dragDisabled ? 0.4 : 1 }}
          >
            <IconGripVertical size={18} color="var(--mantine-color-gray-6)" />
          </span>
        )}
        <Accordion.Control style={{ flex: 1 }}>
          <Group gap="xs" wrap="nowrap">
            <Text fw={600}>{article.title}</Text>
            {!article.is_published && (
              <Badge color="yellow" variant="light" style={{ flexShrink: 0 }}>
                Draft
              </Badge>
            )}
          </Group>
        </Accordion.Control>
      </Group>
      <Accordion.Panel>
        <Markdown>{article.content}</Markdown>
        <Group justify="space-between" mt="md">
          <Text size="xs" c="dimmed">Diperbarui {formatDateTime(article.updated_at)}</Text>
          {canManage && (
            <Group gap={4}>
              <Tooltip label="Ubah">
                <ActionIcon variant="subtle" aria-label={`Ubah ${article.title}`} onClick={() => onEdit(article)}>
                  <IconPencil size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Hapus">
                <ActionIcon variant="subtle" color="red" aria-label={`Hapus ${article.title}`} onClick={() => onDelete(article)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Group>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

export default function HelpDeskPage() {
  const canManage = usePermission('manageHelpDesk');
  const seesDrafts = usePermission('viewHelpDeskDrafts');
  const queryClient = useQueryClient();
  const { filters, setFilters } = useUrlFilters(KEYS, { category: 'rule' });
  const category = (CATEGORIES.includes(filters.category as HelpDeskCategory) ? filters.category : 'rule') as HelpDeskCategory;
  const [editing, setEditing] = useState<HelpDeskArticle | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const isPublished = seesDrafts && filters.is_published ? filters.is_published === 'true' : undefined;
  const filtered = Boolean(filters.search) || isPublished !== undefined;
  // Reordering must send every article of the category (drafts included), so
  // drag & drop is only offered on the unfiltered list.
  const sortable = canManage && !filtered;

  const query = useQuery({
    queryKey: ['help-desk', 'list', category, filters.search, isPublished],
    queryFn: ({ signal }) =>
      fetchAllPages((page) => helpDeskApi.list({ category, search: filters.search, is_published: isPublished, page, limit: MAX_PAGE_SIZE }), { signal }),
  });

  // Server order is final; the local copy only holds the optimistic drag result.
  const [order, setOrder] = useState<HelpDeskArticle[]>([]);
  useEffect(() => {
    if (query.data) setOrder(query.data);
  }, [query.data]);

  const reorder = useMutation({
    mutationFn: (next: HelpDeskArticle[]) => helpDeskApi.reorder(category, next.map((a) => a.id)),
    onMutate: (next) => {
      const previous = order;
      setOrder(next);
      return { previous };
    },
    onError: (error, _next, context) => {
      if (context) setOrder(context.previous);
      notifyError(error);
      if (isApiError(error) && error.kind === 'validation') void query.refetch();
    },
    onSuccess: (saved) => {
      setOrder(saved);
      queryClient.setQueryData(['help-desk', 'list', category, filters.search, isPublished], saved);
      notifySuccess('Urutan disimpan.');
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => helpDeskApi.remove(id),
    onSuccess: () => {
      notifySuccess('Artikel dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['help-desk'] });
    },
    onError: (error) => notifyError(error),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const position = (id: string | number) => order.findIndex((a) => a.id === id) + 1;
  const titleOf = (id: string | number) => order.find((a) => a.id === id)?.title ?? '';
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Mengambil ${titleOf(active.id)} di posisi ${position(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)} dipindah ke posisi ${position(over.id)}.` : `${titleOf(active.id)} di luar daftar.`),
    onDragEnd: ({ active, over }) => (over ? `${titleOf(active.id)} diletakkan di posisi ${position(over.id)}.` : `${titleOf(active.id)} dilepas.`),
    onDragCancel: ({ active }) => `Batal memindahkan ${titleOf(active.id)}.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = order.findIndex((a) => a.id === active.id);
    const to = order.findIndex((a) => a.id === over.id);
    reorder.mutate(arrayMove(order, from, to));
  };

  const openForm = (article: HelpDeskArticle | null) => {
    setEditing(article);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Help Desk"
        description="Aturan, tata cara, dan tanya jawab untuk petugas."
        actions={
          canManage && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
              Tambah Artikel
            </Button>
          )
        }
      />
      <Card withBorder radius="md">
        <Tabs value={category} onChange={(v) => v && setFilters({ category: v })} mb="md">
          <Tabs.List>
            {CATEGORIES.map((c) => (
              <Tabs.Tab key={c} value={c}>{CATEGORY_LABEL[c]}</Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        <Group mb="md" gap="sm">
          <SearchInput value={filters.search} onChange={(search) => setFilters({ search })} placeholder="Cari artikel" />
          {seesDrafts && (
            <SegmentedControl
              aria-label="Filter status terbit"
              value={filters.is_published}
              onChange={(is_published) => setFilters({ is_published })}
              data={[
                { value: '', label: 'Semua' },
                { value: 'true', label: 'Terbit' },
                { value: 'false', label: 'Draft' },
              ]}
            />
          )}
          {canManage && (
            <Text size="xs" c="dimmed">
              {sortable
                ? 'Seret ikon ⋮⋮ untuk mengubah urutan (atau fokus ikon, tekan spasi, lalu panah atas/bawah).'
                : 'Hapus pencarian dan filter untuk mengubah urutan.'}
            </Text>
          )}
        </Group>

        {query.isPending ? (
          <Stack gap="xs">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={52} radius="md" />)}</Stack>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : order.length === 0 ? (
          <EmptyState title={filtered ? 'Tidak ada artikel yang cocok' : 'Belum ada artikel'} />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{
              announcements,
              screenReaderInstructions: { draggable: 'Tekan spasi untuk mengambil, panah atas/bawah untuk memindah, spasi lagi untuk meletakkan, Escape untuk batal.' },
            }}
          >
            <SortableContext items={order.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <Accordion variant="separated" radius="md">
                {order.map((article) => (
                  <ArticleItem
                    key={article.id}
                    article={article}
                    sortable={sortable}
                    // Disabled while saving so two reorders never race each other.
                    dragDisabled={reorder.isPending}
                    canManage={canManage}
                    onEdit={openForm}
                    onDelete={(a) => confirmDelete({ title: 'Hapus artikel?', name: a.title, onConfirm: () => remove.mutate(a.id) })}
                  />
                ))}
              </Accordion>
            </SortableContext>
          </DndContext>
        )}
      </Card>
      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Ubah Artikel' : 'Tambah Artikel'} size="xl" centered closeOnClickOutside={false}>
        {formOpen && (
          <Suspense fallback={<Skeleton h={420} />}>
            <ArticleForm article={editing} defaultCategory={category} onDone={() => setFormOpen(false)} />
          </Suspense>
        )}
      </Modal>
    </>
  );
}
