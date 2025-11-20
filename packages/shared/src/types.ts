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
  flatPieceSpecsSchema,
  foldedPieceSpecsSchema,
  bookletSelfCoverSpecsSchema,
  bookletPlusCoverSpecsSchema,
  legacyJobSpecsSchema,
  jobSpecsSchema,
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

// Job Type-Specific Specs Types
export type FlatPieceSpecs = z.infer<typeof flatPieceSpecsSchema>;
export type FoldedPieceSpecs = z.infer<typeof foldedPieceSpecsSchema>;
export type BookletSelfCoverSpecs = z.infer<typeof bookletSelfCoverSpecsSchema>;
export type BookletPlusCoverSpecs = z.infer<typeof bookletPlusCoverSpecsSchema>;
export type LegacyJobSpecs = z.infer<typeof legacyJobSpecsSchema>;
export type JobSpecs = z.infer<typeof jobSpecsSchema>;
