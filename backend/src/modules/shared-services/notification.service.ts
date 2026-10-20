import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AlertPayload {
  type: 'PROCESSING_FAILED' | 'NEEDS_REVIEW' | 'JOB_COMPLETED' | 'JOB_RETRIED';
  jobId: string;
  documentId: string;
  tenantId: string;
  message: string;
  timestamp: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

export interface DispatchedAlert extends AlertPayload {
  dispatchedAt: string;
  status: 'DELIVERED' | 'MOCK_RECORDED' | 'FAILED_FALLBACK';
  attemptCount: number;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly sentIdempotencyKeys = new Set<string>();
  private readonly alertHistory: DispatchedAlert[] = [];
  private readonly notificationServiceUrl?: string;
  private readonly notificationApiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.notificationServiceUrl = this.configService.get<string>('NOTIFICATION_SERVICE_URL');
    this.notificationApiKey = this.configService.get<string>('NOTIFICATION_SERVICE_API_KEY');
  }

  async sendAlert(payload: AlertPayload): Promise<{ success: boolean; duplicateIgnored?: boolean; status: string }> {
    // Prevent duplicate alerts via idempotency key
    if (this.sentIdempotencyKeys.has(payload.idempotencyKey)) {
      this.logger.debug(
        `[Idempotency] Alert already dispatched for key: ${payload.idempotencyKey}. Skipping duplicate.`,
      );
      return { success: true, duplicateIgnored: true, status: 'DUPLICATE_IGNORED' };
    }

    this.sentIdempotencyKeys.add(payload.idempotencyKey);

    if (!this.notificationServiceUrl) {
      // Local / Mock mode
      this.logger.log(
        `[Notification:Mock] [${payload.type}] Tenant: ${payload.tenantId} | Job: ${payload.jobId} - ${payload.message}`,
      );
      this.alertHistory.push({
        ...payload,
        dispatchedAt: new Date().toISOString(),
        status: 'MOCK_RECORDED',
        attemptCount: 1,
      });
      return { success: true, status: 'MOCK_RECORDED' };
    }

    // External service dispatch with bounded timeout and retry budget
    let attempts = 0;
    const maxAttempts = 2;
    const timeoutMs = 3000;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(this.notificationServiceUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': payload.idempotencyKey,
            ...(this.notificationApiKey ? { Authorization: `Bearer ${this.notificationApiKey}` } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok) {
          this.alertHistory.push({
            ...payload,
            dispatchedAt: new Date().toISOString(),
            status: 'DELIVERED',
            attemptCount: attempts,
          });
          return { success: true, status: 'DELIVERED' };
        }

        this.logger.warn(
          `Notification service responded with status ${response.status} (attempt ${attempts}/${maxAttempts})`,
        );

        if (response.status === 401 || response.status === 403) {
          // Authentication failure: do not retry
          break;
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to contact notification service: ${err?.message || err} (attempt ${attempts}/${maxAttempts})`,
        );
      }
    }

    // Graceful fallback: record failure without breaking document pipeline
    this.alertHistory.push({
      ...payload,
      dispatchedAt: new Date().toISOString(),
      status: 'FAILED_FALLBACK',
      attemptCount: attempts,
    });
    return { success: false, status: 'FAILED_FALLBACK' };
  }

  getAlertHistory(tenantId?: string): DispatchedAlert[] {
    if (tenantId) {
      return this.alertHistory.filter((a) => a.tenantId === tenantId);
    }
    return this.alertHistory;
  }
}
