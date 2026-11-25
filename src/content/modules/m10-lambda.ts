import type { LearningModule } from '../../types';
import { e, g, n, p, r } from '../../animation/builders';

export const serverless: LearningModule = {
  id: 'serverless',
  num: 10,
  title: 'Lambda and Serverless',
  short: 'Serverless',
  icon: 'zap',
  level: 'Intermediate',
  minutes: 45,
  intro:
    'Serverless means you build and run applications without provisioning or managing servers. AWS Lambda runs your function code in response to events – an HTTP request through API Gateway, a file landing in S3, a message in SQS, a schedule – and automatically scales from zero to thousands of concurrent executions. You pay per request and per millisecond of execution time (by memory size).',
  analogy: 'EC2 is owning a car: it costs money parked in the driveway. Lambda is a taxi: it appears when you call it, you pay for the ride, and a hundred taxis can show up if a hundred people call at once.',
  concepts: [
    { term: 'What is serverless?', body: 'There are still servers, but AWS manages them: no OS patching, no capacity planning, automatic scaling, built-in availability across AZs and pay-for-value pricing. Serverless services include Lambda, API Gateway, DynamoDB, S3, SQS, SNS, EventBridge, Step Functions and Fargate.' },
    { term: 'AWS Lambda', body: 'You upload code (zip or container image) for a supported runtime (Node.js, Python, Java, .NET, Ruby, or custom runtimes) and define a handler function. Lambda runs it in isolated execution environments (Firecracker micro-VMs).' },
    { term: 'Function execution', body: 'Lambda passes an event object (JSON) and a context object to your handler. Synchronous invocations (API Gateway) wait for the response; asynchronous invocations (S3, SNS, EventBridge) are queued and retried twice on error by default; event source mappings poll SQS, Kinesis and DynamoDB Streams.' },
    { term: 'Triggers', body: 'Event sources configured to invoke a function: API Gateway, ALB, S3 events, DynamoDB Streams, SQS, SNS, EventBridge rules and schedules, Kinesis, Cognito, CloudWatch Logs subscriptions and more.' },
    { term: 'Event-driven architecture', body: 'Components communicate by producing and reacting to events instead of calling each other directly. This decouples services: the producer does not need to know who consumes the event.' },
    { term: 'API Gateway', body: 'A managed front door for APIs. HTTP APIs (lower cost, lower latency, simpler) and REST APIs (more features: API keys, usage plans, request validation, caching) plus WebSocket APIs. Handles authentication (IAM, Cognito, Lambda authorisers, JWT), throttling and stages.' },
    { term: 'Lambda execution roles', body: 'An IAM role the function assumes when it runs. It grants the function permissions to call other services (e.g. dynamodb:PutItem) and to write logs to CloudWatch. A separate resource-based policy controls who can invoke the function.' },
    { term: 'Cold starts', body: 'When no idle execution environment exists, Lambda must create one: download code, start the runtime and run your initialisation code. This adds latency (from well under a second to several seconds for heavy runtimes). Warm environments are reused. Mitigations: smaller packages, provisioned concurrency, SnapStart (Java, Python, .NET).' },
    { term: 'Concurrency', body: 'The number of requests being processed at the same moment. Each environment handles one request at a time, so concurrency ≈ requests per second × average duration. Accounts have a Regional concurrency quota (default 1,000, can be raised). Reserved concurrency caps/guarantees a function; excess requests are throttled (429).' },
    { term: 'Timeout', body: 'Maximum run time per invocation: default 3 seconds, maximum 900 seconds (15 minutes). Long-running jobs should use Step Functions, ECS/Fargate or Batch.' },
    { term: 'Memory configuration', body: 'Set from 128 MB to 10,240 MB. CPU is allocated proportionally to memory (up to 6 vCPUs), so more memory can make a CPU-bound function faster and sometimes cheaper. Ephemeral /tmp storage is 512 MB to 10,240 MB.' },
  ],
  animations: [
    {
      id: 'm10-api',
      title: 'User → API Gateway → Lambda → DynamoDB',
      description: 'A cold start followed by a warm invocation',
      width: 840,
      height: 360,
      groups: [g('svc', 'Lambda service (managed, multi-AZ)', 340, 40, 260, 290, 'generic')],
      nodes: [
        n('user', 'Mobile app', 80, 180, 'user', 'POST /orders'),
        n('apigw', 'API Gateway', 230, 180, 'network', 'HTTP API', { w: 110 }),
        n('env1', 'Execution env 1', 470, 120, 'compute', 'Python 3.13', { icon: 'zap', w: 140 }),
        n('env2', 'Execution env 2', 470, 260, 'compute', 'Python 3.13', { icon: 'zap', w: 140 }),
        n('ddb', 'DynamoDB', 720, 180, 'database', 'Orders table'),
        n('cwl', 'CloudWatch Logs', 720, 300, 'monitoring', '/aws/lambda/…', { w: 130 }),
      ],
      edges: [e('u-a', 'user', 'apigw'), e('a-1', 'apigw', 'env1'), e('a-2', 'apigw', 'env2'), e('1-d', 'env1', 'ddb'), e('2-d', 'env2', 'ddb'), e('1-l', 'env1', 'cwl', { dashed: true })],
      initial: { env1: 'hidden', env2: 'hidden' },
      steps: [
        { title: 'Request arrives', text: 'API Gateway authenticates the caller (e.g. a JWT authoriser), applies throttling and maps the route POST /orders to the function.', packets: [p('u-a', 'blue', 'POST /orders')] },
        { title: 'Cold start', text: 'No warm environment exists, so Lambda creates one: downloads the code, starts the runtime, and runs the init code outside the handler (e.g. creating the DynamoDB client).', set: { env1: 'new' }, badges: { env1: 'INIT ~400ms' }, duration: 3200 },
        { title: 'Handler runs', text: 'The event (JSON with headers and body) is passed to handler(event, context). The function uses its execution role’s temporary credentials.', packets: [p('a-1', 'blue', 'event')], set: { env1: 'active' }, badges: { env1: 'INVOKE' } },
        { title: 'Write to DynamoDB', text: 'PutItem stores the order. Logs (print/console.log) stream to CloudWatch Logs automatically.', packets: [p('1-d', 'purple', 'PutItem', { span: 0.4 }), r('1-d', 'green', 'OK', { at: 0.45, span: 0.3 }), p('1-l', 'gray', 'log', { at: 0.2 })] },
        { title: 'Response returned', text: 'The handler returns { statusCode: 201 }. API Gateway sends it to the client. Billing = duration rounded up to 1 ms × memory.', packets: [r('a-1', 'green', '201', { span: 0.4 }), r('u-a', 'green', '201 Created', { at: 0.4, span: 0.4 })], set: { env1: 'ok' }, log: 'REPORT Duration: 42.1 ms Billed: 43 ms Memory: 512 MB Init Duration: 398 ms' },
        { title: 'Warm invocation', text: 'The next request reuses the warm environment – no init, so it is much faster.', packets: [p('u-a', 'blue', 'POST', { span: 0.25 }), p('a-1', 'blue', undefined, { at: 0.25, span: 0.25 }), p('1-d', 'purple', undefined, { at: 0.5, span: 0.2 }), r('u-a', 'green', '201', { at: 0.72, span: 0.2 })], badges: { env1: 'WARM 38ms' } },
        { title: 'Concurrent requests scale out', text: 'When two requests arrive at the same moment, the first environment is busy, so Lambda creates a second one (another cold start). Concurrency is now 2.', set: { env2: 'new' }, packets: [p('a-1', 'blue', undefined, { span: 0.5 }), p('a-2', 'blue', undefined, { at: 0.05, span: 0.5 })], badges: { env1: 'busy', env2: 'INIT' } },
      ],
    },
    {
      id: 'm10-s3',
      title: 'Event-driven: S3 upload triggers Lambda',
      width: 820,
      height: 320,
      nodes: [
        n('user', 'User', 80, 160, 'user'),
        n('s3in', 'S3 uploads/', 260, 160, 'storage', 'ObjectCreated'),
        n('fn', 'Thumbnail fn', 460, 160, 'compute', 'async invoke', { icon: 'zap' }),
        n('s3out', 'S3 thumbnails/', 680, 90, 'storage'),
        n('dlq', 'On-failure dest.', 680, 240, 'integration', 'SQS / SNS', { w: 130 }),
      ],
      edges: [e('u-s', 'user', 's3in', { label: 'PUT photo.jpg' }), e('s-f', 's3in', 'fn', { label: 'event' }), e('f-o', 'fn', 's3out'), e('f-d', 'fn', 'dlq', { dashed: true })],
      steps: [
        { title: 'Upload', text: 'A photo is uploaded to the uploads/ prefix.', packets: [p('u-s', 'blue', 'photo.jpg')] },
        { title: 'S3 emits an event', text: 'An event notification (s3:ObjectCreated:*) invokes the function asynchronously with the bucket and key.', packets: [p('s-f', 'orange', 'event')] },
        { title: 'Process and store', text: 'The function downloads the image, resizes it and writes the thumbnail to a different prefix (writing to the same prefix would trigger an infinite loop!).', packets: [p('f-o', 'green', 'thumb.jpg')] },
        { title: 'Failure handling', text: 'Async invocations are retried twice. If they still fail, the event goes to an on-failure destination or DLQ for inspection.', packets: [p('f-d', 'red', 'failed event')], focus: ['dlq'] },
      ],
    },
  ],
  experiment: 'lambda-simulator',
  experimentTitle: 'Lambda concurrency & cold start simulator',
  experimentBlurb: 'Trigger events, adjust request rate, duration, memory and reserved concurrency, and watch execution environments, cold starts and throttling.',
  code: [
    {
      title: 'Python handler writing to DynamoDB',
      lang: 'python',
      code: `import json, os, uuid
import boto3

# Init code: runs once per execution environment (cold start)
table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])

def handler(event, context):
    body = json.loads(event.get("body") or "{}")
    order = {"pk": f"ORDER#{uuid.uuid4()}", "item": body.get("item"), "qty": body.get("qty", 1)}
    table.put_item(Item=order)
    return {"statusCode": 201, "body": json.dumps(order)}`,
    },
    {
      title: 'Execution role permissions (least privilege)',
      lang: 'json',
      code: `{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "dynamodb:PutItem",
      "Resource": "arn:aws:dynamodb:eu-west-1:111122223333:table/Orders" },
    { "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "*" }
  ]
}`,
    },
  ],
  realWorld: {
    title: 'A startup’s API that costs almost nothing at night',
    story: 'A startup built its backend with API Gateway HTTP APIs, Lambda and DynamoDB on-demand. During a launch-day spike it scaled to hundreds of concurrent executions without anyone touching servers, and at night – with almost no traffic – the bill is close to zero. They set reserved concurrency on a function that writes to a legacy SQL database so it cannot open too many connections.',
    points: ['Scale-to-zero cost profile', 'Reserved concurrency protects downstream systems', 'Provisioned concurrency for latency-sensitive endpoints'],
  },
  limits: ['Maximum timeout 15 minutes.', 'Deployment package: 50 MB zipped (direct upload) / 250 MB unzipped; container images up to 10 GB.', 'Synchronous payload limit 6 MB.', 'Default Regional concurrency quota 1,000 (adjustable).'],
  summary: ['Lambda runs code on events; you pay per request and duration.', 'Concurrency ≈ RPS × duration; each environment handles one request at a time.', 'Cold starts happen when new environments are created.', 'Execution role = what the function can do; resource policy = who can invoke it.', 'API Gateway + Lambda + DynamoDB is the classic serverless web backend.'],
  related: ['lambda', 'api-gateway', 'dynamodb', 'sqs', 'eventbridge', 'cloudwatch'],
  quiz: [
    { q: 'A function averages 200 ms per request and receives 500 requests per second. Approximately what concurrency does it need?', options: ['5', '100', '500', '2,500'], answer: 1, explain: 'Concurrency ≈ 500 rps × 0.2 s = 100 concurrent executions.' },
    { q: 'What is the maximum timeout for a Lambda function?', options: ['30 seconds', '5 minutes', '15 minutes', '1 hour'], answer: 2, explain: 'Lambda functions can run for up to 900 seconds (15 minutes).' },
    { q: 'Which change gives a CPU-bound Lambda function more CPU?', options: ['Increase memory', 'Increase timeout', 'Add an environment variable', 'Enable X-Ray'], answer: 0, explain: 'Lambda allocates CPU in proportion to configured memory.' },
    { q: 'What grants a Lambda function permission to write to DynamoDB?', options: ['The function’s resource-based policy', 'The function’s execution role', 'The API Gateway stage', 'A security group'], answer: 1, explain: 'The execution role defines what the function can do. The resource-based policy defines who may invoke it.' },
    { q: 'How do you reduce cold-start latency for a critical endpoint?', options: ['Provisioned concurrency', 'Larger timeout', 'Reserved concurrency of 0', 'Use CloudTrail'], answer: 0, explain: 'Provisioned concurrency keeps initialised environments ready. (Reserved concurrency of 0 would throttle everything.)' },
  ],
  docs: [
    { label: 'AWS Lambda Developer Guide', url: 'https://docs.aws.amazon.com/lambda/latest/dg/welcome.html' },
    { label: 'Lambda concurrency', url: 'https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html' },
    { label: 'Lambda quotas', url: 'https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html' },
  ],
};
