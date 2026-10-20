import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService, AlertPayload } from './notification.service';

describe('NotificationService Resiliency & Idempotency', () => {
  let service: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'NOTIFICATION_SERVICE_URL') return 'https://mock-notification.internal/api/v1/alerts';
              if (key === 'NOTIFICATION_SERVICE_API_KEY') return 'mock-key';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should ignore duplicate alert dispatches with the same idempotencyKey', async () => {
    const mockFetch = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const payload: AlertPayload = {
      type: 'JOB_COMPLETED',
      jobId: 'job-idem-1',
      documentId: 'doc-1',
      tenantId: 'tenant-1',
      message: 'Extraction done',
      timestamp: new Date().toISOString(),
      idempotencyKey: 'idemp-key-unique-123',
    };

    // First call
    const res1 = await service.sendAlert(payload);
    expect(res1.success).toBe(true);
    expect(res1.status).toBe('DELIVERED');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call with identical idempotencyKey
    const res2 = await service.sendAlert(payload);
    expect(res2.success).toBe(true);
    expect(res2.duplicateIgnored).toBe(true);
    expect(res2.status).toBe('DUPLICATE_IGNORED');
    // fetch should NOT have been called again!
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should not retry indefinitely on 401/403 auth errors', async () => {
    const mockFetch = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 401,
    } as any);

    const payload: AlertPayload = {
      type: 'PROCESSING_FAILED',
      jobId: 'job-auth-fail',
      documentId: 'doc-2',
      tenantId: 'tenant-1',
      message: 'Failed',
      timestamp: new Date().toISOString(),
      idempotencyKey: 'idemp-auth-401',
    };

    const res = await service.sendAlert(payload);
    expect(res.success).toBe(false);
    expect(res.status).toBe('FAILED_FALLBACK');
    // Only 1 attempt because 401 aborts retry immediately
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should gracefully handle 5xx server errors within retry budget without throwing uncaught exceptions', async () => {
    const mockFetch = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: false,
      status: 503,
    } as any);

    const payload: AlertPayload = {
      type: 'NEEDS_REVIEW',
      jobId: 'job-503-fail',
      documentId: 'doc-3',
      tenantId: 'tenant-1',
      message: 'Needs review',
      timestamp: new Date().toISOString(),
      idempotencyKey: 'idemp-503',
    };

    const res = await service.sendAlert(payload);
    expect(res.success).toBe(false);
    expect(res.status).toBe('FAILED_FALLBACK');
    // Retried up to maxAttempts (2)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
