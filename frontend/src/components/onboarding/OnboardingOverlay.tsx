import React, { useEffect, useState, useRef } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, X, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpotlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingOverlay() {
  const {
    isOnboarding,
    currentStep,
    steps,
    nextStep,
    prevStep,
    stopOnboarding,
    markOnboardingComplete,
  } = useOnboarding();

  const handleClose = () => {
    stopOnboarding();
    markOnboardingComplete();
  };

  const [spotlightPosition, setSpotlightPosition] = useState<SpotlightPosition | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStepData = steps[currentStep];

  useEffect(() => {
    if (!isOnboarding || !currentStepData) return;

    const updatePosition = () => {
      const element = document.querySelector(currentStepData.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        const padding = 8;
        
        setSpotlightPosition({
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        });

        // Calculate tooltip position based on specified position
        const tooltipWidth = 320;
        const tooltipHeight = 200;
        let tooltipTop = rect.top;
        let tooltipLeft = rect.right + 20;

        switch (currentStepData.position) {
          case 'top':
            tooltipTop = rect.top - tooltipHeight - 20;
            tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case 'bottom':
            tooltipTop = rect.bottom + 20;
            tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
            break;
          case 'left':
            tooltipTop = rect.top + rect.height / 2 - tooltipHeight / 2;
            tooltipLeft = rect.left - tooltipWidth - 20;
            break;
          case 'right':
          default:
            tooltipTop = rect.top;
            tooltipLeft = rect.right + 20;
            break;
        }

        // Keep tooltip within viewport
        tooltipLeft = Math.max(20, Math.min(tooltipLeft, window.innerWidth - tooltipWidth - 20));
        tooltipTop = Math.max(20, Math.min(tooltipTop, window.innerHeight - tooltipHeight - 20));

        setTooltipPosition({ top: tooltipTop, left: tooltipLeft });
      } else {
        // If element not found, center the tooltip
        setSpotlightPosition(null);
        setTooltipPosition({
          top: window.innerHeight / 2 - 100,
          left: window.innerWidth / 2 - 160,
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isOnboarding, currentStep, currentStepData]);

  if (!isOnboarding || !currentStepData) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* SVG Mask for spotlight effect - doesn't blur the highlighted element */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="spotlight-mask">
            {/* White = visible (dark overlay), Black = hidden (spotlight hole) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightPosition && (
              <rect
                x={spotlightPosition.left}
                y={spotlightPosition.top}
                width={spotlightPosition.width}
                height={spotlightPosition.height}
                rx="8"
                ry="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Dark overlay with mask cutout */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>
      
      {/* Highlight ring around the spotlight area */}
      {spotlightPosition && (
        <div
          className="absolute rounded-lg ring-4 ring-primary transition-all duration-300 ease-out pointer-events-none"
          style={{
            top: spotlightPosition.top,
            left: spotlightPosition.left,
            width: spotlightPosition.width,
            height: spotlightPosition.height,
            boxShadow: '0 0 20px 5px rgba(59, 130, 246, 0.5)',
          }}
        />
      )}

      {/* Tooltip Card */}
      <Card
        ref={tooltipRef}
        className={cn(
          "absolute w-80 shadow-2xl border-primary/20 transition-all duration-300 ease-out pointer-events-auto",
          "animate-in fade-in-0 zoom-in-95"
        )}
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              {currentStepData.title}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1 mt-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  index <= currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {currentStepData.description}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between pt-0">
          <div className="text-xs text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={prevStep}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={nextStep}>
              {currentStep === steps.length - 1 ? (
                'Finish'
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
