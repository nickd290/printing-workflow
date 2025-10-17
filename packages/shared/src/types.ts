import { z } from 'zod';
import {
  quoteRequestSpecsSchema,
  quoteLineSchema,
  createQuoteRequestSchema,
  createJobSchema,
  uploadProofSchema,
  approveProofSchema,
  requestProofChangesSchema,
  scheduleShipmentSchema,
  parseTextRequestSchema,
  bradfordWebhookSchema,
} from './schemas';

// Infer types from schemas
export type QuoteRequestSpecs = z.infer<typeof quoteRequestSpecsSchema>;
export type QuoteLine = z.infer<typeof quoteLineSchema>;
export type CreateQuoteRequest = z.infer<typeof createQuoteRequestSchema>;
export type CreateJob = z.infer<typeof createJobSchema>;
export type UploadProof = z.infer<typeof uploadProofSchema>;
export type ApproveProof = z.infer<typeof approveProofSchema>;
export type RequestProofChanges = z.infer<typeof requestProofChangesSchema>;
export type ScheduleShipment = z.infer<typeof scheduleShipmentSchema>;
export type ParseTextRequest = z.infer<typeof parseTextRequestSchema>;
export type BradfordWebhook = z.infer<typeof bradfordWebhookSchema>;
