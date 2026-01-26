'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Paperclip, Send, X, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Attachment {
  file?: File;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  isUploading?: boolean;
}

interface ChatInputProps {
  placeholder?: string;
  onSend: (message: string, attachments?: Attachment[]) => Promise<void>;
  onUpload?: (file: File) => Promise<{ url: string; fileName: string; mimeType: string; size: number }>;
  showPriority?: boolean;
  disabled?: boolean;
}

function isImageFile(mimeType: string): boolean {
  return mimeType?.startsWith('image/');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatInput({
  placeholder = 'Type a message...',
  onSend,
  onUpload,
  showPriority = false,
  disabled = false,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isHighPriority, setIsHighPriority] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle paste event for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await handleFileUpload(file);
          }
          break;
        }
      }
    };

    const inputElement = inputRef.current;
    if (inputElement) {
      inputElement.addEventListener('paste', handlePaste);
      return () => inputElement.removeEventListener('paste', handlePaste);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!onUpload) {
      toast.error('File upload not supported');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Create preview attachment
    const tempAttachment: Attachment = {
      file,
      url: URL.createObjectURL(file),
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      isUploading: true,
    };

    setAttachments((prev) => [...prev, tempAttachment]);

    try {
      const uploaded = await onUpload(file);
      setAttachments((prev) =>
        prev.map((att) =>
          att.file === file
            ? { ...uploaded, isUploading: false }
            : att
        )
      );
    } catch (error) {
      setAttachments((prev) => prev.filter((att) => att.file !== file));
      toast.error('Failed to upload file');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      await handleFileUpload(files[i]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const att = prev[index];
      if (att.file) {
        URL.revokeObjectURL(att.url);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage && attachments.length === 0) return;
    if (attachments.some((att) => att.isUploading)) {
      toast.error('Please wait for files to finish uploading');
      return;
    }

    setIsSending(true);
    try {
      await onSend(
        trimmedMessage,
        attachments.length > 0
          ? attachments.map((att) => ({
              url: att.url,
              fileName: att.fileName,
              mimeType: att.mimeType,
              size: att.size,
            }))
          : undefined
      );
      setMessage('');
      setAttachments([]);
      setIsHighPriority(false);
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        await handleFileUpload(files[i]);
      }
    },
    [onUpload]
  );

  return (
    <div
      className={`space-y-2 ${isDragging ? 'ring-2 ring-primary ring-offset-2 rounded-lg' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-lg">
          {attachments.map((att, index) => (
            <div key={index} className="relative group">
              {isImageFile(att.mimeType) ? (
                <div className="relative">
                  <img
                    src={att.url}
                    alt={att.fileName}
                    className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg"
                  />
                  {att.isUploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center bg-muted rounded-lg p-2">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                  <span className="text-[8px] sm:text-[10px] text-center truncate w-full mt-1">
                    {att.fileName.slice(0, 10)}...
                  </span>
                  {att.isUploading && (
                    <Loader2 className="h-3 w-3 animate-spin mt-1" />
                  )}
                </div>
              )}
              {!att.isUploading && (
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className="flex gap-2 items-end">
        {onUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled || isSending}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isSending}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </>
        )}

        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSending}
            className={`pr-10 ${isHighPriority ? 'border-green-500 focus-visible:ring-green-500' : ''}`}
          />
          {isDragging && (
            <div className="absolute inset-0 bg-primary/10 rounded-md flex items-center justify-center border-2 border-dashed border-primary">
              <p className="text-sm text-primary font-medium">Drop files here</p>
            </div>
          )}
        </div>

        <Button
          type="button"
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={handleSend}
          disabled={
            disabled ||
            isSending ||
            (!message.trim() && attachments.length === 0) ||
            attachments.some((att) => att.isUploading)
          }
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Priority Checkbox */}
      {showPriority && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="highPriority"
            checked={isHighPriority}
            onCheckedChange={(checked) => setIsHighPriority(checked === true)}
            disabled={disabled || isSending}
          />
          <Label
            htmlFor="highPriority"
            className="text-xs sm:text-sm text-green-600 dark:text-green-400 cursor-pointer"
          >
            ⚡ High Priority Message
          </Label>
        </div>
      )}

      {/* Paste hint */}
      <p className="text-[10px] sm:text-xs text-muted-foreground">
        Tip: Paste images directly (Ctrl+V) or drag & drop files
      </p>
    </div>
  );
}
