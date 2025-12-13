import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { TooltipPointerPosition, TooltipVariant } from '@/components';

const DEFAULT_TOOLTIP_DURATION = 4000; // 4 seconds

export interface TooltipOptions {
  message: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  onLeadingIconTap?: () => void;
  onTrailingIconTap?: () => void;
  isDismissible?: boolean;
  isInfo?: boolean;
  duration?: number;
  variant?: TooltipVariant;
  pointerPosition?: TooltipPointerPosition;
  pointerSize?: number;
}

interface TooltipState extends TooltipOptions {
  visible: boolean;
}

export const useTooltip = () => {
  const [tooltipState, setTooltipState] = useState<TooltipState>({
    visible: false,
    message: '',
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const callbackRef = useRef<(() => void) | undefined>(undefined);

  // Update ref when tooltip state changes
  callbackRef.current = tooltipState.onTrailingIconTap;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setTooltipState((prev) => ({ ...prev, visible: false }));
  }, []);

  const show = useCallback(
    (options: TooltipOptions) => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setTooltipState({
        ...options,
        visible: true,
      });

      // Set auto-dismiss timeout if not dismissible
      if (!options.isDismissible) {
        const duration = options.duration ?? DEFAULT_TOOLTIP_DURATION;
        timeoutRef.current = setTimeout(() => {
          hide();
        }, duration);
      }
    },
    [hide]
  );

  const handleTrailingIconTap = useCallback(() => {
    callbackRef.current?.();
    hide();
  }, [hide]);

  return {
    show,
    hide,
    tooltipState: {
      ...tooltipState,
      onTrailingIconTap: handleTrailingIconTap,
      onDismiss: hide,
    },
  };
};
