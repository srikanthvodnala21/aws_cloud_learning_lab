import type { LearningModule } from '../../types';
import { e, g, n, p, r } from '../../animation/builders';

export const s3: LearningModule = {
  id: 's3',
  num: 6,
  title: 'S3 – Simple Storage Service',
  short: 'S3',
  icon: 'folder',
  level: 'Beginner',
  minutes: 50,
  intro:
    'Amazon S3 stores objects (files plus metadata) in buckets and makes them available over HTTPS. It is designed for 99.999999999% (11 nines) durability by storing data redundantly across multiple AZs (except One Zone classes). You never provision capacity – you just put objects and pay for GB-months stored, requests and data transfer. S3 provides strong read-after-write consistency for all operations.',
  analogy: 'A bucket is a giant, infinitely large warehouse; each object is a box with a unique label (its key). There are no real shelves (folders) – the slashes in labels just make them look organised.',
  concepts: [
    { term: 'Buckets', body: 'Containers for objects. A bucket lives in one Region you choose, but its name must be globally unique (3–63 characters, lowercase letters, numbers, dots and hyphens). New buckets have Block Public Access enabled, ACLs disabled and default encryption (SSE-S3).' },
    { term: 'Objects', body: 'The data (any bytes) plus metadata (system metadata like Content-Type, and user metadata). Objects are immutable – "editing" uploads a whole new object. Large files use multipart upload.' },
    { term: 'Object keys', body: 'The unique name of an object within a bucket, e.g. reports/2026/q1.pdf. The "/" creates the folder illusion in the console; S3 has a flat namespace. Prefixes are used for organisation, lifecycle filters and performance.' },
    { term: 'Storage classes', body: 'Each object has a class that trades storage price against retrieval cost, latency and minimum storage duration. Choose by access pattern. See the comparison table in the simulator.' },
    { term: 'Versioning', body: 'Keeps every version of every object. Overwrites create a new version; a simple DELETE adds a delete marker (the object looks deleted but older versions remain and can be restored). A bucket is unversioned, versioning-enabled or versioning-suspended – once enabled it can never return to unversioned.' },
    { term: 'Lifecycle policies', body: 'Rules that automatically transition objects to cheaper classes after N days (e.g. Standard → Standard-IA at 30 days → Glacier Flexible Retrieval at 90) or expire them, including noncurrent versions and incomplete multipart uploads.' },
    { term: 'Replication', body: 'Same-Region (SRR) and Cross-Region Replication (CRR) asynchronously copy new objects to another bucket – for compliance, latency or DR. Requires versioning on both buckets.' },
    { term: 'Encryption', body: 'In transit with TLS (HTTPS). At rest with SSE-S3 (default, S3-managed keys), SSE-KMS (KMS keys, auditable and controllable), DSSE-KMS (dual-layer) or SSE-C (customer-provided keys), or client-side encryption.' },
    { term: 'Bucket policies', body: 'Resource-based JSON policies attached to the bucket. Used to grant cross-account access, enforce HTTPS (aws:SecureTransport), require encryption or restrict access to a VPC endpoint or CloudFront distribution.' },
    { term: 'Access control', body: 'Access is the combination of IAM policies, bucket policies, (legacy) ACLs and Block Public Access settings. Block Public Access overrides any policy that would make data public – keep it on unless you are intentionally hosting public content.' },
    { term: 'Pre-signed URLs', body: 'A URL signed with the credentials of someone who has access, granting temporary access to a specific object operation (GET or PUT) until it expires. Lets users download or upload without AWS credentials.' },
    { term: 'Static website hosting', body: 'S3 can serve static sites (HTML/CSS/JS) via a website endpoint (HTTP only). The recommended pattern is CloudFront in front of a private bucket using Origin Access Control (OAC) for HTTPS, caching and custom domains.' },
  ],
  animations: [
    {
      id: 'm6-put',
      title: 'PUT an object – stored redundantly across AZs',
      width: 820,
      height: 360,
      groups: [g('reg', 'Region eu-west-1 – bucket "company-reports"', 250, 30, 550, 300, 'region'), g('a', 'AZ a', 470, 60, 100, 250, 'az'), g('b', 'AZ b', 580, 60, 100, 250, 'az'), g('c', 'AZ c', 690, 60, 100, 250, 'az')],
      nodes: [
        n('client', 'Client app', 90, 180, 'user', 'SDK / CLI'),
        n('api', 'S3 endpoint', 340, 180, 'storage', 'HTTPS API', { w: 110 }),
        n('sa', 'Storage', 520, 180, 'storage', '', { w: 84 }),
        n('sb', 'Storage', 630, 180, 'storage', '', { w: 84 }),
        n('sc', 'Storage', 740, 180, 'storage', '', { w: 84 }),
      ],
      edges: [e('c-a', 'client', 'api', { label: 'PUT q1.pdf' }), e('a-1', 'api', 'sa'), e('a-2', 'api', 'sb', { curve: -35 }), e('a-3', 'api', 'sc', { curve: -60 })],
      steps: [
        { title: 'PUT request over HTTPS', text: 'The client sends PUT /reports/2026/q1.pdf with an IAM-signed request. IAM and the bucket policy are evaluated.', packets: [p('c-a', 'blue', 'PUT')] },
        { title: 'Encrypted and stored across AZs', text: 'S3 encrypts the object (SSE-S3 by default) and stores it redundantly on multiple devices across at least three AZs (for Standard).', packets: [p('a-1', 'teal'), p('a-2', 'teal', undefined, { at: 0.1 }), p('a-3', 'teal', undefined, { at: 0.2 })] },
        { title: '200 OK only after durable storage', text: 'Only once the data is durably stored does S3 return 200 OK with an ETag (and a VersionId if versioning is on).', packets: [r('c-a', 'green', '200 OK · ETag')] },
        { title: 'Strong consistency', text: 'An immediate GET or LIST anywhere returns the new object – S3 has strong read-after-write consistency.', packets: [p('c-a', 'blue', 'GET', { span: 0.35 }), r('c-a', 'green', 'q1.pdf', { at: 0.4, span: 0.35 })] },
        { title: 'Survives an AZ loss', text: 'Even if a whole AZ becomes unavailable, the object remains available from the others.', set: { a: 'fail', sa: 'fail' }, packets: [p('a-2', 'green', 'read', { reverse: true })] },
      ],
    },
    {
      id: 'm6-versioning',
      title: 'Versioning: overwrite and delete',
      width: 820,
      height: 340,
      groups: [g('obj', 'Key: config.json (versioning enabled)', 280, 40, 520, 270, 'generic')],
      nodes: [
        n('user', 'User', 90, 170, 'user'),
        n('v1', 'Version 1', 380, 230, 'storage', 'id: 3HL4k…', { icon: 'file', w: 110 }),
        n('v2', 'Version 2', 520, 230, 'storage', 'id: 9Ab2X…', { icon: 'file', w: 110 }),
        n('dm', 'Delete marker', 660, 230, 'security', 'id: uP0q…', { icon: 'file', w: 120 }),
        n('cur', 'Current version', 540, 100, 'storage', 'what GET returns', { icon: 'eye', w: 140 }),
      ],
      edges: [e('u-v1', 'user', 'v1'), e('u-v2', 'user', 'v2', { curve: 40 }), e('u-dm', 'user', 'dm', { curve: 70 }), e('c-v', 'cur', 'v1', { dashed: true }), e('c-v2', 'cur', 'v2', { dashed: true }), e('c-dm', 'cur', 'dm', { dashed: true })],
      initial: { v2: 'hidden', dm: 'hidden', 'c-v2': 'hidden', 'c-dm': 'hidden' },
      steps: [
        { title: 'First upload', text: 'PUT config.json creates version 1. It is the current version.', packets: [p('u-v1', 'blue', 'PUT')], focus: ['v1'] },
        { title: 'Overwrite', text: 'Another PUT to the same key creates version 2. Version 1 is kept as a noncurrent version (still billed).', set: { v2: 'new', 'c-v2': 'ok', 'c-v': 'off' }, packets: [p('u-v2', 'blue', 'PUT')] },
        { title: 'Delete without a version ID', text: 'A DELETE inserts a delete marker. GET now returns 404 – but nothing was really removed.', set: { dm: 'new', 'c-dm': 'ok', 'c-v2': 'off', v2: 'ok' }, packets: [p('u-dm', 'red', 'DELETE')] },
        { title: 'Restore', text: 'Deleting the delete marker (DELETE with its versionId) makes version 2 current again. To permanently delete a version, DELETE with that version’s ID.', set: { dm: 'hidden', 'c-dm': 'hidden', 'c-v2': 'ok' }, focus: ['v2'], log: 'DeleteObject versionId=uP0q… (delete marker removed)' },
      ],
    },
    {
      id: 'm6-lifecycle',
      title: 'Lifecycle: an object moves to cheaper storage over time',
      description: 'Rule: Standard → Standard-IA (30 days) → Glacier Flexible Retrieval (90) → Deep Archive (180) → expire (2555)',
      width: 840,
      height: 300,
      nodes: [
        n('std', 'S3 Standard', 80, 150, 'storage', 'day 0', { w: 120 }),
        n('ia', 'Standard-IA', 250, 150, 'storage', 'day 30', { w: 120 }),
        n('gfr', 'Glacier Flexible', 430, 150, 'storage', 'day 90', { w: 130 }),
        n('gda', 'Glacier Deep Archive', 620, 150, 'storage', 'day 180', { w: 150 }),
        n('exp', 'Expired', 770, 260, 'security', '~7 years', { w: 100 }),
      ],
      edges: [e('1', 'std', 'ia'), e('2', 'ia', 'gfr'), e('3', 'gfr', 'gda'), e('4', 'gda', 'exp', { dashed: true })],
      steps: [
        { title: 'Day 0 – frequently accessed', text: 'New invoices are read often. Standard has no retrieval fee and millisecond access.', focus: ['std'], badges: { std: 'object here' } },
        { title: 'Day 30 – infrequent access', text: 'Access drops. Standard-IA has lower storage cost but a per-GB retrieval fee and a 30-day minimum storage duration (and objects need ≥ 30 days in Standard before this transition).', packets: [p('1', 'orange', 'transition')], badges: { ia: 'object here' } },
        { title: 'Day 90 – archive', text: 'Glacier Flexible Retrieval: very low storage cost. Objects must be restored before reading (minutes to hours). 90-day minimum.', packets: [p('2', 'orange', 'transition')], badges: { gfr: 'object here' } },
        { title: 'Day 180 – deep archive', text: 'Lowest cost storage in AWS, for data you may never read. Restores take up to 12 hours (standard) or 48 hours (bulk). 180-day minimum.', packets: [p('3', 'orange', 'transition')], badges: { gda: 'object here' } },
        { title: 'Retention period ends', text: 'An expiration action deletes the object after the legal retention period, so you stop paying for it.', packets: [p('4', 'red', 'expire')], set: { exp: 'fail' } },
      ],
    },
    {
      id: 'm6-presign',
      title: 'Pre-signed URL: temporary access without credentials',
      width: 820,
      height: 320,
      nodes: [
        n('browser', 'User browser', 90, 160, 'user', 'no AWS creds'),
        n('app', 'Your backend', 330, 70, 'compute', 'has IAM role'),
        n('s3', 'S3 bucket', 650, 160, 'storage', 'private'),
      ],
      edges: [e('b-a', 'browser', 'app'), e('b-s', 'browser', 's3', { label: 'GET with signature' }), e('a-s', 'app', 's3', { dashed: true, label: 'no network call needed' })],
      steps: [
        { title: 'User requests a download', text: 'The user is logged into your app and wants invoice-42.pdf from a private bucket.', packets: [p('b-a', 'blue', 'GET /invoice/42')] },
        { title: 'Backend signs a URL', text: 'Your backend uses its own credentials to compute a signature locally (SDK presign). Expiry: e.g. 5 minutes.', focus: ['app'], badges: { app: 'X-Amz-Expires=300' } },
        { title: 'URL returned', text: 'The browser receives https://bucket.s3.amazonaws.com/invoice-42.pdf?X-Amz-Signature=…', packets: [r('b-a', 'green', 'signed URL')] },
        { title: 'Direct download from S3', text: 'S3 validates the signature and expiry and checks the signer still has permission. The file streams directly from S3 – your server does no heavy lifting.', packets: [p('b-s', 'blue', 'GET', { span: 0.35 }), r('b-s', 'green', 'PDF', { at: 0.4, span: 0.4 })] },
        { title: 'After expiry', text: 'The same URL now returns 403 AccessDenied (Request has expired).', packets: [p('b-s', 'red', 'GET', { dropAt: 0.85 })] },
      ],
    },
  ],
  experiment: 's3-simulator',
  experimentTitle: 'S3 bucket simulator',
  experimentBlurb: 'Create a bucket, upload files, enable versioning, delete and restore objects, change storage classes and fast-forward time to watch a lifecycle rule.',
  code: [
    {
      title: 'Bucket policy: deny any request that is not HTTPS',
      lang: 'json',
      code: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::company-reports",
        "arn:aws:s3:::company-reports/*"
      ],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    }
  ]
}`,
    },
    {
      title: 'Lifecycle configuration',
      lang: 'json',
      code: `{
  "Rules": [
    {
      "ID": "archive-invoices",
      "Filter": { "Prefix": "invoices/" },
      "Status": "Enabled",
      "Transitions": [
        { "Days": 30,  "StorageClass": "STANDARD_IA" },
        { "Days": 90,  "StorageClass": "GLACIER" },
        { "Days": 180, "StorageClass": "DEEP_ARCHIVE" }
      ],
      "Expiration": { "Days": 2555 },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 30 }
    }
  ]
}`,
    },
  ],
  realWorld: {
    title: 'Photo-sharing app storage',
    story: 'Users upload photos straight to S3 using pre-signed PUT URLs, so uploads never pass through app servers. An S3 event triggers Lambda to create thumbnails. Originals move to Standard-IA after 30 days and to Glacier Instant Retrieval after 180 days, because old photos are rarely viewed but must load instantly when they are.',
    points: ['Pre-signed URLs offload upload traffic', 'Event notifications drive processing', 'Lifecycle rules cut storage cost without code'],
  },
  limits: ['Bucket names are globally unique and cannot be renamed.', 'Single PUT uploads are limited to 5 GB; use multipart upload for larger objects (recommended above ~100 MB).', 'Minimum storage duration and minimum billable object size (128 KB) apply to IA and some Glacier classes.'],
  summary: ['Buckets are Regional with globally unique names; objects are addressed by key.', 'Storage classes trade storage price for retrieval cost and speed.', 'Versioning protects against overwrites and deletes; lifecycle rules automate cost savings.', 'Block Public Access is on by default; use bucket policies, IAM and pre-signed URLs to grant access.', 'For public websites use CloudFront + OAC in front of a private bucket.'],
  related: ['s3', 's3-glacier', 'efs', 'ebs', 'cloudfront', 'kms'],
  quiz: [
    { q: 'An object was deleted from a versioning-enabled bucket with a normal DELETE. How do you recover it?', options: ['It is gone forever', 'Delete the delete marker', 'Restore from Glacier', 'Contact AWS Support'], answer: 1, explain: 'A DELETE without a version ID creates a delete marker. Removing the marker makes the previous version current again.' },
    { q: 'Which storage class stores data in a single AZ?', options: ['S3 Standard', 'S3 Standard-IA', 'S3 One Zone-IA', 'S3 Glacier Deep Archive'], answer: 2, explain: 'One Zone-IA stores data in one AZ, so it is cheaper but data can be lost if that AZ is destroyed.' },
    { q: 'Access patterns are unknown and change over time. Which class automatically optimises cost?', options: ['S3 Intelligent-Tiering', 'S3 Standard-IA', 'Glacier Flexible Retrieval', 'Reduced Redundancy'], answer: 0, explain: 'Intelligent-Tiering moves objects between access tiers automatically for a small monitoring fee, with no retrieval fees.' },
    { q: 'You want users to download one private file for 10 minutes without giving them AWS credentials. Use…', options: ['A public bucket', 'A pre-signed URL', 'An IAM user per customer', 'A NAT Gateway'], answer: 1, explain: 'Pre-signed URLs grant time-limited access to a specific object operation.' },
    { q: 'Once versioning is enabled on a bucket, what can you do?', options: ['Disable it to return to unversioned', 'Suspend it', 'Nothing – it is permanent and cannot be changed', 'Convert the bucket to EFS'], answer: 1, explain: 'You can suspend versioning, but the bucket can never return to the unversioned state.' },
    { q: 'Which is the recommended way to serve a static website over HTTPS with a custom domain?', options: ['S3 website endpoint alone', 'CloudFront with Origin Access Control in front of a private bucket', 'An EC2 instance with a public IP', 'Make every object public'], answer: 1, explain: 'S3 website endpoints are HTTP only. CloudFront adds HTTPS, caching and keeps the bucket private using OAC.' },
  ],
  docs: [
    { label: 'Amazon S3 User Guide', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html' },
    { label: 'S3 storage classes', url: 'https://aws.amazon.com/s3/storage-classes/' },
    { label: 'Lifecycle transition constraints', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html' },
  ],
};
