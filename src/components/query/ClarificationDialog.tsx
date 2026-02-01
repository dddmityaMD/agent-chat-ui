"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  HelpCircle,
  Loader2,
  MessageSquare,
  ArrowRight,
  Check,
} from "lucide-react";

export interface ClarificationOption {
  id: string;
  label: string;
  preview: string;
  confidence?: number;
}

export interface ClarificationDialogProps {
  isOpen: boolean;
  options: ClarificationOption[];
  onSelect: (optionId: string) => void;
  onCancel: () => void;
  originalQuery: string;
  isLoading?: boolean;
}

export function ClarificationDialog({
  isOpen,
  options,
  onSelect,
  onCancel,
  originalQuery,
  isLoading = false,
}: ClarificationDialogProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  // Reset selection when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedOption(null);
      setHoveredOption(null);
    }
  }, [isOpen]);

  const handleSelect = useCallback(
    (optionId: string) => {
      setSelectedOption(optionId);
      onSelect(optionId);
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, optionId: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect(optionId);
      }
    },
    [handleSelect]
  );

  const handleCancel = useCallback(() => {
    setSelectedOption(null);
    onCancel();
  }, [onCancel]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[550px]" aria-describedby="clarification-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-primary" />
            Did you mean:
          </DialogTitle>
          <DialogDescription id="clarification-description">
            Your query could be interpreted in different ways. Please select the
            option that best matches what you&apos;re looking for.
          </DialogDescription>
        </DialogHeader>

        {/* Original Query Display */}
        <div className="bg-muted/50 rounded-lg p-3 border">
          <div className="text-xs text-muted-foreground mb-1">Original query:</div>
          <div className="text-sm font-medium truncate" title={originalQuery}>
            &ldquo;{originalQuery}&rdquo;
          </div>
        </div>

        {/* Options List */}
        <div className="space-y-3 py-2">
          {options.map((option, index) => (
            <OptionCard
              key={option.id}
              option={option}
              index={index}
              isSelected={selectedOption === option.id}
              isHovered={hoveredOption === option.id}
              isLoading={isLoading && selectedOption === option.id}
              onSelect={() => handleSelect(option.id)}
              onHover={() => setHoveredOption(option.id)}
              onLeave={() => setHoveredOption(null)}
              onKeyDown={(e) => handleKeyDown(e, option.id)}
            />
          ))}

          {/* "Something else" option */}
          <Card
            className={cn(
              "cursor-pointer transition-all duration-200 border-dashed",
              "hover:border-primary/50 hover:bg-muted/50",
              "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
            )}
            onClick={handleCancel}
            onMouseEnter={() => setHoveredOption("cancel")}
            onMouseLeave={() => setHoveredOption(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCancel();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="None of the above - rephrase your question"
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Something else</div>
                <div className="text-xs text-muted-foreground">
                  Rephrase your question
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface OptionCardProps {
  option: ClarificationOption;
  index: number;
  isSelected: boolean;
  isHovered: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function OptionCard({
  option,
  index,
  isSelected,
  isHovered,
  isLoading,
  onSelect,
  onHover,
  onLeave,
  onKeyDown,
}: OptionCardProps) {
  const confidence = option.confidence ?? 0;

  // Determine confidence indicator
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.7) return "bg-green-500";
    if (conf >= 0.4) return "bg-yellow-500";
    return "bg-gray-400";
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200",
        isSelected && "ring-2 ring-primary ring-offset-2 border-primary",
        isHovered && !isSelected && "border-primary/50 bg-muted/30",
        "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="radio"
      aria-checked={isSelected}
      aria-label={`Option ${index + 1}: ${option.label}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Radio indicator */}
          <div
            className={cn(
              "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5",
              isSelected
                ? "border-primary bg-primary"
                : "border-muted-foreground/30"
            )}
          >
            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
          </div>

          <div className="flex-1 min-w-0">
            {/* Option label */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{option.label}</span>
              {confidence > 0 && (
                <div className="flex items-center gap-1">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      getConfidenceColor(confidence)
                    )}
                    title={`Confidence: ${(confidence * 100).toFixed(0)}%`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {(confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 font-mono">
              Preview: &ldquo;{option.preview}&rdquo;
            </div>
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex-shrink-0">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ClarificationDialog;
