# AWS S3 File Storage Setup

## Why S3 Storage?

**Current (No Storage):**
- ❌ Files lost on server restart
- ❌ Can't scale to multiple servers
- ❌ No backup or redundancy
- ❌ Limited by server disk space

**With S3:**
- ✅ 99.999999999% durability (11 nines)
- ✅ Unlimited storage capacity
- ✅ CDN integration for fast global delivery
- ✅ Versioning and backup built-in
- ✅ Works with any S3-compatible provider

---

## Quick Start Options

### Option 1: AWS S3 (Recommended for Production)

#### Step 1: Create S3 Bucket

1. Go to https://s3.console.aws.amazon.com/
2. Click "Create bucket"
3. Bucket name: `printing-workflow-files` (must be globally unique)
4. Region: `us-east-1` (or closest to you)
5. **Block Public Access:** Keep enabled (we'll use signed URLs)
6. Click "Create bucket"

#### Step 2: Create IAM User

1. Go to https://console.aws.amazon.com/iam/
2. Users → Add users
3. User name: `printing-workflow-s3`
4. Access type: **Programmatic access** (API keys)
5. Attach policy: `AmazonS3FullAccess` (or create custom policy below)
6. **Save Access Key ID and Secret Access Key**

Custom Policy (Recommended - Least Privilege):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::printing-workflow-files/*",
        "arn:aws:s3:::printing-workflow-files"
      ]
    }
  ]
}
```

#### Step 3: Update .env

```bash
S3_ENDPOINT=""  # Leave empty for AWS S3
S3_REGION="us-east-1"
S3_BUCKET="printing-workflow-files"
S3_ACCESS_KEY_ID="AKIA..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_URL=""  # Leave empty for AWS
```

---

### Option 2: Digital Ocean Spaces (Cheaper Alternative)

#### Step 1: Create Space

1. Go to https://cloud.digitalocean.com/spaces
2. Click "Create a Space"
3. Region: New York 3 (or closest)
4. Name: `printing-workflow-files`
5. Enable CDN (recommended)

#### Step 2: Generate API Keys

1. Go to API → Spaces Keys
2. Click "Generate New Key"
3. Name: `Printing Workflow`
4. **Save Access Key and Secret Key**

#### Step 3: Update .env

```bash
S3_ENDPOINT="https://nyc3.digitaloceanspaces.com"
S3_REGION="us-east-1"  # DO Spaces uses this
S3_BUCKET="printing-workflow-files"
S3_ACCESS_KEY_ID="DO00..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_URL="https://printing-workflow-files.nyc3.digitaloceanspaces.com"
```

---

### Option 3: MinIO (Local Development)

#### Step 1: Start MinIO

```bash
cd /Users/nicholasdeblasio/printing-workflow

# Start MinIO via Docker
docker compose up -d minio minio-setup

# Verify MinIO is running
docker ps | grep minio

# Open MinIO Console
open http://localhost:9001
# Login: minioadmin / minioadmin
```

#### Step 2: Update .env

```bash
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_BUCKET="printing-files"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
S3_PUBLIC_URL="http://localhost:9000"
```

---

## Testing Storage

### Test File Upload

```typescript
// apps/api/src/test-storage.ts
import { uploadFile } from './lib/storage.js';
import fs from 'fs';

async function testUpload() {
  const buffer = Buffer.from('Hello, S3!', 'utf-8');

  const result = await uploadFile({
    buffer,
    fileName: 'test.txt',
    mimeType: 'text/plain',
    prefix: 'proofs',
  });

  console.log('✅ Upload successful:');
  console.log('  Object Key:', result.objectKey);
  console.log('  URL:', result.url);
  console.log('  Size:', result.size);
  console.log('  Checksum:', result.checksum);
}

testUpload();
```

Run it:
```bash
cd apps/api
npx tsx src/test-storage.ts
```

### Test Signed URLs

```typescript
import { getSignedDownloadUrl } from './lib/storage.js';

const signedUrl = await getSignedDownloadUrl('proofs/1234-test.pdf');
console.log('Signed URL (expires in 24h):', signedUrl);
```

---

## Integration with File Upload Endpoints

### Update File Upload Route

```typescript
// apps/api/src/routes/files.ts
import { uploadFile } from '../lib/storage.js';
import { prisma, FileKind } from '@printing-workflow/db';

fastify.post('/upload', async (request, reply) => {
  const data = await request.file();

  if (!data) {
    return reply.code(400).send({ error: 'No file provided' });
  }

  // Get file buffer
  const buffer = await data.toBuffer();

  // Upload to S3
  const { objectKey, url, size, checksum } = await uploadFile({
    buffer,
    fileName: data.filename,
    mimeType: data.mimetype,
    prefix: 'artwork',
  });

  // Save to database
  const file = await prisma.file.create({
    data: {
      kind: FileKind.ARTWORK,
      objectKey,
      fileName: data.filename,
      mimeType: data.mimetype,
      size,
      checksum,
    },
  });

  return { file, url };
});
```

---

## Cost Comparison

| Provider | Storage | Data Transfer | Price/Month (50GB + 100GB transfer) |
|----------|---------|---------------|--------------------------------------|
| **AWS S3** | $0.023/GB | $0.09/GB | $10.65 |
| **Digital Ocean** | $5 flat | 250GB free | $5.00 |
| **Backblaze B2** | $0.005/GB | $0.01/GB (free egress to Cloudflare) | $1.25 |
| **MinIO (self-hosted)** | Server cost | Free | $20+ (server) |

**Recommendation:** DigitalOcean Spaces ($5/month flat rate with CDN)

---

## Security Best Practices

### 1. Use Signed URLs (Not Public Files)

```typescript
// ❌ BAD: Public file URL
const url = file.url;

// ✅ GOOD: Signed URL (expires in 24h)
const signedUrl = await getSignedDownloadUrl(file.objectKey, 86400);
```

### 2. Verify File Integrity

```typescript
import { verifyFileIntegrity } from './lib/storage.js';

const isValid = await verifyFileIntegrity(file.objectKey, file.checksum);
if (!isValid) {
  throw new Error('File corrupted!');
}
```

### 3. Implement File Size Limits

```typescript
// In apps/api/src/index.ts
await fastify.register(multipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});
```

### 4. Validate File Types

```typescript
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
];

if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
  return reply.code(400).send({ error: 'Invalid file type' });
}
```

---

## CDN Integration (Optional)

### AWS CloudFront

1. Create CloudFront distribution
2. Origin: Your S3 bucket
3. Update `S3_PUBLIC_URL` in .env:
   ```
   S3_PUBLIC_URL="https://d1234abcd.cloudfront.net"
   ```

Benefits:
- Global edge caching
- Faster proof loading worldwide
- Reduced S3 costs (fewer requests)

---

## Backup Strategy

### AWS S3 Versioning

```bash
aws s3api put-bucket-versioning \
  --bucket printing-workflow-files \
  --versioning-configuration Status=Enabled
```

Now all file uploads keep previous versions.

### Replication (Disaster Recovery)

1. Create second S3 bucket in different region
2. Enable cross-region replication
3. Configure lifecycle policy

---

## Monitoring

### S3 Metrics (AWS Console)

- Storage size
- Number of objects
- Request count
- Data transfer

### Application Metrics

```typescript
// Log file upload success/failure
console.log('📤 File upload stats:', {
  size: result.size,
  type: mimeType,
  objectKey: result.objectKey,
  duration: Date.now() - startTime,
});
```

---

## Troubleshooting

### "Access Denied"

- Check IAM policy allows s3:PutObject
- Verify bucket name matches
- Ensure AWS credentials are correct

### "Bucket not found"

- Check bucket exists in correct region
- Verify S3_BUCKET environment variable
- Ensure bucket name is globally unique

### "Connection timeout"

- Check S3_ENDPOINT is correct
- For MinIO, ensure Docker is running
- Check firewall/security groups

---

## Migration Plan

### Step 1: Set up S3

Choose provider and configure .env

### Step 2: Update Upload Code

Replace local filesystem with `uploadFile()`

### Step 3: Migrate Existing Files

```typescript
// One-time migration script
import fs from 'fs';
import { uploadFile } from './lib/storage.js';
import { prisma } from '@printing-workflow/db';

const localFiles = fs.readdirSync('/path/to/uploads');

for (const fileName of localFiles) {
  const buffer = fs.readFileSync(`/path/to/uploads/${fileName}`);
  const result = await uploadFile({
    buffer,
    fileName,
    mimeType: 'application/pdf',
    prefix: 'proofs',
  });

  // Update database with new objectKey
  await prisma.file.updateMany({
    where: { fileName },
    data: { objectKey: result.objectKey },
  });
}
```

### Step 4: Verify

- Test proof uploads
- Test invoice generation
- Check signed URLs work

### Step 5: Cleanup

Delete local files after confirming S3 migration

---

## Next Steps

1. ✅ Choose S3 provider
2. ✅ Configure .env variables
3. ✅ Test file upload
4. 🔄 Update file routes to use S3
5. 🚀 Deploy to production

---

## Support

- AWS S3 Docs: https://docs.aws.amazon.com/s3/
- DigitalOcean Spaces: https://docs.digitalocean.com/products/spaces/
- MinIO Docs: https://min.io/docs/
