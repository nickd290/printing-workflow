'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { employeesAPI, vendorsAPI, jobsAPI, type Employee, type Vendor } from '@/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface JobEditModalProps {
  job: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
}

interface PricingRule {
  id: string;
  sizeName: string;
  baseCPM: number;
  printCPM: number;
  paperWeightPer1000: number | null;
  paperCostPerLb: number | null;
  paperCPM: number | null;
  paperChargedCPM: number | null;
}

export function JobEditModal({ job, isOpen, onClose, onSave }: JobEditModalProps) {
  // Form state - now includes ALL editable fields
  const [formData, setFormData] = useState({
    // Basic Info
    title: job.title || '',
    description: job.description || '',
    employeeId: job.employeeId || '',
    quantity: job.quantity || 0,
    sizeName: job.sizeName || '',
    paperType: job.paperType || '',
    customerPONumber: job.customerPONumber || '',
    packingSlipNotes: job.packingSlipNotes || '',
    jdSuppliesPaper: job.jdSuppliesPaper || false,
    bradfordWaivesPaperMargin: job.bradfordWaivesPaperMargin || false,

    // Dates
    deliveryDate: job.deliveryDate ? new Date(job.deliveryDate).toISOString().split('T')[0] : '',
    mailDate: job.mailDate ? new Date(job.mailDate).toISOString().split('T')[0] : '',
    inHomesDate: job.inHomesDate ? new Date(job.inHomesDate).toISOString().split('T')[0] : '',

    // Financial
    customerTotal: job.customerTotal?.toString() || '0',
    jdTotal: job.jdTotal?.toString() || '0',
    paperChargedTotal: job.paperChargedTotal?.toString() || '0',
    paperCostTotal: job.paperCostTotal?.toString() || '0',
    impactMargin: job.impactMargin?.toString() || '0',
    bradfordTotal: job.bradfordTotal?.toString() || '0',
    bradfordPrintMargin: job.bradfordPrintMargin?.toString() || '0',
    bradfordPaperMargin: job.bradfordPaperMargin?.toString() || '0',
    bradfordTotalMargin: job.bradfordTotalMargin?.toString() || '0',

    // CPM
    printCPM: job.printCPM?.toString() || '0',
    paperCostCPM: job.paperCostCPM?.toString() || '0',
    paperChargedCPM: job.paperChargedCPM?.toString() || '0',

    // Paper
    paperWeightPer1000: job.paperWeightPer1000?.toString() || '0',

    // Routing & Vendor
    routingType: job.routingType || 'BRADFORD_JD',
    jobType: job.jobType || '',
    vendorId: job.vendorId || '',
    vendorAmount: job.vendorAmount?.toString() || '0',
    bradfordCut: job.bradfordCut?.toString() || '0',
    vendorShipToName: job.vendorShipToName || '',
    vendorShipToAddress: job.vendorShipToAddress || '',
    vendorShipToCity: job.vendorShipToCity || '',
    vendorShipToState: job.vendorShipToState || '',
    vendorShipToZip: job.vendorShipToZip || '',
    vendorShipToPhone: job.vendorShipToPhone || '',
    vendorSpecialInstructions: job.vendorSpecialInstructions || '',
    vendorPaymentTerms: job.vendorPaymentTerms || '',
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [selectedPricingRule, setSelectedPricingRule] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [showPdfRegenDialog, setShowPdfRegenDialog] = useState(false);
  const [regeneratingPdfs, setRegeneratingPdfs] = useState(false);

  // Load employees, vendors, and pricing rules
  useEffect(() => {
    loadEmployees();
    loadVendors();
    loadPricingRules();
  }, []);

  // Sync formData when job prop changes
  useEffect(() => {
    if (job) {
      setFormData({
        // Basic Info
        title: job.title || '',
        description: job.description || '',
        employeeId: job.employeeId || '',
        quantity: job.quantity || 0,
        sizeName: job.sizeName || '',
        paperType: job.paperType || '',
        customerPONumber: job.customerPONumber || '',
        packingSlipNotes: job.packingSlipNotes || '',
        jdSuppliesPaper: job.jdSuppliesPaper || false,
        bradfordWaivesPaperMargin: job.bradfordWaivesPaperMargin || false,

        // Dates
        deliveryDate: job.deliveryDate ? new Date(job.deliveryDate).toISOString().split('T')[0] : '',
        mailDate: job.mailDate ? new Date(job.mailDate).toISOString().split('T')[0] : '',
        inHomesDate: job.inHomesDate ? new Date(job.inHomesDate).toISOString().split('T')[0] : '',

        // Financial
        customerTotal: job.customerTotal?.toString() || '0',
        jdTotal: job.jdTotal?.toString() || '0',
        paperChargedTotal: job.paperChargedTotal?.toString() || '0',
        paperCostTotal: job.paperCostTotal?.toString() || '0',
        impactMargin: job.impactMargin?.toString() || '0',
        bradfordTotal: job.bradfordTotal?.toString() || '0',
        bradfordPrintMargin: job.bradfordPrintMargin?.toString() || '0',
        bradfordPaperMargin: job.bradfordPaperMargin?.toString() || '0',
        bradfordTotalMargin: job.bradfordTotalMargin?.toString() || '0',

        // CPM
        printCPM: job.printCPM?.toString() || '0',
        paperCostCPM: job.paperCostCPM?.toString() || '0',
        paperChargedCPM: job.paperChargedCPM?.toString() || '0',

        // Paper
        paperWeightPer1000: job.paperWeightPer1000?.toString() || '0',

        // Routing & Vendor
        routingType: job.routingType || 'BRADFORD_JD',
        jobType: job.jobType || '',
        vendorId: job.vendorId || '',
        vendorAmount: job.vendorAmount?.toString() || '0',
        bradfordCut: job.bradfordCut?.toString() || '0',
        vendorShipToName: job.vendorShipToName || '',
        vendorShipToAddress: job.vendorShipToAddress || '',
        vendorShipToCity: job.vendorShipToCity || '',
        vendorShipToState: job.vendorShipToState || '',
        vendorShipToZip: job.vendorShipToZip || '',
        vendorShipToPhone: job.vendorShipToPhone || '',
        vendorSpecialInstructions: job.vendorSpecialInstructions || '',
        vendorPaymentTerms: job.vendorPaymentTerms || '',
      });
    }
  }, [job]);

  // Auto-populate vendor shipping address when vendor is selected
  useEffect(() => {
    if (formData.vendorId && vendors.length > 0) {
      const selectedVendor = vendors.find(v => v.id === formData.vendorId);
      if (selectedVendor) {
        setFormData(prev => ({
          ...prev,
          vendorShipToName: selectedVendor.name,
          vendorShipToAddress: selectedVendor.streetAddress || '',
          vendorShipToCity: selectedVendor.city || '',
          vendorShipToState: selectedVendor.state || '',
          vendorShipToZip: selectedVendor.zip || '',
          vendorShipToPhone: selectedVendor.phone || '',
        }));
      }
    }
  }, [formData.vendorId, vendors]);

  const loadEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const data = await employeesAPI.list({ companyId: job.customerId });
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadVendors = async () => {
    try {
      setLoadingVendors(true);
      const data = await vendorsAPI.list({ isActive: true });
      setVendors(data);
    } catch (error) {
      console.error('Error loading vendors:', error);
    } finally {
      setLoadingVendors(false);
    }
  };

  const loadPricingRules = async () => {
    try {
      const response = await fetch(`${API_URL}/api/pricing-rules`);
      if (!response.ok) throw new Error('Failed to load pricing rules');
      const data = await response.json();
      setPricingRules(data.rules || []);
    } catch (error) {
      console.error('Error loading pricing rules:', error);
    }
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBradfordWaiverChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, bradfordWaivesPaperMargin: checked }));
    setTimeout(() => calculateMarginsFrom5050(checked), 0);
  };

  const calculateMarginsFrom5050 = (overrideWaiver?: boolean) => {
    const customerTotal = parseFloat(formData.customerTotal) || 0;
    const paperCharged = parseFloat(formData.paperChargedTotal) || 0;
    const paperCost = parseFloat(formData.paperCostTotal) || 0;
    const jdTotal = parseFloat(formData.jdTotal) || 0;

    const isWaiver = overrideWaiver !== undefined ? overrideWaiver : formData.bradfordWaivesPaperMargin;

    let updates: any = {};

    if (isWaiver) {
      updates.paperChargedTotal = paperCost.toFixed(2);
      const profitPool = customerTotal - paperCost - jdTotal;

      if (profitPool < 0) {
        toast.error(`Negative profit pool: $${profitPool.toFixed(2)}. Customer total is less than costs!`);
      }

      const impactMargin = profitPool / 2;
      const bradfordMargin = profitPool / 2;
      const bradfordTotal = bradfordMargin + paperCost + jdTotal;

      updates.impactMargin = impactMargin.toFixed(2);
      updates.bradfordTotalMargin = bradfordMargin.toFixed(2);
      updates.bradfordTotal = bradfordTotal.toFixed(2);

      setFormData(prev => ({ ...prev, ...updates }));
      toast.success(`Bradford waives paper margin - 50/50 split: Impact $${impactMargin.toFixed(2)}, Bradford $${bradfordMargin.toFixed(2)}`);
    } else {
      const profitPool = customerTotal - paperCharged - jdTotal;

      if (profitPool < 0) {
        toast.error(`Negative profit pool: $${profitPool.toFixed(2)}. Customer total is less than costs!`);
      }

      const impactMargin = profitPool / 2;
      const paperMarkup = paperCharged - paperCost;
      const bradfordMargin = profitPool / 2 + paperMarkup;
      const bradfordTotal = bradfordMargin + paperCharged + jdTotal;

      updates.impactMargin = impactMargin.toFixed(2);
      updates.bradfordTotalMargin = bradfordMargin.toFixed(2);
      updates.bradfordTotal = bradfordTotal.toFixed(2);

      setFormData(prev => ({ ...prev, ...updates }));
      toast.success(`Margins calculated: Impact $${impactMargin.toFixed(2)}, Bradford $${bradfordMargin.toFixed(2)}`);
    }
  };

  const applyPricingRule = () => {
    const rule = pricingRules.find(r => r.id === selectedPricingRule);
    if (!rule) {
      toast.error('Please select a pricing rule');
      return;
    }

    const quantity = parseInt(formData.quantity.toString()) || 0;
    const thousands = quantity / 1000;

    const jdTotal = (parseFloat(rule.printCPM.toString()) * thousands).toFixed(2);
    const paperCharged = (parseFloat((rule.paperChargedCPM || rule.paperCPM || 0).toString()) * thousands).toFixed(2);
    const paperCost = rule.paperCostPerLb && rule.paperWeightPer1000
      ? ((parseFloat(rule.paperCostPerLb.toString()) * parseFloat(rule.paperWeightPer1000.toString()) / 1000) * quantity / 1000).toFixed(2)
      : '0';

    setFormData(prev => ({
      ...prev,
      sizeName: rule.sizeName,
      jdTotal,
      paperChargedTotal: paperCharged,
      paperCostTotal: paperCost,
      printCPM: rule.printCPM.toString(),
      paperChargedCPM: (rule.paperChargedCPM || rule.paperCPM || 0).toString(),
      paperCostCPM: rule.paperCostPerLb?.toString() || '0',
      paperWeightPer1000: rule.paperWeightPer1000?.toString() || '0',
    }));

    toast.success(`Applied pricing for ${rule.sizeName}`);
  };

  const calculateCPMs = () => {
    const quantity = parseInt(formData.quantity.toString()) || 0;
    if (quantity === 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    const thousands = quantity / 1000;

    const customerTotal = parseFloat(formData.customerTotal) || 0;
    const jdTotal = parseFloat(formData.jdTotal) || 0;
    const paperCharged = parseFloat(formData.paperChargedTotal) || 0;
    const impactMargin = parseFloat(formData.impactMargin) || 0;

    setFormData(prev => ({
      ...prev,
      customerCPM: (customerTotal / thousands).toFixed(2),
      printCPM: (jdTotal / thousands).toFixed(2),
      paperChargedCPM: (paperCharged / thousands).toFixed(2),
      impactMarginCPM: (impactMargin / thousands).toFixed(2),
    }));

    toast.success('CPM values calculated from totals');
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Convert form data to API payload
      const updates: any = {
        // Basic Info
        title: formData.title || null,
        description: formData.description || null,
        employeeId: formData.employeeId || null,
        quantity: parseInt(formData.quantity.toString()),
        sizeName: formData.sizeName,
        paperType: formData.paperType,
        customerPONumber: formData.customerPONumber || null,
        packingSlipNotes: formData.packingSlipNotes || null,
        jdSuppliesPaper: formData.jdSuppliesPaper,
        bradfordWaivesPaperMargin: formData.bradfordWaivesPaperMargin,

        // Dates (send as ISO strings or null)
        deliveryDate: formData.deliveryDate ? new Date(formData.deliveryDate).toISOString() : null,
        mailDate: formData.mailDate ? new Date(formData.mailDate).toISOString() : null,
        inHomesDate: formData.inHomesDate ? new Date(formData.inHomesDate).toISOString() : null,

        // Financial
        customerTotal: parseFloat(formData.customerTotal),
        jdTotal: parseFloat(formData.jdTotal),
        paperChargedTotal: parseFloat(formData.paperChargedTotal),
        paperCostTotal: parseFloat(formData.paperCostTotal),
        impactMargin: parseFloat(formData.impactMargin),
        bradfordTotal: parseFloat(formData.bradfordTotal),
        bradfordPrintMargin: parseFloat(formData.bradfordPrintMargin),
        bradfordPaperMargin: parseFloat(formData.bradfordPaperMargin),
        bradfordTotalMargin: parseFloat(formData.bradfordTotalMargin),
        printCPM: parseFloat(formData.printCPM),
        paperCostCPM: parseFloat(formData.paperCostCPM),
        paperChargedCPM: parseFloat(formData.paperChargedCPM),
        paperWeightPer1000: parseFloat(formData.paperWeightPer1000),

        // Routing & Vendor
        routingType: formData.routingType,
        jobType: formData.jobType || null,
        vendorId: formData.vendorId || null,
        vendorAmount: formData.vendorAmount ? parseFloat(formData.vendorAmount) : null,
        bradfordCut: formData.bradfordCut ? parseFloat(formData.bradfordCut) : null,
        vendorShipToName: formData.vendorShipToName || null,
        vendorShipToAddress: formData.vendorShipToAddress || null,
        vendorShipToCity: formData.vendorShipToCity || null,
        vendorShipToState: formData.vendorShipToState || null,
        vendorShipToZip: formData.vendorShipToZip || null,
        vendorShipToPhone: formData.vendorShipToPhone || null,
        vendorSpecialInstructions: formData.vendorSpecialInstructions || null,
        vendorPaymentTerms: formData.vendorPaymentTerms || null,

        changedBy: 'admin@impactdirect.com', // TODO: get from auth
        changedByRole: 'BROKER_ADMIN',
      };

      const response = await fetch(`${API_URL}/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update job');

      toast.success('Job updated successfully!');

      await onSave();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if job has invoices - if yes, prompt for PDF regeneration
      if (job.invoices && job.invoices.length > 0) {
        setShowPdfRegenDialog(true);
      } else {
        onClose();
      }
    } catch (error: any) {
      console.error('Error saving job:', error);
      toast.error(error.message || 'Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  const handleRegeneratePdfs = async () => {
    try {
      setRegeneratingPdfs(true);
      setShowPdfRegenDialog(false);
      toast.loading('Regenerating invoice PDFs...', { id: 'regen-pdfs' });

      const result = await jobsAPI.regenerateInvoicePdfs(job.id);

      if (result.success) {
        toast.success(
          `Successfully regenerated ${result.count} of ${result.total} invoice PDFs!`,
          { id: 'regen-pdfs', duration: 5000 }
        );
      } else {
        toast.error('Failed to regenerate some PDFs', { id: 'regen-pdfs' });
      }

      onClose();
    } catch (error: any) {
      console.error('Error regenerating PDFs:', error);
      toast.error(error.message || 'Failed to regenerate invoice PDFs', { id: 'regen-pdfs' });
      onClose();
    } finally {
      setRegeneratingPdfs(false);
    }
  };

  const handleSkipPdfRegeneration = () => {
    setShowPdfRegenDialog(false);
    onClose();
  };

  if (!isOpen) return null;

  const profitPool = (parseFloat(formData.customerTotal) || 0) -
                     (parseFloat(formData.paperChargedTotal) || 0) -
                     (parseFloat(formData.jdTotal) || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-2xl font-bold text-gray-900">Edit Job: {job.jobNo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabbed Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="basic" className="h-full flex flex-col">
            <TabsList className="flex-shrink-0 px-6">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="dates">Dates & Timeline</TabsTrigger>
              <TabsTrigger value="vendor">Vendor & Routing</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto px-6">
              {/* TAB 1: BASIC INFO */}
              <TabsContent value="basic">
                <div className="space-y-6">
                  {/* Job Details */}
                  <section>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Job Title (Optional)</label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="e.g., Spring Promotion Mailers"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={3}
                          placeholder="Additional notes or details about this job"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee Who Placed Order</label>
                        <select
                          value={formData.employeeId}
                          onChange={(e) => handleInputChange('employeeId', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          disabled={loadingEmployees}
                        >
                          <option value="">None selected</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} {emp.isPrimary ? '(Primary)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* Product Specifications */}
                  <section>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Specifications</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                        <input
                          type="number"
                          value={formData.quantity}
                          onChange={(e) => handleInputChange('quantity', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Size Name</label>
                        <input
                          type="text"
                          value={formData.sizeName}
                          onChange={(e) => handleInputChange('sizeName', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="e.g., 8.5 x 11"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Paper Type</label>
                        <input
                          type="text"
                          value={formData.paperType}
                          onChange={(e) => handleInputChange('paperType', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="e.g., 100# Gloss Text"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Paper Weight (per 1000)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.paperWeightPer1000}
                          onChange={(e) => handleInputChange('paperWeightPer1000', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Paper Supply Options */}
                  <section>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Paper Supply Options</h3>
                    <div className="space-y-3">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.jdSuppliesPaper}
                          onChange={(e) => handleInputChange('jdSuppliesPaper', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          JD Supplies Paper (10/10 margin split, no Bradford markup)
                        </span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.bradfordWaivesPaperMargin}
                          onChange={(e) => handleBradfordWaiverChange(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Bradford Waives Paper Margin (50/50 split of total margin)
                        </span>
                      </label>
                    </div>
                  </section>

                  {/* Customer PO & Notes */}
                  <section>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer PO & Notes</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer PO Number</label>
                        <input
                          type="text"
                          value={formData.customerPONumber}
                          onChange={(e) => handleInputChange('customerPONumber', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="Customer's purchase order number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Packing Slip Notes</label>
                        <textarea
                          value={formData.packingSlipNotes}
                          onChange={(e) => handleInputChange('packingSlipNotes', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={3}
                          placeholder="Special instructions for packing and shipping"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              </TabsContent>

              {/* TAB 2: FINANCIAL */}
              <TabsContent value="financial">
                <div className="space-y-6">
                  {/* Pricing Rule Lookup */}
                  <section className="bg-blue-50 p-4 rounded-md">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Apply Pricing Rule</h3>
                    <div className="flex gap-4">
                      <select
                        value={selectedPricingRule}
                        onChange={(e) => setSelectedPricingRule(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white"
                      >
                        <option value="">Select a size...</option>
                        {pricingRules.map(rule => (
                          <option key={rule.id} value={rule.id}>
                            {rule.sizeName} - Print: ${rule.printCPM} CPM
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={applyPricingRule}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Apply Rule
                      </button>
                    </div>
                  </section>

                  {/* Cost Breakdown */}
                  <section>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer Total</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.customerTotal}
                          onChange={(e) => handleInputChange('customerTotal', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">JD Printing Total</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.jdTotal}
                          onChange={(e) => handleInputChange('jdTotal', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Paper Charged</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.paperChargedTotal}
                          onChange={(e) => handleInputChange('paperChargedTotal', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Paper Cost</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.paperCostTotal}
                          onChange={(e) => handleInputChange('paperCostTotal', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Profit Pool Display */}
                  <div className={`p-4 rounded-md ${profitPool < 0 ? 'bg-red-100 border border-red-300' : 'bg-green-100 border border-green-300'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${profitPool < 0 ? 'text-red-900' : 'text-green-900'}`}>Profit Pool (Customer - Paper - JD):</span>
                      <span className={`text-xl font-bold ${profitPool < 0 ? 'text-red-700' : 'text-green-700'}`}>
                        ${profitPool.toFixed(2)}
                      </span>
                    </div>
                    {profitPool < 0 && (
                      <p className="text-sm text-red-700 mt-2">⚠️ Negative profit! Customer total is less than costs.</p>
                    )}
                  </div>

                  {/* Margin Split (50/50) */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Margin Split (50/50)</h3>
                      <button
                        onClick={() => calculateMarginsFrom5050()}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Auto-Calculate
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Impact Margin (50%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.impactMargin}
                          onChange={(e) => handleInputChange('impactMargin', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bradford Margin (50%)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.bradfordTotalMargin}
                          onChange={(e) => handleInputChange('bradfordTotalMargin', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bradford Total (Margin + Paper + JD)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.bradfordTotal}
                          onChange={(e) => handleInputChange('bradfordTotal', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                          readOnly
                        />
                      </div>
                    </div>
                  </section>

                  {/* CPM Fields */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">CPM Rates (Per Thousand)</h3>
                      <button
                        onClick={calculateCPMs}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                      >
                        Calculate CPMs
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Print CPM</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.printCPM}
                          onChange={(e) => handleInputChange('printCPM', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Paper Charged CPM</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.paperChargedCPM}
                          onChange={(e) => handleInputChange('paperChargedCPM', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Paper Cost CPM</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.paperCostCPM}
                          onChange={(e) => handleInputChange('paperCostCPM', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              </TabsContent>

              {/* TAB 3: DATES & TIMELINE */}
              <TabsContent value="dates">
                <div className="space-y-6">
                  <section>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Important Dates</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                        <input
                          type="date"
                          value={formData.deliveryDate}
                          onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <p className="text-xs text-gray-500 mt-1">Date the job should be delivered to customer</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mail Date</label>
                        <input
                          type="date"
                          value={formData.mailDate}
                          onChange={(e) => handleInputChange('mailDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <p className="text-xs text-gray-500 mt-1">Date the materials will be mailed (if applicable)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">In-Homes Date</label>
                        <input
                          type="date"
                          value={formData.inHomesDate}
                          onChange={(e) => handleInputChange('inHomesDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <p className="text-xs text-gray-500 mt-1">Target date for materials to arrive at recipients</p>
                      </div>
                    </div>
                  </section>

                  {/* Date Timeline Visualization */}
                  <section className="bg-blue-50 p-4 rounded-md">
                    <h4 className="font-semibold text-gray-900 mb-3">Timeline Overview</h4>
                    <div className="space-y-2">
                      {formData.deliveryDate && (
                        <div className="flex items-center gap-2">
                          <span className="text-blue-600 font-medium">📦</span>
                          <span className="text-sm">Delivery: {new Date(formData.deliveryDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {formData.mailDate && (
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 font-medium">📮</span>
                          <span className="text-sm">Mail: {new Date(formData.mailDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {formData.inHomesDate && (
                        <div className="flex items-center gap-2">
                          <span className="text-purple-600 font-medium">🏠</span>
                          <span className="text-sm">In-Homes: {new Date(formData.inHomesDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {!formData.deliveryDate && !formData.mailDate && !formData.inHomesDate && (
                        <p className="text-sm text-gray-500 italic">No dates set yet</p>
                      )}
                    </div>
                  </section>
                </div>
              </TabsContent>

              {/* TAB 4: VENDOR & ROUTING */}
              <TabsContent value="vendor">
                <div className="space-y-6">
                  {/* Routing Type */}
                  <section>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Routing</h3>
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-md hover:bg-gray-50">
                        <input
                          type="radio"
                          name="routingType"
                          value="BRADFORD_JD"
                          checked={formData.routingType === 'BRADFORD_JD'}
                          onChange={(e) => handleInputChange('routingType', e.target.value)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <span className="font-medium text-gray-900">Bradford + JD Graphic</span>
                          <p className="text-sm text-gray-500">Standard routing through Bradford and JD</p>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer p-3 border rounded-md hover:bg-gray-50">
                        <input
                          type="radio"
                          name="routingType"
                          value="THIRD_PARTY_VENDOR"
                          checked={formData.routingType === 'THIRD_PARTY_VENDOR'}
                          onChange={(e) => handleInputChange('routingType', e.target.value)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div>
                          <span className="font-medium text-gray-900">Third-Party Vendor</span>
                          <p className="text-sm text-gray-500">Route to external vendor with Bradford cut</p>
                        </div>
                      </label>
                    </div>
                  </section>

                  {/* Vendor Section (Conditional) */}
                  {formData.routingType === 'THIRD_PARTY_VENDOR' && (
                    <>
                      <section>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                            <select
                              value={formData.vendorId}
                              onChange={(e) => handleInputChange('vendorId', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              disabled={loadingVendors}
                            >
                              <option value="">Select vendor...</option>
                              {vendors.map(vendor => (
                                <option key={vendor.id} value={vendor.id}>
                                  {vendor.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Amount</label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.vendorAmount}
                              onChange={(e) => handleInputChange('vendorAmount', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Bradford Cut</label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.bradfordCut}
                              onChange={(e) => handleInputChange('bradfordCut', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
                            <input
                              type="text"
                              value={formData.jobType}
                              onChange={(e) => handleInputChange('jobType', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              placeholder="e.g., Business Cards, Banners, etc."
                            />
                          </div>
                        </div>
                      </section>

                      <section>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Shipping Address</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ship To Name</label>
                            <input
                              type="text"
                              value={formData.vendorShipToName}
                              onChange={(e) => handleInputChange('vendorShipToName', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                            <input
                              type="text"
                              value={formData.vendorShipToAddress}
                              onChange={(e) => handleInputChange('vendorShipToAddress', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                            <input
                              type="text"
                              value={formData.vendorShipToCity}
                              onChange={(e) => handleInputChange('vendorShipToCity', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                            <input
                              type="text"
                              value={formData.vendorShipToState}
                              onChange={(e) => handleInputChange('vendorShipToState', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              placeholder="e.g., CA"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                            <input
                              type="text"
                              value={formData.vendorShipToZip}
                              onChange={(e) => handleInputChange('vendorShipToZip', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <input
                              type="tel"
                              value={formData.vendorShipToPhone}
                              onChange={(e) => handleInputChange('vendorShipToPhone', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                          </div>
                        </div>
                      </section>

                      <section>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Vendor Information</h3>
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                            <input
                              type="text"
                              value={formData.vendorPaymentTerms}
                              onChange={(e) => handleInputChange('vendorPaymentTerms', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              placeholder="e.g., Net 30, Due on receipt, etc."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                            <textarea
                              value={formData.vendorSpecialInstructions}
                              onChange={(e) => handleInputChange('vendorSpecialInstructions', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              rows={4}
                              placeholder="Any special handling, packaging, or shipping instructions for the vendor"
                            />
                          </div>
                        </div>
                      </section>
                    </>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-gray-50 border-t px-6 py-4 flex items-center justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* PDF Regeneration Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showPdfRegenDialog}
        onClose={handleSkipPdfRegeneration}
        onConfirm={handleRegeneratePdfs}
        title="Regenerate Invoice PDFs?"
        message="The job has been updated. Would you like to regenerate all invoice PDFs with the new information?"
        confirmText="Regenerate PDFs"
        cancelText="Skip"
        confirmButtonClass="bg-blue-600 hover:bg-blue-700"
        isLoading={regeneratingPdfs}
      />
    </div>
  );
}
