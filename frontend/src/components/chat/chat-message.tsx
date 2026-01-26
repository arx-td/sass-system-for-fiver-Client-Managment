'use client';

import { useState, useRef } from 'react';
import { format } from 'date-fns';
import {
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Check,
  X,
  Download,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface Attachment {
  url: string;
  fileName: string;
  mimeType: string;
  size?: number;
}

interface ChatMessageProps {
  id: string;
  message: string;
  attachments?: Attachment[];
  sender: {
    id: string;
    name: string;
    role: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt?: string;
  isOwn: boolean;
  priority?: string;
  onEdit?: (id: string, newMessage: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return format(date, 'h:mm a');
  } else if (diffDays === 1) {
    return `Yesterday ${format(date, 'h:mm a')}`;
  } else if (diffDays < 7) {
    return format(date, 'EEEE h:mm a');
  }
  return format(date, 'MMM d, yyyy h:mm a');
}

function isImageFile(mimeType: string): boolean {
  return mimeType?.startsWith('image/');
}

function isPdfFile(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatMessage({
  id,
  message,
  attachments,
  sender,
  createdAt,
  updatedAt,
  isOwn,
  priority,
  onEdit,
  onDelete,
}: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState(message);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success('Message copied to clipboard');
    } catch {
      toast.error('Failed to copy message');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedMessage(message);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSaveEdit = async () => {
    if (!onEdit || editedMessage.trim() === message) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onEdit(id, editedMessage.trim());
      setIsEditing(false);
      toast.success('Message updated');
    } catch {
      toast.error('Failed to update message');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedMessage(message);
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(id);
      toast.success('Message deleted');
    } catch {
      toast.error('Failed to delete message');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <>
      <div
        className={`group flex gap-2 sm:gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
      >
        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
          <AvatarImage src={sender.avatar} />
          <AvatarFallback className="text-xs">
            {getInitials(sender.name)}
          </AvatarFallback>
        </Avatar>

        <div
          className={`max-w-[80%] sm:max-w-[70%] min-w-0 ${isOwn ? 'text-right' : ''}`}
        >
          <div className="relative inline-block">
            <div
              className={`p-2 sm:p-3 rounded-lg ${
                priority === 'HIGH'
                  ? 'bg-green-100 dark:bg-green-900/50 border-2 border-green-500'
                  : isOwn
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {priority === 'HIGH' && (
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-green-600 dark:text-green-400 text-[10px] sm:text-xs font-bold">
                    ⚡ HIGH PRIORITY
                  </span>
                </div>
              )}

              {!isOwn && (
                <p
                  className={`font-medium text-xs sm:text-sm mb-1 ${
                    priority === 'HIGH' ? 'text-green-800 dark:text-green-200' : ''
                  }`}
                >
                  {sender.name}
                </p>
              )}

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    ref={inputRef}
                    value={editedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-w-[200px] text-sm"
                    disabled={isSaving}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ) : (
                <p
                  className={`text-sm sm:text-base break-words whitespace-pre-wrap ${
                    priority === 'HIGH' ? 'text-green-800 dark:text-green-200' : ''
                  }`}
                >
                  {message}
                </p>
              )}

              {/* Attachments */}
              {attachments && attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {attachments.map((att, idx) => (
                    <div key={idx}>
                      {isImageFile(att.mimeType) ? (
                        <img
                          src={att.url}
                          alt={att.fileName}
                          className="max-w-[200px] sm:max-w-[280px] h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setImagePreview(att.url)}
                        />
                      ) : isPdfFile(att.mimeType) ? (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 p-2 rounded-lg border ${
                            isOwn
                              ? 'border-primary-foreground/30 hover:bg-primary-foreground/10'
                              : 'border-border hover:bg-muted/50'
                          } transition-colors`}
                        >
                          <FileText className="h-8 w-8 text-red-500 flex-shrink-0" />
                          <div className="min-w-0 text-left">
                            <p className="text-xs sm:text-sm font-medium truncate">
                              {att.fileName}
                            </p>
                            <p className="text-[10px] sm:text-xs opacity-70">
                              PDF • {formatFileSize(att.size)}
                            </p>
                          </div>
                          <Download className="h-4 w-4 flex-shrink-0 ml-2" />
                        </a>
                      ) : (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 p-2 rounded-lg border ${
                            isOwn
                              ? 'border-primary-foreground/30 hover:bg-primary-foreground/10'
                              : 'border-border hover:bg-muted/50'
                          } transition-colors`}
                        >
                          <FileText className="h-6 w-6 flex-shrink-0" />
                          <span className="text-xs sm:text-sm truncate">
                            {att.fileName}
                          </span>
                          <Download className="h-4 w-4 flex-shrink-0" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message Actions */}
            {isOwn && (onEdit || onDelete) && !isEditing && (
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleCopy}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </DropdownMenuItem>
                    {onEdit && (
                      <DropdownMenuItem onClick={handleEdit}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        onClick={handleDelete}
                        className="text-red-600"
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Copy for others' messages */}
            {!isOwn && (
              <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopy}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <p
            className={`text-[10px] sm:text-xs text-muted-foreground mt-1 ${
              isOwn ? 'text-right' : ''
            }`}
          >
            {formatMessageTime(createdAt)}
            {updatedAt && updatedAt !== createdAt && (
              <span className="ml-1 italic">(edited)</span>
            )}
          </p>
        </div>
      </div>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setImagePreview(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => setImagePreview(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <a
              href={imagePreview}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-2 right-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="secondary" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </a>
          </div>
        </div>
      )}
    </>
  );
}
