import type { LearningModule } from '../../types';
import { e, g, n, p, r } from '../../animation/builders';

export const S3_READ_ONLY_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3ReadOnly",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::company-reports",
        "arn:aws:s3:::company-reports/*"
      ]
    }
  ]
}`;

export const iam: LearningModule = {
  id: 'iam',
  num: 3,
  title: 'IAM – Identity and Access Management',
  short: 'IAM',
  icon: 'key',
  level: 'Beginner',
  minutes: 45,
  intro:
    'IAM decides two things for every AWS API call: who are you (authentication) and are you allowed to do this (authorization). Every console click, CLI command and SDK call is an API request that IAM evaluates against policies – JSON documents that allow or deny actions on resources. IAM is a global service and is offered at no additional charge.',
  analogy: 'IAM is the building’s security desk. Your badge proves who you are (authentication); the access list decides which doors your badge opens (authorization). Doors are locked by default.',
  concepts: [
    { term: 'Root user', body: 'The identity created with the AWS account, with unrestricted access. Protect it with MFA, do not create access keys for it, and use it only for the few tasks that require it.' },
    { term: 'IAM users', body: 'A long-term identity for a person or application with a password (console) and/or access keys (API). AWS now recommends that humans use federation via IAM Identity Center with temporary credentials instead of individual IAM users.' },
    { term: 'IAM groups', body: 'A collection of users. Policies attached to a group apply to every member (e.g. a Developers group). Groups cannot be nested and are not principals – you cannot sign in as a group.' },
    { term: 'IAM roles', body: 'An identity with permissions but no long-term credentials. Trusted entities (an EC2 instance, a Lambda function, a user in another account, a federated user) assume the role and receive temporary credentials. Roles are the preferred way to grant AWS services and cross-account access.' },
    { term: 'IAM policies', body: 'JSON documents with Statements. Each Statement has an Effect (Allow/Deny), Action (e.g. s3:GetObject), Resource (an ARN) and optional Condition. Identity-based policies attach to users, groups and roles; resource-based policies (e.g. an S3 bucket policy) attach to a resource and include a Principal.' },
    { term: 'Managed vs inline policies', body: 'Managed policies are standalone and reusable: AWS managed (maintained by AWS, e.g. AmazonS3ReadOnlyAccess) or customer managed (you maintain them, with versioning). Inline policies are embedded in one identity and deleted with it – use them only for a strict one-to-one relationship.' },
    { term: 'Least privilege', body: 'Grant only the permissions required to perform a task, on only the resources needed. Start narrow, use IAM Access Analyzer to generate policies from activity, and remove unused permissions.' },
    { term: 'Authentication vs authorization', body: 'Authentication verifies identity (password + MFA, access key signature, federated token). Authorization evaluates policies to decide whether the authenticated principal may perform the action on the resource.' },
    { term: 'MFA', body: 'Multi-factor authentication adds a second factor (authenticator app, hardware key / passkey). Policies can require MFA with the condition key aws:MultiFactorAuthPresent.' },
    { term: 'Access keys', body: 'An access key ID + secret access key used to sign API requests for an IAM user. They are long-term credentials: never commit them to Git, rotate them, and prefer roles or Identity Center whenever possible.' },
    { term: 'AssumeRole', body: 'An AWS STS API. A principal allowed by the role’s trust policy calls sts:AssumeRole and receives temporary credentials (access key, secret key, session token) with the role’s permissions.' },
    { term: 'Temporary credentials', body: 'Credentials issued by STS that expire automatically (from 15 minutes up to the role’s maximum session duration, default 1 hour, max 12 hours). EC2 instance profiles and Lambda execution roles deliver them to your code automatically.' },
    { term: 'Policy evaluation logic', body: 'By default every request is implicitly denied. An explicit Deny in any applicable policy always wins. Otherwise the request is allowed only if an applicable policy explicitly allows it (and no SCP, permissions boundary or session policy restricts it).', facts: ['Explicit Deny > Allow > Implicit Deny', 'SCPs and permissions boundaries set maximum permissions; they never grant'] },
  ],
  animations: [
    {
      id: 'm3-authz',
      title: 'How IAM evaluates a request',
      description: 'Developer (S3 read-only) attempts s3:PutObject.',
      width: 820,
      height: 380,
      groups: [g('iam', 'IAM policy evaluation engine', 210, 30, 420, 320, 'generic')],
      nodes: [
        n('dev', 'Developer', 80, 190, 'user', 'IAM user'),
        n('authn', '1. Authenticate', 320, 80, 'security', 'SigV4 signature', { icon: 'key' }),
        n('ctx', '2. Request context', 520, 80, 'security', 'action, resource, conditions', { icon: 'list', w: 150 }),
        n('deny', '3. Explicit deny?', 320, 190, 'security', 'any Deny statement', { icon: 'shield' }),
        n('allow', '4. Explicit allow?', 520, 190, 'security', 'identity / resource policy', { icon: 'shieldcheck', w: 150 }),
        n('implicit', '5. Implicit deny', 420, 300, 'security', 'default', { icon: 'lock' }),
        n('s3', 'Amazon S3', 740, 190, 'storage', 'company-reports'),
      ],
      edges: [e('d-a', 'dev', 'authn'), e('a-c', 'authn', 'ctx'), e('c-d', 'ctx', 'deny', { curve: -20 }), e('d-al', 'deny', 'allow', { label: 'no deny' }), e('al-s3', 'allow', 's3', { label: 'allowed' }), e('al-im', 'allow', 'implicit', { label: 'no allow' }), e('im-dev', 'implicit', 'dev', { dashed: true, label: 'AccessDenied' })],
      steps: [
        { title: 'Signed request', text: 'The CLI signs a PutObject request with the Developer’s access key (Signature Version 4).', packets: [p('d-a', 'blue', 'PutObject')], log: 'aws s3 cp report.pdf s3://company-reports/' },
        { title: 'Authentication', text: 'AWS verifies the signature. The principal is arn:aws:iam::111122223333:user/Developer.', focus: ['authn'], packets: [p('a-c', 'blue')] },
        { title: 'Build request context', text: 'Action = s3:PutObject, Resource = arn:aws:s3:::company-reports/report.pdf, plus conditions such as source IP, MFA, time.', focus: ['ctx'] },
        { title: 'Check for explicit Deny', text: 'IAM gathers all applicable policies (identity, resource, SCPs, boundaries). No statement explicitly denies this action.', packets: [p('c-d', 'blue')], focus: ['deny'] },
        { title: 'Check for an Allow', text: 'The only identity policy allows s3:GetObject and s3:ListBucket. Nothing matches s3:PutObject.', packets: [p('d-al', 'blue')], focus: ['allow'], set: { allow: 'warn' } },
        { title: 'Implicit deny', text: 'With no matching Allow, the default implicit deny applies. S3 is never touched.', packets: [p('al-im', 'red', 'no match')], set: { implicit: 'fail' } },
        { title: 'AccessDenied returned', text: 'The CLI receives "An error occurred (AccessDenied) when calling the PutObject operation". Try the interactive simulator below to see GetObject succeed.', packets: [p('im-dev', 'red', '403 AccessDenied')], log: 'AccessDenied: not authorized to perform s3:PutObject' },
      ],
    },
    {
      id: 'm3-assumerole',
      title: 'AssumeRole and temporary credentials',
      description: 'An EC2 instance uses a role to read from S3 without any stored keys.',
      width: 820,
      height: 340,
      nodes: [
        n('ec2', 'EC2 instance', 100, 170, 'compute', 'instance profile'),
        n('imds', 'Instance metadata', 300, 70, 'compute', 'IMDSv2', { icon: 'cpu' }),
        n('sts', 'AWS STS', 300, 270, 'security', 'AssumeRole', { icon: 'key' }),
        n('role', 'Role: AppReadS3', 520, 270, 'security', 'trust + permissions', { icon: 'shieldcheck', w: 140 }),
        n('s3', 'Amazon S3', 720, 170, 'storage'),
      ],
      edges: [e('e-m', 'ec2', 'imds'), e('m-s', 'imds', 'sts', { curve: 30 }), e('s-r', 'sts', 'role', { label: 'trust policy check' }), e('e-s3', 'ec2', 's3', { label: 'signed with temp creds' })],
      steps: [
        { title: 'Role attached via instance profile', text: 'The role’s trust policy allows the principal "ec2.amazonaws.com" to assume it; its permissions policy allows s3:GetObject.', focus: ['role'] },
        { title: 'SDK asks for credentials', text: 'The AWS SDK on the instance queries the instance metadata service (IMDSv2, session-token protected).', packets: [p('e-m', 'blue', 'GET credentials')] },
        { title: 'STS issues temporary credentials', text: 'AWS assumes the role on the instance’s behalf. STS checks the trust policy and returns AccessKeyId, SecretAccessKey, SessionToken and an Expiration.', packets: [p('m-s', 'orange'), p('s-r', 'orange', 'trusted?', { at: 0.35 })], focus: ['sts'] },
        { title: 'Credentials delivered', text: 'The credentials reach the SDK. They are rotated automatically before they expire – nothing is stored on disk or in code.', packets: [r('m-s', 'green', 'temp creds'), r('e-m', 'green', 'temp creds', { at: 0.4 })] },
        { title: 'Call S3', text: 'The SDK signs requests with the temporary credentials. IAM evaluates the role’s permissions and S3 returns the object.', packets: [p('e-s3', 'blue', 'GetObject', { span: 0.4 }), r('e-s3', 'green', '200 OK', { at: 0.45, span: 0.35 })], log: 'GetObject s3://app-config/settings.json → 200' },
      ],
    },
    {
      id: 'm3-identities',
      title: 'Users, groups, roles and policies',
      width: 820,
      height: 340,
      nodes: [
        n('alice', 'Alice', 80, 70, 'user', 'IAM user'),
        n('bob', 'Bob', 80, 170, 'user', 'IAM user'),
        n('grp', 'Group: Developers', 290, 120, 'security', 'members inherit', { icon: 'users', w: 140 }),
        n('pol', 'Policy: S3ReadOnly', 520, 120, 'security', 'managed policy', { icon: 'file', w: 140 }),
        n('lambda', 'Lambda function', 80, 280, 'compute', 'service'),
        n('role', 'Role: lambda-exec', 290, 280, 'security', 'assumed', { icon: 'shieldcheck', w: 140 }),
        n('pol2', 'Policy: DynamoDB write', 520, 280, 'security', 'customer managed', { icon: 'file', w: 150 }),
        n('res', 'AWS resources', 730, 200, 'storage', 'S3 / DynamoDB', { icon: 'layers' }),
      ],
      edges: [e('a-g', 'alice', 'grp'), e('b-g', 'bob', 'grp'), e('g-p', 'grp', 'pol', { label: 'attached' }), e('p-r', 'pol', 'res'), e('l-r', 'lambda', 'role', { label: 'assumes' }), e('r-p2', 'role', 'pol2', { label: 'attached' }), e('p2-r', 'pol2', 'res')],
      steps: [
        { title: 'Users join a group', text: 'Alice and Bob are added to the Developers group instead of getting individual policies.', packets: [p('a-g', 'blue'), p('b-g', 'blue', undefined, { at: 0.2 })], focus: ['grp'] },
        { title: 'Policy attached to group', text: 'A managed policy attached to the group gives every member the same permissions – easy to audit and change once.', packets: [p('g-p', 'purple')], focus: ['pol'] },
        { title: 'Permissions apply to resources', text: 'The policy grants read access to specific S3 resources.', packets: [p('p-r', 'green', 'allow')] },
        { title: 'Services use roles', text: 'A Lambda function assumes its execution role, receiving temporary credentials – no passwords or keys involved.', packets: [p('l-r', 'orange', 'assume'), p('r-p2', 'orange', undefined, { at: 0.35 }), p('p2-r', 'green', 'allow', { at: 0.6, span: 0.3 })], focus: ['role'] },
      ],
    },
  ],
  experiment: 'iam-simulator',
  experimentTitle: 'IAM policy simulator',
  experimentBlurb: 'The Developer user has an S3 read-only policy. Try reading, uploading and deleting objects – then edit the policy JSON and watch the evaluation change.',
  code: [
    {
      title: 'Identity-based policy: S3 read-only on one bucket',
      lang: 'json',
      code: S3_READ_ONLY_POLICY,
      notes: [
        { key: 'Version', text: 'Policy language version. Always use "2012-10-17" (the current version; older "2008-10-17" lacks features such as policy variables).' },
        { key: 'Statement', text: 'An array of one or more permission statements.' },
        { key: 'Sid', text: 'Optional statement ID – a label to help humans.' },
        { key: 'Effect', text: '"Allow" or "Deny". An explicit Deny always overrides any Allow.' },
        { key: 'Action', text: 'API operations in service:Operation form. Wildcards allowed, e.g. "s3:Get*". ListBucket applies to the bucket ARN; GetObject applies to object ARNs.' },
        { key: 'Resource', text: 'ARNs the statement applies to. The bucket (arn:aws:s3:::company-reports) and its objects (…/*) are different resources.' },
      ],
    },
    {
      title: 'Explicit deny with a condition (require MFA for deletes)',
      lang: 'json',
      code: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyDeleteWithoutMFA",
      "Effect": "Deny",
      "Action": "s3:DeleteObject",
      "Resource": "arn:aws:s3:::company-reports/*",
      "Condition": {
        "BoolIfExists": { "aws:MultiFactorAuthPresent": "false" }
      }
    }
  ]
}`,
      notes: [
        { key: 'Condition', text: 'Optional. The statement applies only when the condition is true. Here: deny deletes when MFA is not present.' },
        { key: 'BoolIfExists', text: 'Condition operator; "IfExists" makes it also match when the key is missing (e.g. long-term access-key requests).' },
      ],
    },
    {
      title: 'Role trust policy (who can assume the role)',
      lang: 'json',
      code: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ec2.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}`,
      notes: [{ key: 'Principal', text: 'Only resource-based policies (such as a role trust policy or bucket policy) contain a Principal – the entity the policy applies to.' }],
    },
  ],
  realWorld: {
    title: 'Giving a CI pipeline access without stored keys',
    story: 'A team used to store an IAM user’s access keys as CI secrets – until a key leaked in a log. They replaced it with an IAM role that trusts their CI provider via OpenID Connect (OIDC). Each pipeline run now assumes the role and gets credentials that expire after an hour, scoped to only the S3 bucket and ECS service it deploys.',
    points: ['No long-term secrets to leak or rotate', 'Trust policy conditions restrict which repository/branch can assume the role', 'CloudTrail logs every AssumeRole call'],
  },
  limits: ['IAM is eventually consistent: policy changes can take a few seconds to propagate.', 'A user can be a member of a limited number of groups (default 10).', 'Managed policy size is limited (6,144 characters); split large policies.'],
  summary: ['Every AWS API call is authenticated then authorized.', 'Users and groups for identities; roles for services, federation and cross-account access.', 'Explicit Deny beats Allow; no Allow means implicit Deny.', 'Prefer temporary credentials (roles, Identity Center) over long-term access keys.', 'Apply least privilege and enable MFA, especially on the root user.'],
  related: ['iam', 'sts', 'iam-identity-center', 'organizations'],
  quiz: [
    { q: 'A user has a policy allowing s3:* on a bucket, and the bucket policy explicitly denies s3:DeleteObject for that user. Can the user delete objects?', options: ['Yes, Allow s3:* covers it', 'No, an explicit Deny always overrides an Allow', 'Only from the console', 'Only if MFA is used'], answer: 1, explain: 'Explicit Deny in any applicable policy always wins over any Allow.' },
    { q: 'What is the best way to give an application running on EC2 access to DynamoDB?', options: ['Store an IAM user’s access keys in a config file', 'Attach an IAM role through an instance profile', 'Use the root user’s keys', 'Open the security group'], answer: 1, explain: 'Roles deliver automatically rotated temporary credentials via instance metadata – no stored secrets.' },
    { q: 'A request matches no Allow statement in any policy. What happens?', options: ['Allowed by default', 'Implicitly denied', 'Allowed for read actions only', 'IAM asks the root user'], answer: 1, explain: 'All requests are denied by default (implicit deny) unless explicitly allowed.' },
    { q: 'Which policy type can be reused across many users, groups and roles and supports versioning?', options: ['Inline policy', 'Customer managed policy', 'Trust policy', 'Session tag'], answer: 1, explain: 'Managed policies are standalone and reusable; customer managed policies keep up to five versions.' },
    { q: 'What does a role trust policy define?', options: ['Which actions the role can perform', 'Which principals are allowed to assume the role', 'The role’s password', 'The Region of the role'], answer: 1, explain: 'The trust policy (a resource-based policy on the role) lists the principals allowed to call sts:AssumeRole. The permissions policy defines what the role can do.' },
    { q: 'Authentication answers which question?', options: ['What may you do?', 'Who are you?', 'How much will it cost?', 'Where is the resource?'], answer: 1, explain: 'Authentication verifies identity; authorization decides permissions.' },
    { q: 'Do Service Control Policies (SCPs) grant permissions?', options: ['Yes, they grant permissions to all accounts', 'No, they only set the maximum available permissions', 'Only to the root user', 'Only for S3'], answer: 1, explain: 'SCPs are guardrails: they limit what identities in member accounts can do but never grant permissions by themselves.' },
  ],
  docs: [
    { label: 'IAM User Guide', url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html' },
    { label: 'Policy evaluation logic', url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html' },
    { label: 'IAM JSON policy elements', url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements.html' },
    { label: 'Security best practices in IAM', url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html' },
  ],
};

