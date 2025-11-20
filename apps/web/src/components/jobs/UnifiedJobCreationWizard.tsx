'use client';

import { useState, useEffect } from 'react';
import { filesAPI, companiesAPI, employeesAPI, type Company, type Employee } from '@/lib/api-client';
import { JobFormFields } from './JobFormFields';

type EntryMethod = 'upload' | 'manual' | null;

interface WizardStep {
  id: number;
  title: string;
  description: string;
}

interface JobFormData {
  customerId?: string;
  employeeId?: string;
  description: string;
  paper: string;
  flatSize: string;
  foldedSize: string;
  colors: string;
  finishing: string;
  total: string;
  poNumber: string;
  deliveryDate: string;
  samples: string;
  requiredArtworkCount: number;
  requiredDataFileCount: number;
  // Routing fields
  routingType?: 'BRADFORD_JD' | 'THIRD_PARTY_VENDOR';
  vendorId?: string;
  vendorAmount?: string;
  bradfordCut?: string;
}

interface UnifiedJobCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  userRole: 'admin' | 'customer' | 'production';
  defaultCustomerId?: string; // For customer users, pre-populate
}

const STEPS: WizardStep[] = [
  { id: 1, title: 'Entry Method', description: 'Choose how to enter job details' },
  { id: 2, title: 'Job Details', description: 'Fill in order information' },
  { id: 3, title: 'Review', description: 'Confirm and submit' },
];

