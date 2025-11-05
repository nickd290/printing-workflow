'use client';

import { useEffect, useState } from 'react';

interface ParsingLoadingModalProps {
  isOpen: boolean;
}

const STEPS = [
  { id: 1, label: 'Uploading PDF...', duration: 500 },
  { id: 2, label: 'Extracting text...', duration: 800 },
  { id: 3, label: 'Analyzing with AI...', duration: 1500 },
  { id: 4, label: 'Parsing job details...', duration: 1200 },
];

const DISCOVERIES = [
  { delay: 1800, text: 'Found PO Number ✓' },
  { delay: 2200, text: 'Found Quantity ✓' },
  { delay: 2600, text: 'Found Dimensions ✓' },
  { delay: 3000, text: 'Calculating pricing ✓' },
  { delay: 3400, text: 'Parsing dates ✓' },
  { delay: 3800, text: 'Processing samples ✓' },
];

export function ParsingLoadingModal({ isOpen }: ParsingLoadingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [discoveries, setDiscoveries] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setDiscoveries([]);
      return;
    }

    // Animate through steps
    const stepTimers: NodeJS.Timeout[] = [];
    let cumulativeTime = 0;

    STEPS.forEach((step, index) => {
      cumulativeTime += step.duration;
      const timer = setTimeout(() => {
        setCurrentStep(index + 1);
      }, cumulativeTime);
      stepTimers.push(timer);
    });

    // Show discoveries
    const discoveryTimers = DISCOVERIES.map((discovery) =>
      setTimeout(() => {
        setDiscoveries((prev) => [...prev, discovery.text]);
      }, discovery.delay)
    );

    return () => {
      stepTimers.forEach(clearTimeout);
      discoveryTimers.forEach(clearTimeout);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full mx-4 transform transition-all">
        {/* Spinner */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-200 rounded-full"></div>
            <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
          Analyzing Your PO
        </h2>
        <p className="text-center text-gray-600 mb-6">
          Please wait while we extract and analyze your order details...
        </p>

        {/* Progress Steps */}
        <div className="space-y-3 mb-6">
          {STEPS.map((step, index) => {
            const isComplete = currentStep > index;
            const isActive = currentStep === index;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 transition-all duration-300 ${
                  isActive ? 'opacity-100' : isComplete ? 'opacity-70' : 'opacity-40'
                }`}
              >
                {isComplete ? (
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : isActive ? (
                  <div className="w-6 h-6 rounded-full border-2 border-blue-600 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex-shrink-0"></div>
                )}
                <span
                  className={`text-sm font-medium ${
                    isActive ? 'text-blue-600' : isComplete ? 'text-gray-700' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Field Discoveries */}
        {discoveries.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Discovered Fields
            </p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {discoveries.map((discovery, index) => (
                <div
                  key={index}
                  className="text-sm text-green-600 flex items-center gap-2 animate-fade-in"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {discovery}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
