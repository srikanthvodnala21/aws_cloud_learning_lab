import type { LearningModule } from '../../types';
import { e, g, n, p } from '../../animation/builders';

export const messaging: LearningModule = {
  id: 'messaging',
  num: 12,
  title: 'Messaging and Event-Driven Architecture',
  short: 'Messaging',
  icon: 'mail',
  level: 'Intermediate',
  minutes: 50,
  intro:
    'Messaging services let parts of a system communicate asynchronously so they can scale and fail independently. Amazon SQS is a queue (one consumer group pulls work), Amazon SNS is pub/sub (one message pushed to many subscribers), Amazon EventBridge is an event bus that routes events by content to targets, and Amazon Kinesis Data Streams handles ordered, replayable real-time streams.',
  analogy: 'SQS is a to-do pile on a desk – workers take one item at a time. SNS is a megaphone – everyone subscribed hears the announcement. EventBridge is a smart mail sorter – it reads each envelope and routes it to the right departments.',
  concepts: [
    { term: 'Amazon SQS', body: 'Fully managed message queues. Producers send messages; consumers poll (ReceiveMessage), process and then delete them. Messages are retained up to 14 days (default 4). Long polling (up to 20 s wait) reduces empty responses and cost.' },
    { term: 'Standard vs FIFO queues', body: 'Standard: nearly unlimited throughput, at-least-once delivery (rare duplicates) and best-effort ordering. FIFO: strict ordering within a message group and exactly-once processing (deduplication), with lower throughput (high-throughput mode available). FIFO queue names end in .fifo.' },
    { term: 'Message visibility timeout', body: 'When a consumer receives a message, it becomes invisible to others for the visibility timeout (default 30 s, max 12 h). If the consumer deletes it in time, it is gone; if not (crash, too slow), it becomes visible again and is redelivered.' },
    { term: 'Dead-letter queues (DLQ)', body: 'A redrive policy moves a message to a DLQ after it has been received maxReceiveCount times without being deleted – isolating "poison" messages for inspection instead of retrying forever. Redrive lets you move them back later.' },
    { term: 'Retry mechanisms', body: 'SQS retries implicitly via visibility timeout. Lambda async invocations retry twice and support on-failure destinations. SNS retries deliveries with backoff policies; EventBridge retries up to 24 hours by default and supports DLQs on targets. Make consumers idempotent because messages may be delivered more than once.' },
    { term: 'Amazon SNS', body: 'Publish/subscribe topics. A message published to a topic is pushed to all subscriptions: SQS queues, Lambda, HTTP/S endpoints, email, SMS, mobile push. Subscription filter policies deliver only matching messages. SNS + SQS (fan-out) gives each consumer its own durable queue.' },
    { term: 'Amazon EventBridge', body: 'A serverless event bus. AWS services, SaaS partners and your applications emit JSON events; rules match event patterns (source, detail-type, fields) and send events to targets (Lambda, SQS, Step Functions, API destinations, other buses). Also provides Scheduler and Pipes.' },
    { term: 'Amazon Kinesis Data Streams', body: 'Real-time streaming with shards. Records are ordered per partition key within a shard, retained (default 24 hours, up to 365 days) and can be read by multiple consumers and replayed – ideal for clickstreams, telemetry and log aggregation.' },
  ],
  animations: [
    {
      id: 'm12-sqs',
      title: 'SQS: producers, consumers, unavailable consumers and the DLQ',
      width: 840,
      height: 380,
      groups: [g('q', 'SQS queue: orders (visibility timeout 30 s, maxReceiveCount 3)', 220, 110, 360, 150, 'generic')],
      nodes: [
        n('prod', 'Producer', 80, 185, 'compute', 'web app'),
        n('m1', 'msg 1', 300, 185, 'integration', '', { w: 70, h: 40, icon: 'mail' }),
        n('m2', 'msg 2', 390, 185, 'integration', '', { w: 70, h: 40, icon: 'mail' }),
        n('m3', 'msg 3', 480, 185, 'integration', 'poison', { w: 80, h: 40, icon: 'mail' }),
        n('cons', 'Consumer', 720, 120, 'compute', 'worker'),
        n('dlq', 'DLQ', 720, 300, 'integration', 'orders-dlq', { icon: 'mail' }),
      ],
      edges: [e('p-q', 'prod', 'm1', { label: 'SendMessage' }), e('q-c', 'm2', 'cons', { label: 'ReceiveMessage' }), e('q-c3', 'm3', 'cons', { curve: 20 }), e('q-d', 'm3', 'dlq', { label: 'redrive' })],
      initial: { m1: 'hidden', m2: 'hidden', m3: 'hidden', cons: 'off' },
      steps: [
        { title: 'Producer sends messages', text: 'The web app sends orders to the queue and immediately returns to the user – it does not wait for processing.', packets: [p('p-q', 'blue', 'order', { span: 0.3 }), p('p-q', 'blue', 'order', { at: 0.25, span: 0.3 }), p('p-q', 'blue', 'order', { at: 0.5, span: 0.3 })], set: { m1: 'new', m2: 'new', m3: 'new' } },
        { title: 'Consumers unavailable', text: 'The worker fleet is down for a deployment. Messages simply wait in the queue (retained up to 14 days) – nothing is lost.', focus: ['q'], set: { m1: 'ok', m2: 'ok', m3: 'ok' }, badges: { m1: 'waiting', m2: 'waiting' } },
        { title: 'Consumer comes back and polls', text: 'The worker uses long polling to receive a batch. Received messages become invisible to other consumers for 30 s.', set: { cons: 'ok', m1: 'off', m2: 'off' }, packets: [p('q-c', 'blue', 'receive')] },
        { title: 'Process and delete', text: 'After successful processing the worker calls DeleteMessage. Messages 1 and 2 are gone for good.', set: { m1: 'hidden', m2: 'hidden' }, log: 'DeleteMessage ReceiptHandle=AQEB… (msg 1, msg 2)' },
        { title: 'A poison message', text: 'msg 3 has a malformed payload. The consumer crashes each time and never deletes it; after the visibility timeout it reappears. ReceiveCount: 1, 2, 3…', packets: [p('q-c3', 'red', 'try 1', { span: 0.25 }), p('q-c3', 'red', 'try 2', { at: 0.3, span: 0.25 }), p('q-c3', 'red', 'try 3', { at: 0.6, span: 0.25 })], set: { m3: 'warn' } },
        { title: 'Moved to the dead-letter queue', text: 'After maxReceiveCount (3) the redrive policy moves msg 3 to the DLQ. The main queue keeps flowing; an alarm on DLQ depth alerts the team.', packets: [p('q-d', 'red', 'msg 3')], set: { m3: 'hidden', dlq: 'fail' }, log: 'ApproximateNumberOfMessagesVisible(orders-dlq) = 1 → ALARM' },
      ],
    },
    {
      id: 'm12-sns',
      title: 'SNS publishes to multiple subscribers (fan-out)',
      width: 820,
      height: 360,
      nodes: [
        n('pub', 'Order service', 80, 180, 'compute', 'Publish'),
        n('topic', 'SNS topic', 280, 180, 'integration', 'order-placed'),
        n('q1', 'SQS: shipping', 540, 60, 'integration', 'own queue', { w: 130 }),
        n('q2', 'SQS: invoicing', 540, 160, 'integration', 'own queue', { w: 130 }),
        n('fn', 'Lambda: analytics', 540, 260, 'compute', '', { icon: 'zap', w: 140 }),
        n('mail', 'Email', 730, 330, 'user', 'filter: total > 1000', { icon: 'mail', w: 140 }),
      ],
      edges: [e('p-t', 'pub', 'topic'), e('t-1', 'topic', 'q1'), e('t-2', 'topic', 'q2'), e('t-3', 'topic', 'fn'), e('t-4', 'topic', 'mail', { dashed: true })],
      steps: [
        { title: 'One publish', text: 'The order service publishes one "order-placed" message. It does not know or care who listens.', packets: [p('p-t', 'blue', 'order 42')] },
        { title: 'Fan-out to every subscriber', text: 'SNS pushes a copy to each subscription in parallel – two SQS queues and a Lambda function.', packets: [p('t-1', 'purple', 'copy'), p('t-2', 'purple', 'copy', { at: 0.05 }), p('t-3', 'purple', 'copy', { at: 0.1 })] },
        { title: 'Filter policy', text: 'The email subscription has a filter policy {"total": [{"numeric": [">", 1000]}]}. This order is €80, so no email is sent.', packets: [p('t-4', 'gray', 'filtered', { dropAt: 0.3 })] },
        { title: 'Independent consumers', text: 'Shipping and invoicing process at their own pace from their own queues. Adding a new consumer = add a subscription, no change to the producer.', focus: ['q1', 'q2'] },
      ],
    },
    {
      id: 'm12-eb',
      title: 'EventBridge routes events to different targets',
      width: 820,
      height: 360,
      groups: [g('bus', 'Event bus: default', 230, 30, 260, 300, 'generic')],
      nodes: [
        n('ec2', 'EC2 state change', 90, 90, 'compute', 'aws.ec2', { w: 130 }),
        n('app', 'Your app', 90, 270, 'compute', 'com.shop.orders'),
        n('r1', 'Rule: instance stopped', 360, 90, 'integration', 'source=aws.ec2, state=stopped', { w: 200 }),
        n('r2', 'Rule: big orders', 360, 270, 'integration', 'detail.total > 1000', { w: 200 }),
        n('sns', 'SNS → on-call', 680, 90, 'integration'),
        n('sfn', 'Step Functions', 680, 210, 'integration', 'fraud check', { icon: 'workflow' }),
        n('sqs', 'SQS archive', 680, 310, 'integration'),
      ],
      edges: [e('e-r1', 'ec2', 'r1'), e('a-r2', 'app', 'r2'), e('r1-s', 'r1', 'sns'), e('r2-f', 'r2', 'sfn'), e('r2-q', 'r2', 'sqs'), e('a-r1', 'app', 'r1', { dashed: true })],
      steps: [
        { title: 'AWS service event', text: 'An EC2 instance stops. EC2 automatically emits an "EC2 Instance State-change Notification" event to the default bus.', packets: [p('e-r1', 'blue', 'stopped')] },
        { title: 'Pattern match → target', text: 'The rule’s event pattern matches source and state, so the event is sent to an SNS topic that pages on-call.', packets: [p('r1-s', 'orange', 'match')], focus: ['r1'] },
        { title: 'Custom application event', text: 'Your app puts an "OrderPlaced" event with total 1,500.', packets: [p('a-r2', 'purple', 'OrderPlaced'), p('a-r1', 'gray', 'no match', { dropAt: 0.5, at: 0.1 })] },
        { title: 'One rule, multiple targets', text: 'The big-orders rule matches and invokes two targets: a Step Functions fraud workflow and an SQS archive queue (up to 5 targets per rule).', packets: [p('r2-f', 'purple'), p('r2-q', 'purple', undefined, { at: 0.1 })] },
      ],
    },
  ],
  experiment: 'messaging-simulator',
  experimentTitle: 'SQS / SNS / EventBridge simulator',
  experimentBlurb: 'Run a live queue with producers, consumers, failure rates and a DLQ; fan out through SNS; and test EventBridge event patterns.',
  code: [
    {
      title: 'EventBridge event pattern',
      lang: 'json',
      code: `{
  "source": ["com.shop.orders"],
  "detail-type": ["OrderPlaced"],
  "detail": {
    "total": [{ "numeric": [">", 1000] }],
    "country": ["DE", "FR"]
  }
}`,
    },
    {
      title: 'SQS redrive policy (DLQ after 3 receives)',
      lang: 'json',
      code: `{
  "deadLetterTargetArn": "arn:aws:sqs:eu-west-1:111122223333:orders-dlq",
  "maxReceiveCount": "3"
}`,
    },
  ],
  realWorld: {
    title: 'Decoupling checkout from slow downstream systems',
    story: 'Checkout used to call shipping, invoicing and email synchronously – if any was slow, customers waited or saw errors. Now checkout publishes one SNS message; each downstream team owns an SQS queue subscribed to the topic, with its own DLQ and scaling. During an invoicing outage, messages simply piled up and were processed when it recovered.',
    points: ['Producers and consumers scale independently', 'Queues buffer spikes and outages', 'DLQs isolate poison messages'],
  },
  limits: ['Standard SQS can deliver duplicates – make processing idempotent.', 'Set the visibility timeout longer than the processing time (for Lambda, at least 6× the function timeout is recommended).', 'SNS does not store messages for later – subscribe an SQS queue for durability.'],
  summary: ['SQS = queue, pull, one consumer per message.', 'SNS = pub/sub, push, many subscribers.', 'EventBridge = content-based routing of events to targets.', 'Kinesis = ordered, replayable streams.', 'Visibility timeout and DLQs are the core reliability tools for SQS.'],
  related: ['sqs', 'sns', 'eventbridge', 'kinesis', 'lambda'],
  quiz: [
    { q: 'A message is received but the consumer crashes before deleting it. What happens?', options: ['It is lost', 'It becomes visible again after the visibility timeout', 'It moves to the DLQ immediately', 'SQS deletes it after 30 days'], answer: 1, explain: 'Unless deleted, the message reappears after the visibility timeout for another attempt.' },
    { q: 'Orders for the same customer must be processed in exact order. Which queue?', options: ['SQS Standard', 'SQS FIFO with MessageGroupId = customerId', 'SNS standard topic', 'S3 events'], answer: 1, explain: 'FIFO queues preserve order within a message group.' },
    { q: 'One event must trigger a shipping service, an invoicing service and an analytics function. Best pattern?', options: ['Three separate SQS sends from the producer', 'SNS topic fan-out (optionally to SQS queues)', 'One SQS queue shared by all three', 'CloudTrail'], answer: 1, explain: 'SNS pushes a copy to every subscriber; with SQS subscribers each consumer gets its own durable queue. A single shared queue would give each message to only one consumer.' },
    { q: 'What moves repeatedly failing messages out of the main queue?', options: ['Long polling', 'A redrive policy to a dead-letter queue', 'Message timers', 'Visibility timeout of 0'], answer: 1, explain: 'After maxReceiveCount receives, SQS moves the message to the configured DLQ.' },
    { q: 'You want to react when any EC2 instance in the account stops, without polling. Use…', options: ['EventBridge rule on EC2 state-change events', 'SQS long polling', 'A cron job on EC2', 'Route 53 health checks'], answer: 0, explain: 'AWS services emit events to the default EventBridge bus; a rule can match and route them.' },
  ],
  docs: [
    { label: 'Amazon SQS Developer Guide', url: 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html' },
    { label: 'Amazon SNS Developer Guide', url: 'https://docs.aws.amazon.com/sns/latest/dg/welcome.html' },
    { label: 'Amazon EventBridge User Guide', url: 'https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html' },
  ],
};
