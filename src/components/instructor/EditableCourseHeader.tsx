import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EditableCourseHeaderProps {
  title: string;
  code: string | null;
  description: string | null;
  isPublished: boolean;
  onSave: (updates: { title?: string; code?: string | null; description?: string | null }) => Promise<void>;
  isSaving: boolean;
}

export function EditableCourseHeader({ title, code, description, isPublished, onSave, isSaving }: EditableCourseHeaderProps) {
  const [editingField, setEditingField] = useState<'title' | 'code' | 'description' | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingField === 'title' || editingField === 'code') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (editingField === 'description') {
      textareaRef.current?.focus();
    }
  }, [editingField]);

  const startEdit = (field: 'title' | 'code' | 'description') => {
    setEditingField(field);
    setEditValue(
      field === 'title' ? title :
      field === 'code' ? (code || '') :
      (description || '')
    );
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingField) return;
    const trimmed = editValue.trim();

    if (editingField === 'title' && !trimmed) return; // title is required

    const updates: Record<string, string | null> = {};
    if (editingField === 'title' && trimmed !== title) updates.title = trimmed;
    if (editingField === 'code') updates.code = trimmed || null;
    if (editingField === 'description') updates.description = trimmed || null;

    if (Object.keys(updates).length > 0) {
      await onSave(updates);
    }
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && editingField !== 'description') {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === 'Escape') cancelEdit();
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        {/* Course Code */}
        {editingField === 'code' ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 w-28 text-xs"
              placeholder="Course code"
              disabled={isSaving}
            />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveEdit} disabled={isSaving}>
              <Check className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          code && (
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 gap-1"
              onClick={() => startEdit('code')}
              title="Click to edit course code"
            >
              {code}
              <Pencil className="h-2.5 w-2.5 opacity-50" />
            </Badge>
          )
        )}

        {/* Title */}
        {editingField === 'title' ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <Input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9 text-xl font-bold"
              disabled={isSaving}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={saveEdit} disabled={isSaving}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={cancelEdit}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <h1
            className="text-xl sm:text-2xl font-bold text-foreground cursor-pointer hover:text-primary/80 transition-colors group inline-flex items-center gap-1.5"
            onClick={() => startEdit('title')}
            title="Click to edit title"
          >
            {title}
            <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
          </h1>
        )}

        {/* Add code button if none exists */}
        {!code && editingField !== 'code' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground"
            onClick={() => startEdit('code')}
          >
            + Add code
          </Button>
        )}

        <Badge variant={isPublished ? 'default' : 'outline'}>
          {isPublished ? 'Published' : 'Draft'}
        </Badge>
      </div>

      {/* Description */}
      {editingField === 'description' ? (
        <div className="mt-1 flex gap-1 items-start">
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }}
            className="text-sm min-h-[60px]"
            placeholder="Add a description..."
            disabled={isSaving}
          />
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit} disabled={isSaving}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : description ? (
        <p
          className="text-sm text-muted-foreground mt-1 cursor-pointer hover:text-foreground/70 transition-colors group inline-flex items-center gap-1"
          onClick={() => startEdit('description')}
          title="Click to edit description"
        >
          {description}
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
        </p>
      ) : (
        <button
          className="text-sm text-muted-foreground/50 mt-1 hover:text-muted-foreground transition-colors"
          onClick={() => startEdit('description')}
        >
          + Add description
        </button>
      )}
    </div>
  );
}
