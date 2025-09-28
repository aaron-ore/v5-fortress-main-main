import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, UploadCloud, Loader2 } from 'lucide-react';

interface CustomFileInputProps {
  id: string;
  label: string;
  file?: File | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  disabled?: boolean;
  accept?: string;
  isUploading?: boolean;
  previewUrl?: string | null; // This is now expected to be a PUBLIC URL or data:URL
}

const CustomFileInput: React.FC<CustomFileInputProps> = ({
  id,
  label,
  file,
  onChange,
  onClear,
  disabled,
  accept,
  isUploading,
  previewUrl,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    if (fileInputRef.current && !disabled && !isUploading) {
      fileInputRef.current.click();
    }
  };

  const hasFileOrPreview = !!file || !!previewUrl;

  const buttonText = isUploading
    ? "Uploading..."
    : file
      ? file.name
      : previewUrl
        ? "Image Selected" // Show this if there's a preview URL but no new file
        : "Choose File";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleButtonClick}
          disabled={disabled || isUploading}
          className="flex-grow justify-start relative"
        >
          <UploadCloud className="mr-2 h-4 w-4" />
          {buttonText}
          <Input
            id={id}
            type="file"
            accept={accept}
            onChange={onChange}
            ref={fileInputRef}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer hidden"
            disabled={disabled || isUploading}
          />
        </Button>
        {hasFileOrPreview && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClear}
            disabled={disabled || isUploading}
            aria-label="Clear selected file"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {isUploading ? (
        <div className="mt-2 p-4 border border-dashed border-muted-foreground/50 rounded-md flex items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Uploading...
        </div>
      ) : previewUrl ? (
        <div className="mt-2 p-2 border border-border rounded-md flex items-center justify-center bg-muted/20">
          <img src={previewUrl} alt="Product Preview" className="max-w-[100px] max-h-[100px] object-contain" />
        </div>
      ) : (
        <div className="mt-2 p-4 border border-dashed border-muted-foreground/50 rounded-md flex items-center justify-center text-muted-foreground text-sm">
          <span>No image selected</span>
        </div>
      )}
    </div>
  );
};

export default CustomFileInput;