export function UnifiedJobCreationWizard({
  isOpen,
  onClose,
  onSubmit,
  userRole,
  defaultCustomerId,
}: UnifiedJobCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [entryMethod, setEntryMethod] = useState<EntryMethod>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [formData, setFormData] = useState<JobFormData>({
    customerId: defaultCustomerId,
    description: '',
    paper: '',
    flatSize: '',
    foldedSize: '',
    colors: '',
    finishing: '',
    total: '',
    poNumber: '',
    deliveryDate: '',
    samples: '',
    requiredArtworkCount: 1,
    requiredDataFileCount: 0,
    routingType: 'BRADFORD_JD',
  });
  const [customers, setCustomers] = useState<Company[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isCustomer = userRole === 'customer';
  const isAdmin = userRole === 'admin';

  // Load customers for admin users
  useEffect(() => {
    if (isOpen && !isCustomer) {
      const loadCustomers = async () => {
        try {
          setLoadingCustomers(true);
          const data = await companiesAPI.list({ type: 'customer' });
          setCustomers(data);
        } catch (error) {
          console.error('Failed to load customers:', error);
        } finally {
          setLoadingCustomers(false);
        }
      };
      loadCustomers();
    }
  }, [isOpen, isCustomer]);

  // Load employees when customer is selected
  useEffect(() => {
    if (formData.customerId) {
      const loadEmployees = async () => {
        try {
          console.log('📞 Loading employees for customer:', formData.customerId);
          setLoadingEmployees(true);
          const data = await employeesAPI.list({ companyId: formData.customerId });
          console.log('✅ Employees loaded:', {
            count: data?.length || 0,
            employees: data.map((e) => ({ id: e.id, name: e.name, isPrimary: e.isPrimary }))
          });
          setEmployees(data || []);

          // Auto-select primary employee if only one exists or if there's a primary employee
          if (data && data.length > 0) {
            const primaryEmployee = data.find((e) => e.isPrimary);
            if (primaryEmployee || data.length === 1) {
              const autoSelectId = primaryEmployee?.id || data[0].id;
              console.log('🎯 Auto-selecting employee:', autoSelectId);
              setFormData((prev) => ({ ...prev, employeeId: autoSelectId }));
            }
          }
        } catch (error: any) {
          console.error('❌ Failed to load employees:', {
            error: error.message || error,
            customerId: formData.customerId
          });
          setEmployees([]);
        } finally {
          setLoadingEmployees(false);
        }
      };
      loadEmployees();
    } else {
      // Clear employees when no customer is selected
      setEmployees([]);
      setFormData((prev) => ({ ...prev, employeeId: undefined }));
      setLoadingEmployees(false);
    }
  }, [formData.customerId]);

  // Reset wizard when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setEntryMethod(null);
      setUploadedFile(null);
      setParsingFile(false);
      setFormData({
        customerId: defaultCustomerId,
        description: '',
        paper: '',
        flatSize: '',
        foldedSize: '',
        colors: '',
        finishing: '',
        total: '',
        poNumber: '',
        deliveryDate: '',
        samples: '',
        requiredArtworkCount: 1,
        requiredDataFileCount: 0,
        routingType: 'BRADFORD_JD',
      });
    }
  }, [isOpen, defaultCustomerId]);

  const handleFileUpload = async (file: File) => {
    console.log('📁 [Wizard] File upload started:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    setUploadedFile(file);
    setParsingFile(true);

    try {
      console.log('🔍 [Wizard] Calling filesAPI.parsePO...');
      const parseResult = await filesAPI.parsePO(file);
      console.log('📋 [Wizard] Parse result received:', {
        success: parseResult.success,
        hasData: !!parseResult.parsed,
        message: parseResult.message,
      });

      if (!parseResult.success || !parseResult.parsed) {
        throw new Error(parseResult.message || 'Failed to parse file');
      }

      // Populate form data with parsed results
      const parsedData = {
        description: parseResult.parsed.description || '',
        paper: parseResult.parsed.paper || '',
        flatSize: parseResult.parsed.flatSize || '',
        foldedSize: parseResult.parsed.foldedSize || '',
        colors: parseResult.parsed.colors || '',
        finishing: parseResult.parsed.finishing || '',
        total: parseResult.parsed.total?.toString() || '',
        poNumber: parseResult.parsed.poNumber || '',
        deliveryDate: parseResult.parsed.deliveryDate || '',
        samples: parseResult.parsed.samples || '',
      };

      console.log('✅ [Wizard] Setting form data:', parsedData);
      setFormData((prev) => ({
        ...prev,
        ...parsedData,
      }));

      console.log('➡️ [Wizard] Moving to step 2');
      // Move to next step
      setCurrentStep(2);
    } catch (error: any) {
      console.error('❌ [Wizard] File parsing failed:', {
        error: error.message || error,
        fileName: file.name,
      });
      alert(error.message || 'Failed to parse file. Please try manual entry.');
    } finally {
      setParsingFile(false);
    }
  };

  const handleFormFieldChange = (field: keyof JobFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    console.log('⏭️ [Wizard] Next button clicked:', {
      currentStep,
      entryMethod,
    });

    if (currentStep === 1 && entryMethod) {
      if (entryMethod === 'manual') {
        console.log('✍️ [Wizard] Manual entry selected, moving to step 2');
        setCurrentStep(2);
      }
      // For upload, handleFileUpload will advance the step
    } else if (currentStep === 2) {
      console.log('👀 [Wizard] Moving to review step (step 3)');
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 [Wizard] Submit button clicked, form data:', {
      customerId: formData.customerId,
      employeeId: formData.employeeId,
      description: formData.description,
      routingType: formData.routingType,
      hasVendorId: !!formData.vendorId,
      hasVendorAmount: !!formData.vendorAmount,
    });

    setSubmitting(true);

    try {
      console.log('📡 [Wizard] Calling onSubmit callback...');
      await onSubmit(formData);
      console.log('✅ [Wizard] onSubmit completed successfully');
      onClose();
    } catch (error: any) {
      console.error('❌ [Wizard] Submit failed:', {
        error: error.message || error,
        formData,
      });
      alert(error.message || 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isCustomer ? 'Create New Order' : 'Create New Job'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {STEPS[currentStep - 1].description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      currentStep >= step.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                    }`}
                  >
                    {step.id}
                  </div>
                  <div className="text-xs mt-1 text-gray-600 dark:text-slate-400">{step.title}</div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      currentStep > step.id ? 'bg-blue-500' : 'bg-gray-200 dark:bg-slate-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Entry Method */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  How would you like to enter job details?
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Upload a PO for AI parsing or enter details manually
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AI Upload Option */}
                <button
                  type="button"
                  onClick={() => setEntryMethod('upload')}
                  className={`p-6 border-2 rounded-lg text-left transition-all ${
                    entryMethod === 'upload'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <svg
                        className="w-8 h-8 text-blue-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">AI Upload</h4>
                      <p className="text-sm text-gray-600 dark:text-slate-400">
                        Upload a PO file (PDF, JPG, PNG) and let AI extract the details
                      </p>
                    </div>
                  </div>
                </button>

                {/* Manual Entry Option */}
                <button
                  type="button"
                  onClick={() => setEntryMethod('manual')}
                  className={`p-6 border-2 rounded-lg text-left transition-all ${
                    entryMethod === 'manual'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <svg
                        className="w-8 h-8 text-blue-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Manual Entry</h4>
                      <p className="text-sm text-gray-600 dark:text-slate-400">
                        Fill in the job details manually using a form
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* File Upload Area (shown when upload is selected) */}
              {entryMethod === 'upload' && (
                <div className="mt-6">
                  <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="hidden"
                      id="file-upload"
                      disabled={parsingFile}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      {parsingFile ? (
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 border-4 border-transparent border-t-blue-500 border-r-purple-500 rounded-full animate-spin"></div>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            Analyzing your file...
                          </p>
                          <p className="text-sm text-gray-500 dark:text-slate-400">This may take a moment</p>
                        </div>
                      ) : uploadedFile ? (
                        <div className="flex flex-col items-center gap-4">
                          <svg
                            className="w-16 h-16 text-green-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {uploadedFile.name}
                          </p>
                          <p className="text-sm text-green-600">File parsed successfully!</p>
                        </div>
                      ) : (
                        <>
                          <svg
                            className="mx-auto h-16 w-16 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                          <p className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                            Drop your file here
                          </p>
                          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">or click to browse</p>
                          <p className="mt-2 text-xs text-gray-400">Supports PDF, JPG, PNG</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Job Details */}
          {currentStep === 2 && (
            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
              {/* Customer Selection (for admin/production users) */}
              {!isCustomer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Customer *
                  </label>
                  <select
                    value={formData.customerId || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, customerId: e.target.value }))}
                    required
                    disabled={loadingCustomers}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Select customer...</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                  {loadingCustomers && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Loading customers...</p>
                  )}
                </div>
              )}

              {/* Employee Selection (for admin/production users, shown after customer is selected) */}
              {!isCustomer && formData.customerId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Contact Person *
                  </label>
                  <select
                    value={formData.employeeId || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, employeeId: e.target.value }))}
                    required
                    disabled={loadingEmployees}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Select contact person...</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} {employee.position ? `(${employee.position})` : ''} {employee.isPrimary ? '⭐' : ''}
                      </option>
                    ))}
                  </select>
                  {loadingEmployees && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Loading employees...</p>
                  )}
                  {!loadingEmployees && employees.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      No employees found for this customer. Please add an employee first.
                    </p>
                  )}
                </div>
              )}

              {/* Job Form Fields */}
              <JobFormFields
                data={formData}
                onChange={handleFormFieldChange}
                showFileRequirements={true}
                showRoutingOptions={isAdmin} // Only show routing for admins
              />
            </form>
          )}

          {/* Step 3: Review */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Review Your Order</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Please review the details below before submitting
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-6 space-y-4">
                {!isCustomer && formData.customerId && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-slate-400">Customer</div>
                    <div className="text-base text-gray-900 dark:text-white">
                      {customers.find((c) => c.id === formData.customerId)?.name || formData.customerId}
                    </div>
                  </div>
                )}

                {!isCustomer && formData.employeeId && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-slate-400">Contact Person</div>
                    <div className="text-base text-gray-900 dark:text-white">
                      {employees.find((e) => e.id === formData.employeeId)?.name || formData.employeeId}
                    </div>
                  </div>
                )}

                {formData.description && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-slate-400">Description</div>
                    <div className="text-base text-gray-900 dark:text-white">{formData.description}</div>
                  </div>
                )}

                {formData.paper && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-slate-400">Paper</div>
                    <div className="text-base text-gray-900 dark:text-white">{formData.paper}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {formData.flatSize && (
                    <div>
                      <div className="text-sm font-medium text-gray-500 dark:text-slate-400">Flat Size</div>
                      <div className="text-base text-gray-900 dark:text-white">{formData.flatSize}</div>
                    </div>
                  )}

                  {formData.foldedSize && (
                    <div>
                      <div className="text-sm font-medium text-gray-500 dark:text-slate-400">Folded Size</div>
                      <div className="text-base text-gray-900 dark:text-white">{formData.foldedSize}</div>
                    </div>
                  )}
                </div>

                {formData.colors && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-slate-400">Colors</div>
                    <div className="text-base text-gray-900 dark:text-white">{formData.colors}</div>
                  </div>
                )}

                {formData.finishing && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-slate-400">Finishing</div>
                    <div className="text-base text-gray-900 dark:text-white">{formData.finishing}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {formData.total && (
                    <div>
                      <div className="text-sm font-medium text-gray-500 dark:text-slate-400">Total Price</div>
                      <div className="text-base text-gray-900 dark:text-white">${formData.total}</div>
                    </div>
                  )}

                  {formData.poNumber && (
                    <div>
                      <div className="text-sm font-medium text-gray-500 dark:text-slate-400">PO Number</div>
                      <div className="text-base text-gray-900 dark:text-white">{formData.poNumber}</div>
                    </div>
                  )}
                </div>

                {formData.deliveryDate && (
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-slate-400">Delivery Date</div>
                    <div className="text-base text-gray-900 dark:text-white">{formData.deliveryDate}</div>
                  </div>
                )}

                {/* Routing Details (for admin) */}
                {isAdmin && formData.routingType === 'THIRD_PARTY_VENDOR' && (
                  <div className="border-t border-gray-200 dark:border-slate-600 pt-4 mt-4">
                    <div className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      Routing Details
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-slate-400">Routing Type:</span>
                        <span className="text-gray-900 dark:text-white">Third-Party Vendor</span>
                      </div>
                      {formData.vendorAmount && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-slate-400">Vendor Amount:</span>
                          <span className="text-gray-900 dark:text-white">${formData.vendorAmount}</span>
                        </div>
                      )}
                      {formData.bradfordCut && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-slate-400">Bradford's Cut:</span>
                          <span className="text-gray-900 dark:text-white">${formData.bradfordCut}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1 || submitting}
            className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            >
              Cancel
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => {
                  const isDisabled =
                    (currentStep === 1 && !entryMethod) ||
                    (currentStep === 1 && entryMethod === 'upload' && !uploadedFile);

                  console.log('🔘 [Wizard] Next button clicked - button state:', {
                    currentStep,
                    entryMethod,
                    uploadedFile: !!uploadedFile,
                    isDisabled,
                  });

                  if (!isDisabled) {
                    handleNext();
                  } else {
                    console.warn('⚠️ [Wizard] Next button is disabled, cannot proceed');
                  }
                }}
                disabled={
                  (currentStep === 1 && !entryMethod) ||
                  (currentStep === 1 && entryMethod === 'upload' && !uploadedFile)
                }
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  const isVendorRouting = formData.routingType === 'THIRD_PARTY_VENDOR';
                  const vendorFieldsComplete = formData.vendorId && formData.vendorAmount && formData.bradfordCut;
                  const isDisabled = submitting || (isVendorRouting && !vendorFieldsComplete);

                  console.log('🔘 [Wizard] Submit button clicked - button state:', {
                    submitting,
                    routingType: formData.routingType,
                    isVendorRouting,
                    vendorFieldsComplete,
                    isDisabled,
                    formData: {
                      customerId: formData.customerId,
                      employeeId: formData.employeeId,
                      description: formData.description,
                      vendorId: formData.vendorId,
                      vendorAmount: formData.vendorAmount,
                      bradfordCut: formData.bradfordCut,
                    }
                  });

                  if (!isDisabled) {
                    handleSubmit(e as any);
                  } else {
                    console.warn('⚠️ [Wizard] Submit button is disabled:', {
                      reason: submitting ? 'Already submitting' : 'Vendor fields incomplete',
                      missingFields: isVendorRouting ? {
                        vendorId: !formData.vendorId,
                        vendorAmount: !formData.vendorAmount,
                        bradfordCut: !formData.bradfordCut,
                      } : null
                    });
                  }
                }}
                disabled={
                  submitting ||
                  (formData.routingType === 'THIRD_PARTY_VENDOR' &&
                    (!formData.vendorId || !formData.vendorAmount || !formData.bradfordCut))
                }
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Submitting...
                  </>
                ) : (
                  'Submit Order'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
