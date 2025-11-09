import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface MediaItem {
  id: string;
  title: string;
  description: string;
  file_url: string;
  content_type: string;
}

interface MediaViewerProps {
  media: MediaItem[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export const MediaViewer = ({ media, currentIndex, isOpen, onClose }: MediaViewerProps) => {
  const [index, setIndex] = useState(currentIndex);
  
  const currentMedia = media[index];
  const isImage = currentMedia?.content_type === 'image';
  const canGoPrev = index > 0;
  const canGoNext = index < media.length - 1;

  const handlePrev = () => {
    if (canGoPrev) setIndex(index - 1);
  };

  const handleNext = () => {
    if (canGoNext) setIndex(index + 1);
  };

  if (!currentMedia) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-full h-[90vh] p-0">
        <div className="relative w-full h-full flex flex-col bg-background">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-background/95 to-transparent p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-4">
                <h2 className="text-2xl font-bold text-foreground mb-2">{currentMedia.title}</h2>
                {currentMedia.description && (
                  <p className="text-sm text-muted-foreground">{currentMedia.description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-foreground hover:bg-background/80"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {/* Media Content */}
          <div className="flex-1 flex items-center justify-center p-16 overflow-auto">
            {isImage ? (
              <img
                src={currentMedia.file_url}
                alt={currentMedia.title}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
              <video
                src={currentMedia.file_url}
                controls
                className="max-w-full max-h-full rounded-lg"
                autoPlay
              />
            )}
          </div>

          {/* Navigation */}
          {media.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrev}
                disabled={!canGoPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/95 disabled:opacity-0"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                disabled={!canGoNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/95 disabled:opacity-0"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}

          {/* Counter */}
          {media.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 px-4 py-2 rounded-full text-sm text-foreground">
              {index + 1} / {media.length}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
